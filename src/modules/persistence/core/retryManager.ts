/**
 * Gestionnaire de retry pour les tâches de persistance
 * Centralise la logique de retry, détection d'erreurs récupérables, et backoff exponentiel
 */

import type { PersistenceTask } from './types'
import { RETRY_DEFAULTS } from './constants'

/**
 * Configuration du retry avec backoff exponentiel
 */
export interface RetryConfig {
  /**
   * Nombre de tentatives maximum (défaut: RETRY_DEFAULTS.MAX_RETRIES)
   * retryCount = 0 : première tentative
   * retryCount = 1 : deuxième tentative (1er retry)
   * retryCount = 2 : troisième tentative (2ème retry)
   * retryCount = 3 : quatrième tentative (3ème retry) → STOP
   */
  maxRetries: number
  
  /**
   * Délai initial du premier retry en ms (défaut: RETRY_DEFAULTS.INITIAL_DELAY_MS)
   * C'est le délai avant le premier retry avec backoff exponentiel
   */
  initialDelay: number
  
  /**
   * Multiplicateur pour le backoff exponentiel (défaut: RETRY_DEFAULTS.MULTIPLIER)
   * Le délai augmente exponentiellement : initialDelay × multiplier^(retryCount-1)
   * Ex: 30s → 120s (2min) → 480s (8min) → 1920s (32min)...
   */
  multiplier: number
  
  /**
   * Délai maximum en ms (défaut: RETRY_DEFAULTS.MAX_DELAY_MS)
   * Limite le délai maximum entre deux tentatives
   */
  maxDelay?: number
}

/**
 * Configuration par défaut du retry
 * Utilise les constantes centralisées pour faciliter la maintenance
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: RETRY_DEFAULTS.MAX_RETRIES,
  initialDelay: RETRY_DEFAULTS.INITIAL_DELAY_MS,
  multiplier: RETRY_DEFAULTS.MULTIPLIER,
  maxDelay: RETRY_DEFAULTS.MAX_DELAY_MS
}

/**
 * Résultat de l'analyse d'une erreur (pour logging uniquement)
 */
export interface ErrorAnalysis {
  error: unknown
  httpStatus?: number
  code?: string
  message?: string
}

/**
 * Analyse une erreur pour extraire des informations utiles au logging
 * Ne détermine pas si l'erreur est récupérable (toujours géré par shouldRetry)
 */
export function analyzeError(error: unknown): ErrorAnalysis {
  // On catégorise les erreurs pour le logging et le debugging
  let code = 'UNKNOWN_ERROR'
  let httpStatus: number | undefined
  
  if (error && typeof error === 'object') {
    // Erreur Axios avec response
    if ('response' in error) {
      const axiosError = error as any
      httpStatus = axiosError.response?.status
      
      if (httpStatus) {
        if (httpStatus >= 500) {
          code = 'SERVER_ERROR'
        } else if (httpStatus >= 400) {
          code = 'CLIENT_ERROR'
        }
      }
    }
    
    // Erreur avec code
    if ('code' in error) {
      const errorCode = (error as any).code
      if (errorCode === 'ERR_NETWORK' || errorCode === 'ERR_CONNECTION_REFUSED' || errorCode === 'ERR_CONNECTION_ABORTED') {
        code = 'NETWORK_ERROR'
      } else if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT' || errorCode === 'TIMEOUT') {
        code = 'TIMEOUT'
      }
    }
  }
  
  // Erreurs réseau (TypeError avec fetch)
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
      code = 'NETWORK_ERROR'
    }
  }

  return {
    error,
    code,
    httpStatus,
    message: error instanceof Error ? error.message : String(error)
  }
}

/**
 * Calcule le délai de retry avec backoff exponentiel
 * 
 * Formule : delay = initialDelay × multiplier^(retryCount-1)
 * - retryCount = 1 => delay = initialDelay × multiplier^0 = initialDelay
 * - retryCount = 2 => delay = initialDelay × multiplier^1
 * - retryCount = 3 => delay = initialDelay × multiplier^2
 * 
 * Exemple avec initialDelay=RETRY_DEFAULTS.INITIAL_DELAY_MS (30s), multiplier=RETRY_DEFAULTS.MULTIPLIER (4):
 * - retryCount = 1 => delay = 30000 × 4^0 = 30000 (30s)
 * - retryCount = 2 => delay = 30000 × 4^1 = 120000 (2min)
 * - retryCount = 3 => delay = 30000 × 4^2 = 480000 (8min)
 * 
 * Le délai est limité à maxDelay si défini
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  if (retryCount === 0) {
    return 0
  }

  // Backoff exponentiel : delay = initialDelay × multiplier^(retryCount-1)
  const delay = config.initialDelay * Math.pow(config.multiplier, retryCount - 1)

  // Limiter au maxDelay si défini
  if (config.maxDelay !== undefined) {
    return Math.min(delay, config.maxDelay)
  }

  return delay
}

/**
 * Type partiel pour les méthodes de retry qui acceptent soit PersistenceTask
 * soit un objet avec retryCount et maxRetries (depuis les métadonnées)
 */
type TaskWithRetryInfo = Pick<PersistenceTask, 'id' | 'expiresAt'> & {
  retryCount: number
  maxRetries: number
}

/**
 * Gestionnaire de retry centralisé
 */
export class RetryManager {
  private config: RetryConfig

  constructor(config?: RetryConfig | Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...(config || {}) }
  }

  /**
   * Détermine si une tâche doit être retentée
   * Accepte soit PersistenceTask soit un objet avec retryCount/maxRetries depuis les métadonnées
   */
  shouldRetry(error: unknown, task: TaskWithRetryInfo): boolean {
    // 1. Vérifier l'expiration de la tâche
    if (task.expiresAt && Date.now() > task.expiresAt) {
      console.log(`[RetryManager] Task ${task.id} expired, not retrying`)
      return false
    }

    // 2. Limiter le nombre total de tentatives
    // retryCount = 0 : première tentative
    // retryCount = 1 : deuxième tentative (1er retry)
    // retryCount = 2 : troisième tentative (2ème retry)
    // retryCount = 3 : quatrième tentative (3ème retry) → STOP
    // Donc pour 3 tentatives max, on s'arrête quand retryCount >= 3
    if (task.retryCount >= task.maxRetries) {
      console.log(`[RetryManager] Task ${task.id} reached max retries (${task.maxRetries}), not retrying`)
      return false
    }

    return true
  }

  /**
   * Calcule le délai avant le prochain retry
   * Accepte soit PersistenceTask soit un objet avec retryCount depuis les métadonnées
   */
  calculateDelay(task: Pick<PersistenceTask, 'id'> & { retryCount: number }): number {
    return calculateRetryDelay(task.retryCount, this.config)
  }

  /**
   * Analyse une erreur
   */
  analyzeError(error: unknown): ErrorAnalysis {
    return analyzeError(error)
  }

  /**
   * Retourne la configuration actuelle
   */
  getConfig(): Readonly<RetryConfig> {
    return { ...this.config }
  }
}


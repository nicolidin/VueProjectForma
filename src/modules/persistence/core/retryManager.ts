/**
 * Gestionnaire de retry pour les tâches de persistance
 * Centralise la logique de retry, détection d'erreurs récupérables, et backoff exponentiel
 */

import type { PersistenceTask } from './types'

/**
 * Configuration du retry avec backoff exponentiel
 */
export interface RetryConfig {
  /**
   * Nombre de tentatives maximum (défaut: 3)
   * retryCount = 0 : première tentative
   * retryCount = 1 : deuxième tentative (1er retry)
   * retryCount = 2 : troisième tentative (2ème retry)
   * retryCount = 3 : quatrième tentative (3ème retry) → STOP
   */
  maxRetries: number
  
  /**
   * Nombre de retries rapides avant le backoff exponentiel (défaut: 0)
   * Si 0, on commence directement avec le backoff exponentiel
   */
  maxFastRetries: number
  
  /**
   * Délai initial pour les retries rapides en ms (défaut: 2000 = 2 secondes)
   * Non utilisé si maxFastRetries = 0
   */
  initialDelay: number
  
  /**
   * Délai initial pour le backoff exponentiel en ms (défaut: 240000 = 4 minutes)
   * C'est le délai avant le premier retry avec backoff exponentiel
   */
  exponentialBackoffInitialDelay: number
  
  /**
   * Multiplicateur pour le backoff exponentiel (défaut: 4)
   * Ex: 4min → 16min → 64min → 256min...
   */
  backoffMultiplier: number
  
  /**
   * Délai maximum en ms (défaut: 6000000 = 100 minutes)
   * Limite le délai maximum entre deux tentatives
   */
  maxDelay: number
}

/**
 * Configuration par défaut du retry
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3, // 3 tentatives maximum
  maxFastRetries: 0, // Pas de retries rapides, on commence directement avec le backoff exponentiel
  initialDelay: 2000, // 2 secondes (non utilisé car maxFastRetries = 0)
  exponentialBackoffInitialDelay: 240000, // 4 minutes pour le premier backoff
  backoffMultiplier: 4, // Multiplicateur de 4 : 4min → 16min → 64min → 100min (max)
  maxDelay: 6000000 // 100 minutes maximum
}

/**
 * Résultat de l'analyse d'une erreur
 */
export interface ErrorAnalysis {
  isRetryable: boolean
  error: unknown
  httpStatus?: number
  code?: string
  message?: string
}

/**
 * Analyse une erreur pour déterminer si elle est récupérable
 */
export function analyzeError(error: unknown): ErrorAnalysis {
  // Erreurs réseau (TypeError avec fetch, NetworkError, etc.)
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    if (message.includes('fetch') || message.includes('network') || message.includes('failed to fetch')) {
      return {
        isRetryable: true,
        error,
        code: 'NETWORK_ERROR',
        message: error.message
      }
    }
  }

  // Erreurs Axios (si utilisé)
  if (error && typeof error === 'object') {
    // Erreur Axios avec response
    if ('response' in error) {
      const axiosError = error as any
      const status = axiosError.response?.status
      
      // Erreurs serveur (5xx) : retryable
      if (status >= 500 && status < 600) {
        return {
          isRetryable: true,
          error,
          httpStatus: status,
          code: 'SERVER_ERROR',
          message: axiosError.response?.data?.message || `HTTP ${status}`
        }
      }
      
      // Erreurs client (4xx) : généralement non retryable
      if (status >= 400 && status < 500) {
        // Mais certaines erreurs 4xx peuvent être retryables
        // 408 Request Timeout : retryable
        // 429 Too Many Requests : retryable (avec backoff)
        if (status === 408 || status === 429) {
          return {
            isRetryable: true,
            error,
            httpStatus: status,
            code: status === 408 ? 'TIMEOUT' : 'RATE_LIMIT',
            message: axiosError.response?.data?.message || `HTTP ${status}`
          }
        }
        
        // Autres 4xx : non retryable
        return {
          isRetryable: false,
          error,
          httpStatus: status,
          code: 'CLIENT_ERROR',
          message: axiosError.response?.data?.message || `HTTP ${status}`
        }
      }
    }
    
    // Erreur avec code (timeout, etc.)
    if ('code' in error) {
      const code = (error as any).code
      if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'TIMEOUT') {
        return {
          isRetryable: true,
          error,
          code: 'TIMEOUT',
          message: (error as any).message || 'Request timeout'
        }
      }
    }
    
    // Erreur avec message de timeout
    if ('message' in error) {
      const message = String((error as any).message).toLowerCase()
      if (message.includes('timeout') || message.includes('aborted')) {
        return {
          isRetryable: true,
          error,
          code: 'TIMEOUT',
          message: (error as any).message
        }
      }
    }
  }

  // Par défaut : non retryable (erreur inconnue)
  return {
    isRetryable: false,
    error,
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : String(error)
  }
}

/**
 * Calcule le délai de retry avec backoff exponentiel
 * 
 * - Si maxFastRetries > 0 : pour les N premières tentatives, délai fixe (initialDelay)
 * - Sinon ou après maxFastRetries : backoff exponentiel (exponentialBackoffInitialDelay * multiplier^attempts)
 * - Limité à maxDelay
 * 
 * Exemple avec maxFastRetries=0, exponentialBackoffInitialDelay=240000 (4min), multiplier=4:
 * - retryCount = 1 => delay = 240000 * 4^0 = 240000 (4min)
 * - retryCount = 2 => delay = 240000 * 4^1 = 960000 (16min)
 * - retryCount = 3 => delay = 240000 * 4^2 = 3840000 (64min) mais limité à maxDelay
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  if (retryCount === 0) {
    return 0
  }

  // Retries rapides : délai fixe (si maxFastRetries > 0)
  if (config.maxFastRetries > 0 && retryCount <= config.maxFastRetries) {
    return config.initialDelay
  }

  // Backoff exponentiel
  // Si maxFastRetries = 0, on commence directement avec le backoff
  // retryCount = 1 => exponentialAttempts = 1 => delay = exponentialBackoffInitialDelay * multiplier^0 = exponentialBackoffInitialDelay
  // retryCount = 2 => exponentialAttempts = 2 => delay = exponentialBackoffInitialDelay * multiplier^1
  // retryCount = 3 => exponentialAttempts = 3 => delay = exponentialBackoffInitialDelay * multiplier^2
  const exponentialAttempts = config.maxFastRetries > 0 
    ? retryCount - config.maxFastRetries 
    : retryCount
  const delay = config.exponentialBackoffInitialDelay * Math.pow(config.backoffMultiplier, exponentialAttempts - 1)

  // Limiter au maxDelay
  return Math.min(delay, config.maxDelay)
}

/**
 * Gestionnaire de retry centralisé
 */
export class RetryManager {
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  /**
   * Détermine si une tâche doit être retentée
   */
  shouldRetry(error: unknown, task: PersistenceTask): boolean {
    // 1. Analyser l'erreur pour déterminer si elle est récupérable
    const analysis = analyzeError(error)
    if (!analysis.isRetryable) {
      console.log(`[RetryManager] Error not retryable for task ${task.id}:`, {
        code: analysis.code,
        message: analysis.message,
        httpStatus: analysis.httpStatus
      })
      return false
    }

    // 2. Vérifier l'expiration de la tâche
    if (task.expiresAt && Date.now() > task.expiresAt) {
      console.log(`[RetryManager] Task ${task.id} expired, not retrying`)
      return false
    }

    // 3. Limiter le nombre total de tentatives
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
   */
  calculateDelay(task: PersistenceTask): number {
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


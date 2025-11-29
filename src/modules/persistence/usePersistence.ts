/**
 * Composable Vue pour gérer la persistance générique
 * Initialise EventBus, PersistedQueueManager et Orchestrator
 * Écoute les événements de persistance pour mettre à jour le store
 */

import { EventBus } from './core/eventBus'
import { PersistedQueueManager } from './persisting/queue'
import { PersistenceOrchestrator, type OrchestratorOptions } from './core/orchestrator'
import type { PersistenceEvents, PersistenceStrategy, TaskPriority } from './core/types'
import type { RetryConfig } from './core/retryManager'
import { initPersistenceQueueStore } from './persisting/store'
import { SyncAdaptersManager, type SyncAdapter } from './sync/syncAdapters'

/**
 * Configuration des stratégies de persistance
 * Permet d'enregistrer des stratégies pour chaque type d'entité
 */
export interface PersistenceStrategies {
  [entityType: string]: PersistenceStrategy<unknown>
}

/**
 * Options de configuration pour le système de persistance
 */
export interface PersistenceOptions {
  /**
   * Priorité par défaut pour toutes les tâches (défaut: NORMAL)
   */
  defaultPriority?: TaskPriority
  /**
   * Durée de vie maximale d'une tâche en ms (optionnel)
   * Si défini, les tâches expireront après cette durée
   * Ex: 7 jours = 7 * 24 * 60 * 60 * 1000 = 604800000
   */
  defaultMaxAge?: number
  /**
   * Configuration du retry globale (timing, backoff exponentiel, nombre de tentatives)
   * Si non défini, utilise la configuration par défaut :
   * - maxRetries: 3
   * - initialDelay: 30000 (30 secondes)
   * - multiplier: 4
   * - maxDelay: 600000 (10 minutes)
   * Séquence : 30s → 120s (2min) → 480s (8min) → 1920s (32min, limité à 10min)
   */
  retryConfig?: Partial<RetryConfig>
  /**
   * Configuration du retry spécifique par type d'entité
   * Permet d'override la configuration globale pour certains types d'entités
   * Ex: { note: { maxRetries: 5 }, tag: { maxRetries: 2 } }
   */
  retryConfigByEntityType?: {
    [entityType: string]: Partial<RetryConfig>
  }
}

/**
 * Configuration complète pour initialiser le système de persistance
 */
export interface PersistenceConfig {
  /**
   * Les stratégies de persistance à enregistrer pour chaque type d'entité
   */
  strategies: PersistenceStrategies
  /**
   * Options de configuration (retries, priorités, etc.)
   */
  options?: PersistenceOptions
  /**
   * Adapters de synchronisation pour mettre à jour les stores après persistance
   * Les stores exposent ces adapters qui sont ensuite enregistrés ici
   */
  syncAdapters?: Array<SyncAdapter>
}

/**
 * EventBus global pour la persistance
 * Créé dès le chargement du module pour être disponible avant l'initialisation du service
 * Permet aux stores d'accéder à l'eventBus même si usePersistence() n'a pas encore été appelé
 */
const persistenceEventBus = new EventBus<PersistenceEvents>()

/**
 * Service centralisé de persistance
 * Encapsule tout l'état et la logique d'initialisation
 * Respecte le principe SOC en centralisant la gestion d'état
 */
class PersistenceService {
  private readonly queue: PersistedQueueManager
  private readonly orchestrator: PersistenceOrchestrator
  private readonly syncAdaptersManager: SyncAdaptersManager
  private initialized = false

  /**
   * Crée une nouvelle instance du service de persistance
   * @param config - Configuration complète ou simplement les stratégies (rétrocompatibilité)
   */
  constructor(config?: PersistenceConfig | PersistenceStrategies) {
    console.log('[PersistenceService] Creating persistence service...')

    // Initialiser et valider le store de queue (doit être fait après Pinia est prêt)
    initPersistenceQueueStore()

    // Extraire les stratégies et options selon le format passé
    const { strategies, options } = this.normalizeConfig(config)

    // Utiliser l'eventBus global (créé au chargement du module)
    // Cela permet aux stores d'y accéder même avant l'initialisation du service

    // Créer la queue avec la config retryConfig si fournie
    this.queue = new PersistedQueueManager({
      retryConfig: options?.retryConfig
    })
    console.log('[PersistenceService] Queue created with retryConfig:', options?.retryConfig)

    // Préparer les options pour l'orchestrateur
    const orchestratorOptions: OrchestratorOptions = {
      defaultPriority: options?.defaultPriority,
      defaultMaxAge: options?.defaultMaxAge,
      retryConfig: options?.retryConfig,
      retryConfigByEntityType: options?.retryConfigByEntityType
    }

    // Créer l'orchestrateur
    console.log('[PersistenceService] Creating orchestrator with options:', orchestratorOptions)
    this.orchestrator = new PersistenceOrchestrator(
      persistenceEventBus,
      this.queue,
      orchestratorOptions
    )

    // Enregistrer les stratégies pour chaque type d'entité si fournies
    if (strategies) {
      for (const [entityType, strategy] of Object.entries(strategies)) {
        this.orchestrator.registerStrategy(entityType, strategy)
        console.log(`[PersistenceService] Strategy registered for entity type: ${entityType}`)
      }
    }

    // Initialiser le processeur APRÈS l'enregistrement des stratégies
    // Cela évite la race condition où le traitement démarre avant que les stratégies soient prêtes
    this.orchestrator.initializeProcessor()
    console.log('[PersistenceService] Orchestrator created and processor initialized')

    // Créer le gestionnaire de sync adapters
    this.syncAdaptersManager = new SyncAdaptersManager(persistenceEventBus)
    console.log('[PersistenceService] SyncAdaptersManager created')

    // Enregistrer les adapters si fournis
    if (config && 'syncAdapters' in config && config.syncAdapters) {
      this.syncAdaptersManager.registerAll(config.syncAdapters)
      console.log(`[PersistenceService] ${config.syncAdapters.length} sync adapter(s) registered`)
    }

    // Démarrer le traitement si des tâches sont en attente
    const initialQueueSize = this.queue.size()
    console.log('[PersistenceService] Initial queue size:', initialQueueSize)
    if (initialQueueSize > 0) {
      console.log('[PersistenceService] Starting queue processing for', initialQueueSize, 'pending tasks')
      this.queue.restart()
    }

    this.initialized = true
    console.log('[PersistenceService] Persistence service initialized successfully')
  }

  /**
   * Normalise la configuration pour supporter les deux formats (nouveau et ancien)
   * @private
   */
  private normalizeConfig(
    config?: PersistenceConfig | PersistenceStrategies
  ): { strategies?: PersistenceStrategies; options?: PersistenceOptions } {
    if (!config) {
      return {}
    }

    // Nouveau format : { strategies: {...}, options: {...} }
    if ('strategies' in config) {
      return {
        strategies: config.strategies,
        options: config.options
      }
    }

    // Ancien format (rétrocompatibilité) : juste les stratégies
    return { strategies: config }
  }

  /**
   * Vérifie si le service est initialisé
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Retourne l'event bus (pour utilisation dans les stores)
   */
  getEventBus(): EventBus<PersistenceEvents> {
    return persistenceEventBus
  }

  /**
   * Retourne la queue
   */
  getQueue(): PersistedQueueManager {
    return this.queue
  }

  /**
   * Retourne l'orchestrateur
   */
  getOrchestrator(): PersistenceOrchestrator {
    return this.orchestrator
  }

  /**
   * Retourne le gestionnaire de sync adapters
   */
  getSyncAdaptersManager(): SyncAdaptersManager {
    return this.syncAdaptersManager
  }

  /**
   * Nettoie les ressources (utile pour les tests)
   */
  destroy(): void {
    console.log('[PersistenceService] Destroying persistence service...')
    this.orchestrator.destroy()
    this.queue.stop()
    // Note: syncAdaptersManager n'a pas de méthode destroy, mais on peut le laisser au GC
    console.log('[PersistenceService] Persistence service destroyed')
  }
}

/**
 * Instance singleton du service de persistance
 * @private
 */
let serviceInstance: PersistenceService | null = null

/**
 * Composable pour initialiser le système de persistance
 * Doit être appelé une seule fois au niveau de l'application (App.vue)
 * Doit être appelé APRÈS l'initialisation de Pinia
 * 
 * @param config - Configuration complète (stratégies + options) ou simplement les stratégies (rétrocompatibilité)
 * @returns L'instance du service de persistance
 */
export function usePersistence(
  config?: PersistenceConfig | PersistenceStrategies
): PersistenceService {
  // Si le service existe déjà, on le retourne (singleton)
  // Note: Si une config est fournie alors que le service existe déjà,
  // on ignore la nouvelle config (comportement singleton classique)
  if (serviceInstance) {
    console.log('[usePersistence] Service already initialized, returning existing instance')
    return serviceInstance
  }

  // Créer une nouvelle instance
  serviceInstance = new PersistenceService(config)
  return serviceInstance
}

/**
 * Retourne l'instance de l'event bus (pour utilisation dans les stores)
 * L'eventBus est toujours disponible, même si le service n'est pas encore initialisé
 * Cela permet aux stores de s'initialiser avant usePersistence()
 */
export function getPersistenceEventBus(): EventBus<PersistenceEvents> {
  return persistenceEventBus
}

/**
 * Retourne l'instance du service (pour utilisation avancée)
 * @throws Error si le service n'est pas encore initialisé
 */
export function getPersistenceService(): PersistenceService {
  if (!serviceInstance) {
    throw new Error(
      'PersistenceService not initialized. Call usePersistence() first.'
    )
  }
  return serviceInstance
}

/**
 * Réinitialise le service (utile pour les tests uniquement)
 * ⚠️ Ne pas utiliser en production
 * @internal
 */
export function resetPersistenceService(): void {
  if (serviceInstance) {
    serviceInstance.destroy()
  }
  serviceInstance = null
  console.log('[usePersistence] Service reset (for testing only)')
}

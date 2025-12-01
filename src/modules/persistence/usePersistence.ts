/**
 * Composable Vue pour gérer la persistance générique
 * Initialise EventBus, PersistedQueueManager et Orchestrator
 * Écoute les événements de persistance pour mettre à jour le store
 */

import { EventBus } from './core/eventBus'
import { PersistedQueueManager } from './queue'
import { PersistenceOrchestrator } from './core/orchestrator'
import type { PersistenceEvents, PersistenceStrategy } from './core/types'
import type { RetryConfig } from './core/retryManager'
import { DEFAULT_RETRY_CONFIG } from './core/retryManager'
import { initPersistenceQueueStore } from './queue/store'
import { SyncAdaptersManager, type SyncAdapter } from './sync/syncAdapters'

/**
 * EventBus global pour la persistance
 * 
 * IMPORTANT : Cet EventBus est créé au chargement du module (avant toute initialisation)
 * pour permettre aux stores Pinia d'y accéder même si usePersistence() n'a pas encore été appelé.
 * 
 * Problème résolu : Les stores Pinia peuvent s'initialiser avant usePersistence() dans App.vue.
 * Sans cet EventBus global, les stores lanceraient une erreur lors de leur setup.
 * 
 * Le service utilise ce même EventBus global (pas de duplication, juste un partage).
 */
const persistenceEventBus = new EventBus<PersistenceEvents>()

/**
 * Configuration des stratégies de persistance
 * Permet d'enregistrer des stratégies pour chaque type d'entité
 */
export interface PersistenceStrategies {
  [entityType: string]: PersistenceStrategy<unknown>
}

/**
 * Configuration simplifiée pour initialiser le système de persistance
 */
export interface PersistenceConfig {
  /**
   * Les stratégies de persistance à enregistrer pour chaque type d'entité (obligatoire)
   */
  strategies: PersistenceStrategies
  
  /**
   * Configuration du retry (optionnel, utilise les defaults sinon)
   * Une seule config globale pour tout le système
   */
  retryConfig?: Partial<RetryConfig>
  
  /**
   * Adapters de synchronisation pour mettre à jour les stores après persistance (optionnel)
   * Les stores exposent ces adapters qui sont ensuite enregistrés ici
   */
  syncAdapters?: Array<SyncAdapter>
}

/**
 * Service centralisé de persistance
 * Encapsule tout l'état et la logique d'initialisation
 */
class PersistenceService {
  private readonly eventBus: EventBus<PersistenceEvents>
  private readonly queue: PersistedQueueManager
  private readonly orchestrator: PersistenceOrchestrator
  private readonly syncAdaptersManager: SyncAdaptersManager
  private readonly retryConfig: RetryConfig

  /**
   * Crée une nouvelle instance du service de persistance
   * @param config - Configuration du système de persistance
   */
  constructor(config: PersistenceConfig) {
    console.log('[PersistenceService] Creating persistence service...')

    // Initialiser et valider le store de queue (doit être fait après Pinia est prêt)
    initPersistenceQueueStore()

    // Utiliser l'EventBus global (créé au chargement du module)
    // Cela permet aux stores d'y accéder même avant l'initialisation du service
    this.eventBus = persistenceEventBus

    // Créer la config retry une seule fois
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...(config.retryConfig || {}) }

    // Queue : a besoin de toute la config (pour RetryManager)
    this.queue = new PersistedQueueManager(this.retryConfig)
    console.log('[PersistenceService] Queue created with retryConfig:', this.retryConfig)

    // Orchestrator : a besoin seulement de maxRetries
    this.orchestrator = new PersistenceOrchestrator(
      this.eventBus,
      this.queue,
      this.retryConfig.maxRetries
    )

    // Enregistrer les stratégies pour chaque type d'entité
    for (const [entityType, strategy] of Object.entries(config.strategies)) {
      this.orchestrator.registerStrategy(entityType, strategy)
      console.log(`[PersistenceService] Strategy registered for entity type: ${entityType}`)
    }

    // Initialiser le processeur APRÈS l'enregistrement des stratégies
    // Cela évite la race condition où le traitement démarre avant que les stratégies soient prêtes
    this.orchestrator.initializeProcessor()
    console.log('[PersistenceService] Orchestrator created and processor initialized')

    // Créer et enregistrer les sync adapters
    this.syncAdaptersManager = new SyncAdaptersManager(this.eventBus)
    if (config.syncAdapters && config.syncAdapters.length > 0) {
      this.syncAdaptersManager.registerAll(config.syncAdapters)
      console.log(`[PersistenceService] ${config.syncAdapters.length} sync adapter(s) registered`)
    }

    // Démarrer le traitement si des tâches sont en attente
    // Le store Pinia est déjà hydraté de manière synchrone par le plugin,
    // donc on peut vérifier immédiatement la taille de la queue
    const initialQueueSize = this.queue.size()
    console.log('[PersistenceService] Initial queue size:', initialQueueSize)
    if (initialQueueSize > 0) {
      console.log('[PersistenceService] Starting queue processing for', initialQueueSize, 'pending tasks')
      this.queue.restart()
    } else {
      console.log('[PersistenceService] No pending tasks, processor ready for future tasks')
    }

    console.log('[PersistenceService] Persistence service initialized successfully')
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
 * @param config - Configuration du système de persistance
 * @returns L'instance du service de persistance
 */
export function usePersistence(config: PersistenceConfig): PersistenceService {
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
 * 
 * IMPORTANT : Cette fonction est toujours disponible, même si usePersistence() n'a pas encore été appelé.
 * L'EventBus global est créé au chargement du module, permettant aux stores Pinia de s'initialiser
 * avant que le service ne soit créé dans App.vue.
 * 
 * Si des événements sont émis avant l'initialisation du service, ils seront simplement ignorés
 * (pas de listeners encore enregistrés). C'est un comportement attendu et sans danger.
 */
export function getPersistenceEventBus(): EventBus<PersistenceEvents> {
  return persistenceEventBus
}


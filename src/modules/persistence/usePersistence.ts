/**
 * Composable Vue pour gérer la persistance générique
 * Initialise EventBus, PersistedQueueManager et Orchestrator
 * Écoute les événements de persistance pour mettre à jour le store
 */

import { onUnmounted } from 'vue'
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
 * Instance globale de l'event bus pour la persistance
 */
export const persistenceEventBus = new EventBus<PersistenceEvents>()

/**
 * Instance globale de la queue persistée pour la persistance
 * Utilise le store Pinia pour persister automatiquement dans localStorage
 * Sera initialisée avec la config retryConfig si fournie dans usePersistence
 */
let persistenceQueue: PersistedQueueManager | null = null

/**
 * Instance globale de l'orchestrateur
 */
let orchestrator: PersistenceOrchestrator | null = null

/**
 * Instance globale du gestionnaire de sync adapters
 */
let syncAdaptersManager: SyncAdaptersManager | null = null

/**
 * Composable pour initialiser le système de persistance
 * Doit être appelé une seule fois au niveau de l'application (App.vue)
 * Doit être appelé APRÈS l'initialisation de Pinia
 * 
 * @param config - Configuration complète (stratégies + options) ou simplement les stratégies (rétrocompatibilité)
 */
export function usePersistence(
  config?: PersistenceConfig | PersistenceStrategies
) {
  console.log('[usePersistence] Initializing persistence system...')
  
  // Initialiser et valider le store de queue (doit être fait après Pinia est prêt)
  initPersistenceQueueStore()

  // Extraire les stratégies et options selon le format passé
  let strategies: PersistenceStrategies | undefined
  let options: PersistenceOptions | undefined

  if (config) {
    // Nouveau format : { strategies: {...}, options: {...} }
    if ('strategies' in config) {
      strategies = config.strategies
      options = config.options
    } else {
      // Ancien format (rétrocompatibilité) : juste les stratégies
      strategies = config
    }
  }

  // Créer la queue avec la config retryConfig si fournie
  if (!persistenceQueue) {
    persistenceQueue = new PersistedQueueManager({
      retryConfig: options?.retryConfig
    })
    console.log('[usePersistence] PersistenceQueue created with retryConfig:', options?.retryConfig)
  }

  // Créer l'orchestrateur si pas déjà créé
  if (!orchestrator) {

    // Préparer les options pour l'orchestrateur
    const orchestratorOptions: OrchestratorOptions = {
      defaultPriority: options?.defaultPriority,
      defaultMaxAge: options?.defaultMaxAge,
      retryConfig: options?.retryConfig,
      retryConfigByEntityType: options?.retryConfigByEntityType
    }

    console.log('[usePersistence] Creating orchestrator with options:', orchestratorOptions)
    orchestrator = new PersistenceOrchestrator(persistenceEventBus, persistenceQueue, orchestratorOptions)

    // Enregistrer les stratégies pour chaque type d'entité si fournies
    if (strategies) {
      for (const [entityType, strategy] of Object.entries(strategies)) {
        orchestrator.registerStrategy(entityType, strategy)
        console.log(`[usePersistence] Strategy registered for entity type: ${entityType}`)
      }
    }
    
    console.log('[usePersistence] Strategies registered')
    
    // Initialiser le processeur APRÈS l'enregistrement des stratégies
    // Cela évite la race condition où le traitement démarre avant que les stratégies soient prêtes
    orchestrator.initializeProcessor()
    
    console.log('[usePersistence] Orchestrator created and processor initialized')
    console.log('[usePersistence] Initial queue size:', persistenceQueue.size())
    
    // Démarrer le traitement si des tâches sont en attente
    if (persistenceQueue.size() > 0) {
      console.log('[usePersistence] Starting queue processing for', persistenceQueue.size(), 'pending tasks')
      persistenceQueue.restart()
    }
  } else {
    console.log('[usePersistence] Orchestrator already exists')
  }

  // Initialiser le gestionnaire de sync adapters
  if (!syncAdaptersManager) {
    syncAdaptersManager = new SyncAdaptersManager(persistenceEventBus)
    console.log('[usePersistence] SyncAdaptersManager created')
  }
  
  // Enregistrer les adapters si fournis
  if (config && 'syncAdapters' in config && config.syncAdapters) {
    syncAdaptersManager.registerAll(config.syncAdapters)
    console.log(`[usePersistence] ${config.syncAdapters.length} sync adapter(s) registered`)
  }

  // Nettoyage lors du démontage (si nécessaire)
  onUnmounted(() => {
    // Ne pas détruire l'orchestrateur car il est global
    // Il sera détruit quand l'app se ferme
  })

  return {
    eventBus: persistenceEventBus,
    queue: persistenceQueue!,
    orchestrator
  }
}

/**
 * Retourne l'instance de l'event bus (pour utilisation dans les stores)
 */
export function getPersistenceEventBus(): EventBus<PersistenceEvents> {
  return persistenceEventBus
}

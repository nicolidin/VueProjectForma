/**
 * Composable Vue pour gérer la persistance générique
 * Initialise EventBus, PersistedQueueManager et Orchestrator
 * Écoute les événements de persistance pour mettre à jour le store
 */

import { onUnmounted } from 'vue'
import { EventBus } from './core/eventBus'
import { PersistedQueueManager } from './persisting/queue'
import { PersistenceOrchestrator } from './core/orchestrator'
import type { PersistenceEvents } from './core/types'
import { NoteRestApiStrategy, TagRestApiStrategy } from './strategies'
import { initPersistenceQueueStore } from './persisting/store'
import type { NoteType } from '@/types/NoteType'
import type { TagType } from '@/types/TagType'

/**
 * Instance globale de l'event bus pour la persistance
 */
export const persistenceEventBus = new EventBus<PersistenceEvents>()

/**
 * Instance globale de la queue persistée pour la persistance
 * Utilise le store Pinia pour persister automatiquement dans localStorage
 */
export const persistenceQueue = new PersistedQueueManager()

/**
 * Instance globale de l'orchestrateur
 */
let orchestrator: PersistenceOrchestrator | null = null

/**
 * Composable pour initialiser le système de persistance
 * Doit être appelé une seule fois au niveau de l'application (App.vue)
 * Doit être appelé APRÈS l'initialisation de Pinia
 */
export function usePersistence() {
  console.log('[usePersistence] Initializing persistence system...')
  
  // Initialiser et valider le store de queue (doit être fait après Pinia est prêt)
  initPersistenceQueueStore()

  // Créer l'orchestrateur si pas déjà créé
  if (!orchestrator) {
    console.log('[usePersistence] Creating orchestrator...')
    orchestrator = new PersistenceOrchestrator(persistenceEventBus, persistenceQueue)

    // Enregistrer les stratégies pour chaque type d'entité
    orchestrator.registerStrategy('note', new NoteRestApiStrategy())
    orchestrator.registerStrategy('tag', new TagRestApiStrategy())
    
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

  // Nettoyage lors du démontage (si nécessaire)
  onUnmounted(() => {
    // Ne pas détruire l'orchestrateur car il est global
    // Il sera détruit quand l'app se ferme
  })

  return {
    eventBus: persistenceEventBus,
    queue: persistenceQueue,
    orchestrator
  }
}

/**
 * Retourne l'instance de l'event bus (pour utilisation dans les stores)
 */
export function getPersistenceEventBus(): EventBus<PersistenceEvents> {
  return persistenceEventBus
}

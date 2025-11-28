/**
 * Composable Vue pour gérer la persistance générique
 * Initialise EventBus, QueueManager et Orchestrator
 * Écoute les événements de persistance pour mettre à jour le store
 */

import { onUnmounted } from 'vue'
import { EventBus } from './core/eventBus'
import { QueueManager } from './core/queue'
import { PersistenceOrchestrator } from './core/orchestrator'
import type { PersistenceEvents } from './core/types'
import { NoteRestApiStrategy, TagRestApiStrategy } from './strategies'
import type { NoteType } from '@/types/NoteType'
import type { TagType } from '@/types/TagType'

/**
 * Instance globale de l'event bus pour la persistance
 */
export const persistenceEventBus = new EventBus<PersistenceEvents>()

/**
 * Instance globale de la queue pour la persistance
 */
export const persistenceQueue = new QueueManager()

/**
 * Instance globale de l'orchestrateur
 */
let orchestrator: PersistenceOrchestrator | null = null

/**
 * Composable pour initialiser le système de persistance
 * Doit être appelé une seule fois au niveau de l'application (App.vue)
 */
export function usePersistence() {
  // Créer l'orchestrateur si pas déjà créé
  if (!orchestrator) {
    orchestrator = new PersistenceOrchestrator(persistenceEventBus, persistenceQueue)

    // Enregistrer les stratégies pour chaque type d'entité
    orchestrator.registerStrategy('note', new NoteRestApiStrategy())
    orchestrator.registerStrategy('tag', new TagRestApiStrategy())


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

import { onUnmounted } from 'vue'
import { PersistenceService } from './PersistenceService'
import { RestApiPersistence } from './RestApiPersistence'
import { noteEventBus } from './eventBus'
import { useNotesStore } from '@/stores/notes'

/**
 * Composable Vue pour gérer la persistance des notes
 * 
 * Ce composable :
 * - Initialise le service de persistance avec une stratégie (REST par défaut)
 * - Écoute les événements de persistance pour mettre à jour le store si nécessaire
 * - Nettoie les ressources lors du démontage du composant
 * 
 * @param strategy - Optionnel : stratégie de persistance personnalisée (par défaut: RestApiPersistence)
 * @returns Le service de persistance et des helpers
 */
export function usePersistence(strategy?: RestApiPersistence) {
  const notesStore = useNotesStore()
  const persistenceStrategy = strategy || new RestApiPersistence()
  const persistenceService = new PersistenceService(persistenceStrategy)

  // Écouter les événements de persistance réussie pour mettre à jour le store
  // (ex: mettre à jour le _id MongoDB après création)
  const unsubscribePersisted = noteEventBus.on('note:persisted', ({ original, persisted }) => {
    // Si la note a été créée et qu'on a maintenant un _id du backend
    if (original.frontId && persisted._id && !original._id) {
      // Utiliser syncNote pour éviter d'émettre un nouvel événement de persistance
      notesStore.syncNote(original.frontId, {
        _id: persisted._id,
        // Mettre à jour aussi les tagIds si le backend les a transformés
        tagIds: persisted.tagIds || original.tagIds
      })
    }
  })

  // Écouter les erreurs de persistance (optionnel : pour afficher des notifications)
  const unsubscribeError = noteEventBus.on('note:persist-error', ({ note, error }) => {
    console.warn('Erreur de persistance pour la note:', note.frontId, error)
    // Ici, on pourrait ajouter une notification à l'utilisateur
    // ou mettre en queue pour retry plus tard
  })

  // Nettoyage lors du démontage
  onUnmounted(() => {
    persistenceService.destroy()
    unsubscribePersisted()
    unsubscribeError()
  })

  return {
    persistenceService,
    noteEventBus
  }
}


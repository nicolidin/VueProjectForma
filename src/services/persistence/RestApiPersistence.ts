import { createNote, updateNote, deleteNote } from '@/api/noteApi'
import type { PersistenceStrategy } from './types'
import type { NoteType } from '@/types/NoteType'

/**
 * Implémentation de la stratégie de persistance via REST API
 * Cette classe est pure et ne contient aucune logique métier
 * Elle délègue simplement les appels aux fonctions API
 */
export class RestApiPersistence implements PersistenceStrategy {
  /**
   * Persiste la création d'une note via l'API REST
   * @param note - La note à créer
   * @returns La note créée avec les données du backend (_id, etc.)
   */
  async persistCreate(note: NoteType): Promise<NoteType> {
    // Convertir les tagIds en format attendu par l'API (titles ou frontIds)
    const tags = note.tagIds.length > 0 ? note.tagIds : undefined

    const persistedNote = await createNote({
      contentMd: note.contentMd,
      tags
    })

    return persistedNote
  }

  /**
   * Persiste la mise à jour d'une note via l'API REST
   * @param id - L'identifiant de la note (frontId ou _id)
   * @param updates - Les modifications à appliquer
   * @returns La note mise à jour
   */
  async persistUpdate(id: string, updates: Partial<NoteType>): Promise<NoteType> {
    const apiUpdates: Partial<{
      contentMd: string
      tags: string[]
    }> = {}

    // Mapper les updates vers le format attendu par l'API
    if (updates.contentMd !== undefined) {
      apiUpdates.contentMd = updates.contentMd
    }

    if (updates.tagIds !== undefined) {
      apiUpdates.tags = updates.tagIds.length > 0 ? updates.tagIds : []
    }

    const updatedNote = await updateNote(id, apiUpdates)
    return updatedNote
  }

  /**
   * Persiste la suppression d'une note via l'API REST
   * @param id - L'identifiant de la note (frontId ou _id)
   */
  async persistDelete(id: string): Promise<void> {
    await deleteNote(id)
  }
}


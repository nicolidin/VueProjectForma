import type { NoteType } from '@/types/NoteType'

/**
 * Événements émis par le système de persistance
 */
export type PersistenceEvents = {
  'note:created': { note: NoteType }
  'note:updated': { id: string; updates: Partial<NoteType> }
  'note:deleted': { id: string }
  'note:persisted': { original: NoteType; persisted: NoteType }
  'note:persist-error': { note: NoteType; error: unknown }
  'note:update-error': { id: string; updates: Partial<NoteType>; error: unknown }
  'note:delete-error': { id: string; error: unknown }
}

/**
 * Interface pour les stratégies de persistance
 * Permet d'implémenter différentes méthodes de persistance (REST, CRDT, décentralisé, etc.)
 */
export interface PersistenceStrategy {
  /**
   * Persiste la création d'une note
   * @param note - La note à persister
   * @returns La note persistée (avec _id du backend si applicable)
   */
  persistCreate(note: NoteType): Promise<NoteType>

  /**
   * Persiste la mise à jour d'une note
   * @param id - L'identifiant de la note (frontId ou _id)
   * @param updates - Les modifications à appliquer
   * @returns La note mise à jour
   */
  persistUpdate(id: string, updates: Partial<NoteType>): Promise<NoteType>

  /**
   * Persiste la suppression d'une note
   * @param id - L'identifiant de la note (frontId ou _id)
   */
  persistDelete(id: string): Promise<void>
}


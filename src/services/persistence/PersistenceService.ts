import { noteEventBus } from './eventBus'
import type { PersistenceStrategy, PersistenceEvents } from './types'
import type { NoteType } from '@/types/NoteType'

/**
 * Service orchestrateur de la persistance
 * Écoute les événements du store et délègue la persistance à la stratégie configurée
 * 
 * Cette classe respecte le principe SOC :
 * - Elle ne connaît pas les détails d'implémentation de la stratégie
 * - Elle ne connaît pas la structure du store
 * - Elle orchestre uniquement la communication entre événements et persistance
 */
export class PersistenceService {
  private strategy: PersistenceStrategy
  private unsubscribeFunctions: Array<() => void> = []

  /**
   * @param strategy - La stratégie de persistance à utiliser (REST, CRDT, etc.)
   */
  constructor(strategy: PersistenceStrategy) {
    this.strategy = strategy
    this.setupEventListeners()
  }

  /**
   * Configure les listeners pour les événements de persistance
   * @private
   */
  private setupEventListeners(): void {
    // Écouter la création de notes
    const unsubscribeCreate = noteEventBus.on('note:created', async ({ note }) => {
      await this.handleCreate(note)
    })

    // Écouter la mise à jour de notes
    const unsubscribeUpdate = noteEventBus.on('note:updated', async ({ id, updates }) => {
      await this.handleUpdate(id, updates)
    })

    // Écouter la suppression de notes
    const unsubscribeDelete = noteEventBus.on('note:deleted', async ({ id }) => {
      await this.handleDelete(id)
    })

    this.unsubscribeFunctions = [unsubscribeCreate, unsubscribeUpdate, unsubscribeDelete]
  }

  /**
   * Gère la persistance de la création d'une note
   * @private
   */
  private async handleCreate(note: NoteType): Promise<void> {
    try {
      const persistedNote = await this.strategy.persistCreate(note)
      
      // Émettre un événement de succès avec les données persistées
      noteEventBus.emit('note:persisted', {
        original: note,
        persisted: persistedNote
      })
    } catch (error) {
      // Émettre un événement d'erreur
      noteEventBus.emit('note:persist-error', {
        note,
        error
      })
      
      console.error('Erreur lors de la persistance de la note:', error)
    }
  }

  /**
   * Gère la persistance de la mise à jour d'une note
   * @private
   */
  private async handleUpdate(id: string, updates: Partial<NoteType>): Promise<void> {
    try {
      const updatedNote = await this.strategy.persistUpdate(id, updates)
      
      // Émettre un événement de succès (optionnel, si besoin de mettre à jour le store)
      noteEventBus.emit('note:persisted', {
        original: { frontId: id } as NoteType, // Note minimale pour l'événement
        persisted: updatedNote
      })
    } catch (error) {
      // Émettre un événement d'erreur
      noteEventBus.emit('note:update-error', {
        id,
        updates,
        error
      })
      
      console.error(`Erreur lors de la mise à jour de la note ${id}:`, error)
    }
  }

  /**
   * Gère la persistance de la suppression d'une note
   * @private
   */
  private async handleDelete(id: string): Promise<void> {
    try {
      await this.strategy.persistDelete(id)
      // Pas besoin d'émettre d'événement de succès pour la suppression
      // Le store gère déjà la suppression locale
    } catch (error) {
      // Émettre un événement d'erreur
      noteEventBus.emit('note:delete-error', {
        id,
        error
      })
      
      console.error(`Erreur lors de la suppression de la note ${id}:`, error)
    }
  }

  /**
   * Change la stratégie de persistance à la volée
   * Utile pour basculer entre différentes implémentations
   */
  setStrategy(strategy: PersistenceStrategy): void {
    this.strategy = strategy
  }

  /**
   * Nettoie les listeners d'événements
   * À appeler lors de la destruction du service
   */
  destroy(): void {
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    this.unsubscribeFunctions = []
  }
}


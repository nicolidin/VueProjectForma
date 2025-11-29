/**
 * Système de synchronisation des entités après persistance
 * Permet aux stores d'exposer des adapters pour synchroniser leurs données
 * après qu'une entité ait été persistée avec succès
 */

import type { EventBus } from '../core/eventBus'
import type { PersistenceEvents } from '../core/types'

/**
 * Adapter de synchronisation pour un type d'entité
 * Permet de définir comment synchroniser les données du store après persistance
 */
export interface SyncAdapter<T = unknown> {
  /**
   * Type d'entité géré par cet adapter
   */
  entityType: string
  
  /**
   * Fonction appelée après une persistance réussie
   * @param original - L'entité originale (avant persistance)
   * @param persisted - L'entité persistée (avec _id du backend)
   */
  syncEntity: (original: T, persisted: T) => void | Promise<void>
  
  /**
   * Fonction optionnelle appelée en cas d'erreur de persistance
   * @param error - L'erreur rencontrée
   * @param entity - L'entité concernée
   */
  onError?: (error: unknown, entity: T) => void
}

/**
 * Gestionnaire centralisé des adapters de synchronisation
 * Écoute les événements de persistance et délègue aux adapters appropriés
 */
export class SyncAdaptersManager {
  private adapters = new Map<string, SyncAdapter>()
  private eventBus: EventBus<PersistenceEvents>
  
  constructor(eventBus: EventBus<PersistenceEvents>) {
    this.eventBus = eventBus
    this.setupListeners()
  }
  
  /**
   * Enregistre un adapter de synchronisation
   */
  register(adapter: SyncAdapter): void {
    this.adapters.set(adapter.entityType, adapter)
    console.log(`[SyncAdaptersManager] Adapter registered for entity type: ${adapter.entityType}`)
  }
  
  /**
   * Enregistre plusieurs adapters
   */
  registerAll(adapters: Array<SyncAdapter>): void {
    for (const adapter of adapters) {
      this.register(adapter)
    }
  }
  
  /**
   * Configure les listeners sur l'event bus
   */
  private setupListeners(): void {
    // Écouter les événements de persistance réussie
    this.eventBus.on('entity:persisted', ({ entityType, original, persisted }) => {
      const adapter = this.adapters.get(entityType)
      if (adapter) {
        try {
          adapter.syncEntity(original.data, persisted.data)
        } catch (error) {
          console.error(`[SyncAdaptersManager] Error in sync adapter for ${entityType}:`, error)
        }
      }
    })
    
    // Écouter les erreurs de persistance
    this.eventBus.on('entity:persist-error', ({ entityType, task, error }) => {
      const adapter = this.adapters.get(entityType)
      if (adapter?.onError) {
        try {
          adapter.onError(error, task.payload.data)
        } catch (err) {
          console.error(`[SyncAdaptersManager] Error in error handler for ${entityType}:`, err)
        }
      } else {
        // Log par défaut si pas de handler spécifique
        console.warn(`[SyncAdaptersManager] Persistence error for ${entityType}:`, task.payload.metadata.frontId, error)
      }
    })
  }
}


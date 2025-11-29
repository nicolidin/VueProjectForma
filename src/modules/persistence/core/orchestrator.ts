/**
 * Orchestrateur de persistance générique
 * Coordonne EventBus, PersistedQueueManager et Strategy
 * Code pur, respecte le principe SOC
 */

import type {
  PersistenceTask,
  PersistenceStrategy,
  PersistableEntity,
  PersistenceEvents
} from './types'
import type { EventBus } from './eventBus'
import type { PersistedQueueManager } from '../queue/QueueManager'
import { updateMetadataOnSuccess, updateMetadataOnError, updateMetadataOnSyncing } from './metadata'
import { createTask } from './taskHelpers'

/**
 * Orchestrateur de persistance
 * Écoute les événements du store, les met en queue, et les traite via la stratégie
 */
export class PersistenceOrchestrator<T = unknown> {
  private eventBus: EventBus<PersistenceEvents<T>>
  private queue: PersistedQueueManager<T>
  private strategies: Map<string, PersistenceStrategy<T>> = new Map()
  private maxRetries: number
  private unsubscribeFunctions: Array<() => void> = []

  constructor(
    eventBus: EventBus<PersistenceEvents<T>>,
    queue: PersistedQueueManager<T>,
    maxRetries: number = 3
  ) {
    this.eventBus = eventBus
    this.queue = queue
    this.maxRetries = maxRetries

    this.setupEventListeners()
    // Le processeur sera initialisé via initializeProcessor() après l'enregistrement des stratégies
  }

  /**
   * Enregistre une stratégie de persistance pour un type d'entité
   */
  registerStrategy(entityType: string, strategy: PersistenceStrategy<T>): void {
    this.strategies.set(entityType, strategy)
  }

  /**
   * Initialise le processeur de queue
   * Doit être appelé après l'enregistrement des stratégies pour éviter les race conditions
   */
  initializeProcessor(): void {
    this.queue.setProcessor(async (task: PersistenceTask<T>) => {
      await this.processTask(task)
    })
  }

  /**
   * Configure les listeners pour les événements du store
   * @private
   */
  private setupEventListeners(): void {
    // Écouter la création d'entités
    const unsubscribeCreate = this.eventBus.on('entity:created', ({ entityType, data }) => {
      console.log('[PersistenceOrchestrator] Received entity:created event:', { 
        entityType, 
        frontId: (data as any).frontId 
      })
      this.enqueueCreate(entityType, data)
    })

    // Écouter la mise à jour d'entités
    const unsubscribeUpdate = this.eventBus.on('entity:updated', ({ entityType, id, updates }) => {
      console.log('[PersistenceOrchestrator] Received entity:updated event:', { entityType, id })
      this.enqueueUpdate(entityType, id, updates)
    })

    // Écouter la suppression d'entités
    const unsubscribeDelete = this.eventBus.on('entity:deleted', ({ entityType, id }) => {
      console.log('[PersistenceOrchestrator] Received entity:deleted event:', { entityType, id })
      this.enqueueDelete(entityType, id)
    })

    this.unsubscribeFunctions = [unsubscribeCreate, unsubscribeUpdate, unsubscribeDelete]
  }

  /**
   * Met en queue une création
   * @private
   */
  private enqueueCreate(entityType: string, data: T): void {
    const frontId = (data as any).frontId || `temp-${Date.now()}`
    const task = createTask('create', entityType, data, frontId, this.maxRetries)
    this.enqueueTask(task)
  }

  /**
   * Met en queue une mise à jour
   * @private
   */
  private enqueueUpdate(entityType: string, id: string, updates: Partial<T>): void {
    const task = createTask('update', entityType, updates, id, this.maxRetries)
    this.enqueueTask(task)
  }

  /**
   * Met en queue une suppression
   * @private
   */
  private enqueueDelete(entityType: string, id: string): void {
    const task = createTask('delete', entityType, {} as T, id, this.maxRetries)
    this.enqueueTask(task)
  }

  /**
   * Met une tâche en queue et émet l'événement
   * Centralise la logique commune d'enqueue
   * @private
   */
  private enqueueTask(task: PersistenceTask<T>): void {
    console.log('[PersistenceOrchestrator] Enqueuing task:', {
      taskId: task.id,
      entityType: task.entityType,
      operation: task.operation,
      frontId: task.payload.metadata.frontId,
      priority: task.priority
    })
    
    this.queue.enqueue(task)
    this.eventBus.emit('queue:task-enqueued', { task })
    
    console.log('[PersistenceOrchestrator] Task enqueued, queue size:', this.queue.size())
  }

  /**
   * Traite une tâche de la queue
   * @private
   */
  private async processTask(task: PersistenceTask<T>): Promise<void> {
    const strategy = this.strategies.get(task.entityType)
    if (!strategy) {
      throw new Error(`No strategy registered for entity type: ${task.entityType}`)
    }

    this.eventBus.emit('queue:task-processing', { task })

    try {
      // Mettre à jour les métadonnées pour indiquer qu'on synchronise
      task.payload.metadata = updateMetadataOnSyncing(task.payload.metadata)

      let persisted: PersistableEntity<T>

      switch (task.operation) {
        case 'create':
          persisted = await strategy.persistCreate(task.payload)
          break
        case 'update':
          persisted = await strategy.persistUpdate(task.payload)
          break
        case 'delete':
          await strategy.persistDelete(task.payload.metadata.frontId, task.entityType)
          persisted = task.payload // Pour delete, on retourne l'entité originale
          break
        default:
          throw new Error(`Unknown operation: ${task.operation}`)
      }

      // Mettre à jour les métadonnées après succès
      persisted.metadata = updateMetadataOnSuccess(
        persisted.metadata,
        (persisted.data as any)?._id,
        persisted.metadata.version
      )

      // Émettre l'événement de succès
      this.eventBus.emit('entity:persisted', {
        entityType: task.entityType,
        original: task.payload,
        persisted
      })

      this.eventBus.emit('queue:task-completed', { task })
    } catch (error) {
      // Mettre à jour les métadonnées après erreur
      task.payload.metadata = updateMetadataOnError(task.payload.metadata, error)

      // Émettre l'événement d'erreur approprié
      const errorEvent = this.getErrorEventName(task.operation)
      this.eventBus.emit(errorEvent, {
        entityType: task.entityType,
        task,
        error
      })

      this.eventBus.emit('queue:task-failed', { task, error })

      // Re-throw pour que la queue puisse gérer le retry
      // La queue utilisera RetryManager pour déterminer si l'erreur est récupérable
      throw error
    }
  }

  /**
   * Retourne le nom de l'événement d'erreur selon l'opération
   * @private
   */
  private getErrorEventName(operation: PersistenceTask<T>['operation']): keyof PersistenceEvents<T> {
    switch (operation) {
      case 'create':
        return 'entity:persist-error'
      case 'update':
        return 'entity:update-error'
      case 'delete':
        return 'entity:delete-error'
      default:
        return 'entity:persist-error'
    }
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    this.unsubscribeFunctions = []
    this.queue.stop()
  }
}


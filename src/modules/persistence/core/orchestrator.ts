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
import { TaskPriority } from './types'
import type { EventBus } from './eventBus'
import type { IQueueManager } from './IQueueManager'
import { createMetadata, updateMetadataOnSuccess, updateMetadataOnError, updateMetadataOnSyncing } from './metadata'

/**
 * Orchestrateur de persistance
 * Écoute les événements du store, les met en queue, et les traite via la stratégie
 */
export class PersistenceOrchestrator<T = unknown> {
  private eventBus: EventBus<PersistenceEvents<T>>
  private queue: IQueueManager<T>
  private strategies: Map<string, PersistenceStrategy<T>> = new Map()
  private maxRetries: number
  private unsubscribeFunctions: Array<() => void> = []

  constructor(
    eventBus: EventBus<PersistenceEvents<T>>,
    queue: IQueueManager<T>,
    maxRetries: number = 3
  ) {
    this.eventBus = eventBus
    this.queue = queue
    this.maxRetries = maxRetries

    this.setupEventListeners()
    // Ne pas appeler setupQueueProcessor() ici pour éviter la race condition
    // Il sera appelé explicitement via initializeProcessor() après l'enregistrement des stratégies
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
    this.setupQueueProcessor()
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
   * Configure le processeur de la queue
   * @private
   */
  private setupQueueProcessor(): void {
    this.queue.setProcessor(async (task: PersistenceTask<T>) => {
      await this.processTask(task)
    })
  }

  /**
   * Met en queue une création
   * @private
   */
  private enqueueCreate(entityType: string, data: T): void {
    const metadata = createMetadata(
      (data as any).frontId || `temp-${Date.now()}`,
      { maxRetries: this.maxRetries }
    )
    const entity: PersistableEntity<T> = { data, metadata }

    const task: PersistenceTask<T> = {
      id: `create-${entityType}-${metadata.frontId}-${Date.now()}`,
      entityType,
      operation: 'create',
      payload: entity,
      priority: TaskPriority.NORMAL,
      createdAt: Date.now()
    }

    console.log('[PersistenceOrchestrator] Enqueuing create task:', {
      taskId: task.id,
      entityType: task.entityType,
      frontId: metadata.frontId,
      priority: task.priority
    })
    
    this.queue.enqueue(task)
    this.eventBus.emit('queue:task-enqueued', { task })
    
    console.log('[PersistenceOrchestrator] Task enqueued, queue size:', this.queue.size())
  }

  /**
   * Met en queue une mise à jour
   * @private
   */
  private enqueueUpdate(entityType: string, id: string, updates: Partial<T>): void {
    // Pour une mise à jour, on a besoin de reconstruire l'entité complète
    // On utilise les updates comme données partielles
    const metadata = createMetadata(id, {
      maxRetries: this.maxRetries
    })
    const entity: PersistableEntity<T> = {
      data: updates as T, // Les updates contiennent les données à mettre à jour
      metadata
    }

    const task: PersistenceTask<T> = {
      id: `update-${entityType}-${id}-${Date.now()}`,
      entityType,
      operation: 'update',
      payload: entity,
      priority: TaskPriority.NORMAL,
      createdAt: Date.now()
    }

    this.queue.enqueue(task)
    this.eventBus.emit('queue:task-enqueued', { task })
  }

  /**
   * Met en queue une suppression
   * @private
   */
  private enqueueDelete(entityType: string, id: string): void {
    const metadata = createMetadata(id, {
      maxRetries: this.maxRetries
    })
    const entity: PersistableEntity<T> = {
      data: {} as T, // Pas besoin de données pour une suppression
      metadata
    }

    const task: PersistenceTask<T> = {
      id: `delete-${entityType}-${id}-${Date.now()}`,
      entityType,
      operation: 'delete',
      payload: entity,
      priority: TaskPriority.NORMAL,
      createdAt: Date.now()
    }

    this.queue.enqueue(task)
    this.eventBus.emit('queue:task-enqueued', { task })
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


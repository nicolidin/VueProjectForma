/**
 * Orchestrateur de persistance générique
 * Coordonne EventBus, PersistedQueueManager et Strategy
 * Code pur, respecte le principe SOC
 */

import type {
  PersistenceTask,
  PersistenceStrategy,
  PersistableEntity,
  PersistenceEvents,
  PersistenceOperation
} from './types'
import type { EventBus } from './eventBus'
import type { PersistedQueueManager } from '../queue/QueueManager'
import { updateMetadataOnSuccess, updateMetadataOnError, updateMetadataOnSyncing } from './metadata'
import { createTask } from './taskHelpers'
import { ENTITY_EVENTS, PERSISTENCE_EVENTS, QUEUE_EVENTS } from './events'

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
    const unsubscribeCreate = this.eventBus.on(ENTITY_EVENTS.CREATED, ({ entityType, data }) => {
      this.enqueueOperation('create', entityType, data, (data as any)?.frontId || `temp-${Date.now()}`)
    })

    const unsubscribeUpdate = this.eventBus.on(ENTITY_EVENTS.UPDATED, ({ entityType, id, updates }) => {
      this.enqueueOperation('update', entityType, updates, id)
    })

    const unsubscribeDelete = this.eventBus.on(ENTITY_EVENTS.DELETED, ({ entityType, id }) => {
      this.enqueueOperation('delete', entityType, {} as T, id)
    })

    this.unsubscribeFunctions = [unsubscribeCreate, unsubscribeUpdate, unsubscribeDelete]
  }

  /**
   * Méthode générique pour enqueuer une opération (fusionne les 3 méthodes)
   * @private
   */
  private enqueueOperation(
    operation: PersistenceOperation,
    entityType: string,
    data: T | Partial<T>,
    id: string
  ): void {
    const task = createTask(operation, entityType, data, id, this.maxRetries)
    this.enqueueTask(task)
  }

  /**
   * Met une tâche en queue et émet l'événement
   * @private
   */
  private enqueueTask(task: PersistenceTask<T>): void {
    this.queue.enqueue(task)
    this.eventBus.emit(QUEUE_EVENTS.TASK_ENQUEUED, { task })
  }

  /**
   * Traite une tâche de la queue (extrait en méthodes plus petites)
   * @private
   */
  private async processTask(task: PersistenceTask<T>): Promise<void> {
    const strategy = this.strategies.get(task.entityType)
    if (!strategy) {
      throw new Error(`No strategy registered for entity type: ${task.entityType}`)
    }

    this.eventBus.emit(QUEUE_EVENTS.TASK_PROCESSING, { task })

    try {
      task.payload.metadata = updateMetadataOnSyncing(task.payload.metadata)
      
      const persisted = await this.executeStrategy(task, strategy)
      const updatedPersisted = this.updateMetadataOnSuccess(persisted, task)
      
      this.emitSuccessEvents(task, updatedPersisted)
    } catch (error) {
      this.handleError(task, error)
      throw error // Re-throw pour que la queue puisse gérer le retry
    }
  }

  /**
   * Exécute la stratégie selon l'opération (méthode extraite)
   * @private
   */
  private async executeStrategy(
    task: PersistenceTask<T>,
    strategy: PersistenceStrategy<T>
  ): Promise<PersistableEntity<T>> {
    switch (task.operation) {
      case 'create':
        return await strategy.persistCreate(task.payload)
      case 'update':
        return await strategy.persistUpdate(task.payload)
      case 'delete':
        await strategy.persistDelete(task.payload.metadata.frontId, task.entityType)
        return task.payload
      default:
        throw new Error(`Unknown operation: ${task.operation}`)
    }
  }

  /**
   * Met à jour les métadonnées après succès (méthode extraite)
   * @private
   */
  private updateMetadataOnSuccess(
    persisted: PersistableEntity<T>,
    task: PersistenceTask<T>
  ): PersistableEntity<T> {
    persisted.metadata = updateMetadataOnSuccess(
      persisted.metadata,
      (persisted.data as any)?._id,
      persisted.metadata.version
    )
    return persisted
  }

  /**
   * Émet les événements de succès (méthode extraite)
   * @private
   */
  private emitSuccessEvents(
    task: PersistenceTask<T>,
    persisted: PersistableEntity<T>
  ): void {
    this.eventBus.emit(PERSISTENCE_EVENTS.PERSISTED, {
      entityType: task.entityType,
      original: task.payload,
      persisted
    })
    this.eventBus.emit(QUEUE_EVENTS.TASK_COMPLETED, { task })
  }

  /**
   * Gère les erreurs (méthode extraite)
   * @private
   */
  private handleError(task: PersistenceTask<T>, error: unknown): void {
    task.payload.metadata = updateMetadataOnError(task.payload.metadata, error)

    const errorEvent = this.getErrorEventName(task.operation)
    this.eventBus.emit(errorEvent, {
      entityType: task.entityType,
      task,
      error
    })

    this.eventBus.emit(QUEUE_EVENTS.TASK_FAILED, { task, error })
  }

  /**
   * Mapping des opérations vers les événements d'erreur
   * @private
   */
  private readonly ERROR_EVENT_MAP: Record<PersistenceOperation, keyof PersistenceEvents<T>> = {
    create: PERSISTENCE_EVENTS.PERSIST_ERROR as keyof PersistenceEvents<T>,
    update: PERSISTENCE_EVENTS.UPDATE_ERROR as keyof PersistenceEvents<T>,
    delete: PERSISTENCE_EVENTS.DELETE_ERROR as keyof PersistenceEvents<T>,
  }

  /**
   * Retourne le nom de l'événement d'erreur selon l'opération
   * @private
   */
  private getErrorEventName(operation: PersistenceOperation): keyof PersistenceEvents<T> {
    return this.ERROR_EVENT_MAP[operation]
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


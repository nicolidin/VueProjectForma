/**
 * Orchestrateur de persistance générique
 * Coordonne EventBus, QueueManager et Strategy
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
import type { RetryConfig } from './retryManager'
import { DEFAULT_RETRY_CONFIG } from './retryManager'

/**
 * Options de configuration de l'orchestrateur
 */
export interface OrchestratorOptions {
  defaultPriority?: TaskPriority
  /**
   * Durée de vie maximale d'une tâche en ms (optionnel)
   * Si défini, les tâches expireront après cette durée
   * Ex: 7 jours = 7 * 24 * 60 * 60 * 1000 = 604800000
   */
  defaultMaxAge?: number
  /**
   * Configuration du retry globale (timing, backoff exponentiel, nombre de tentatives)
   * Si non défini, utilise DEFAULT_RETRY_CONFIG
   */
  retryConfig?: Partial<RetryConfig>
  /**
   * Configuration du retry spécifique par type d'entité
   * Permet d'override la configuration globale pour certains types d'entités
   * Ex: { note: { maxRetries: 5 }, tag: { maxRetries: 2 } }
   */
  retryConfigByEntityType?: {
    [entityType: string]: Partial<RetryConfig>
  }
}

/**
 * Orchestrateur de persistance
 * Écoute les événements du store, les met en queue, et les traite via la stratégie
 */
export class PersistenceOrchestrator<T = unknown> {
  private eventBus: EventBus<PersistenceEvents<T>>
  private queue: IQueueManager<T>
  private strategies: Map<string, PersistenceStrategy<T>> = new Map()
  private options: Required<Omit<OrchestratorOptions, 'defaultMaxAge' | 'retryConfig' | 'retryConfigByEntityType'>> & 
    Pick<OrchestratorOptions, 'defaultMaxAge' | 'retryConfig' | 'retryConfigByEntityType'>
  private globalRetryConfig: RetryConfig
  private unsubscribeFunctions: Array<() => void> = []

  constructor(
    eventBus: EventBus<PersistenceEvents<T>>,
    queue: IQueueManager<T>,
    options: OrchestratorOptions = {}
  ) {
    this.eventBus = eventBus
    this.queue = queue
    this.options = {
      defaultPriority: options.defaultPriority ?? TaskPriority.NORMAL,
      defaultMaxAge: options.defaultMaxAge,
      retryConfig: options.retryConfig,
      retryConfigByEntityType: options.retryConfigByEntityType
    }
    
    // Fusionner la config globale avec les défauts
    this.globalRetryConfig = { ...DEFAULT_RETRY_CONFIG, ...(options.retryConfig || {}) }

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
   * Obtient la configuration retry pour un type d'entité donné
   * Utilise la configuration spécifique si disponible, sinon la configuration globale
   * @private
   */
  private getRetryConfigForEntityType(entityType: string): RetryConfig {
    if (this.options.retryConfigByEntityType && this.options.retryConfigByEntityType[entityType]) {
      // Fusionner la config globale avec la config spécifique
      return { ...this.globalRetryConfig, ...this.options.retryConfigByEntityType[entityType] }
    }
    return this.globalRetryConfig
  }

  /**
   * Met en queue une création
   * @private
   */
  private enqueueCreate(entityType: string, data: T): void {
    const metadata = createMetadata((data as any).frontId || `temp-${Date.now()}`)
    const entity: PersistableEntity<T> = { data, metadata }

    const retryConfig = this.getRetryConfigForEntityType(entityType)
    const task: PersistenceTask<T> = {
      id: `create-${entityType}-${metadata.frontId}-${Date.now()}`,
      entityType,
      operation: 'create',
      payload: entity,
      priority: this.options.defaultPriority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: retryConfig.maxRetries,
      ...(this.options.defaultMaxAge && {
        maxAge: this.options.defaultMaxAge,
        expiresAt: Date.now() + this.options.defaultMaxAge
      })
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
    const metadata = createMetadata(id)
    const entity: PersistableEntity<T> = {
      data: updates as T, // Les updates contiennent les données à mettre à jour
      metadata
    }

    const retryConfig = this.getRetryConfigForEntityType(entityType)
    const task: PersistenceTask<T> = {
      id: `update-${entityType}-${id}-${Date.now()}`,
      entityType,
      operation: 'update',
      payload: entity,
      priority: this.options.defaultPriority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: retryConfig.maxRetries,
      ...(this.options.defaultMaxAge && {
        maxAge: this.options.defaultMaxAge,
        expiresAt: Date.now() + this.options.defaultMaxAge
      })
    }

    this.queue.enqueue(task)
    this.eventBus.emit('queue:task-enqueued', { task })
  }

  /**
   * Met en queue une suppression
   * @private
   */
  private enqueueDelete(entityType: string, id: string): void {
    const metadata = createMetadata(id)
    const entity: PersistableEntity<T> = {
      data: {} as T, // Pas besoin de données pour une suppression
      metadata
    }

    const retryConfig = this.getRetryConfigForEntityType(entityType)
    const task: PersistenceTask<T> = {
      id: `delete-${entityType}-${id}-${Date.now()}`,
      entityType,
      operation: 'delete',
      payload: entity,
      priority: this.options.defaultPriority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: retryConfig.maxRetries,
      ...(this.options.defaultMaxAge && {
        maxAge: this.options.defaultMaxAge,
        expiresAt: Date.now() + this.options.defaultMaxAge
      })
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


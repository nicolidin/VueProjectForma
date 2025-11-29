/**
 * Queue Manager qui utilise le store Pinia pour la persistance
 * Code pur, respecte le principe SOC
 * La queue est automatiquement persistée dans localStorage via Pinia
 */

import type { PersistenceTask } from '../core/types'
import { RetryManager, type RetryConfig } from '../core/retryManager'
import { TIMING, QUEUE_DEFAULTS } from '../core/constants'
import { updateMetadataOnError } from '../core/metadata'
import { usePersistenceQueueStore } from './store'

/**
 * Callback appelé quand une tâche est traitée
 */
export type TaskProcessor<T = unknown> = (task: PersistenceTask<T>) => Promise<void>

/**
 * Helpers purs pour la logique de queue (testables facilement)
 */
class QueueHelpers {
  /**
   * Sélectionne les tâches prêtes à être traitées (PURE)
   */
  static getReadyTasks<T>(
    sortedTasks: PersistenceTask<T>[],
    processing: Set<string>,
    maxConcurrent: number,
    now: number
  ): PersistenceTask<T>[] {
    const ready: PersistenceTask<T>[] = []
    
    for (const task of sortedTasks) {
      if (ready.length >= maxConcurrent || processing.size >= maxConcurrent) break
      if (processing.has(task.id)) continue
      
      const isReady = !task.retryAt || task.retryAt <= now
      if (isReady) {
        ready.push(task)
      }
    }
    
    return ready
  }

  /**
   * Calcule le prochain temps de retry (PURE)
   */
  static getNextRetryTime<T>(
    sortedTasks: PersistenceTask<T>[],
    now: number
  ): number | null {
    const retryTimes = sortedTasks
      .filter(task => task.retryAt && task.retryAt > now)
      .map(task => task.retryAt!)
      .sort((a, b) => a - b)
    
    return retryTimes[0] || null
  }

  /**
   * Calcule le retryAt pour une tâche (PURE)
   */
  static calculateRetryAt<T>(
    task: PersistenceTask<T>,
    retryManager: RetryManager,
    now: number
  ): number {
    const delay = retryManager.calculateDelay({
      ...task,
      retryCount: task.payload.metadata.retryCount,
      maxRetries: task.payload.metadata.maxRetries
    })
    return now + delay
  }

  /**
   * Vérifie si une tâche est expirée (PURE)
   */
  static isTaskExpired<T>(task: PersistenceTask<T>, now: number): boolean {
    return task.expiresAt ? now > task.expiresAt : false
  }

  /**
   * Calcule expiresAt si maxAge est défini (PURE)
   */
  static calculateExpiresAt<T>(task: PersistenceTask<T>): number | undefined {
    if (task.maxAge && !task.expiresAt) {
      return task.createdAt + task.maxAge
    }
    return task.expiresAt
  }
}

/**
 * Queue Manager qui utilise le store Pinia pour la persistance
 * Les tâches sont automatiquement persistées dans localStorage
 * Restaure automatiquement les tâches au démarrage
 */
export class PersistedQueueManager<T = unknown> {
  private processing: Set<string> = new Set()
  private maxConcurrent: number = QUEUE_DEFAULTS.MAX_CONCURRENT
  private maxQueueSize: number = QUEUE_DEFAULTS.MAX_QUEUE_SIZE
  private retryManager: RetryManager
  private processor?: TaskProcessor<T>
  private isRunning = false

  constructor(retryConfig?: RetryConfig) {
    // Initialiser le RetryManager avec la configuration
    this.retryManager = new RetryManager(retryConfig)

    // Ne pas appeler usePersistenceQueueStore() dans le constructeur
    // car Pinia n'est peut-être pas encore initialisé
  }

  /**
   * Récupère le store (lazy loading pour éviter les erreurs avant l'init de Pinia)
   * @private
   */
  private getQueueStore() {
    return usePersistenceQueueStore()
  }

  /**
   * Définit le processeur de tâches
   */
  setProcessor(processor: TaskProcessor<T>): void {
    this.processor = processor
  }

  /**
   * Ajoute une tâche à la queue (via le store, donc persistée)
   */
  enqueue(task: PersistenceTask<T>): void {
    const queueStore = this.getQueueStore()
    if (queueStore.queueSize >= this.maxQueueSize) {
      throw new Error(`Queue is full (max size: ${this.maxQueueSize})`)
    }

    queueStore.enqueue(task)

    if (!this.isRunning && this.processor) {
      this.startProcessing()
    }
  }

  /**
   * Retire une tâche de la queue (via le store)
   */
  dequeue(taskId: string): boolean {
    return this.getQueueStore().dequeue(taskId)
  }

  /**
   * Retourne la taille de la queue
   */
  size(): number {
    return this.getQueueStore().queueSize
  }

  /**
   * Vérifie si la queue est vide
   */
  isEmpty(): boolean {
    return this.getQueueStore().isEmpty && this.processing.size === 0
  }

  /**
   * Vide la queue (via le store)
   */
  clear(): void {
    this.getQueueStore().clear()
  }

  /**
   * Retourne toutes les tâches en attente (depuis le store)
   */
  getPendingTasks(): ReadonlyArray<PersistenceTask<T>> {
    return this.getQueueStore().getPendingTasks() as PersistenceTask<T>[]
  }

  /**
   * Démarre le traitement de la queue (simplifié avec helpers purs)
   * @private
   */
  private async startProcessing(): Promise<void> {
    if (this.isRunning || !this.processor) return

    this.isRunning = true

    while (true) {
      const queueStore = this.getQueueStore()
      
      if (queueStore.queueSize === 0 && this.processing.size === 0) {
        break
      }

      const sortedTasks = queueStore.sortedTasks as PersistenceTask<T>[]
      const now = Date.now()

      // Utiliser helper pur pour sélectionner les tâches
      const readyTasks = QueueHelpers.getReadyTasks(
        sortedTasks,
        this.processing,
        this.maxConcurrent,
        now
      )

      // Nettoyer retryAt des tâches prêtes
      for (const task of readyTasks) {
        if (task.retryAt) {
          queueStore.updateTask(task.id, { retryAt: undefined })
        }
      }

      // Traiter les tâches en parallèle
      if (readyTasks.length > 0) {
        const promises = readyTasks.map(task => this.processTask(task))
        await Promise.allSettled(promises)
      }

      // Utiliser helper pur pour calculer le prochain retry
      const nextRetryAt = QueueHelpers.getNextRetryTime(sortedTasks, now)
      
      // Attendre selon la situation
      await this.waitForNextAction(nextRetryAt, queueStore.queueSize, readyTasks.length)
    }

    this.isRunning = false
  }

  /**
   * Attend jusqu'à la prochaine action (simplifié)
   * @private
   */
  private async waitForNextAction(
    nextRetryAt: number | null,
    queueSize: number,
    readyTasksCount: number
  ): Promise<void> {
    const now = Date.now()
    
    if (nextRetryAt) {
      const waitTime = Math.min(nextRetryAt - now, TIMING.POLLING_INTERVAL_MAX_WAIT)
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    } else if (queueSize === 0 && this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, TIMING.POLLING_INTERVAL_SHORT))
    } else if (queueSize > 0 && readyTasksCount === 0) {
      await new Promise(resolve => setTimeout(resolve, TIMING.POLLING_INTERVAL_NORMAL))
    }
  }

  /**
   * Traite une tâche (simplifié avec helpers purs)
   * @private
   */
  private async processTask(task: PersistenceTask<T>): Promise<void> {
    if (!this.processor) return

    this.processing.add(task.id)
    const queueStore = this.getQueueStore()
    const now = Date.now()

    try {
      // Utiliser helper pur pour vérifier expiration
      if (QueueHelpers.isTaskExpired(task, now)) {
        queueStore.dequeue(task.id)
        return
      }

      // Utiliser helper pur pour calculer expiresAt
      const expiresAt = QueueHelpers.calculateExpiresAt(task)
      if (expiresAt && expiresAt !== task.expiresAt) {
        queueStore.updateTask(task.id, { expiresAt })
      }

      // Appeler le processeur (callback)
      await this.processor(task)
      
      queueStore.dequeue(task.id)
    } catch (error) {
      await this.handleTaskError(task, error, queueStore, now)
    } finally {
      this.processing.delete(task.id)
    }
  }

  /**
   * Gère les erreurs de tâche (simplifié)
   * @private
   */
  private async handleTaskError(
    task: PersistenceTask<T>,
    error: unknown,
    queueStore: ReturnType<typeof this.getQueueStore>,
    now: number
  ): Promise<void> {
    const metadata = task.payload.metadata
    const shouldRetry = this.retryManager.shouldRetry(error, {
      ...task,
      retryCount: metadata.retryCount,
      maxRetries: metadata.maxRetries
    })
    
    if (!shouldRetry) {
      queueStore.dequeue(task.id)
      return
    }

    // Mettre à jour métadonnées
    const updatedMetadata = updateMetadataOnError(metadata, error)
    task.payload.metadata = updatedMetadata
    
    // Utiliser helper pur pour calculer retryAt
    const retryAt = QueueHelpers.calculateRetryAt(task, this.retryManager, now)
    
    queueStore.updateTask(task.id, { 
      payload: task.payload,
      retryAt
    })
  }

  /**
   * Arrête le traitement de la queue
   */
  stop(): void {
    this.isRunning = false
  }

  /**
   * Force le redémarrage du traitement (utile après restauration)
   */
  restart(): void {
    if (!this.isRunning && this.processor) {
      this.startProcessing()
    }
  }
}


/**
 * Queue Manager qui utilise le store Pinia pour la persistance
 * Code pur, respecte le principe SOC
 * La queue est automatiquement persistée dans localStorage via Pinia
 */

import type { PersistenceTask } from '../../core/types'
import { TaskPriority } from '../../core/types'
import type { IQueueManager, TaskProcessor } from '../../core/IQueueManager'
import { usePersistenceQueueStore } from '../store'

/**
 * Options de configuration de la queue
 */
export interface PersistedQueueOptions {
  maxConcurrent?: number // Nombre max de tâches en parallèle (défaut: 1 = séquentiel)
  retryDelay?: number // Délai en ms avant retry (défaut: 1000)
  maxQueueSize?: number // Taille max de la queue (défaut: Infinity)
  autoStart?: boolean // Démarrer automatiquement le traitement au démarrage (défaut: true)
}

/**
 * Queue Manager qui utilise le store Pinia pour la persistance
 * Les tâches sont automatiquement persistées dans localStorage
 * Restaure automatiquement les tâches au démarrage
 */
export class PersistedQueueManager<T = unknown> implements IQueueManager<T> {
  private processing: Set<string> = new Set()
  private options: Required<Omit<PersistedQueueOptions, 'autoStart'>> & { autoStart: boolean }
  private processor?: TaskProcessor<T>
  private isRunning = false

  constructor(options: PersistedQueueOptions = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 1,
      retryDelay: options.retryDelay ?? 1000,
      maxQueueSize: options.maxQueueSize ?? Infinity,
      autoStart: options.autoStart ?? true
    }

    // Ne pas appeler usePersistenceQueueStore() dans le constructeur
    // car Pinia n'est peut-être pas encore initialisé
    // La restauration sera faite dans restoreAndStart() qui sera appelé après
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
    // Si on a des tâches en attente et qu'on vient de définir le processeur, démarrer
    const queueStore = this.getQueueStore()
    if (queueStore.queueSize > 0 && !this.isRunning) {
      this.startProcessing()
    }
  }

  /**
   * Restaure les tâches depuis le store et démarre le traitement
   * @private
   */
  private restoreAndStart(): void {
    const queueStore = this.getQueueStore()
    const pendingTasks = queueStore.getPendingTasks()
    if (pendingTasks.length > 0 && this.processor && !this.isRunning) {
      console.log(`[PersistedQueueManager] Restoring ${pendingTasks.length} pending tasks`)
      this.startProcessing()
    }
  }

  /**
   * Ajoute une tâche à la queue (via le store, donc persistée)
   */
  enqueue(task: PersistenceTask<T>): void {
    const queueStore = this.getQueueStore()
    if (queueStore.queueSize >= this.options.maxQueueSize) {
      throw new Error(`Queue is full (max size: ${this.options.maxQueueSize})`)
    }

    // Utiliser le store pour persister automatiquement
    queueStore.enqueue(task)

    // Démarrer le traitement si pas déjà en cours
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
   * Retourne le nombre de tâches en cours de traitement
   */
  processingCount(): number {
    return this.processing.size
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
   * Retourne toutes les tâches en cours de traitement
   */
  getProcessingTasks(): string[] {
    return Array.from(this.processing)
  }

  /**
   * Démarre le traitement de la queue
   * @private
   */
  private async startProcessing(): Promise<void> {
    if (this.isRunning || !this.processor) {
      return
    }

    this.isRunning = true

    while (true) {
      const queueStore = this.getQueueStore()
      
      if (queueStore.queueSize === 0 && this.processing.size === 0) {
        break
      }

      // Récupérer les tâches depuis le store (triées par priorité)
      const sortedTasks = queueStore.sortedTasks as PersistenceTask<T>[]
      const tasksToProcess: PersistenceTask<T>[] = []

      // Prendre jusqu'à maxConcurrent tâches
      for (const task of sortedTasks) {
        if (
          tasksToProcess.length < this.options.maxConcurrent &&
          !this.processing.has(task.id) &&
          this.processing.size < this.options.maxConcurrent
        ) {
          // Retirer de la queue avant de traiter
          queueStore.dequeue(task.id)
          tasksToProcess.push(task)
        }
      }

      // Traiter les tâches en parallèle
      if (tasksToProcess.length > 0) {
        const promises = tasksToProcess.map(task => this.processTask(task))
        await Promise.allSettled(promises)
      }

      // Si la queue est vide mais qu'on attend encore des tâches, on attend un peu
      if (queueStore.queueSize === 0 && this.processing.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    this.isRunning = false
  }

  /**
   * Traite une tâche
   * @private
   */
  private async processTask(task: PersistenceTask<T>): Promise<void> {
    if (!this.processor) {
      return
    }

    this.processing.add(task.id)

    try {
      await this.processor(task)
      // Tâche réussie : elle a déjà été retirée de la queue dans startProcessing
    } catch (error) {
      // Si la tâche peut être retentée, on la remet en queue (persistée)
      if (task.retryCount < task.maxRetries) {
        task.retryCount++
        const queueStore = this.getQueueStore()
        
        // Attendre avant de retenter
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay))
        
        // Remettre en queue (persistée) avec le retryCount mis à jour
        queueStore.enqueue(task)
      } else {
        // Tâche échouée définitivement
        console.error(`Task ${task.id} failed after ${task.maxRetries} retries:`, error)
        // La tâche a déjà été retirée de la queue, pas besoin de la retirer
      }
    } finally {
      this.processing.delete(task.id)
    }
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
    const queueStore = this.getQueueStore()
    if (!this.isRunning && this.processor && queueStore.queueSize > 0) {
      this.startProcessing()
    }
  }
}


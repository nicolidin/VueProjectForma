/**
 * Queue Manager pour gérer séquentiellement les tâches de persistance
 * Code pur, sans dépendances externes
 * Respecte le principe SOC en étant complètement découplé
 */

import type { PersistenceTask } from './types'
import { TaskPriority } from './types'

/**
 * Options de configuration de la queue
 */
export interface QueueOptions {
  maxConcurrent?: number // Nombre max de tâches en parallèle (défaut: 1 = séquentiel)
  retryDelay?: number // Délai en ms avant retry (défaut: 1000)
  maxQueueSize?: number // Taille max de la queue (défaut: Infinity)
}

/**
 * Callback appelé quand une tâche est traitée
 */
export type TaskProcessor<T = unknown> = (task: PersistenceTask<T>) => Promise<void>

/**
 * Queue Manager pour gérer les tâches de persistance
 * Traite les tâches séquentiellement (ou avec un parallélisme limité)
 * Gère automatiquement les retries
 */
export class QueueManager<T = unknown> {
  private queue: PersistenceTask<T>[] = []
  private processing: Set<string> = new Set()
  private options: Required<QueueOptions>
  private processor?: TaskProcessor<T>
  private isRunning = false

  constructor(options: QueueOptions = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 1,
      retryDelay: options.retryDelay ?? 1000,
      maxQueueSize: options.maxQueueSize ?? Infinity
    }
  }

  /**
   * Définit le processeur de tâches
   */
  setProcessor(processor: TaskProcessor<T>): void {
    this.processor = processor
  }

  /**
   * Ajoute une tâche à la queue
   * Les tâches sont triées par priorité (plus haute priorité en premier)
   */
  enqueue(task: PersistenceTask<T>): void {
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error(`Queue is full (max size: ${this.options.maxQueueSize})`)
    }

    // Insérer la tâche à la bonne position selon la priorité
    const insertIndex = this.queue.findIndex(
      t => t.priority < task.priority
    )
    
    if (insertIndex === -1) {
      this.queue.push(task)
    } else {
      this.queue.splice(insertIndex, 0, task)
    }

    // Démarrer le traitement si pas déjà en cours
    if (!this.isRunning && this.processor) {
      this.startProcessing()
    }
  }

  /**
   * Retire une tâche de la queue
   */
  dequeue(taskId: string): boolean {
    const index = this.queue.findIndex(t => t.id === taskId)
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Retourne la taille de la queue
   */
  size(): number {
    return this.queue.length
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
    return this.queue.length === 0 && this.processing.size === 0
  }

  /**
   * Vide la queue
   */
  clear(): void {
    this.queue = []
  }

  /**
   * Retourne toutes les tâches en attente
   */
  getPendingTasks(): ReadonlyArray<PersistenceTask<T>> {
    return [...this.queue]
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

    while (this.queue.length > 0 || this.processing.size > 0) {
      // Traiter jusqu'à maxConcurrent tâches en parallèle
      const tasksToProcess: PersistenceTask<T>[] = []
      
      while (
        tasksToProcess.length < this.options.maxConcurrent &&
        this.queue.length > 0 &&
        this.processing.size < this.options.maxConcurrent
      ) {
        const task = this.queue.shift()
        if (task && !this.processing.has(task.id)) {
          tasksToProcess.push(task)
        }
      }

      // Traiter les tâches en parallèle
      const promises = tasksToProcess.map(task => this.processTask(task))
      await Promise.allSettled(promises)

      // Si la queue est vide mais qu'on attend encore des tâches, on attend un peu
      if (this.queue.length === 0 && this.processing.size > 0) {
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
    } catch (error) {
      // Si la tâche peut être retentée, on la remet en queue
      if (task.retryCount < task.maxRetries) {
        task.retryCount++
        // Attendre avant de retenter
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay))
        this.enqueue(task)
      } else {
        // Tâche échouée définitivement
        console.error(`Task ${task.id} failed after ${task.maxRetries} retries:`, error)
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
}


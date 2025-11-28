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
  exponentialBackoffBase?: number // Base pour le backoff exponentiel après maxRetries (défaut: 30000 = 30s)
}

/**
 * Calcule le délai de retry avec backoff exponentiel
 * - Pour les 3 premières tentatives : délai normal (retryDelay)
 * - Après 3 tentatives : backoff exponentiel (30s, 60s, 120s...)
 * @private
 */
function calculateRetryDelay(
  retryCount: number,
  maxRetries: number,
  baseRetryDelay: number,
  exponentialBackoffBase: number
): number {
  if (retryCount <= maxRetries) {
    // Retries rapides pour les premières tentatives
    return baseRetryDelay
  }
  
  // Backoff exponentiel après maxRetries
  const exponentialAttempts = retryCount - maxRetries
  return exponentialBackoffBase * Math.pow(2, exponentialAttempts - 1)
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
      autoStart: options.autoStart ?? true,
      exponentialBackoffBase: options.exponentialBackoffBase ?? 30000
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
   * Note: Ne démarre pas automatiquement le traitement pour éviter les race conditions
   * Le traitement sera démarré explicitement via restart() après l'initialisation complète
   */
  setProcessor(processor: TaskProcessor<T>): void {
    console.log('[PersistedQueueManager] setProcessor called')
    this.processor = processor
    const queueStore = this.getQueueStore()
    console.log('[PersistedQueueManager] Processor set, queue size:', queueStore.queueSize, 'isRunning:', this.isRunning)
    // Ne pas démarrer automatiquement ici - sera fait explicitement via restart() après init complète
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

    console.log('[PersistedQueueManager] enqueue called:', {
      taskId: task.id,
      entityType: task.entityType,
      operation: task.operation,
      currentQueueSize: queueStore.queueSize,
      hasProcessor: !!this.processor,
      isRunning: this.isRunning
    })

    // Utiliser le store pour persister automatiquement
    queueStore.enqueue(task)
    
    console.log('[PersistedQueueManager] Task added to store, new queue size:', queueStore.queueSize)

    // Démarrer le traitement si pas déjà en cours
    if (!this.isRunning && this.processor) {
      console.log('[PersistedQueueManager] Starting processing...')
      this.startProcessing()
    } else if (!this.processor) {
      console.warn('[PersistedQueueManager] Processor not set yet, task will wait')
    } else {
      console.log('[PersistedQueueManager] Already processing, task will be picked up')
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
      console.log('[PersistedQueueManager] startProcessing aborted:', { 
        isRunning: this.isRunning, 
        hasProcessor: !!this.processor 
      })
      return
    }

    console.log('[PersistedQueueManager] startProcessing started')
    this.isRunning = true

    while (true) {
      const queueStore = this.getQueueStore()
      
      if (queueStore.queueSize === 0 && this.processing.size === 0) {
        console.log('[PersistedQueueManager] Queue empty, stopping processing')
        break
      }

      // Récupérer les tâches depuis le store (triées par priorité)
      const sortedTasks = queueStore.sortedTasks as PersistenceTask<T>[]
      const tasksToProcess: PersistenceTask<T>[] = []

      // Prendre jusqu'à maxConcurrent tâches
      // Ne pas retirer de la queue maintenant : on le fera seulement après succès
      for (const task of sortedTasks) {
        if (
          tasksToProcess.length < this.options.maxConcurrent &&
          !this.processing.has(task.id) &&
          this.processing.size < this.options.maxConcurrent
        ) {
          // Ne pas retirer de la queue : la tâche reste dans pendingTasks
          // Elle sera retirée seulement après succès dans processTask
          tasksToProcess.push(task)
        }
      }

      // Traiter les tâches en parallèle
      if (tasksToProcess.length > 0) {
        console.log('[PersistedQueueManager] Processing', tasksToProcess.length, 'tasks:', 
          tasksToProcess.map(t => `${t.entityType}:${t.operation}:${t.id.substring(0, 20)}...`))
        const promises = tasksToProcess.map(task => this.processTask(task))
        await Promise.allSettled(promises)
      }

      // Si la queue est vide mais qu'on attend encore des tâches, on attend un peu
      if (queueStore.queueSize === 0 && this.processing.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    this.isRunning = false
    console.log('[PersistedQueueManager] Processing stopped')
  }

  /**
   * Traite une tâche
   * Offline-first : la tâche reste dans la queue jusqu'à succès
   * @private
   */
  private async processTask(task: PersistenceTask<T>): Promise<void> {
    if (!this.processor) {
      console.warn('[PersistedQueueManager] processTask called but no processor')
      return
    }

    console.log('[PersistedQueueManager] processTask started:', {
      taskId: task.id,
      entityType: task.entityType,
      operation: task.operation,
      retryCount: task.retryCount
    })

    this.processing.add(task.id)
    const queueStore = this.getQueueStore()

    try {
      await this.processor(task)
      
      // ✅ Tâche réussie : maintenant on peut la retirer de la queue
      queueStore.dequeue(task.id)
      console.log('[PersistedQueueManager] Task completed successfully:', task.id)
    } catch (error) {
      // ❌ Tâche échouée : toujours remettre en queue avec backoff exponentiel
      // Offline-first : on ne supprime jamais une tâche, on la retente indéfiniment
      task.retryCount++
      
      console.warn('[PersistedQueueManager] Task failed:', {
        taskId: task.id,
        retryCount: task.retryCount,
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Calculer le délai avec backoff exponentiel
      const delay = calculateRetryDelay(
        task.retryCount,
        task.maxRetries,
        this.options.retryDelay,
        this.options.exponentialBackoffBase
      )
      
      // Log pour les retries après maxRetries (backoff exponentiel)
      if (task.retryCount > task.maxRetries) {
        console.log(
          `[PersistedQueueManager] Task ${task.id} retry ${task.retryCount} after ${delay}ms (exponential backoff)`
        )
      }
      
      // Attendre avant de retenter
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Remettre en queue (persistée) avec le retryCount mis à jour
      // La tâche est déjà dans la queue, mais on la met à jour pour persister le retryCount
      queueStore.updateTask(task.id, { retryCount: task.retryCount })
      
      // Si la tâche n'est plus dans la queue (cas edge), la remettre
      if (!queueStore.getTaskById(task.id)) {
        queueStore.enqueue(task)
      }
      
      console.log('[PersistedQueueManager] Task scheduled for retry:', task.id)
    } finally {
      this.processing.delete(task.id)
      console.log('[PersistedQueueManager] processTask finished:', task.id)
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


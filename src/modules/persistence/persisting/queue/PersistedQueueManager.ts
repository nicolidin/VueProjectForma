/**
 * Queue Manager qui utilise le store Pinia pour la persistance
 * Code pur, respecte le principe SOC
 * La queue est automatiquement persistée dans localStorage via Pinia
 */

import type { PersistenceTask } from '../../core/types'
import { TaskPriority } from '../../core/types'
import type { IQueueManager, TaskProcessor } from '../../core/IQueueManager'
import { RetryManager, type RetryConfig } from '../../core/retryManager'
import { TIMING, QUEUE_DEFAULTS } from '../../core/constants'
import { updateMetadataOnError } from '../../core/metadata'
import { usePersistenceQueueStore } from '../store'

/**
 * Queue Manager qui utilise le store Pinia pour la persistance
 * Les tâches sont automatiquement persistées dans localStorage
 * Restaure automatiquement les tâches au démarrage
 */
export class PersistedQueueManager<T = unknown> implements IQueueManager<T> {
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
    if (queueStore.queueSize >= this.maxQueueSize) {
      throw new Error(`Queue is full (max size: ${this.maxQueueSize})`)
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
      const now = Date.now()

      // Prendre jusqu'à maxConcurrent tâches qui sont prêtes à être traitées
      // Une tâche est prête si :
      // - Elle n'est pas déjà en cours de traitement
      // - Elle n'a pas de retryAt OU retryAt est dans le passé
      for (const task of sortedTasks) {
        if (
          tasksToProcess.length < this.maxConcurrent &&
          !this.processing.has(task.id) &&
          this.processing.size < this.maxConcurrent
        ) {
          // Vérifier si la tâche est prête à être traitée (pas de retryAt ou retryAt dépassé)
          const isReady = !task.retryAt || task.retryAt <= now
          
          if (isReady) {
            // Si la tâche avait un retryAt, le supprimer car elle est maintenant prête
            // On met à jour la tâche pour retirer retryAt (même si undefined, la vérification !task.retryAt fonctionne)
            if (task.retryAt) {
              queueStore.updateTask(task.id, { retryAt: undefined })
            }
            tasksToProcess.push(task)
          }
        }
      }

      // Traiter les tâches en parallèle
      if (tasksToProcess.length > 0) {
        console.log('[PersistedQueueManager] Processing', tasksToProcess.length, 'tasks:', 
          tasksToProcess.map(t => `${t.entityType}:${t.operation}:${t.id.substring(0, 20)}...`))
        const promises = tasksToProcess.map(task => this.processTask(task))
        await Promise.allSettled(promises)
      }

      // Calculer le prochain retryAt le plus proche pour savoir quand réessayer
      const nextRetryAt = sortedTasks
        .filter(task => task.retryAt && task.retryAt > now)
        .map(task => task.retryAt!)
        .sort((a, b) => a - b)[0]

      // Si on a des tâches en attente de retry, attendre jusqu'au prochain retry
      if (nextRetryAt) {
        const waitTime = nextRetryAt - now
        if (waitTime > 0) {
          console.log(`[PersistedQueueManager] Waiting ${Math.round(waitTime / TIMING.MS_PER_SECOND)}s until next retry at ${new Date(nextRetryAt).toISOString()}`)
          await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, TIMING.POLLING_INTERVAL_MAX_WAIT)))
        }
      } else if (queueStore.queueSize === 0 && this.processing.size > 0) {
        // Si la queue est vide mais qu'on attend encore des tâches, on attend un peu
        await new Promise(resolve => setTimeout(resolve, TIMING.POLLING_INTERVAL_SHORT))
      } else if (queueStore.queueSize > 0 && tasksToProcess.length === 0) {
        // Si on a des tâches mais qu'elles ne sont pas prêtes (retryAt dans le futur), attendre un peu
        await new Promise(resolve => setTimeout(resolve, TIMING.POLLING_INTERVAL_NORMAL))
      }
    }

    this.isRunning = false
    console.log('[PersistedQueueManager] Processing stopped')
  }

  /**
   * Traite une tâche
   * Offline-first : la tâche reste dans la queue jusqu'à succès (si erreur récupérable)
   * @private
   */
  private async processTask(task: PersistenceTask<T>): Promise<void> {
    if (!this.processor) {
      console.warn('[PersistedQueueManager] processTask called but no processor')
      return
    }

    // Utiliser les métadonnées comme source de vérité
    const metadata = task.payload.metadata

    console.log('[PersistedQueueManager] processTask started:', {
      taskId: task.id,
      entityType: task.entityType,
      operation: task.operation,
      retryCount: metadata.retryCount
    })

    this.processing.add(task.id)
    const queueStore = this.getQueueStore()

    // Vérifier l'expiration de la tâche avant traitement
    if (task.expiresAt && Date.now() > task.expiresAt) {
      console.warn(`[PersistedQueueManager] Task ${task.id} expired, removing from queue`)
      queueStore.dequeue(task.id)
      this.processing.delete(task.id)
      return
    }

    // Calculer expiresAt si maxAge est défini mais pas expiresAt
    if (task.maxAge && !task.expiresAt) {
      task.expiresAt = task.createdAt + task.maxAge
      queueStore.updateTask(task.id, { expiresAt: task.expiresAt })
    }

    try {
      await this.processor(task)
      
      // ✅ Tâche réussie : maintenant on peut la retirer de la queue
      queueStore.dequeue(task.id)
      console.log('[PersistedQueueManager] Task completed successfully:', task.id)
    } catch (error) {
      // Utiliser les métadonnées comme source de vérité
      const shouldRetry = this.retryManager.shouldRetry(error, {
        ...task,
        retryCount: metadata.retryCount,
        maxRetries: metadata.maxRetries
      })
      
      if (!shouldRetry) {
        // Erreur non récupérable ou expiration : supprimer de la queue
        const analysis = this.retryManager.analyzeError(error)
        console.error(`[PersistedQueueManager] Task ${task.id} failed permanently:`, {
          code: analysis.code,
          message: analysis.message,
          httpStatus: analysis.httpStatus,
          retryCount: metadata.retryCount
        })
        
        queueStore.dequeue(task.id)
        return
      }

      // Mettre à jour les métadonnées (source de vérité)
      const updatedMetadata = updateMetadataOnError(metadata, error)
      task.payload.metadata = updatedMetadata
      
      // Calculer le délai avec backoff exponentiel
      const delay = this.retryManager.calculateDelay({
        ...task,
        retryCount: updatedMetadata.retryCount,
        maxRetries: updatedMetadata.maxRetries
      })
      const delayInMinutes = Math.round(delay / TIMING.MS_PER_MINUTE * 10) / 10
      const retryAt = Date.now() + delay
      
      console.warn('[PersistedQueueManager] Task failed, will retry:', {
        taskId: task.id,
        retryCount: updatedMetadata.retryCount,
        delayMs: delay,
        delayMinutes: delayInMinutes,
        retryAt: new Date(retryAt).toISOString(),
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Mettre à jour la tâche avec les nouvelles métadonnées
      queueStore.updateTask(task.id, { 
        payload: task.payload,
        retryAt: retryAt
      })
      
      console.log(`[PersistedQueueManager] Task scheduled for retry ${updatedMetadata.retryCount} at ${new Date(retryAt).toISOString()} (in ${delayInMinutes} minutes):`, task.id)
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


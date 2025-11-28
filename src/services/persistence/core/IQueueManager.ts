/**
 * Interface commune pour les queue managers
 * Permet d'utiliser QueueManager ou PersistedQueueManager de manière interchangeable
 */

import type { PersistenceTask } from './types'

/**
 * Callback appelé quand une tâche est traitée
 */
export type TaskProcessor<T = unknown> = (task: PersistenceTask<T>) => Promise<void>

/**
 * Interface commune pour les queue managers
 */
export interface IQueueManager<T = unknown> {
  setProcessor(processor: TaskProcessor<T>): void
  enqueue(task: PersistenceTask<T>): void
  dequeue(taskId: string): boolean
  size(): number
  processingCount(): number
  isEmpty(): boolean
  clear(): void
  getPendingTasks(): ReadonlyArray<PersistenceTask<T>>
  getProcessingTasks(): string[]
  stop(): void
}


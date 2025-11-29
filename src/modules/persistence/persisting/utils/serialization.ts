/**
 * Helpers pour la sérialisation/désérialisation des tâches de persistance
 * Code pur, sans dépendances externes
 */

import type { PersistenceTask } from '../../core/types'
import { TASK_LIFETIME } from '../../core/constants'

/**
 * Vérifie si une tâche est valide (structure correcte)
 */
export function isValidTask(task: unknown): task is PersistenceTask {
  if (!task || typeof task !== 'object') {
    return false
  }

  const t = task as Record<string, unknown>

  return (
    typeof t.id === 'string' &&
    typeof t.entityType === 'string' &&
    ['create', 'update', 'delete'].includes(t.operation as string) &&
    typeof t.payload === 'object' &&
    t.payload !== null &&
    typeof t.priority === 'number' &&
    typeof t.createdAt === 'number' &&
    typeof t.retryCount === 'number' &&
    typeof t.maxRetries === 'number'
  )
}

/**
 * Nettoie les tâches invalides d'un tableau
 */
export function filterValidTasks(tasks: unknown[]): PersistenceTask[] {
  return tasks.filter(isValidTask)
}

/**
 * Vérifie si une tâche est expirée (optionnel, pour nettoyer les vieilles tâches)
 * Utilise TASK_LIFETIME.DEFAULT_MAX_AGE_MS par défaut
 */
export function isTaskExpired(task: PersistenceTask, maxAge: number = TASK_LIFETIME.DEFAULT_MAX_AGE_MS): boolean {
  const age = Date.now() - task.createdAt
  return age > maxAge
}

/**
 * Nettoie les tâches expirées d'un tableau
 */
export function filterExpiredTasks(tasks: PersistenceTask[], maxAge?: number): PersistenceTask[] {
  return tasks.filter(task => !isTaskExpired(task, maxAge))
}


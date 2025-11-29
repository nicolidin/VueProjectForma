/**
 * Helpers pour la sérialisation/désérialisation des tâches de persistance
 * Code pur, sans dépendances externes
 */

import type { PersistenceTask } from '../../core/types'
import { TASK_LIFETIME } from '../../core/constants'

/**
 * Vérifie si une tâche est valide (structure correcte)
 * retryCount et maxRetries sont dans payload.metadata
 */
export function isValidTask(task: unknown): task is PersistenceTask {
  if (!task || typeof task !== 'object') {
    return false
  }

  const t = task as Record<string, unknown>

  // Vérifier la structure de base
  if (
    typeof t.id !== 'string' ||
    typeof t.entityType !== 'string' ||
    !['create', 'update', 'delete'].includes(t.operation as string) ||
    typeof t.payload !== 'object' ||
    t.payload === null ||
    typeof t.priority !== 'number' ||
    typeof t.createdAt !== 'number'
  ) {
    return false
  }

  // Vérifier que payload.metadata existe et contient retryCount et maxRetries
  const payload = t.payload as Record<string, unknown>
  if (
    typeof payload.metadata !== 'object' ||
    payload.metadata === null
  ) {
    return false
  }

  const metadata = payload.metadata as Record<string, unknown>
  return (
    typeof metadata.retryCount === 'number' &&
    typeof metadata.maxRetries === 'number'
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


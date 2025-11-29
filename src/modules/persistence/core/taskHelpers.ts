/**
 * Helpers pour créer des tâches de persistance
 * Centralise la logique de création de tâches pour éviter la duplication
 * Code pur, sans dépendances externes
 */

import type { PersistenceTask, PersistableEntity, PersistenceOperation } from './types'
import { TaskPriority } from './types'
import { createMetadata } from './metadata'

/**
 * Options pour la création d'une tâche
 */
export interface CreateTaskOptions {
  priority?: number
  expiresAt?: number
  maxAge?: number
  retryAt?: number
}

/**
 * Crée une tâche de persistance
 * Centralise la logique de création pour les opérations create, update et delete
 * 
 * @param operation - Type d'opération (create, update, delete)
 * @param entityType - Type d'entité (note, tag, etc.)
 * @param data - Données de l'entité (complètes pour create, partielles pour update, ignorées pour delete)
 * @param id - Identifiant de l'entité (frontId pour create, id pour update/delete)
 * @param maxRetries - Nombre maximum de tentatives
 * @param options - Options supplémentaires (priorité, expiration, etc.)
 */
export function createTask<T = unknown>(
  operation: PersistenceOperation,
  entityType: string,
  data: T | Partial<T>,
  id: string,
  maxRetries: number,
  options: CreateTaskOptions = {}
): PersistenceTask<T> {
  // Pour create, extraire le frontId depuis les données si disponible
  const frontId = operation === 'create' 
    ? ((data as any)?.frontId || id)
    : id

  // Créer les métadonnées
  const metadata = createMetadata(frontId, { maxRetries })

  // Créer l'entité
  // Pour delete, on n'a pas besoin de données
  const entityData = operation === 'delete' ? ({} as T) : (data as T)
  const entity: PersistableEntity<T> = {
    data: entityData,
    metadata
  }

  // Créer la tâche
  const timestamp = Date.now()
  return {
    id: `${operation}-${entityType}-${frontId}-${timestamp}`,
    entityType,
    operation,
    payload: entity,
    priority: options.priority ?? TaskPriority.NORMAL,
    createdAt: timestamp,
    expiresAt: options.expiresAt,
    maxAge: options.maxAge,
    retryAt: options.retryAt
  }
}


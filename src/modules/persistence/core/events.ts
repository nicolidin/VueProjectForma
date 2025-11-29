/**
 * Constantes pour les noms d'événements du système de persistance
 * Évite les magic strings et facilite la maintenance
 */

/**
 * Événements émis par les stores (demande de persistance)
 */
export const ENTITY_EVENTS = {
  CREATED: 'entity:created',
  UPDATED: 'entity:updated',
  DELETED: 'entity:deleted',
} as const

/**
 * Événements émis par le système de persistance (résultats)
 */
export const PERSISTENCE_EVENTS = {
  PERSISTED: 'entity:persisted',
  PERSIST_ERROR: 'entity:persist-error',
  UPDATE_ERROR: 'entity:update-error',
  DELETE_ERROR: 'entity:delete-error',
} as const

/**
 * Événements de la queue
 */
export const QUEUE_EVENTS = {
  TASK_ENQUEUED: 'queue:task-enqueued',
  TASK_PROCESSING: 'queue:task-processing',
  TASK_COMPLETED: 'queue:task-completed',
  TASK_FAILED: 'queue:task-failed',
  TASK_FAILED_PERMANENTLY: 'queue:task-failed-permanently',
  TASK_EXPIRED: 'queue:task-expired',
} as const

/**
 * Tous les événements du système de persistance
 */
export const PERSISTENCE_EVENT_NAMES = {
  ...ENTITY_EVENTS,
  ...PERSISTENCE_EVENTS,
  ...QUEUE_EVENTS,
} as const


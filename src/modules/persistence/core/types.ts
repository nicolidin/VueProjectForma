/**
 * Types génériques pour le système de persistance
 * Respecte le principe SOC en étant complètement découplé des entités métier
 */

/**
 * Statut de synchronisation d'une entité
 */
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'conflict'

/**
 * Métadonnées de persistance pour une entité
 * Permet de tracker l'état de synchronisation, les erreurs, les retries, etc.
 */
export interface PersistenceMetadata {
  frontId: string
  backendId?: string
  syncStatus: SyncStatus
  lastSyncAt?: number
  version?: number // Pour CRDT/optimistic locking
  retryCount: number
  maxRetries: number
  error?: unknown
  createdAt: number
}

/**
 * Entité persistable avec ses métadonnées
 */
export interface PersistableEntity<T> {
  data: T
  metadata: PersistenceMetadata
}

/**
 * Type d'opération de persistance
 */
export type PersistenceOperation = 'create' | 'update' | 'delete'

/**
 * Priorité d'une tâche de persistance
 */
export const TaskPriority = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 20
} as const

export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority]

/**
 * Tâche de persistance à traiter par la queue
 */
export interface PersistenceTask<T = unknown> {
  id: string
  entityType: string // 'note' | 'tag' | etc.
  operation: PersistenceOperation
  payload: PersistableEntity<T>
  priority: TaskPriority
  createdAt: number
  retryCount: number
  maxRetries: number
  /**
   * Timestamp d'expiration de la tâche (optionnel)
   * Si défini, la tâche ne sera plus retentée après cette date
   * Utile pour éviter de garder des tâches obsolètes indéfiniment
   */
  expiresAt?: number
  /**
   * Âge maximum de la tâche en ms (optionnel)
   * Si défini, expiresAt sera calculé automatiquement à createdAt + maxAge
   */
  maxAge?: number
}

/**
 * Événements émis par le système de persistance
 * Générique pour supporter n'importe quel type d'entité
 */
export type PersistenceEvents<T = unknown> = {
  // Événements émis par le store (demande de persistance)
  'entity:created': { entityType: string; data: T }
  'entity:updated': { entityType: string; id: string; updates: Partial<T> }
  'entity:deleted': { entityType: string; id: string }
  
  // Événements émis par le système de persistance (résultats)
  'entity:persisted': { entityType: string; original: PersistableEntity<T>; persisted: PersistableEntity<T> }
  'entity:persist-error': { entityType: string; task: PersistenceTask<T>; error: unknown }
  'entity:update-error': { entityType: string; task: PersistenceTask<T>; error: unknown }
  'entity:delete-error': { entityType: string; task: PersistenceTask<T>; error: unknown }
  
  // Événements de la queue
  'queue:task-enqueued': { task: PersistenceTask<T> }
  'queue:task-processing': { task: PersistenceTask<T> }
  'queue:task-completed': { task: PersistenceTask<T> }
  'queue:task-failed': { task: PersistenceTask<T>; error: unknown }
  'queue:task-failed-permanently': { task: PersistenceTask<T>; error: unknown }
  'queue:task-expired': { task: PersistenceTask<T> }
}

/**
 * Interface pour les stratégies de persistance
 * Générique pour supporter n'importe quel type d'entité
 */
export interface PersistenceStrategy<T = unknown> {
  /**
   * Persiste la création d'une entité
   */
  persistCreate(entity: PersistableEntity<T>): Promise<PersistableEntity<T>>

  /**
   * Persiste la mise à jour d'une entité
   */
  persistUpdate(entity: PersistableEntity<T>): Promise<PersistableEntity<T>>

  /**
   * Persiste la suppression d'une entité
   */
  persistDelete(id: string, entityType: string): Promise<void>

  /**
   * Optionnel : fusionne deux versions d'une entité (pour CRDT)
   */
  merge?(local: T, remote: T): T

  /**
   * Optionnel : résout un conflit entre deux versions (pour optimistic locking)
   */
  resolveConflict?(local: T, remote: T): T
}


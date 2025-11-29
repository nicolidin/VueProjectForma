/**
 * Helpers pour gérer les métadonnées de persistance
 * Code pur, sans dépendances externes
 */

import type { PersistenceMetadata, SyncStatus } from './types'
import { RETRY_DEFAULTS } from './constants'

/**
 * Crée des métadonnées par défaut pour une nouvelle entité
 */
export function createMetadata(
  frontId: string,
  options?: Partial<PersistenceMetadata>
): PersistenceMetadata {
  return {
    frontId,
    syncStatus: 'pending',
    retryCount: 0,
    maxRetries: RETRY_DEFAULTS.MAX_RETRIES,
    createdAt: Date.now(),
    ...options
  }
}

/**
 * Met à jour les métadonnées après une synchronisation réussie
 */
export function updateMetadataOnSuccess(
  metadata: PersistenceMetadata,
  backendId?: string,
  version?: number
): PersistenceMetadata {
  return {
    ...metadata,
    syncStatus: 'synced',
    backendId: backendId || metadata.backendId,
    version: version || metadata.version,
    lastSyncAt: Date.now(),
    error: undefined
  }
}

/**
 * Met à jour les métadonnées après une erreur
 */
export function updateMetadataOnError(
  metadata: PersistenceMetadata,
  error: unknown
): PersistenceMetadata {
  return {
    ...metadata,
    syncStatus: 'error',
    error,
    retryCount: metadata.retryCount + 1,
    lastSyncAt: Date.now()
  }
}

/**
 * Met à jour les métadonnées pendant la synchronisation
 */
export function updateMetadataOnSyncing(
  metadata: PersistenceMetadata
): PersistenceMetadata {
  return {
    ...metadata,
    syncStatus: 'syncing',
    lastSyncAt: Date.now()
  }
}

/**
 * Vérifie si une entité peut être retentée
 */
export function canRetry(metadata: PersistenceMetadata): boolean {
  return (
    metadata.syncStatus === 'error' &&
    metadata.retryCount < metadata.maxRetries
  )
}

/**
 * Vérifie si une entité a été synchronisée
 */
export function isSynced(metadata: PersistenceMetadata): boolean {
  return metadata.syncStatus === 'synced'
}

/**
 * Vérifie si une entité est en attente de synchronisation
 */
export function isPending(metadata: PersistenceMetadata): boolean {
  return metadata.syncStatus === 'pending'
}


/**
 * Export centralisé du module de persistance
 * Permet d'importer facilement les éléments nécessaires
 */

export { noteEventBus } from './eventBus'
export { PersistenceService } from './PersistenceService'
export { RestApiPersistence } from './RestApiPersistence'
export { usePersistence } from './usePersistence'
export type { PersistenceStrategy, PersistenceEvents } from './types'


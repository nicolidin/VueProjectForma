/**
 * Constantes pour le système de persistance
 * Centralise toutes les valeurs magiques pour faciliter la maintenance et la configuration
 */

/**
 * Constantes de timing pour les intervalles de polling et d'attente
 */
export const TIMING = {
  /**
   * Intervalle de polling court (100ms)
   * Utilisé quand la queue est vide mais qu'on attend encore des tâches en cours
   */
  POLLING_INTERVAL_SHORT: 100,

  /**
   * Intervalle de polling normal (1 seconde)
   * Utilisé pour vérifier périodiquement les tâches en attente de retry
   */
  POLLING_INTERVAL_NORMAL: 1000,

  /**
   * Délai maximum d'attente pour un retry (5 secondes)
   * Évite de bloquer trop longtemps la boucle de traitement
   */
  POLLING_INTERVAL_MAX_WAIT: 5000,

  /**
   * Conversions de temps
   */
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 60 * 1000,
  MS_PER_HOUR: 60 * 60 * 1000,
  MS_PER_DAY: 24 * 60 * 60 * 1000,
} as const

/**
 * Constantes de retry par défaut
 */
export const RETRY_DEFAULTS = {
  /**
   * Délai initial du premier retry (30 secondes)
   */
  INITIAL_DELAY_MS: 30000,

  /**
   * Délai maximum entre deux tentatives (10 minutes)
   */
  MAX_DELAY_MS: 600000,

  /**
   * Nombre maximum de tentatives par défaut
   */
  MAX_RETRIES: 3,

  /**
   * Multiplicateur pour le backoff exponentiel
   */
  MULTIPLIER: 4,
} as const

/**
 * Constantes de queue par défaut
 */
export const QUEUE_DEFAULTS = {
  /**
   * Nombre maximum de tâches traitées en parallèle (1 = séquentiel)
   */
  MAX_CONCURRENT: 1,

  /**
   * Taille maximum de la queue (Infinity = illimitée)
   */
  MAX_QUEUE_SIZE: Infinity,

  /**
   * Délai de retry simple pour QueueManager (non utilisé actuellement)
   * @deprecated Utiliser RetryManager avec backoff exponentiel à la place
   */
  RETRY_DELAY_MS: 1000,
} as const

/**
 * Constantes de durée de vie des tâches
 */
export const TASK_LIFETIME = {
  /**
   * Durée de vie par défaut d'une tâche (7 jours)
   */
  DEFAULT_MAX_AGE_DAYS: 7,

  /**
   * Durée de vie par défaut d'une tâche en millisecondes (7 jours)
   */
  DEFAULT_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
} as const


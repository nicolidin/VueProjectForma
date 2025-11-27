import type { PersistenceEvents } from './types'

/**
 * Type pour les handlers d'événements
 */
type EventHandler<T> = (payload: T) => void

/**
 * Event Bus simple et léger pour la communication entre le store et les services de persistance
 * Respecte le principe SOC en découplant l'émission d'événements de leur traitement
 */
class EventBus<T extends Record<string, unknown>> {
  private handlers: Map<keyof T, Set<EventHandler<any>>> = new Map()

  /**
   * Écoute un événement
   * @param event - Le nom de l'événement
   * @param handler - La fonction à exécuter quand l'événement est émis
   * @returns Une fonction pour se désabonner
   */
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)

    // Retourne une fonction de désabonnement
    return () => {
      const handlers = this.handlers.get(event)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.handlers.delete(event)
        }
      }
    }
  }

  /**
   * Émet un événement
   * @param event - Le nom de l'événement
   * @param payload - Les données de l'événement
   */
  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload)
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error)
        }
      })
    }
  }

  /**
   * Retire tous les listeners d'un événement
   * @param event - Le nom de l'événement (optionnel, si non fourni retire tous les listeners)
   */
  off<K extends keyof T>(event?: K): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}

/**
 * Instance globale de l'event bus pour les événements de persistance
 */
export const noteEventBus = new EventBus<PersistenceEvents>()


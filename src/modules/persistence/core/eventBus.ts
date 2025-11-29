/**
 * Event Bus générique et réutilisable
 * Code pur, sans dépendances externes
 * Respecte le principe SOC en étant complètement découplé
 */

type EventHandler<T> = (payload: T) => void | Promise<void>

/**
 * Event Bus simple et léger pour la communication découplée
 * Supporte les handlers synchrones et asynchrones
 */
export class EventBus<T extends Record<string, unknown>> {
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
          const result = handler(payload)
          // Si le handler retourne une Promise, on la catch silencieusement
          // pour éviter les erreurs non gérées
          if (result instanceof Promise) {
            result.catch(error => {
              console.error(`Error in async event handler for ${String(event)}:`, error)
            })
          }
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error)
        }
      })
    }
  }

}


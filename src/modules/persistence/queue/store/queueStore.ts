/**
 * Store Pinia pour la queue de persistance
 * Gère l'état de la queue et la persiste automatiquement dans localStorage
 * Code pur, respecte le principe SOC
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PersistenceTask } from '../../core/types'
import { filterValidTasks } from '../utils/serialization'

/**
 * Store pour gérer la queue de persistance
 * Les tâches sont automatiquement persistées dans localStorage via Pinia
 */
export const usePersistenceQueueStore = defineStore('persistenceQueue', () => {
  // État : liste des tâches en attente de traitement
  const pendingTasks = ref<PersistenceTask[]>([])

  // Computed : taille de la queue
  const queueSize = computed(() => pendingTasks.value.length)

  // Computed : vérifie si la queue est vide
  const isEmpty = computed(() => pendingTasks.value.length === 0)

  // Computed : retourne les tâches triées par priorité (plus haute en premier)
  const sortedTasks = computed(() => {
    return [...pendingTasks.value].sort((a, b) => b.priority - a.priority)
  })

  /**
   * Ajoute une tâche à la queue
   * Évite les doublons et insère selon la priorité
   */
  function enqueue(task: PersistenceTask): void {
    // Éviter les doublons
    if (pendingTasks.value.some(t => t.id === task.id)) {
      console.warn(`[PersistenceQueueStore] Task ${task.id} already exists in queue, skipping`)
      return
    }

    console.log('[PersistenceQueueStore] enqueue called:', {
      taskId: task.id,
      entityType: task.entityType,
      operation: task.operation,
      currentSize: pendingTasks.value.length
    })

    // Insérer selon la priorité (plus haute priorité en premier)
    const insertIndex = pendingTasks.value.findIndex(
      t => t.priority < task.priority
    )

    if (insertIndex === -1) {
      pendingTasks.value.push(task)
    } else {
      pendingTasks.value.splice(insertIndex, 0, task)
    }
    
    console.log('[PersistenceQueueStore] Task added, new size:', pendingTasks.value.length)
  }

  /**
   * Retire une tâche de la queue
   */
  function dequeue(taskId: string): boolean {
    const index = pendingTasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      pendingTasks.value.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Vide la queue
   */
  function clear(): void {
    pendingTasks.value = []
  }

  /**
   * Récupère toutes les tâches en attente (copie pour éviter les mutations)
   */
  function getPendingTasks(): ReadonlyArray<PersistenceTask> {
    return [...pendingTasks.value]
  }

  /**
   * Met à jour une tâche existante
   */
  function updateTask(taskId: string, updates: Partial<PersistenceTask>): boolean {
    const index = pendingTasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      pendingTasks.value[index] = {
        ...pendingTasks.value[index],
        ...updates
      }
      return true
    }
    return false
  }

  return {
    // État
    pendingTasks,
    // Computed
    queueSize,
    isEmpty,
    sortedTasks,
    // Méthodes
    enqueue,
    dequeue,
    clear,
    getPendingTasks,
    updateTask
  }
}, {
  // Configuration de persistance Pinia
  persist: {
    key: 'persistenceQueue',
    storage: localStorage,
    // Ne persister que les tâches en attente
    pick: ['pendingTasks']
  }
})

/**
 * Initialise et valide le store après que Pinia soit prêt
 * Doit être appelé après l'initialisation de Pinia (dans usePersistence)
 */
export function initPersistenceQueueStore(): void {
  const store = usePersistenceQueueStore()
  
  // Nettoyer les tâches invalides après restauration depuis localStorage
  if (store.pendingTasks && Array.isArray(store.pendingTasks) && store.pendingTasks.length > 0) {
    const validTasks = filterValidTasks(store.pendingTasks)
    if (validTasks.length !== store.pendingTasks.length) {
      // Remplacer par les tâches validées si certaines étaient invalides
      store.pendingTasks = validTasks
      console.log(`[PersistenceQueueStore] Filtered ${store.pendingTasks.length - validTasks.length} invalid tasks`)
    }
  }
}


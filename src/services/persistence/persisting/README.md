# Module de Persistance Persistée

Ce module gère la persistance de la queue de persistance dans localStorage via Pinia.

## Structure

```
persisting/
├── store/
│   ├── persistenceQueueStore.ts  # Store Pinia pour la queue
│   └── index.ts                 # Exports
├── queue/
│   ├── PersistedQueueManager.ts # QueueManager qui utilise le store
│   └── index.ts                 # Exports
├── utils/
│   ├── serialization.ts        # Helpers pour validation/sérialisation
│   └── index.ts                 # Exports
└── index.ts                     # Exports centralisés
```

## Fonctionnement

### Store Pinia (`store/persistenceQueueStore.ts`)

Le store Pinia gère l'état de la queue et la persiste automatiquement dans localStorage :

- **État** : `pendingTasks` - Liste des tâches en attente
- **Persistance** : Automatique via `pinia-plugin-persistedstate`
- **Validation** : Les tâches invalides sont filtrées après restauration

### Queue Manager (`queue/PersistedQueueManager.ts`)

Le `PersistedQueueManager` utilise le store Pinia au lieu de gérer la queue en mémoire :

- **Persistance automatique** : Les tâches sont automatiquement sauvegardées dans localStorage
- **Restauration automatique** : Les tâches sont restaurées au démarrage de l'application
- **Compatibilité** : Implémente `IQueueManager` pour être compatible avec l'orchestrator

### Utils (`utils/serialization.ts`)

Helpers pour valider et nettoyer les tâches :

- `isValidTask()` : Vérifie si une tâche a une structure valide
- `filterValidTasks()` : Filtre les tâches invalides
- `isTaskExpired()` : Vérifie si une tâche est expirée
- `filterExpiredTasks()` : Filtre les tâches expirées

## Utilisation

Le `PersistedQueueManager` est utilisé automatiquement dans `usePersistence()` :

```typescript
// Dans usePersistence.ts
export const persistenceQueue = new PersistedQueueManager()
```

Les tâches sont automatiquement :
1. **Persistées** dans localStorage quand elles sont ajoutées à la queue
2. **Restaurées** au démarrage de l'application
3. **Traitées** automatiquement si le processeur est défini

## Avantages

1. **Persistance automatique** : Plus besoin de gérer manuellement la sauvegarde
2. **Restauration au démarrage** : Les tâches non traitées sont automatiquement récupérées
3. **SOC respectée** : Le store gère l'état, le manager gère la logique
4. **Validation** : Les tâches invalides sont automatiquement filtrées
5. **Débogage** : On peut inspecter la queue dans les DevTools Pinia

## Format de stockage dans localStorage

```json
{
  "persistenceQueue": {
    "pendingTasks": [
      {
        "id": "create-note-abc123-1701234567890",
        "entityType": "note",
        "operation": "create",
        "payload": {
          "data": { ... },
          "metadata": { ... }
        },
        "priority": 5,
        "createdAt": 1701234567890,
        "retryCount": 0,
        "maxRetries": 3
      }
    ]
  }
}
```


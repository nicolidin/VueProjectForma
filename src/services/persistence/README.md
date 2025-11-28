# Service de Persistance Générique

## Architecture

Ce module implémente une architecture de persistance générique basée sur **EventBus + QueueManager**, respectant les principes de **Separation of Concerns (SOC)** et permettant une extensibilité maximale pour supporter différentes stratégies (REST, CRDT, décentralisé, etc.).

### Structure

```
persistence/
├── core/
│   ├── types.ts              # Types génériques + metadata de persistance
│   ├── metadata.ts           # Helpers pour gérer les métadonnées
│   ├── eventBus.ts           # EventBus générique et réutilisable
│   ├── queue.ts              # QueueManager avec séquençage, retry, priorité
│   ├── orchestrator.ts       # Orchestrateur générique
│   └── index.ts              # Exports centralisés
├── strategies/
│   ├── RestApiStrategy.ts    # Stratégies REST pour notes et tags
│   └── index.ts              # Exports centralisés
├── usePersistence.ts         # Composable Vue pour initialisation
└── index.ts                  # Exports centralisés
```

## Principe de Fonctionnement

### 1. **EventBus** (`core/eventBus.ts`)
- Système de communication découplé entre le store et les services de persistance
- Le store émet des événements génériques (`entity:created`, `entity:updated`, `entity:deleted`)
- Les services de persistance écoutent ces événements
- Supporte les handlers synchrones et asynchrones

### 2. **QueueManager** (`core/queue.ts`)
- Gère les tâches de persistance de manière séquentielle (ou avec parallélisme limité)
- Tri par priorité (plus haute priorité en premier)
- Retry automatique avec délai configurable
- Gestion des erreurs et échecs définitifs

### 3. **PersistenceOrchestrator** (`core/orchestrator.ts`)
- Écoute les événements du store via EventBus
- Met les tâches en queue via QueueManager
- Délègue la persistance à la stratégie configurée selon le type d'entité
- Gère les métadonnées de persistance (syncStatus, retryCount, etc.)
- Émet des événements de résultat (`entity:persisted`, `entity:persist-error`, etc.)

### 4. **PersistenceStrategy** (`core/types.ts`)
Interface générique permettant d'implémenter différentes méthodes :
- **NoteRestApiStrategy** / **TagRestApiStrategy** : Persistance via REST API (implémentation actuelle)
- **CrdtStrategy** : Persistance via CRDT (futur)
- **DecentralizedStrategy** : Persistance décentralisée (futur)
- **HybridStrategy** : Combinaison de plusieurs stratégies (futur)

### 5. **Metadata de Persistance** (`core/metadata.ts`)
Chaque entité a des métadonnées de persistance :
- `syncStatus`: État de synchronisation (`pending`, `syncing`, `synced`, `error`, `conflict`)
- `backendId`: ID du backend (MongoDB `_id`)
- `lastSyncAt`: Timestamp de la dernière synchronisation
- `version`: Version pour CRDT/optimistic locking
- `retryCount`: Nombre de tentatives
- `maxRetries`: Nombre maximum de tentatives
- `error`: Dernière erreur rencontrée

### 6. **Composable Vue** (`usePersistence.ts`)
- Initialise le système de persistance (EventBus, QueueManager, Orchestrator)
- Enregistre les stratégies pour chaque type d'entité
- Doit être appelé une seule fois au niveau de l'application

## Utilisation

### Initialisation (déjà fait dans `App.vue`)

```typescript
import { usePersistence } from '@/services/persistence'
import { useNotesStore } from '@/stores/notes'

// Dans App.vue
usePersistence() // Initialise EventBus, QueueManager et Orchestrator
notesStore.initPersistenceListeners() // Le store écoute les événements de persistance
```

### Émission d'événements depuis le store

Le store émet automatiquement des événements lors des modifications :

```typescript
// Dans le store
function addNote(note: NoteType) {
  notes.value.push(note)
  eventBus.emit('entity:created', { entityType: 'note', data: note })
}

function addTag(tag: TagType) {
  tags.value.push(tag)
  eventBus.emit('entity:created', { entityType: 'tag', data: tag })
}
```

## Flux de Données

```
┌─────────────┐
│   Store     │
│  (Pinia)    │
└──────┬──────┘
       │ émet 'entity:created'
       ▼
┌─────────────┐
│ Event Bus   │
└──────┬──────┘
       │ écoute
       ▼
┌─────────────┐
│ Orchestrator│
└──────┬──────┘
       │ enqueue
       ▼
┌─────────────┐
│QueueManager │ (séquentiel, retry, priorité)
└──────┬──────┘
       │ process
       ▼
┌─────────────┐      ┌──────────────────┐
│ Orchestrator│─────▶│ RestApiStrategy  │
│             │      │ (ou autre)       │
└──────┬──────┘      └──────────────────┘
       │ émet 'entity:persisted'
       ▼
┌─────────────┐
│ Event Bus   │
└──────┬──────┘
       │ écoute
       ▼
┌─────────────┐
│   Store     │ (met à jour _id MongoDB)
└─────────────┘
```

## Événements

### Émis par le Store
- `entity:created` : Une entité a été créée localement
- `entity:updated` : Une entité a été mise à jour localement
- `entity:deleted` : Une entité a été supprimée localement

### Émis par le Système de Persistance
- `entity:persisted` : Une entité a été persistée avec succès
- `entity:persist-error` : Erreur lors de la persistance d'une création
- `entity:update-error` : Erreur lors de la persistance d'une mise à jour
- `entity:delete-error` : Erreur lors de la persistance d'une suppression

### Émis par la Queue
- `queue:task-enqueued` : Une tâche a été mise en queue
- `queue:task-processing` : Une tâche est en cours de traitement
- `queue:task-completed` : Une tâche a été complétée avec succès
- `queue:task-failed` : Une tâche a échoué définitivement

## Avantages de cette Architecture

1. **SOC Maximale** :
   - Store : Gère uniquement l'état local
   - EventBus : Communication découplée
   - QueueManager : Gestion séquentielle et retry
   - Orchestrator : Orchestration sans connaître les détails
   - Strategy : Implémentation pure (REST, CRDT, etc.)

2. **Générique** :
   - Supporte n'importe quel type d'entité (notes, tags, etc.)
   - Facile d'ajouter de nouveaux types d'entités
   - Stratégies interchangeables

3. **Robuste** :
   - Retry automatique
   - Gestion des erreurs
   - Métadonnées de persistance pour tracking
   - Support offline (queue persistée, futur)

4. **Extensible** :
   - Facile d'ajouter de nouvelles stratégies (CRDT, décentralisé)
   - Support pour résolution de conflits (futur)
   - Support pour synchronisation multi-device (futur)

## Ajout d'un Nouveau Type d'Entité

1. Créer une stratégie dans `strategies/` :
```typescript
export class MyEntityRestApiStrategy implements PersistenceStrategy<MyEntityType> {
  async persistCreate(entity: PersistableEntity<MyEntityType>): Promise<...> { ... }
  async persistUpdate(entity: PersistableEntity<MyEntityType>): Promise<...> { ... }
  async persistDelete(id: string, entityType: string): Promise<void> { ... }
}
```

2. Enregistrer la stratégie dans `usePersistence.ts` :
```typescript
orchestrator.registerStrategy('myEntity', new MyEntityRestApiStrategy())
```

3. Émettre des événements depuis le store :
```typescript
eventBus.emit('entity:created', { entityType: 'myEntity', data: myEntity })
```

## Support Futur

- **CRDT Strategy** : Pour synchronisation multi-device avec résolution automatique de conflits
- **Decentralized Strategy** : Pour persistance P2P
- **Queue Persistée** : Pour support offline complet
- **Synchronisation Incrémentale** : Basée sur `lastSyncAt`
- **Optimistic Locking** : Basé sur `version` dans les métadonnées

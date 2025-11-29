# Module de Persistance Générique

## Architecture

Ce module implémente une architecture de persistance générique basée sur **EventBus + QueueManager**, respectant les principes de **Separation of Concerns (SOC)** et permettant une extensibilité maximale pour supporter différentes stratégies (REST, CRDT, décentralisé, etc.).

### Structure

Le module est **générique et réutilisable**. Les stratégies spécifiques au projet sont définies en dehors du module.

```
modules/persistence/          # Module générique (réutilisable)
├── core/
│   ├── types.ts              # Types génériques + metadata de persistance
│   ├── metadata.ts           # Helpers pour gérer les métadonnées
│   ├── eventBus.ts           # EventBus générique et réutilisable
│   ├── queue.ts              # QueueManager avec séquençage, retry, priorité
│   ├── orchestrator.ts       # Orchestrateur générique
│   ├── retryManager.ts       # Gestionnaire de retry avec backoff exponentiel
│   └── index.ts              # Exports centralisés
├── persisting/               # Persistance via Pinia/localStorage
│   ├── queue/                # QueueManager persisté
│   ├── store/                # Store Pinia pour la queue
│   └── utils/                # Utilitaires de sérialisation
├── sync/                     # Synchronisation des stores après persistance
│   └── syncAdapters.ts       # Système de sync adapters
├── usePersistence.ts         # Composable Vue pour initialisation
└── index.ts                  # Exports centralisés

persistence/                  # Configurations spécifiques au projet
└── strategies/
    ├── RestApiStrategy.ts    # Stratégies REST pour notes et tags (spécifiques au projet)
    └── index.ts              # Exports centralisés
```

## Principe de Fonctionnement

### 1. **EventBus** (`core/eventBus.ts`)
- Système de communication découplé entre le store et les services de persistance
- Le store émet des événements génériques (`entity:created`, `entity:updated`, `entity:deleted`)
- Les services de persistance écoutent ces événements
- Supporte les handlers synchrones et asynchrones

### 2. **QueueManager** (`core/queue.ts` / `persisting/queue/PersistedQueueManager.ts`)
- Gère les tâches de persistance de manière séquentielle (ou avec parallélisme limité)
- Tri par priorité (plus haute priorité en premier)
- Retry automatique avec backoff exponentiel **non-bloquant** (utilise `retryAt`)
- Gestion des erreurs et échecs définitifs
- Queue persistée dans localStorage via Pinia (support offline)

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

Chaque tâche de persistance (`PersistenceTask`) a également :
- `retryAt`: Timestamp de retry planifié (pour backoff exponentiel non-bloquant)
- `expiresAt`: Timestamp d'expiration de la tâche (optionnel)
- `maxAge`: Âge maximum de la tâche en ms (optionnel)

### 6. **Composable Vue** (`usePersistence.ts`)
- Initialise le système de persistance (EventBus, QueueManager, Orchestrator)
- Accepte les stratégies en paramètre (injection de dépendances)
- Accepte les sync adapters pour synchroniser les stores après persistance
- Doit être appelé une seule fois au niveau de l'application
- Les stratégies sont définies en dehors du module (spécifiques au projet)

### 7. **Sync Adapters** (`sync/syncAdapters.ts`)
- Système de synchronisation des stores après persistance réussie
- Permet aux stores d'exposer des adapters pour mettre à jour leurs données
- Respecte le principe SOC : la logique de synchronisation reste dans le store
- Gère automatiquement les événements `entity:persisted` et `entity:persist-error`

## Utilisation

### Initialisation (déjà fait dans `App.vue`)

```typescript
import { usePersistence } from '@/modules/persistence'
import { NoteRestApiStrategy, TagRestApiStrategy } from '@/persistence/strategies'
import { useNotesStore } from '@/stores/notes'

const notesStore = useNotesStore()

// Dans App.vue
// Initialise EventBus, QueueManager et Orchestrator avec les stratégies spécifiques au projet
// Les sync adapters permettent de synchroniser les stores après persistance
usePersistence({
  strategies: {
    note: new NoteRestApiStrategy(),
    tag: new TagRestApiStrategy()
  },
  options: {
    retryConfig: {
      maxRetries: 3,        // 3 tentatives maximum
      initialDelay: 180000, // 3 minutes pour le premier retry (override de la valeur par défaut de 30s)
      multiplier: 4,        // Multiplicateur exponentiel : 3min → 12min → 48min
      maxDelay: 3600000     // 1 heure maximum (override de la valeur par défaut de 10min)
    }
  },
  // Les adapters de synchronisation permettent de mettre à jour les stores
  // après qu'une entité ait été persistée avec succès (mise à jour des _id MongoDB)
  syncAdapters: [
    notesStore.noteSyncAdapter,
    notesStore.tagSyncAdapter
  ]
})
```

### Synchronisation des Stores après Persistance

Les **sync adapters** permettent aux stores de synchroniser leurs données après qu'une entité ait été persistée avec succès. Cette approche respecte le principe SOC (Separation of Concerns) :

- **Le store** expose des adapters qui contiennent la logique de synchronisation
- **Le module de persistance** utilise ces adapters sans connaître les détails du store
- **Tout est centralisé** dans `usePersistence()` lors de l'initialisation

#### Exemple dans le store

```typescript
// Dans stores/notes.ts
const noteSyncAdapter: SyncAdapter<NoteType> = {
  entityType: 'note',
  syncEntity: (original, persisted) => {
    // Si la note a été créée et qu'on a maintenant un _id du backend
    if (original.frontId && persisted._id && !original._id) {
      syncNote(original.frontId, {
        _id: persisted._id
      })
    } else if (persisted._id) {
      // Mise à jour d'une note existante
      syncNote(persisted.frontId, {
        _id: persisted._id
      })
    }
  },
  onError: (error, entity) => {
    console.warn(`Erreur de persistance pour note:`, entity.frontId, error)
  }
}

return {
  // ... autres exports
  noteSyncAdapter,
  tagSyncAdapter
}
```

#### Avantages de cette approche

1. **SOC respectée** : La logique de synchronisation reste dans le store (propriétaire des données)
2. **Découplage** : Le module de persistance ne connaît pas les détails du store
3. **Centralisation** : Tout est configuré dans `usePersistence()` au démarrage
4. **Testabilité** : Les adapters sont testables indépendamment
5. **Extensibilité** : Facile d'ajouter de nouveaux adapters pour d'autres types d'entités

### Configuration du Retry

Le système de persistance utilise un **backoff exponentiel non-bloquant** pour les retries automatiques. **Par défaut, toutes les erreurs sont retryables** (philosophie fail-safe). Les limites sont gérées par `maxRetries` et `expiresAt`.

#### Philosophie : Fail-Safe par Défaut

- **Toutes les erreurs sont retryables par défaut** (réseau, timeout, serveur, client, inconnues)
- Les limites sont gérées par la configuration (`maxRetries`, `expiresAt`)
- Approche offline-first : on retry plutôt que d'abandonner

#### Paramètres de configuration

- **`maxRetries`** : Nombre de tentatives maximum (défaut: 3)
- **`initialDelay`** : Délai initial du premier retry en millisecondes (défaut: 30000 = 30 secondes)
- **`multiplier`** : Multiplicateur pour le backoff exponentiel (défaut: 4)
- **`maxDelay`** : Délai maximum en millisecondes, optionnel (défaut: 600000 = 10 minutes)

#### Formule de calcul

Le délai entre chaque retry est calculé avec la formule : `delay = initialDelay × multiplier^(retryCount-1)`

**Exemple avec la configuration par défaut** (initialDelay=30s, multiplier=4, maxDelay=10min) :
- **1er retry** (retryCount=1) : 30s × 4⁰ = **30 secondes**
- **2ème retry** (retryCount=2) : 30s × 4¹ = **2 minutes**
- **3ème retry** (retryCount=3) : 30s × 4² = **8 minutes** (limité à 10min par maxDelay)

Si `maxDelay` est défini, le délai est limité à cette valeur.

**Note** : Dans `App.vue`, la configuration est surchargée avec `initialDelay=180000` (3 minutes) et `maxDelay=3600000` (1 heure) pour des délais plus longs adaptés à l'application.

#### Implémentation Non-Bloquante

Le système utilise un champ `retryAt` sur chaque tâche pour planifier les retries sans bloquer la queue :
- La tâche reste dans la queue avec un `retryAt` calculé
- La boucle de traitement vérifie périodiquement si `retryAt <= now`
- D'autres tâches peuvent être traitées pendant l'attente
- Pas de récursion, pas de blocage

#### Configuration par type d'entité

Il est possible de configurer des paramètres de retry différents pour chaque type d'entité :

```typescript
usePersistence({
  strategies: {
    note: new NoteRestApiStrategy(),
    tag: new TagRestApiStrategy()
  },
    options: {
    retryConfig: {
      maxRetries: 3,
      initialDelay: 30000,  // 30 secondes (valeur par défaut)
      multiplier: 4
    },
    retryConfigByEntityType: {
      note: { maxRetries: 5, initialDelay: 300000 },  // 5 tentatives, 5 minutes pour le premier retry
      tag: { maxRetries: 2 }  // Seulement 2 tentatives pour les tags
    }
  }
})
```
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
read_file

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
       │ émet 'entity:persisted'
       ▼
┌─────────────┐
│Sync Adapters│ (met à jour _id MongoDB via syncEntity)
│   Manager   │
└──────┬──────┘
       │ appelle
       ▼
┌─────────────┐
│   Store     │ (syncNote, syncTag, etc.)
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
   - Retry automatique avec backoff exponentiel non-bloquant
   - Philosophie fail-safe : toutes les erreurs sont retryables par défaut
   - Gestion des erreurs avec catégorisation (réseau, serveur, client)
   - Métadonnées de persistance pour tracking
   - Support offline (queue persistée dans localStorage)

4. **Extensible** :
   - Facile d'ajouter de nouvelles stratégies (CRDT, décentralisé)
   - Support pour résolution de conflits (futur)
   - Support pour synchronisation multi-device (futur)

## Ajout d'un Nouveau Type d'Entité

1. Créer une stratégie dans `persistence/strategies/` (spécifique au projet) :
```typescript
import type { PersistenceStrategy, PersistableEntity } from '@/modules/persistence/core/types'
import { createMyEntity, updateMyEntity, deleteMyEntity } from '@/api/myEntityApi'
import type { MyEntityType } from '@/types/MyEntityType'

export class MyEntityRestApiStrategy implements PersistenceStrategy<MyEntityType> {
  async persistCreate(entity: PersistableEntity<MyEntityType>): Promise<...> { ... }
  async persistUpdate(entity: PersistableEntity<MyEntityType>): Promise<...> { ... }
  async persistDelete(id: string, entityType: string): Promise<void> { ... }
}
```

2. Créer un sync adapter dans le store :
```typescript
// Dans stores/myEntity.ts
const myEntitySyncAdapter: SyncAdapter<MyEntityType> = {
  entityType: 'myEntity',
  syncEntity: (original, persisted) => {
    // Logique de synchronisation (mise à jour des _id, etc.)
    syncMyEntity(original.frontId, { _id: persisted._id })
  },
  onError: (error, entity) => {
    console.warn(`Erreur de persistance pour myEntity:`, entity.frontId, error)
  }
}

return {
  // ... autres exports
  myEntitySyncAdapter
}
```

3. Enregistrer la stratégie et l'adapter lors de l'initialisation dans `App.vue` :
```typescript
import { usePersistence } from '@/modules/persistence'
import { MyEntityRestApiStrategy } from '@/persistence/strategies'
import { useMyEntityStore } from '@/stores/myEntity'

const myEntityStore = useMyEntityStore()

usePersistence({
  strategies: {
    myEntity: new MyEntityRestApiStrategy()
  },
  syncAdapters: [
    myEntityStore.myEntitySyncAdapter
  ]
})
```

4. Émettre des événements depuis le store :
```typescript
eventBus.emit('entity:created', { entityType: 'myEntity', data: myEntity })
```

## Support Futur

- **CRDT Strategy** : Pour synchronisation multi-device avec résolution automatique de conflits
- **Decentralized Strategy** : Pour persistance P2P
- **Synchronisation Incrémentale** : Basée sur `lastSyncAt`
- **Optimistic Locking** : Basé sur `version` dans les métadonnées

## Fonctionnalités Actuelles

✅ **Queue Persistée** : La queue est automatiquement persistée dans localStorage via Pinia  
✅ **Retry Automatique** : Backoff exponentiel non-bloquant avec `retryAt`  
✅ **Fail-Safe** : Toutes les erreurs sont retryables par défaut  
✅ **Support Offline** : Les tâches restent en queue et sont retraitées automatiquement  
✅ **Sync Adapters** : Système de synchronisation des stores après persistance réussie (mise à jour des `_id` MongoDB)

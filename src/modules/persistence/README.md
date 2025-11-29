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
│   └── index.ts              # Exports centralisés
├── persisting/               # Persistance via Pinia/localStorage
│   ├── queue/                # QueueManager persisté
│   ├── store/                # Store Pinia pour la queue
│   └── utils/                # Utilitaires de sérialisation
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
- Doit être appelé une seule fois au niveau de l'application
- Les stratégies sont définies en dehors du module (spécifiques au projet)

## Utilisation

### Initialisation (déjà fait dans `App.vue`)

```typescript
import { usePersistence } from '@/modules/persistence'
import { NoteRestApiStrategy, TagRestApiStrategy } from '@/persistence/strategies'
import { useNotesStore } from '@/stores/notes'

// Dans App.vue
// Initialise EventBus, QueueManager et Orchestrator avec les stratégies spécifiques au projet
usePersistence({
  strategies: {
    note: new NoteRestApiStrategy(),
    tag: new TagRestApiStrategy()
  },
  options: {
    retryConfig: {
      maxRetries: 3,        // 3 tentatives maximum
      initialDelay: 180000, // 3 minutes pour le premier retry
      multiplier: 4,        // Multiplicateur exponentiel : 3min → 12min → 48min
      maxDelay: 3600000     // 1 heure maximum (optionnel)
    }
  }
})
notesStore.initPersistenceListeners() // Le store écoute les événements de persistance
```

### Configuration du Retry

Le système de persistance utilise un **backoff exponentiel non-bloquant** pour les retries automatiques. **Par défaut, toutes les erreurs sont retryables** (philosophie fail-safe). Les limites sont gérées par `maxRetries` et `expiresAt`.

#### Philosophie : Fail-Safe par Défaut

- **Toutes les erreurs sont retryables par défaut** (réseau, timeout, serveur, client, inconnues)
- Les limites sont gérées par la configuration (`maxRetries`, `expiresAt`)
- Approche offline-first : on retry plutôt que d'abandonner

#### Paramètres de configuration

- **`maxRetries`** : Nombre de tentatives maximum (défaut: 3)
- **`initialDelay`** : Délai initial du premier retry en millisecondes (défaut: 180000 = 3 minutes)
- **`multiplier`** : Multiplicateur pour le backoff exponentiel (défaut: 4)
- **`maxDelay`** : Délai maximum en millisecondes, optionnel (défaut: 3600000 = 1 heure)

#### Formule de calcul

Le délai entre chaque retry est calculé avec la formule : `delay = initialDelay × multiplier^(retryCount-1)`

**Exemple avec la configuration par défaut** (initialDelay=3min, multiplier=4) :
- **1er retry** (retryCount=1) : 3min × 4⁰ = **3 minutes**
- **2ème retry** (retryCount=2) : 3min × 4¹ = **12 minutes**
- **3ème retry** (retryCount=3) : 3min × 4² = **48 minutes** (limité à 1h par maxDelay)

Si `maxDelay` est défini, le délai est limité à cette valeur.

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
      initialDelay: 180000,
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

2. Enregistrer la stratégie lors de l'initialisation dans `App.vue` :
```typescript
import { usePersistence } from '@/modules/persistence'
import { MyEntityRestApiStrategy } from '@/persistence/strategies'

usePersistence({
  myEntity: new MyEntityRestApiStrategy()
})
```

3. Émettre des événements depuis le store :
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

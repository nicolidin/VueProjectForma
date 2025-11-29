# Module de Persistance Générique

## Architecture

Ce module implémente une architecture de persistance générique basée sur **EventBus + PersistedQueueManager**, respectant les principes de **Separation of Concerns (SOC)** et permettant une extensibilité maximale pour supporter différentes stratégies (REST, CRDT, décentralisé, etc.).

### Structure

Le module est **générique et réutilisable**. Les stratégies spécifiques au projet sont définies en dehors du module.

```
modules/persistence/          # Module générique (réutilisable)
├── core/
│   ├── types.ts              # Types génériques + metadata de persistance
│   ├── metadata.ts           # Helpers pour gérer les métadonnées
│   ├── eventBus.ts           # EventBus générique et réutilisable
│   ├── IQueueManager.ts      # Interface pour les queue managers
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

### Organisation du Code : Pourquoi cette Structure ?

Cette architecture respecte plusieurs principes importants :

1. **Séparation Générique/Spécifique** :
   - `modules/persistence/` : Code générique et réutilisable (peut être utilisé dans d'autres projets)
   - `persistence/strategies/` : Code spécifique au projet (appels API, logique métier)

2. **Separation of Concerns (SOC)** :
   - Chaque composant a une responsabilité unique et claire
   - Les dépendances sont unidirectionnelles (du haut vers le bas)
   - Pas de couplage fort entre les composants

3. **Inversion de Dépendances** :
   - Le module générique définit des interfaces (`PersistenceStrategy`)
   - Le projet implémente ces interfaces (stratégies REST)
   - Le module utilise les implémentations sans les connaître

## Principe de Fonctionnement

### 1. **EventBus** (`core/eventBus.ts` / `usePersistence.ts`)
- Système de communication découplé entre le store et les services de persistance
- **EventBus global** : Créé dès le chargement du module (`usePersistence.ts`), toujours disponible
- Le store émet des événements génériques (`entity:created`, `entity:updated`, `entity:deleted`)
- Les services de persistance écoutent ces événements
- Supporte les handlers synchrones et asynchrones
- **Important** : L'EventBus est disponible même avant l'initialisation du service, permettant aux stores de s'initialiser en premier

### 2. **PersistedQueueManager** (`persisting/queue/PersistedQueueManager.ts`)
- Gère les tâches de persistance de manière séquentielle (ou avec parallélisme limité)
- Tri par priorité (plus haute priorité en premier)
- Retry automatique avec backoff exponentiel **non-bloquant** (utilise `retryAt`)
- Gestion des erreurs et échecs définitifs
- Queue persistée dans localStorage via Pinia (support offline)
- Source de vérité unique : toutes les opérations passent par le store Pinia

### 3. **PersistenceOrchestrator** (`core/orchestrator.ts`)
- Écoute les événements du store via EventBus
- Met les tâches en queue via PersistedQueueManager
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

### 6. **PersistenceService** (`usePersistence.ts`)
Le cœur du système de persistance est la classe `PersistenceService` qui encapsule tout l'état et la logique d'initialisation :

#### Architecture interne
```typescript
class PersistenceService {
  private readonly queue: PersistedQueueManager
  private readonly orchestrator: PersistenceOrchestrator
  private readonly syncAdaptersManager: SyncAdaptersManager
  // Utilise l'EventBus global (créé au chargement du module)
}
```

#### Responsabilités
- **Encapsulation** : Toute l'état (queue, orchestrator, syncAdapters) est centralisé dans une seule classe
- **Initialisation** : Crée et configure tous les composants (PersistedQueueManager, Orchestrator, SyncAdaptersManager)
- **Gestion des stratégies** : Enregistre les stratégies de persistance pour chaque type d'entité
- **Singleton** : Une seule instance pour toute l'application (gérée par `usePersistence()`)
- **Testabilité** : Méthode `destroy()` pour nettoyer les ressources en tests

#### Pattern Singleton
Le service est accessible via la fonction `usePersistence()` qui implémente un pattern singleton :
- Premier appel : Crée une nouvelle instance de `PersistenceService`
- Appels suivants : Retourne l'instance existante (ignore toute nouvelle config)
- Garantit qu'une seule instance existe dans l'application

### 7. **Composable Vue** (`usePersistence.ts`)
La fonction `usePersistence()` est le point d'entrée public pour initialiser le système :

#### Fonctionnalités
- **Initialisation** : Crée le `PersistenceService` avec la configuration fournie
- **Injection de dépendances** : Accepte les stratégies en paramètre (spécifiques au projet)
- **Sync Adapters** : Accepte les adapters pour synchroniser les stores après persistance
- **Rétrocompatibilité** : Supporte deux formats de configuration (ancien et nouveau)
- **Ordre d'initialisation flexible** : L'EventBus est disponible avant l'initialisation

#### API Publique
```typescript
// Initialisation (retourne PersistenceService)
const service = usePersistence(config)

// Accès à l'EventBus (toujours disponible, même avant usePersistence())
const eventBus = getPersistenceEventBus()

// Accès au service (nécessite que usePersistence() ait été appelé)
const service = getPersistenceService()

// Réinitialisation (pour les tests uniquement)
resetPersistenceService()
```

### 8. **Sync Adapters** (`sync/syncAdapters.ts`)
- Système de synchronisation des stores après persistance réussie
- Permet aux stores d'exposer des adapters pour mettre à jour leurs données
- Respecte le principe SOC : la logique de synchronisation reste dans le store
- Gère automatiquement les événements `entity:persisted` et `entity:persist-error`

## Architecture Interne : Comment ça marche ?

### Code Source : Points Clés à Comprendre

Pour bien comprendre le module, voici les points clés du code source :

#### 1. EventBus Global (`usePersistence.ts` ligne 81)
```typescript
const persistenceEventBus = new EventBus<PersistenceEvents>()
```
**Pourquoi global ?** 
- Créé au chargement du module (avant toute initialisation)
- Permet aux stores d'accéder à l'EventBus même si `usePersistence()` n'a pas encore été appelé
- Résout le problème d'ordre d'initialisation entre stores et service

#### 2. Classe PersistenceService (`usePersistence.ts` ligne 88)
```typescript
class PersistenceService {
  private readonly queue: PersistedQueueManager
  private readonly orchestrator: PersistenceOrchestrator
  private readonly syncAdaptersManager: SyncAdaptersManager
  // ...
}
```
**Pourquoi une classe ?**
- Encapsule tout l'état dans un seul objet (principe SOC)
- Facilite la testabilité (méthode `destroy()` pour nettoyer)
- Pattern singleton explicite et contrôlé
- API claire avec des getters typés

#### 3. Singleton Pattern (`usePersistence.ts` ligne 241)
```typescript
let serviceInstance: PersistenceService | null = null

export function usePersistence(config?: ...): PersistenceService {
  if (serviceInstance) {
    return serviceInstance  // Retourne l'instance existante
  }
  serviceInstance = new PersistenceService(config)
  return serviceInstance
}
```
**Pourquoi singleton ?**
- Garantit une seule instance dans l'application
- Évite les conflits de configuration
- Centralise la gestion d'état

#### 4. Normalisation de Config (`usePersistence.ts` ligne 171)
```typescript
private normalizeConfig(config?: PersistenceConfig | PersistenceStrategies) {
  // Supporte deux formats pour rétrocompatibilité
  if ('strategies' in config) {
    return { strategies: config.strategies, options: config.options }
  }
  return { strategies: config }  // Ancien format
}
```
**Pourquoi cette méthode ?**
- Rétrocompatibilité avec l'ancien format
- Simplifie la logique d'initialisation
- Code plus maintenable

### Ordre d'Initialisation

Le système est conçu pour être **flexible** en termes d'ordre d'initialisation :

1. **Chargement du module** : L'EventBus global est créé immédiatement
   ```typescript
   // Dans usePersistence.ts (au chargement du module)
   const persistenceEventBus = new EventBus<PersistenceEvents>()
   ```

2. **Initialisation des stores** : Les stores peuvent s'initialiser et accéder à l'EventBus
   ```typescript
   // Dans stores/notes.ts
   const eventBus = getPersistenceEventBus() // ✅ Toujours disponible
   ```

3. **Initialisation du service** : `usePersistence()` crée le `PersistenceService`
   ```typescript
   // Dans App.vue
   usePersistence({ strategies: {...}, syncAdapters: [...] })
   ```

**Pourquoi cette approche ?**
- Les stores Pinia peuvent être initialisés avant `usePersistence()`
- L'EventBus est toujours disponible, même si le service n'est pas encore prêt
- Les événements émis avant l'initialisation sont simplement ignorés (pas de crash)

### Cycle de Vie d'une Tâche de Persistance

Voici le parcours complet d'une tâche, étape par étape :

```
1. Store émet un événement
   └─> eventBus.emit('entity:created', { entityType: 'note', data: note })

2. Orchestrator écoute l'événement
   └─> Crée une PersistenceTask avec métadonnées
   └─> Enqueue dans PersistedQueueManager

3. PersistedQueueManager traite la tâche
   └─> Vérifie retryAt (si présent, attend)
   └─> Appelle le processeur (orchestrator.processTask)

4. Orchestrator exécute la stratégie
   └─> Récupère la stratégie pour le type d'entité
   └─> Appelle strategy.persistCreate/Update/Delete

5. Stratégie fait l'appel API
   └─> NoteRestApiStrategy.persistCreate()
   └─> Appel HTTP vers le backend

6. Succès ou Erreur
   ├─> Succès : Émet 'entity:persisted'
   │   └─> SyncAdaptersManager appelle syncEntity()
   │       └─> Store met à jour _id MongoDB
   └─> Erreur : Analyse avec RetryManager
       ├─> Récupérable : Calcule retryAt, met à jour la tâche
       └─> Définitif : Émet 'entity:persist-error', retire de la queue
```

## Utilisation

### Initialisation (déjà fait dans `App.vue`)

```typescript
import { usePersistence } from '@/modules/persistence'
import { NoteRestApiStrategy, TagRestApiStrategy } from '@/persistence/strategies'
import { useNotesStore } from '@/stores/notes'

const notesStore = useNotesStore()

// Dans App.vue
// Initialise EventBus, PersistedQueueManager et Orchestrator avec les stratégies spécifiques au projet
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

### Accès à l'EventBus dans les stores

Les stores doivent accéder à l'EventBus via `getPersistenceEventBus()`. Cette fonction est **toujours disponible**, même si `usePersistence()` n'a pas encore été appelé :

```typescript
// Dans stores/notes.ts
import { getPersistenceEventBus } from '@/modules/persistence'

export const useNotesStore = defineStore('notes', () => {
  // ✅ L'EventBus est toujours disponible, même avant usePersistence()
  const eventBus = getPersistenceEventBus()
  
  function addNote(note: NoteType) {
    notes.value.push(note)
    // Émettre l'événement pour déclencher la persistance
    eventBus.emit('entity:created', { entityType: 'note', data: note })
  }
  
  function addTag(tag: TagType) {
    tags.value.push(tag)
    eventBus.emit('entity:created', { entityType: 'tag', data: tag })
  }
  
  // ... reste du code
})
```

**Note importante** : Si vous émettez des événements avant que `usePersistence()` ne soit appelé, ces événements seront simplement ignorés (pas de listeners encore enregistrés). C'est un comportement attendu et sans danger.

### API Avancée (pour utilisation avancée)

Si vous avez besoin d'accéder directement au service (pour debug, monitoring, etc.) :

```typescript
import { getPersistenceService } from '@/modules/persistence'

// Accéder au service (nécessite que usePersistence() ait été appelé)
const service = getPersistenceService()

// Accéder aux composants internes
const queue = service.getQueue()
const orchestrator = service.getOrchestrator()
const eventBus = service.getEventBus()

// Vérifier l'état
if (service.isInitialized()) {
  console.log('Service initialisé')
}
```

**⚠️ Attention** : Cette API est destinée à un usage avancé. En général, vous n'avez pas besoin d'y accéder directement.

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
┌─────────────────────┐
│PersistedQueueManager│ (séquentiel, retry, priorité, persisté)
└──────┬──────────────┘
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
   - PersistedQueueManager : Gestion séquentielle, retry et persistance
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
✅ **Service Encapsulé** : Architecture avec `PersistenceService` pour une meilleure SOC  
✅ **EventBus Global** : Disponible dès le chargement du module, ordre d'initialisation flexible  
✅ **Singleton Explicite** : Pattern singleton contrôlé pour garantir une seule instance

## Tests

Le module fournit une fonction utilitaire pour réinitialiser le service entre les tests :

```typescript
import { resetPersistenceService } from '@/modules/persistence'

describe('My tests', () => {
  beforeEach(() => {
    // Réinitialiser le service avant chaque test
    resetPersistenceService()
  })
  
  it('should persist an entity', async () => {
    // Initialiser avec une config de test
    usePersistence({
      strategies: { note: new MockNoteStrategy() }
    })
    
    // ... vos tests
  })
})
```

**⚠️ Important** : `resetPersistenceService()` est destiné uniquement aux tests. Ne l'utilisez jamais en production.

# Service de Persistance des Notes

## Architecture

Ce module implémente une architecture de persistance basée sur les événements, respectant les principes de **Separation of Concerns (SOC)** et permettant une extensibilité maximale.

### Structure

```
persistence/
├── types.ts              # Interfaces et types TypeScript
├── eventBus.ts           # Event bus pour la communication découplée
├── RestApiPersistence.ts # Implémentation REST API (stratégie par défaut)
├── PersistenceService.ts # Service orchestrateur
├── usePersistence.ts     # Composable Vue
└── index.ts              # Exports centralisés
```

## Principe de Fonctionnement

### 1. **Event Bus** (`eventBus.ts`)
- Système de communication découplé entre le store et les services de persistance
- Le store émet des événements (`note:created`, `note:updated`, `note:deleted`)
- Les services de persistance écoutent ces événements

### 2. **Stratégies de Persistance** (`PersistenceStrategy`)
Interface permettant d'implémenter différentes méthodes :
- **RestApiPersistence** : Persistance via REST API (implémentation actuelle)
- **CrdtPersistence** : Persistance via CRDT (futur)
- **DecentralizedPersistence** : Persistance décentralisée (futur)
- **HybridPersistence** : Combinaison de plusieurs stratégies (futur)

### 3. **Service Orchestrateur** (`PersistenceService`)
- Écoute les événements du store
- Délègue la persistance à la stratégie configurée
- Gère les erreurs et émet des événements de résultat

### 4. **Composable Vue** (`usePersistence`)
- Initialise le service de persistance
- Écoute les événements de persistance pour mettre à jour le store (ex: `_id` MongoDB)
- Nettoie les ressources lors du démontage

## Utilisation

### Initialisation (déjà fait dans `App.vue`)

```typescript
import { usePersistence } from '@/services/persistence'

// Dans App.vue ou un composant racine
usePersistence() // Utilise RestApiPersistence par défaut
```

### Utilisation avec une stratégie personnalisée

```typescript
import { usePersistence } from '@/services/persistence'
import { RestApiPersistence } from '@/services/persistence'

const customStrategy = new RestApiPersistence()
usePersistence(customStrategy)
```

### Émission d'événements depuis le store

Le store émet automatiquement des événements lors des modifications :

```typescript
// Dans le store
function addNote(note: NoteType) {
  notes.value.push(note)
  noteEventBus.emit('note:created', { note }) // ✅ Émission automatique
}
```

## Flux de Données

```
┌─────────────┐
│   Store     │
│  (Pinia)    │
└──────┬──────┘
       │ émet 'note:created'
       ▼
┌─────────────┐
│ Event Bus   │
└──────┬──────┘
       │ écoute
       ▼
┌─────────────┐      ┌──────────────────┐
│Persistence  │─────▶│ RestApiPersistence│
│  Service    │      │  (ou autre)       │
└─────────────┘      └──────────────────┘
       │
       │ émet 'note:persisted'
       ▼
┌─────────────┐
│  Composable │
│  (met à jour│
│   le store) │
└─────────────┘
```

## Événements

### Émis par le Store
- `note:created` : Une note a été créée localement
- `note:updated` : Une note a été mise à jour localement
- `note:deleted` : Une note a été supprimée localement

### Émis par le Service de Persistance
- `note:persisted` : Une note a été persistée avec succès (contient `original` et `persisted`)
- `note:persist-error` : Erreur lors de la persistance d'une création
- `note:update-error` : Erreur lors de la persistance d'une mise à jour
- `note:delete-error` : Erreur lors de la persistance d'une suppression

## Extension Future

### Ajouter une nouvelle stratégie de persistance

1. Implémenter l'interface `PersistenceStrategy` :

```typescript
import type { PersistenceStrategy } from './types'

export class CrdtPersistence implements PersistenceStrategy {
  async persistCreate(note: NoteType): Promise<NoteType> {
    // Implémentation CRDT
  }
  
  async persistUpdate(id: string, updates: Partial<NoteType>): Promise<NoteType> {
    // Implémentation CRDT
  }
  
  async persistDelete(id: string): Promise<void> {
    // Implémentation CRDT
  }
}
```

2. Utiliser la nouvelle stratégie :

```typescript
import { usePersistence } from '@/services/persistence'
import { CrdtPersistence } from '@/services/persistence/CrdtPersistence'

usePersistence(new CrdtPersistence())
```

### Stratégie hybride (exemple)

```typescript
export class HybridPersistence implements PersistenceStrategy {
  constructor(
    private restApi: RestApiPersistence,
    private crdt: CrdtPersistence
  ) {}
  
  async persistCreate(note: NoteType): Promise<NoteType> {
    // Persister dans les deux systèmes
    const [restResult, crdtResult] = await Promise.all([
      this.restApi.persistCreate(note),
      this.crdt.persistCreate(note)
    ])
    return restResult // Retourner le résultat principal
  }
}
```

## Avantages de cette Architecture

1. **Separation of Concerns** : Le store gère l'état, la persistance est isolée
2. **Extensibilité** : Ajout de nouvelles stratégies sans modifier le code existant
3. **Testabilité** : Chaque composant est testable indépendamment
4. **Flexibilité** : Changement de stratégie à la volée
5. **Découplage** : Communication via événements, pas de dépendances directes

## Notes Importantes

- La persistance est **asynchrone** et **non-bloquante**
- Les erreurs sont loggées mais n'empêchent pas l'utilisation de l'application
- Le store est mis à jour **optimistiquement** (avant la persistance)
- Les données persistées (ex: `_id` MongoDB) sont synchronisées dans le store après persistance


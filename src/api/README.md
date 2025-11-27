# Services API

Ce dossier contient tous les services API pour communiquer avec le backend Express/MongoDB.

## Structure

- **`axios.ts`** : Configuration de base d'Axios (baseURL, headers)
- **`userApi.ts`** : Services pour les utilisateurs (CRUD complet)
- **`tagApi.ts`** : Services pour les tags (CRUD complet)
- **`noteApi.ts`** : Services pour les notes (CRUD complet)
- **`index.ts`** : Export centralisé de tous les services

## Utilisation

### Import depuis le fichier centralisé

```typescript
import { fetchNotes, createNote, fetchUsers } from '@/api';
```

### Import depuis un fichier spécifique

```typescript
import { fetchNotes } from '@/api/noteApi';
import { createUser } from '@/api/userApi';
import { fetchTagsByUser } from '@/api/tagApi';
```

## Exemples d'utilisation

### Users

```typescript
import { createUser, fetchUsers, fetchUserById, updateUser, deleteUser } from '@/api';

// Créer un utilisateur
const newUser = await createUser({
  nom: "Nicolas",
  email: "nicolas@example.com"
});

// Récupérer tous les utilisateurs
const users = await fetchUsers();

// Récupérer un utilisateur par ID
const user = await fetchUserById("USER_ID");

// Mettre à jour un utilisateur
const updated = await updateUser("USER_ID", {
  nom: "Nicolas Updated",
  email: "nicolas.updated@example.com"
});

// Supprimer un utilisateur
await deleteUser("USER_ID");
```

### Tags

```typescript
import { createTag, fetchTagsByUser, fetchTagById, updateTag, deleteTag } from '@/api';

// Créer un tag
const newTag = await createTag({
  frontId: "550e8400-e29b-41d4-a716-446655440000",
  title: "Important",
  color: "#FF5733",
  userId: "USER_ID"
});

// Récupérer tous les tags d'un utilisateur
const tags = await fetchTagsByUser("USER_ID");

// Récupérer un tag par ID (frontId ou _id)
const tag = await fetchTagById("TAG_ID");

// Mettre à jour un tag
const updated = await updateTag("TAG_ID", {
  title: "Urgent",
  color: "#FF0000"
});

// Supprimer un tag
await deleteTag("TAG_ID");
```

### Notes

```typescript
import { createNote, fetchNotes, fetchNotesByUser, fetchNoteById, updateNote, deleteNote } from '@/api';

// Créer une note (sans tags)
const newNote = await createNote({
  frontId: "660e8400-e29b-41d4-a716-446655440000",
  contentMd: "# Ma première note\n\nCeci est le contenu.",
  userId: "USER_ID",
  tags: []
});

// Créer une note avec des tags (par title)
const noteWithTags = await createNote({
  frontId: "770e8400-e29b-41d4-a716-446655440000",
  contentMd: "# Note avec tags\n\nCette note a des tags.",
  userId: "USER_ID",
  tags: ["Important", "Urgent"] // Par title
});

// Récupérer toutes les notes
const allNotes = await fetchNotes();

// Récupérer les notes d'un utilisateur
const userNotes = await fetchNotesByUser("USER_ID");

// Récupérer une note par ID (frontId ou _id)
const note = await fetchNoteById("NOTE_ID");

// Mettre à jour une note (contenu uniquement)
const updated = await updateNote("NOTE_ID", {
  contentMd: "# Note mise à jour\n\nLe contenu a été modifié."
});

// Mettre à jour une note (tags uniquement)
const updatedTags = await updateNote("NOTE_ID", {
  tags: ["Important", "Nouveau Tag"]
});

// Supprimer une note
await deleteNote("NOTE_ID");
```

## Notes importantes

1. **Base URL** : Configurée via la variable d'environnement `VITE_API_BASE_URL` dans le fichier `.env`
   - Par défaut : `http://localhost:3000/api`
   - Pour modifier : éditez le fichier `.env` à la racine du projet
2. **IDs** : Les endpoints acceptent soit `frontId` (UUID) soit `_id` (MongoDB ObjectId)
3. **Tags dans les notes** : Les tags peuvent être fournis de 3 façons :
   - Par **title** (string) : `["Important", "Urgent"]`
   - Par **frontId** (UUID) : `["550e8400-e29b-41d4-a716-446655440000"]`
   - Par **_id MongoDB** (ObjectId) : `["507f1f77bcf86cd799439011"]`
4. **Gestion des erreurs** : Toutes les fonctions lancent des erreurs qu'il faut gérer avec try/catch


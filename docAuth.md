# Documentation Authentification JWT - Guide Pédagogique Complet

## 📚 Table des matières

1. [Introduction](#introduction)
2. [Architecture globale](#architecture-globale)
3. [Backend - Express + MongoDB](#backend---express--mongodb)
4. [Frontend - Vue 3 + TypeScript](#frontend---vue-3--typescript)
5. [Flux d'authentification](#flux-dauthentification)
6. [Sécurité](#sécurité)
7. [Utilisation pratique](#utilisation-pratique)

---

## 🎯 Introduction

Ce document explique en détail l'implémentation complète d'un système d'authentification JWT (JSON Web Token) pour une application Vue.js avec un backend Express/MongoDB.

### Pourquoi JWT ?

- **Stateless** : Pas besoin de stocker les sessions sur le serveur
- **Scalable** : Fonctionne avec plusieurs serveurs
- **Sécurisé** : Token signé cryptographiquement
- **Standard** : Format JSON largement utilisé

### Objectifs de cette implémentation

✅ Authentification sécurisée (mots de passe hashés)
✅ Gestion automatique du token (intercepteurs Axios)
✅ Protection des routes (navigation guards)
✅ Composants réutilisables (dans la lib)
✅ Séparation des responsabilités (composants purs / logique métier)

---

## 🏗️ Architecture globale

### Principe de séparation

```
┌─────────────────────────────────────────────────────────┐
│                    COMPOSANTS PURS                       │
│              (vue-lib-exo-corrected)                    │
│  - LoginForm.vue                                        │
│  - RegisterForm.vue                                     │
│  → Présentation uniquement, pas de logique              │
└─────────────────────────────────────────────────────────┘
                        ↓ Props/Events
┌─────────────────────────────────────────────────────────┐
│                    PAGES/VUES                            │
│         (VueFormaExoWithLibCorrected)                   │
│  - Login.vue                                            │
│  - Register.vue                                          │
│  → Logique métier : store, router, API                  │
└─────────────────────────────────────────────────────────┘
                        ↓ Appels API
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                               │
│            (express-mongo-ts)                           │
│  - /api/auth/register                                   │
│  - /api/auth/login                                      │
│  - /api/auth/me                                         │
│  → Authentification, génération JWT                     │
└─────────────────────────────────────────────────────────┘
```

### Flux de données

```
User Input → Composant Pur → Page (logique) → Store → API → Backend
                                                              ↓
User Output ← Composant Pur ← Page (logique) ← Store ← API ← JWT
```

---

## 🔐 Backend - Express + MongoDB

### 1. Installation des dépendances

```bash
cd express-mongo-ts
yarn add jsonwebtoken bcrypt
yarn add -D @types/jsonwebtoken @types/bcrypt
```

**Explication** :
- `jsonwebtoken` : Pour créer et vérifier les tokens JWT
- `bcrypt` : Pour hasher les mots de passe (sécurité)
- `@types/*` : Types TypeScript pour l'autocomplétion

### 2. Modification du modèle User

**Fichier : `src/modules/users/user.model.ts`**

#### Avant :
```typescript
export interface IUser extends Document {
  nom: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Après :
```typescript
export interface IUser extends Document {
  nom: string;
  email: string;
  password: string; // ✅ Ajout du champ password
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>({
  nom: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { 
    type: String, 
    required: true, 
    select: false // ✅ Ne pas inclure par défaut dans les requêtes
  },
}, { timestamps: true });
```

**Explication** :
- `password` : Champ obligatoire pour stocker le hash du mot de passe
- `select: false` : Par défaut, le password n'est PAS inclus dans les résultats de requête
  - Pour l'inclure, il faut explicitement faire `.select('+password')`
  - Sécurité : évite d'exposer accidentellement les mots de passe

### 3. Module d'authentification

#### Structure

```
src/modules/auth/
├── auth.controller.ts    # Logique métier (register, login, getCurrentUser)
├── auth.middleware.ts   # Vérification JWT (middleware)
└── auth.routes.ts       # Configuration des routes
```

#### 3.1 Contrôleur (`auth.controller.ts`)

##### Fonction `register` - Inscription

```typescript
export const register = async (req: Request, res: Response) => {
  try {
    const { nom, email, password } = req.body;

    // 1. Validation basique
    if (!nom || !email || !password) {
      return res.status(400).json({ error: "Tous les champs sont requis" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
    }

    // 2. Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Cet email est déjà utilisé" });
    }

    // 3. Hasher le mot de passe AVANT de le stocker
    // bcrypt.hash() : Hash le password avec 10 rounds (sécurité vs performance)
    // - Le hash est irréversible : on ne peut pas retrouver le password original
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Créer l'utilisateur avec le password hashé
    const user = new User({
      nom,
      email,
      password: hashedPassword, // ✅ Stocker le hash, pas le password en clair
    });
    await user.save();

    // 5. Générer un token JWT pour l'utilisateur
    // jwt.sign() : Crée un token signé avec la clé secrète
    // - Payload : données encodées dans le token (userId, email)
    // - JWT_SECRET : clé secrète pour signer le token
    // - expiresIn : durée de validité (ex: "7d" = 7 jours)
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 6. Retourner les infos utilisateur + token (sans le password)
    res.status(201).json({
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
      },
      token, // ✅ Le frontend stockera ce token
    });
  } catch (err: any) {
    // Gestion des erreurs
    if (err.code === 11000) {
      return res.status(400).json({ error: "Cet email existe déjà" });
    }
    res.status(500).json({ error: "Erreur serveur lors de l'inscription" });
  }
};
```

**Points clés** :
1. **Validation** : Vérifier les données avant traitement
2. **Unicité** : Vérifier que l'email n'existe pas déjà
3. **Hashage** : `bcrypt.hash()` avec 10 rounds (équilibre sécurité/performance)
4. **Token JWT** : Généré après création réussie
5. **Sécurité** : Ne jamais retourner le password (même hashé)

##### Fonction `login` - Connexion

```typescript
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    // 2. Rechercher l'utilisateur par email
    // .select('+password') : Inclure le password (normalement exclu car select: false)
    // Nécessaire car on doit comparer le password fourni avec le hash stocké
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      // ⚠️ Message générique pour éviter l'énumération d'emails
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // 3. Comparer le password fourni avec le hash stocké
    // bcrypt.compare() : Compare le password en clair avec le hash
    // - Retourne true si les passwords correspondent
    // - Retourne false sinon
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // 4. Générer un token JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 5. Retourner les infos utilisateur + token
    res.json({
      user: {
        _id: user._id,
        nom: user.nom,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur lors de la connexion" });
  }
};
```

**Points clés** :
1. **`.select('+password')`** : Inclure le password pour la comparaison
2. **`bcrypt.compare()`** : Comparer password en clair avec hash
3. **Message générique** : Ne pas révéler si l'email existe (sécurité)
4. **Token JWT** : Généré après authentification réussie

##### Fonction `getCurrentUser` - Vérifier le token

```typescript
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // req.user est ajouté par le middleware authMiddleware
    const userId = (req as any).user.userId;

    // Récupérer les informations complètes de l'utilisateur
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // Retourner les infos (sans le password)
    res.json({
      _id: user._id,
      nom: user.nom,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
};
```

**Explication** :
- Cette route est protégée par `authMiddleware`
- Permet au frontend de vérifier si le token est toujours valide
- Utile au démarrage de l'application pour récupérer les infos utilisateur

#### 3.2 Middleware JWT (`auth.middleware.ts`)

Le middleware est une fonction qui s'exécute **avant** les routes. Il vérifie le token JWT.

```typescript
export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    // 1. Récupérer le token depuis les headers
    // Format standard : "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token manquant. Authentification requise." });
    }

    // 2. Extraire le token du header
    // authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Format de token invalide." });
    }

    const token = parts[1];

    // 3. Vérifier et décoder le token
    // jwt.verify() : 
    // - Vérifie que le token est signé avec JWT_SECRET
    // - Vérifie que le token n'est pas expiré
    // - Retourne le payload décodé (userId, email)
    // - Lance une erreur si le token est invalide
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    // 4. Ajouter les infos utilisateur à la requête
    // req.user sera accessible dans tous les contrôleurs
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    // 5. Passer au middleware suivant ou à la route
    next();
  } catch (err: any) {
    // Gestion des erreurs JWT
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token invalide" });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expiré. Veuillez vous reconnecter." });
    }
    res.status(500).json({ error: "Erreur serveur lors de la vérification du token" });
  }
};
```

**Explication** :
1. **Extraction** : Récupère le token depuis `Authorization: Bearer <token>`
2. **Vérification** : `jwt.verify()` vérifie la signature et l'expiration
3. **Ajout à req** : `req.user` contient userId et email
4. **next()** : Passe au middleware suivant ou à la route

**Utilisation** :
```typescript
router.post("/", authMiddleware, createNote);
//          ↑ Route    ↑ Middleware    ↑ Contrôleur
```

#### 3.3 Routes (`auth.routes.ts`)

```typescript
import express from "express";
import { register, login, getCurrentUser } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";

const router = express.Router();

// Routes publiques (pas besoin d'authentification)
router.post("/register", register);
router.post("/login", login);

// Route protégée (nécessite un token JWT valide)
router.get("/me", authMiddleware, getCurrentUser);

export default router;
```

**Explication** :
- `/register` et `/login` : Publiques (tout le monde peut y accéder)
- `/me` : Protégée (nécessite `authMiddleware`)

### 4. Protection des routes Notes et Tags

#### Avant (non sécurisé) :

```typescript
// note.controller.ts
export const createNote = async (req: Request, res: Response) => {
  const { frontId, contentMd, userId, tags } = req.body; // ❌ userId du body (modifiable)
  // ...
};

// note.routes.ts
router.post("/", createNote); // ❌ Pas de protection
```

**Problème** : N'importe qui peut passer n'importe quel `userId` dans le body !

#### Après (sécurisé) :

```typescript
// note.routes.ts
router.post("/", authMiddleware, createNote); // ✅ Protection

// note.controller.ts
export const createNote = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId; // ✅ userId depuis le token (sécurisé)
  const { frontId, contentMd, tags } = req.body; // Plus de userId ici
  // ...
};
```

**Avantage** : Le `userId` vient du token JWT, impossible de le modifier côté client !

### 5. Configuration .env

**Fichier : `.env`**

```env
JWT_SECRET=votre-secret-super-securise-changez-moi-en-production
JWT_EXPIRES_IN=7d
```

**Explication** :
- `JWT_SECRET` : Clé secrète pour signer/vérifier les tokens
  - ⚠️ **Important** : Changez en production avec une clé longue et aléatoire
- `JWT_EXPIRES_IN` : Durée de validité du token (ex: "7d", "24h", "1h")

### 6. Intégration dans server.ts

```typescript
import authRoutes from "./modules/auth/auth.routes";

app.use("/api/auth", authRoutes); // ✅ Ajout des routes d'authentification
```

---

## 🎨 Frontend - Vue 3 + TypeScript

### 1. Store d'authentification (Pinia)

**Fichier : `src/stores/auth.ts`**

#### État réactif

```typescript
const token = ref<string | null>(localStorage.getItem('auth_token'));
const user = ref<UserType | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
```

**Explication** :
- `token` : Token JWT stocké (null si non connecté)
- `user` : Informations utilisateur (null si non connecté)
- `isLoading` : État de chargement (pour afficher un spinner)
- `error` : Message d'erreur (pour afficher les erreurs)

#### Computed

```typescript
const isAuthenticated = computed(() => !!token.value);
```

**Explication** : Retourne `true` si un token existe (utilisateur connecté)

#### Méthode `setAuth` - Sauvegarder l'authentification

```typescript
function setAuth(newToken: string, userData: UserType) {
  token.value = newToken;
  user.value = userData;
  error.value = null;
  localStorage.setItem('auth_token', newToken); // ✅ Persister dans localStorage
}
```

**Explication** :
- Sauvegarde le token et les infos utilisateur dans le store
- Persiste le token dans `localStorage` pour maintenir la session après rechargement

#### Méthode `loginUser` - Connexion

```typescript
async function loginUser(email: string, password: string): Promise<boolean> {
  isLoading.value = true;
  error.value = null;
  try {
    // Appeler l'API login
    const response = await login({ email, password });
    
    // Sauvegarder le token et les infos utilisateur
    setAuth(response.token, response.user);
    
    return true; // Succès
  } catch (err: any) {
    error.value = err.message || 'Erreur lors de la connexion';
    return false; // Échec
  } finally {
    isLoading.value = false;
  }
}
```

**Explication** :
1. Active le loading
2. Appelle l'API `login()`
3. Si succès : sauvegarde token + user
4. Si erreur : sauvegarde le message d'erreur
5. Désactive le loading (dans `finally`)

#### Méthode `registerUser` - Inscription

```typescript
async function registerUser(nom: string, email: string, password: string): Promise<boolean> {
  isLoading.value = true;
  error.value = null;
  try {
    const response = await register({ nom, email, password });
    setAuth(response.token, response.user);
    return true;
  } catch (err: any) {
    error.value = err.message || 'Erreur lors de l\'inscription';
    return false;
  } finally {
    isLoading.value = false;
  }
}
```

**Explication** : Même principe que `loginUser`

#### Méthode `initAuth` - Initialisation au démarrage

```typescript
async function initAuth() {
  const storedToken = localStorage.getItem('auth_token');
  if (storedToken) {
    token.value = storedToken;
    isLoading.value = true;
    try {
      // Vérifier si le token est toujours valide
      const userData = await getCurrentUser();
      user.value = userData;
    } catch (err) {
      // Si le token est invalide, nettoyer
      console.error('Token invalide, déconnexion...', err);
      logout();
    } finally {
      isLoading.value = false;
    }
  }
}
```

**Explication** :
1. Récupère le token depuis `localStorage`
2. Si token existe : vérifie sa validité en appelant `/api/auth/me`
3. Si valide : récupère les infos utilisateur
4. Si invalide : déconnecte l'utilisateur

#### Persistance Pinia

```typescript
{
  persist: {
    key: 'auth',
    storage: localStorage,
    pick: ['token'], // ✅ Ne persister que le token
  }
}
```

**Explication** : Pinia sauvegarde automatiquement le token dans `localStorage`

### 2. Configuration Axios

**Fichier : `src/api/axios.ts`**

#### Intercepteur de requête

```typescript
axiosClient.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    
    // Ajouter le token dans les headers si disponible
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

**Explication** :
- S'exécute **avant** chaque requête HTTP
- Ajoute automatiquement `Authorization: Bearer <token>` dans les headers
- Plus besoin d'ajouter le token manuellement dans chaque appel API !

#### Intercepteur de réponse

```typescript
axiosClient.interceptors.response.use(
  (response) => {
    return response; // ✅ Si OK, retourner la réponse
  },
  (error) => {
    // Si le serveur retourne 401 (Unauthorized)
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      // Déconnecter l'utilisateur
      authStore.logout();
      // Optionnel : rediriger vers /login
      // window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);
```

**Explication** :
- S'exécute **après** chaque réponse HTTP
- Si 401 (token expiré/invalide) : déconnecte automatiquement
- Gestion globale des erreurs d'authentification

### 3. API d'authentification

**Fichier : `src/api/authApi.ts`**

```typescript
// Inscription
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>('/auth/register', data);
  return response.data;
};

// Connexion
export const login = async (data: LoginData): Promise<AuthResponse> => {
  const response = await axiosClient.post<AuthResponse>('/auth/login', data);
  return response.data;
};

// Récupérer l'utilisateur connecté
export const getCurrentUser = async (): Promise<UserType> => {
  const response = await axiosClient.get<UserType>('/auth/me');
  return response.data;
};
```

**Explication** :
- Fonctions simples qui appellent l'API
- Utilisent `axiosClient` (qui ajoute automatiquement le token)
- Retournent les données typées

### 4. APIs modifiées (Notes et Tags)

#### Avant (non sécurisé) :

```typescript
// noteApi.ts
export const createNote = async (note: { userId: string, ... }) => {
  // ❌ userId passé manuellement
};
```

#### Après (sécurisé) :

```typescript
// noteApi.ts
export const createNote = async (note: { ... }) => {
  // ✅ userId vient automatiquement du token (via intercepteur)
  const response = await axiosClient.post('/notes', note);
  return response.data;
};
```

**Explication** : Plus besoin de passer `userId`, il vient automatiquement du token JWT côté backend

### 5. Router avec Navigation Guards

**Fichier : `src/router/index.ts`**

#### Routes protégées

```typescript
{
  path: '/',
  name: 'Home',
  component: Home,
  meta: { requiresAuth: true } // ✅ Nécessite une authentification
}
```

#### Routes publiques

```typescript
{
  path: '/login',
  name: 'Login',
  component: Login,
  meta: { requiresAuth: false } // ✅ Accessible sans authentification
}
```

#### Guard `beforeEach`

```typescript
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Si la route nécessite une authentification
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Si non connecté, rediriger vers login
      // Sauvegarder l'URL de destination pour y rediriger après login
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
    } else {
      // Si connecté, autoriser l'accès
      next();
    }
  } else {
    // Si la route est publique (login, register)
    if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
      // Si déjà connecté et qu'on essaie d'accéder à login/register
      // Rediriger vers l'accueil
      next('/');
    } else {
      // Sinon, autoriser l'accès
      next();
    }
  }
});
```

**Explication** :
1. Vérifie si la route nécessite une authentification (`meta.requiresAuth`)
2. Si oui et non connecté : redirige vers `/login` avec `redirect` dans query
3. Si oui et connecté : autorise l'accès
4. Si route publique et déjà connecté : redirige vers `/`
5. Sinon : autorise l'accès

### 6. Composants dans la lib

#### LoginForm (`vue-lib-exo-corrected/src/components/Molecules/LoginForm/LoginForm.vue`)

**Caractéristiques** :
- ✅ **Composant pur** : Pas de store, pas de router, pas d'API
- ✅ **Vuetify** : Utilise `v-form`, `v-text-field`, `v-btn`, `v-alert`
- ✅ **Props** : Reçoit les données via props
- ✅ **Émissions** : Émet des événements pour communiquer avec le parent

```vue
<template>
  <v-form @submit.prevent="handleSubmit">
    <v-text-field
      :model-value="email"
      @update:model-value="$emit('update:email', $event)"
      label="Email"
      type="email"
      required
      :disabled="isLoading"
    />
    <!-- ... -->
    <v-btn
      type="submit"
      :disabled="isLoading || !isFormValid"
      :loading="isLoading"
    >
      Se connecter
    </v-btn>
  </v-form>
</template>
```

**Explication** :
- Le composant ne connaît pas le store, le router, etc.
- Il reçoit tout via props (`email`, `password`, `isLoading`, `error`)
- Il émet des événements (`update:email`, `update:password`, `submit`)
- Le parent (la page) gère toute la logique

#### RegisterForm (même principe)

### 7. Pages (Login.vue et Register.vue)

**Fichier : `src/views/Login.vue`**

```vue
<template>
  <v-container>
    <v-card>
      <v-card-title>Connexion</v-card-title>
      <v-card-text>
        <!-- Composant pur : LoginForm -->
        <LoginForm
          v-model:email="email"
          v-model:password="password"
          :is-loading="authStore.isLoading"
          :error="authStore.error"
          @submit="handleLogin"
        />
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { LoginForm } from 'vue-lib-exo-corrected';

// ✅ Toute la logique est ici
const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');

async function handleLogin() {
  const success = await authStore.loginUser(email.value, password.value);
  
  if (success) {
    // Récupérer la route de redirection depuis query
    const redirect = router.currentRoute.value.query.redirect as string | undefined;
    router.push(redirect || '/');
  }
}
</script>
```

**Explication** :
- La page gère toute la logique (store, router)
- Le composant `LoginForm` est pur (présentation uniquement)
- Séparation claire des responsabilités

### 8. Initialisation

**Fichier : `src/main.ts`**

```typescript
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();

// Initialiser l'authentification avant de monter l'app
authStore.initAuth().then(() => {
  app.mount('#app');
});
```

**Explication** : Vérifie le token au démarrage avant de monter l'application

**Fichier : `src/App.vue`**

```vue
<template>
  <!-- Afficher le Layout seulement si connecté -->
  <Layout v-if="authStore.isAuthenticated">
    <router-view />
  </Layout>
  
  <!-- Sinon, afficher directement le router-view (pour login/register) -->
  <router-view v-else />
</template>
```

**Explication** : Affiche le Layout seulement si l'utilisateur est connecté

---

## 🔄 Flux d'authentification

### 1. Inscription

```
┌─────────┐     ┌──────────┐     ┌──────┐     ┌─────────┐     ┌──────────┐
│  User   │────▶│ Register │────▶│Store │────▶│   API   │────▶│ Backend  │
│         │     │  Form    │     │      │     │         │     │          │
└─────────┘     └──────────┘     └──────┘     └─────────┘     └──────────┘
   Input          Composant        Logique      HTTP          Hash + JWT
                  Pur              Métier       Request       Génération
                                    
                                    
┌─────────┐     ┌──────────┐     ┌──────┐     ┌─────────┐     ┌──────────┐
│  User   │◀────│ Register │◀────│Store │◀────│   API   │◀────│ Backend  │
│         │     │  Form    │     │      │     │         │     │          │
└─────────┘     └──────────┘     └──────┘     └─────────┘     └──────────┘
   Success       Affichage        Token +      HTTP          Token JWT
                 Message          User         Response      + User Data
```

**Étapes détaillées** :

1. **User remplit le formulaire** → `RegisterForm` (composant pur)
2. **Submit** → `Register.vue` écoute `@submit`
3. **Page appelle** → `authStore.registerUser(nom, email, password)`
4. **Store appelle** → `register({ nom, email, password })` (API)
5. **Axios intercepteur** → Ajoute `Authorization: Bearer <token>` (si token existe)
6. **Backend reçoit** → `POST /api/auth/register`
7. **Backend hash** → `bcrypt.hash(password, 10)`
8. **Backend crée user** → `User.create({ nom, email, hashedPassword })`
9. **Backend génère JWT** → `jwt.sign({ userId, email }, JWT_SECRET)`
10. **Backend retourne** → `{ user, token }`
11. **Store sauvegarde** → `setAuth(token, user)` + `localStorage.setItem('auth_token', token)`
12. **Router redirige** → `/`

### 2. Connexion

Même principe que l'inscription, mais :
- Backend vérifie le password avec `bcrypt.compare()`
- Si valide : génère un token JWT
- Si invalide : retourne 401

### 3. Requête API protégée

```
┌─────────┐     ┌──────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│Composant│────▶│ API  │────▶│ Axios  │────▶│ Backend  │────▶│ MongoDB │
│  Vue    │     │ Call │     │Intercep│     │Middleware│     │         │
└─────────┘     └──────┘     └─────────┘     └──────────┘     └─────────┘
  fetchNotes()   fetchNotes()  Ajoute Token   Vérifie Token    Query avec
                                                               userId
```

**Étapes détaillées** :

1. **Composant appelle** → `fetchNotes()`
2. **Axios intercepteur** → Ajoute `Authorization: Bearer <token>` automatiquement
3. **Backend reçoit** → `GET /api/notes` avec header `Authorization`
4. **authMiddleware** → Extrait token, vérifie avec `jwt.verify()`
5. **authMiddleware** → Ajoute `req.user = { userId, email }`
6. **Contrôleur** → Utilise `req.user.userId` (sécurisé)
7. **MongoDB query** → `Note.find({ userId: req.user.userId })`
8. **Backend retourne** → Notes de l'utilisateur uniquement
9. **Composant reçoit** → Notes affichées

### 4. Rechargement de page

```
┌─────────┐     ┌──────┐     ┌─────────┐     ┌──────────┐
│ main.ts │────▶│Store │────▶│   API   │────▶│ Backend  │
│         │     │      │     │         │     │          │
└─────────┘     └──────┘     └─────────┘     └──────────┘
  initAuth()    Récupère     GET /auth/me    Vérifie Token
                Token depuis                  + Retourne User
                localStorage
```

**Étapes détaillées** :

1. **main.ts** → `authStore.initAuth()`
2. **Store** → `localStorage.getItem('auth_token')`
3. **Si token existe** → Appelle `getCurrentUser()` (API)
4. **Axios intercepteur** → Ajoute `Authorization: Bearer <token>`
5. **Backend** → `authMiddleware` vérifie le token
6. **Si valide** → Retourne les infos utilisateur
7. **Store** → `user.value = userData`
8. **App monte** → Utilisateur connecté
9. **Si invalide** → `logout()`, redirige vers `/login`

---

## 🔒 Sécurité

### Backend

#### 1. Mots de passe hashés

```typescript
const hashedPassword = await bcrypt.hash(password, 10);
```

- **Irréversible** : Impossible de retrouver le password original
- **Salt rounds** : 10 itérations (équilibre sécurité/performance)
- **Unique** : Chaque hash est différent (même password = hash différent)

#### 2. Tokens JWT signés

```typescript
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
```

- **Signé** : Impossible de modifier le token sans connaître le secret
- **Expirable** : Durée de vie limitée (7 jours)
- **Vérifiable** : Le serveur peut vérifier l'intégrité

#### 3. userId sécurisé

**Avant** :
```typescript
const userId = req.body.userId; // ❌ Modifiable par le client
```

**Après** :
```typescript
const userId = req.user.userId; // ✅ Extrait du token (non modifiable)
```

#### 4. Middleware global

Toutes les routes protégées passent par `authMiddleware` qui vérifie le token.

#### 5. Validation

- Email unique
- Password minimum 6 caractères
- Validation des données avant traitement

### Frontend

#### 1. Token dans localStorage

- **Persistance** : Maintient la session après rechargement
- **Sécurité** : localStorage est accessible uniquement par le domaine

#### 2. Intercepteur Axios

- **Automatique** : Ajoute le token dans chaque requête
- **Transparent** : Plus besoin de gérer manuellement

#### 3. Déconnexion automatique

Si le token est expiré (401), l'utilisateur est déconnecté automatiquement.

#### 4. Navigation guards

Protection des routes : impossible d'accéder aux pages protégées sans être connecté.

---

## 💡 Utilisation pratique

### Créer un compte

```typescript
// 1. Aller sur /register
// 2. Remplir le formulaire
// 3. Le store gère automatiquement :
//    - Appel API
//    - Sauvegarde token
//    - Redirection
```

### Se connecter

```typescript
// 1. Aller sur /login
// 2. Entrer email/password
// 3. Le store gère automatiquement :
//    - Appel API
//    - Sauvegarde token
//    - Redirection vers / (ou route redirect)
```

### Utiliser les APIs

```typescript
// Plus besoin de passer userId !
const note = await createNote({
  frontId: "...",
  contentMd: "...",
  tags: []
}); // userId vient automatiquement du token
```

### Déconnexion

```typescript
const authStore = useAuthStore();
authStore.logout(); // Nettoie token + user + localStorage
```

### Vérifier si connecté

```typescript
const authStore = useAuthStore();
if (authStore.isAuthenticated) {
  // Utilisateur connecté
}
```

### Accéder aux infos utilisateur

```typescript
const authStore = useAuthStore();
const user = authStore.user; // { _id, nom, email }
```

---

## 📝 Résumé

### Ce qui a été fait

#### Backend
✅ Installation jsonwebtoken, bcrypt
✅ Modification modèle User (ajout password avec select: false)
✅ Création module auth (controller, middleware, routes)
✅ Protection routes notes/tags avec authMiddleware
✅ Modification contrôleurs (userId depuis token au lieu du body)
✅ Configuration .env (JWT_SECRET, JWT_EXPIRES_IN)

#### Frontend - Lib
✅ Création LoginForm (composant pur avec Vuetify)
✅ Création RegisterForm (composant pur avec Vuetify)
✅ Export dans index.ts

#### Frontend - Projet principal
✅ Création store auth (Pinia avec persistance)
✅ Création authApi
✅ Modification axios (intercepteurs request/response)
✅ Modification noteApi/tagApi (plus de userId)
✅ Création pages Login/Register
✅ Navigation guards router
✅ Initialisation auth dans main.ts
✅ Modification App.vue

### Principes respectés

✅ **Sécurité** : Mots de passe hashés, tokens signés, userId sécurisé
✅ **Architecture** : Séparation composants purs / logique métier
✅ **Maintenabilité** : Code organisé, commenté, typé
✅ **Réutilisabilité** : Composants dans la lib
✅ **UX** : Validation, erreurs, états de chargement

---

## 🎓 Conclusion

Cette implémentation respecte les bonnes pratiques de sécurité et d'architecture. Le système est prêt pour la production et peut être étendu avec :
- Refresh tokens
- Rôles et permissions
- OAuth (Google, GitHub, etc.)
- 2FA (authentification à deux facteurs)
- Rate limiting

**Le système est fonctionnel et sécurisé !** 🔐



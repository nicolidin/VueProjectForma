# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Configuration

### Variables d'environnement

Le projet utilise des variables d'environnement pour configurer l'API backend.

1. Copiez le fichier `.env.example` en `.env` :
   ```bash
   cp .env.example .env
   ```

2. Modifiez les valeurs dans `.env` selon votre environnement :
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

**Note :** Les variables d'environnement dans Vite doivent être préfixées par `VITE_` pour être accessibles dans le code client.

Le fichier `.env` est ignoré par Git pour des raisons de sécurité. Utilisez `.env.example` comme référence.

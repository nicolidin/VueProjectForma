import { createApp } from 'vue'

// console.log("import.meta.env.PROD", import.meta?.env?.PROD)

console.log("MODE: ", import.meta.env.MODE)
import 'vue-lib-exo-corrected/style.css' // Import statique (synchrone)

import App from './App.vue'
import {createLidinAppKit, DEFAULT_VUETIFY_CONFIG} from "vue-lib-exo-corrected";
import router from "./router";
import {createPinia} from "pinia";
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const lidinAppKit = createLidinAppKit(DEFAULT_VUETIFY_CONFIG)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const app = createApp(App).use(lidinAppKit).use(pinia).use(router)

// ─── Initialiser l'authentification avant de monter l'app ─────────────────────────
// - Import du store auth
// - Appel de initAuth() pour vérifier si un token existe dans localStorage
// - Si oui, vérifie sa validité et récupère les infos utilisateur
import { useAuthStore } from './stores/auth';
const authStore = useAuthStore();
authStore.initAuth().then(() => {
  // Une fois l'auth initialisée, monter l'application
  app.mount('#app');
});


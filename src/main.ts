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

createApp(App).use(lidinAppKit).use(pinia).use(router).mount('#app')


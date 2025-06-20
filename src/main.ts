import { createApp } from 'vue'

// console.log("import.meta.env.PROD", import.meta?.env?.PROD)

console.log("MODE: ", import.meta.env.MODE)
import('lidin-app-kit/style.css') // in dev mode it takes empty file and in build it takes the builded css lib file ! (components style etc)

import App from './App.vue'
import {createLidinAppKit, DEFAULT_VUETIFY_CONFIG} from "lidin-app-kit";
import router from "./router";
import {createPinia} from "pinia";
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const lidinAppKit = createLidinAppKit(DEFAULT_VUETIFY_CONFIG)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

createApp(App).use(lidinAppKit).use(pinia).use(router).mount('#app')


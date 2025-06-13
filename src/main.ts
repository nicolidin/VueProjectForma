import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import {createLidinAppKit, DEFAULT_VUETIFY_CONFIG} from "lidin-app-kit";
import router from "./router";
import {createPinia} from "pinia";
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const lidinAppKit = createLidinAppKit(DEFAULT_VUETIFY_CONFIG)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

createApp(App).use(lidinAppKit).use(pinia).use(router).mount('#app')


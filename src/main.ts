import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import {createLidinAppKit, DEFAULT_VUETIFY_CONFIG} from "lidin-app-kit";

const lidinAppKit = createLidinAppKit(DEFAULT_VUETIFY_CONFIG)
createApp(App).use(lidinAppKit).mount('#app')

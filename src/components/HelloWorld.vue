<template>
  <h1>{{ msg }}</h1>
  <div class="card">
    <button type="button" @click="count++">count is damn {{ count }}</button>
    <button type="button" @click="counterStore.increment">count store </button>
  </div>
  <!-- <ArticlePreview content="dqgqkddk"/> -->
  count store: {{counterStore.count}}
  <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import {useCounterStore} from "../stores/counter.ts";
// import {ArticlePreview} from "vue-lib-exo-corrected"; // Component not available in vue-lib-exo-corrected

defineProps<{ msg: string }>()
const counterStore = useCounterStore();
const count = ref(0)
</script>



<style scoped>
.read-the-docs {
  color: #888;
}
</style>

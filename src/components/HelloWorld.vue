<template>
  <h1>{{ msg }}</h1>
  <div class="card">
    <button type="button" @click="count++">count is damn {{ count }}</button>
  </div>

  <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import {ArticlePreview} from "lidin-app-kit";

defineProps<{ msg: string }>()

const count = ref(0)
</script>



<style scoped>
.read-the-docs {
  color: #888;
}
</style>

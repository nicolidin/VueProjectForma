<template>
  <div class="note-card">
    <h3>{{ title }}</h3>
    <p>{{ content }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  content: string
}>()
</script>

<style scoped>
.note-card {
  border: 1px solid #aaa;
  padding: 0.5rem;
  width: 200px;
  height: 120px;
  background-color: #f9f9f9;
}
</style>

<template>
  <div class="list-layout">
    <h2>Liste des éléments :</h2>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.list-layout {
  border: 1px solid #ccc;
  padding: 1rem;
}

.content {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
</style>

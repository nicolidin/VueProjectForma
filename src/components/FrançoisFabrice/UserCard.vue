<template>
  <div class="user-card">
    <strong>{{ name }}</strong>
    <p>Email : {{ email }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  email: string
}>()
</script>

<style scoped>
.user-card {
  border: 1px solid #66aaff;
  padding: 0.5rem;
  width: 200px;
  background-color: #eef6ff;
}
</style>

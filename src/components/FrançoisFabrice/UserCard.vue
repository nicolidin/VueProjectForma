<template>
  <div class="user-card">
    <strong>{{ user.name }}</strong>
    <p>Email : {{ user.email }}</p>
    <div class="user-meta" v-if="user.role">
      <span class="role">{{ user.role }}</span>
    </div>
    <div class="user-status" v-if="user.isActive !== undefined">
      <span :class="['status', user.isActive ? 'active' : 'inactive']">
        {{ user.isActive ? 'Actif' : 'Inactif' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { User } from '@/types/UserType'

interface Props {
  user: User
}

defineProps<Props>()
</script>

<style scoped>
.user-card {
  border: 1px solid #66aaff;
  padding: 0.5rem;
  width: 200px;
  background-color: #eef6ff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-meta {
  margin-top: auto;
}

.role {
  background-color: #66aaff;
  color: white;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.user-status {
  margin-top: auto;
}

.status {
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: bold;
}

.status.active {
  background-color: #4caf50;
  color: white;
}

.status.inactive {
  background-color: #f44336;
  color: white;
}
</style>

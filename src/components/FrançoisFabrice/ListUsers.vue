<template>
  <ListLayout>
    <UserCard
        v-for="user in users"
        :key="user.id"
        :name="user.name"
        :email="user.email"
    />
  </ListLayout>
</template>

<script setup lang="ts">
import ListLayout from './ListLayout.vue'
import UserCard from './UserCard.vue'
import {ref, type Ref} from "vue";

interface User {
  id: number
  name: string
  email: string
}

const users: Ref<User[]> = ref([
  { id: 1, name: 'Alice Dupont', email: 'alice@example.com' },
  { id: 2, name: 'Bob Martin', email: 'bob@example.com' },
  { id: 3, name: 'Charlie Niel', email: 'charlie@example.com' },
])
</script>

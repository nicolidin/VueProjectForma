<template>
  <ListLayout>
    <UserCard
        v-for="user in users"
        :key="user.id"
        :user="user"
    />
  </ListLayout>
</template>

<script setup lang="ts">
import ListLayout from './ListLayout.vue'
import UserCard from './UserCard.vue'
import type { User } from '@/types/UserType'

interface Props {
  users: User[]
}

defineProps<Props>()
</script>

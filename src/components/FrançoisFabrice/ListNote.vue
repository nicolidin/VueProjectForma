<template>
  <ListLayout>
    <NoteCard
        v-for="note in notes"
        :key="note.id"
        :note="note"
    />
  </ListLayout>
</template>

<script setup lang="ts">
import ListLayout from './ListLayout.vue'
import NoteCard from './NoteCard.vue'
import type { NoteType } from '@/types/NoteType'

interface Props {
  notes: NoteType[]
}

defineProps<Props>()
</script>

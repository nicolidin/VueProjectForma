<template>
  <ListLayout>
    <NoteCard
        v-for="note in notes"
        :key="note.id"
        :title="note.title"
        :content="note.content"
    />
  </ListLayout>
</template>

<script setup lang="ts">
import ListLayout from './ListLayout.vue'
import NoteCard from './NoteCard.vue'
import {ref, type Ref} from "vue";

interface Note {
  id: number
  title: string
  content: string
}

const notes: Ref<Note[]> = ref([
  { id: 1, title: 'Note 1', content: 'Contenu de la note 1' },
  { id: 2, title: 'Note 2', content: 'Contenu de la note 2' },
  { id: 3, title: 'Note 3', content: 'Contenu de la note 3' },
])
</script>

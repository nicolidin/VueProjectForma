<template>
  <div class="note-card">
    <h3>{{ title }}</h3>
    <p>{{ contentWithoutTitle }}</p>
    <div class="note-meta" v-if="note.tags && note.tags.length > 0">
      <span class="tag" v-for="tag in note.tags" :key="tag">{{ tag }}</span>
    </div>
    <div class="note-status" v-if="note.status">
      <span :class="['status', note.status]">{{ note.status }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NoteType } from '@/types/NoteType'
import { extractTitleFromMarkdown } from '@/services/markdownUtils'

interface Props {
  note: NoteType
}

const props = defineProps<Props>()

// Extract title from markdown content
const title = computed(() => {
  const extractedTitle = extractTitleFromMarkdown(props.note.contentMd)
  return extractedTitle || 'Sans titre'
})

// Get content without the title line
const contentWithoutTitle = computed(() => {
  const lines = props.note.contentMd.split('\n')
  // If first line starts with #, skip it
  if (lines[0]?.trim().startsWith('#')) {
    return lines.slice(1).join('\n').trim()
  }
  return props.note.contentMd
})
</script>

<style scoped>
.note-card {
  border: 1px solid #aaa;
  padding: 0.5rem;
  width: 200px;
  min-height: 120px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.note-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tag {
  background-color: #e0e0e0;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.note-status {
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

.status.completed {
  background-color: #2196f3;
  color: white;
}
</style>

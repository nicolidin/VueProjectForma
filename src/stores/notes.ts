import { defineStore } from 'pinia'
import { ref } from 'vue'
import { merge } from 'lodash'
import type { Note } from '@/api/noteService'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])

  function addNote(note: Note) {
    notes.value.push(note)
  }

  function editNote(id: number, updatedNote: Partial<Note>) {
    const index = notes.value.findIndex(note => note.id === id)
    if (index !== -1) {
      notes.value[index] = merge({}, notes.value[index], updatedNote)
    }
  }

  return {
    notes,
    addNote,
    editNote
  }
}) 
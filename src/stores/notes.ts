import { defineStore } from 'pinia'
import {computed, ref} from 'vue'
import { merge } from 'lodash-es'
import type {NoteType} from "@/types/NoteType.ts";

export const useNotesStore = defineStore('notes',
  () => {
    const notes = ref<NoteType[]>([])

    const getNoteById = (id: string) => {
      return computed(() => notes.value.find((item: any) => item.id === id))
    }

    function setAllNotes(newNotes: Array<NoteType>) {
      notes.value = newNotes
    }

    function addNote(note: NoteType) {
      notes.value.push(note)
    }

    function editNote(id: number, updatedNote: Partial<NoteType>) {
      const index = notes.value.findIndex((note: any) => note.id === id)
      if (index !== -1) {
        notes.value[index] = merge({}, notes.value[index], updatedNote)
      }
    }

    return {
      notes,
      getNoteById,
      addNote,
      setAllNotes,
      editNote
    }
  },{
    persist: {
      key: 'notes', // clé dans localStorage
      storage: localStorage, // facultatif, car par défaut c’est localStorage
    }
  })

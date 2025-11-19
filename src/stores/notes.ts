import { defineStore } from 'pinia'
import {computed, ref} from 'vue'
import { merge } from 'lodash-es'
import type {NoteType} from "@/types/NoteType.ts";
import type {TagType} from "@/types/TagType.ts";
import {generateRandomUuid} from "vue-lib-exo-corrected";

export const useNotesStore = defineStore('notes',
  () => {
    const notes = ref<NoteType[]>([])
    const tags = ref<TagType[]>([])

    const getNoteById = (id: string) => {
      return computed(() => notes.value.find((item: any) => item.id === id))
    }

    const getTagById = (id: string) => {
      return computed(() => tags.value.find((tag: TagType) => tag.id === id))
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

    function setAllTags(newTags: Array<TagType>) {
      tags.value = newTags
    }

    function addTag(tag: Omit<TagType, 'id'>) {
      const newTag: TagType = {
        id: generateRandomUuid(),
        ...tag
      }
      tags.value.push(newTag)
      return newTag
    }

    function editTag(id: string, updatedTag: Partial<TagType>) {
      const index = tags.value.findIndex((tag: TagType) => tag.id === id)
      if (index !== -1) {
        tags.value[index] = merge({}, tags.value[index], updatedTag)
      }
    }

    function deleteTag(id: string) {
      const index = tags.value.findIndex((tag: TagType) => tag.id === id)
      if (index !== -1) {
        tags.value.splice(index, 1)
      }
    }

    return {
      notes,
      tags,
      getNoteById,
      getTagById,
      addNote,
      setAllNotes,
      editNote,
      setAllTags,
      addTag,
      editTag,
      deleteTag
    }
  },{
    persist: {
      key: 'notes', // clé dans localStorage
      storage: localStorage, // facultatif, car par défaut c'est localStorage
    }
  })

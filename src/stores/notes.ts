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
    // État pour gérer la sélection des tags (par nom de tag)
    // Utilisation d'un tableau au lieu d'un Set pour la réactivité Vue
    const selectedTagNames = ref<string[]>([])

    const getNoteById = (id: string) => {
      return computed(() => notes.value.find((item: any) => item.id === id))
    }

    const getTagById = (id: string) => {
      return computed(() => tags.value.find((tag: TagType) => tag.id === id))
    }

    // Computed pour obtenir les IDs des tags sélectionnés
    const selectedTagIds = computed(() => {
      if (selectedTagNames.value.length === 0) {
        return null
      }
      return new Set(
        tags.value
          .filter(tag => selectedTagNames.value.includes(tag.title))
          .map(tag => tag.id)
      )
    })

    // Computed pour filtrer les notes selon les tags sélectionnés
    const filteredNotes = computed(() => {
      // Si aucun tag n'est sélectionné, afficher toutes les notes
      if (selectedTagIds.value === null) {
        return notes.value
      }
      
      // Filtrer les notes qui ont au moins un des tags sélectionnés
      return notes.value.filter((note: NoteType) => {
        return note.tagIds.some(tagId => selectedTagIds.value!.has(tagId))
      })
    })

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

    // Méthodes pour gérer la sélection des tags
    function setTagSelected(tagName: string, isSelected: boolean) {
      if (isSelected) {
        if (!selectedTagNames.value.includes(tagName)) {
          selectedTagNames.value.push(tagName)
        }
      } else {
        const index = selectedTagNames.value.indexOf(tagName)
        if (index > -1) {
          selectedTagNames.value.splice(index, 1)
        }
      }
    }

    function clearSelectedTags() {
      selectedTagNames.value.length = 0
    }

    return {
      notes,
      tags,
      selectedTagNames,
      selectedTagIds,
      filteredNotes,
      getNoteById,
      getTagById,
      addNote,
      setAllNotes,
      editNote,
      setAllTags,
      addTag,
      editTag,
      deleteTag,
      setTagSelected,
      clearSelectedTags
    }
  },{
    persist: {
      key: 'notes', // clé dans localStorage
      storage: localStorage, // facultatif, car par défaut c'est localStorage
      // Exclure selectedTagNames de la persistance car c'est un Set et on ne veut pas persister l'état de sélection
      pick: ['notes', 'tags']
    }
  })

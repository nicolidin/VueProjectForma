import { defineStore } from 'pinia'
import {computed, ref} from 'vue'
import { merge } from 'lodash-es'
import type {NoteType} from "@/types/NoteType.ts";
import type {TagType} from "@/types/TagType.ts";
import {generateRandomUuid} from "vue-lib-exo-corrected";
import { noteEventBus } from "@/services/persistence/eventBus.ts";

export const useNotesStore = defineStore('notes',
  () => {
    const notes = ref<NoteType[]>([])
    const tags = ref<TagType[]>([])
    // État pour gérer la sélection des tags (par nom de tag)
    // Utilisation d'un tableau au lieu d'un Set pour la réactivité Vue
    const selectedTagNames = ref<string[]>([])

    const getNoteById = (id: string) => {
      return computed(() => notes.value.find((item: any) => item.frontId === id))
    }

    const getTagById = (id: string) => {
      return computed(() => tags.value.find((tag: TagType) => tag.frontId === id))
    }

    // Computed pour obtenir les IDs des tags sélectionnés
    const selectedTagIds = computed(() => {
      if (selectedTagNames.value.length === 0) {
        return null
      }
      return new Set(
        tags.value
          .filter(tag => selectedTagNames.value.includes(tag.title))
          .map(tag => tag.frontId)
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
      // Émettre un événement pour déclencher la persistance
      noteEventBus.emit('note:created', { note })
    }

    function editNote(id: string, updatedNote: Partial<NoteType>) {
      const index = notes.value.findIndex((note: any) => note.frontId === id)
      if (index !== -1) {
        notes.value[index] = merge({}, notes.value[index], updatedNote)
        // Émettre un événement pour déclencher la persistance
        noteEventBus.emit('note:updated', { id, updates: updatedNote })
      }
    }

    /**
     * Synchronise une note avec les données du backend sans émettre d'événement
     * Utilisé pour mettre à jour le _id MongoDB après persistance
     * @internal
     */
    function syncNote(id: string, updates: Partial<NoteType>) {
      const index = notes.value.findIndex((note: any) => note.frontId === id)
      if (index !== -1) {
        notes.value[index] = merge({}, notes.value[index], updates)
        // Pas d'émission d'événement pour éviter les boucles de persistance
      }
    }

    function deleteNote(id: string) {
      const index = notes.value.findIndex((note: any) => note.frontId === id)
      if (index !== -1) {
        notes.value.splice(index, 1)
        // Émettre un événement pour déclencher la persistance
        noteEventBus.emit('note:deleted', { id })
      }
    }

    function setAllTags(newTags: Array<TagType>) {
      tags.value = newTags
    }

    function addTag(tag: Omit<TagType, 'frontId'>) {
      const newTag: TagType = {
        frontId: generateRandomUuid(),
        ...tag
      }
      tags.value.push(newTag)
      return newTag
    }

    function editTag(id: string, updatedTag: Partial<TagType>) {
      const index = tags.value.findIndex((tag: TagType) => tag.frontId === id)
      if (index !== -1) {
        tags.value[index] = merge({}, tags.value[index], updatedTag)
      }
    }

    function deleteTag(id: string) {
      const index = tags.value.findIndex((tag: TagType) => tag.frontId === id)
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
      syncNote,
      deleteNote,
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

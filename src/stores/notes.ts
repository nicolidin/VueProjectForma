import { defineStore } from 'pinia'
import {computed, ref} from 'vue'
import { merge } from 'lodash-es'
import type {NoteType} from "@/types/NoteType.ts";
import type {TagType} from "@/types/TagType.ts";
import {generateRandomUuid} from "vue-lib-exo-corrected";
import { getPersistenceEventBus } from "@/services/persistence/usePersistence.ts";

export const useNotesStore = defineStore('notes',
  () => {
    const notes = ref<NoteType[]>([])
    const tags = ref<TagType[]>([])
    // État pour gérer la sélection des tags (par nom de tag)
    // Utilisation d'un tableau au lieu d'un Set pour la réactivité Vue
    const selectedTagNames = ref<string[]>([])

    // Event bus pour la persistance
    const eventBus = getPersistenceEventBus()

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
      eventBus.emit('entity:created', { entityType: 'note', data: note })
    }

    function editNote(id: string, updatedNote: Partial<NoteType>) {
      const index = notes.value.findIndex((note: any) => note.frontId === id)
      if (index !== -1) {
        notes.value[index] = merge({}, notes.value[index], updatedNote)
        // Émettre un événement pour déclencher la persistance
        eventBus.emit('entity:updated', { entityType: 'note', id, updates: updatedNote })
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

    /**
     * Synchronise un tag avec les données du backend sans émettre d'événement
     * Utilisé pour mettre à jour le _id MongoDB après persistance
     * @internal
     */
    function syncTag(id: string, updates: Partial<TagType>) {
      const index = tags.value.findIndex((tag: TagType) => tag.frontId === id)
      if (index !== -1) {
        tags.value[index] = merge({}, tags.value[index], updates)
        // Pas d'émission d'événement pour éviter les boucles de persistance
      }
    }

    function deleteNote(id: string) {
      const index = notes.value.findIndex((note: any) => note.frontId === id)
      if (index !== -1) {
        notes.value.splice(index, 1)
        // Émettre un événement pour déclencher la persistance
        eventBus.emit('entity:deleted', { entityType: 'note', id })
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
      // Émettre un événement pour déclencher la persistance
      eventBus.emit('entity:created', { entityType: 'tag', data: newTag })
      return newTag
    }

    function editTag(id: string, updatedTag: Partial<TagType>) {
      const index = tags.value.findIndex((tag: TagType) => tag.frontId === id)
      if (index !== -1) {
        tags.value[index] = merge({}, tags.value[index], updatedTag)
        // Émettre un événement pour déclencher la persistance
        eventBus.emit('entity:updated', { entityType: 'tag', id, updates: updatedTag })
      }
    }

    function deleteTag(id: string) {
      const index = tags.value.findIndex((tag: TagType) => tag.frontId === id)
      if (index !== -1) {
        tags.value.splice(index, 1)
        // Émettre un événement pour déclencher la persistance
        eventBus.emit('entity:deleted', { entityType: 'tag', id })
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

    /**
     * Initialise les listeners pour les événements de persistance
     * Doit être appelé une fois depuis App.vue après l'initialisation de usePersistence
     */
    function initPersistenceListeners() {
      // Écouter les événements de persistance réussie
      eventBus.on('entity:persisted', ({ entityType, original, persisted }) => {
        if (entityType === 'note') {
          const note = persisted.data as NoteType
          const originalNote = original.data as NoteType
          
          // Si la note a été créée et qu'on a maintenant un _id du backend
          if (originalNote.frontId && note._id && !originalNote._id) {
            syncNote(originalNote.frontId, {
              _id: note._id,
              // Mettre à jour aussi les tagIds si le backend les a transformés
              tagIds: note.tagIds || originalNote.tagIds
            })
          } else if (note._id) {
            // Mise à jour d'une note existante
            syncNote(note.frontId, {
              _id: note._id,
              tagIds: note.tagIds
            })
          }
        } else if (entityType === 'tag') {
          const tag = persisted.data as TagType
          const originalTag = original.data as TagType
          
          // Si le tag a été créé et qu'on a maintenant un _id du backend
          if (originalTag.frontId && tag._id && !originalTag._id) {
            syncTag(originalTag.frontId, {
              _id: tag._id
            })
          } else if (tag._id) {
            // Mise à jour d'un tag existant
            syncTag(tag.frontId, {
              _id: tag._id
            })
          }
        }
      })

      // Écouter les erreurs de persistance (optionnel : pour afficher des notifications)
      eventBus.on('entity:persist-error', ({ entityType, task, error }) => {
        console.warn(`Erreur de persistance pour ${entityType}:`, task.payload.metadata.frontId, error)
        // Ici, on pourrait ajouter une notification à l'utilisateur
      })
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
      syncTag,
      deleteTag,
      setTagSelected,
      clearSelectedTags,
      initPersistenceListeners
    }
  },{
    persist: {
      key: 'notes', // clé dans localStorage
      storage: localStorage, // facultatif, car par défaut c'est localStorage
      // Exclure selectedTagNames de la persistance car c'est un Set et on ne veut pas persister l'état de sélection
      pick: ['notes', 'tags']
    }
  })

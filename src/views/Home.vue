<template>
<!--  <NoteCreation @create="addNote" class="noteCreation"/>-->
<!--  <div class="noteCreation"></div>-->
<!--  <MozaicArticles :articles="notesStore.notes" @click-on-article="onClickArticle" />-->
  <ListNote :notes="notesStore.notes" />
  <ListUsers :users="sampleUsers" />
  <Parent />
</template>


<script setup lang="ts">

import { ListNote, ListUsers} from "vue-lib-exo-corrected";
import {useNotesStore} from "../stores/notes.ts";
import {onBeforeMount } from "vue";
import { fetchNotes } from "../api/noteApi.ts";
import { initNote } from "../types/NoteType.ts";
import { appendContentToTitle } from "../services/markdownUtils.ts";
import {useRouter} from "vue-router";
import type { User } from "@/types/UserType"
import Parent from "../components/FrançoisFabrice/RefExemple/Parent.vue";

const notesStore = useNotesStore()
const router = useRouter()

const newNote = initNote({contentMd: 'dqdd'})

// Données d'exemple pour les utilisateurs
const sampleUsers: User[] = [
  { id: 1, name: 'Alice Dupont', email: 'alice@example.com', role: 'Admin', isActive: true },
  { id: 2, name: 'Bob Martin', email: 'bob@example.com', role: 'User', isActive: true },
  { id: 3, name: 'Charlie Niel', email: 'charlie@example.com', role: 'Moderator', isActive: false },
]


// Type local pour la création de note (si nécessaire)
type NoteCreated = {
  contentMd: string;
  title?: string;
  status?: 'active' | 'completed';
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

function addNote(newVal: NoteCreated) {
  const formatedContentMd = newVal.title 
    ? appendContentToTitle(newVal.contentMd, newVal.title)
    : newVal.contentMd;
  delete (newVal as any).title;
  newVal.contentMd = formatedContentMd;
  const newNote = initNote(newVal)
  notesStore.addNote(newNote)
}

function onClickArticle(data: any) {
  console.log("onclickarticle:", data)
  router.push('/note', )

  router.push({ path: "/note", query: { id: data.id }});

}

onBeforeMount(async () => {
  try {
    const allNotes = await fetchNotes()
    notesStore.setAllNotes(allNotes)
  } catch (error) {
    console.log('API non disponible, utilisation des données de test')
    // Données de test avec des titres
    const testNotes = [
      {
        id: '1',
        contentMd: '# Ma première note\n\nCeci est le contenu de ma première note avec un titre.',
        createdAt: '2024-01-01',
        status: 'active' as const,
        tags: ['test', 'première']
      },
      {
        id: '2',
        contentMd: '# Note importante\n\nCette note est très importante pour le projet.',
        createdAt: '2024-01-02',
        status: 'completed' as const,
        tags: ['important', 'projet']
      },
      {
        id: '3',
        contentMd: 'Cette note n\'a pas de titre dans le markdown.',
        createdAt: '2024-01-03',
        status: 'active' as const,
        tags: ['sans-titre']
      }
    ]
    notesStore.setAllNotes(testNotes)
  }
})


</script>


<style scoped lang="scss">
.noteCreation {
  padding-bottom: $spacing-24;
}
</style>

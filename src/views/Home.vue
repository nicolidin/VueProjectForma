<template>
  <div class="home">
    <NoteCreation @create="addNote" class="home__note-creation" />
    <ListNote :notes="notesStore.notes" />
    <ListUsers :users="sampleUsers" />
    <Parent />
  </div>
</template>


<script setup lang="ts">

import { ListNote, ListUsers, NoteCreation} from "vue-lib-exo-corrected";
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

// Données d'exemple pour les utilisateurs
const sampleUsers: User[] = [
  { id: 1, name: 'Alice Dupont', email: 'alice@example.com', role: 'Admin', isActive: true },
  { id: 2, name: 'Bob Martin', email: 'bob@example.com', role: 'User', isActive: true },
  { id: 3, name: 'Charlie Niel', email: 'charlie@example.com', role: 'Moderator', isActive: false },
]


function addNote(newVal: { title: string; contentMd: string }) {
  // Format the content with title at the beginning
  const formatedContentMd = appendContentToTitle(newVal.contentMd, newVal.title);
  
  // Create the note using initNote (which will add id, createdAt, etc.)
  const newNote = initNote({
    contentMd: formatedContentMd,
    status: 'active',
    tags: []
  });
  
  notesStore.addNote(newNote);
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
.home {
  &__note-creation {
    margin-bottom: $spacing-24;
  }
}
</style>

<template>
  <div class="home">
    <NoteCreation
      :tags="notesStore.tags"
      @create="addNote"
      class="home__note-creation"
    />
    <ListNote :notes="notesStore.filteredNotes" :available-tags="notesStore.tags" />
  </div>
</template>


<script setup lang="ts">

import { ListNote, NoteCreation} from "vue-lib-exo-corrected";
import {useNotesStore} from "../stores/notes.ts";
import {useAuthStore} from "../stores/auth.ts";
import {onBeforeMount} from "vue";
import { fetchNotesByUser } from "../api/noteApi.ts";
import { fetchTagsByUser } from "../api/tagApi.ts";
import { initNote } from "../types/NoteType.ts";
import { appendContentToTitle } from "../services/markdownUtils.ts";
import {useRouter} from "vue-router";

const notesStore = useNotesStore()
const authStore = useAuthStore()
const router = useRouter()


function addNote(newVal: { title: string; contentMd: string; tagsFrontId: string[] }) {
  // Format the content with title at the beginning
  const formatedContentMd = appendContentToTitle(newVal.contentMd, newVal.title);

  // Create the note using initNote (which will add frontId, createdAt, etc.)
  const newNote = initNote({
    contentMd: formatedContentMd,
    tagsFrontId: newVal.tagsFrontId || []
  });

  notesStore.addNote(newNote);
}

function onClickArticle(data: any) {
  console.log("onclickarticle:", data)
  router.push('/note', )

  router.push({ path: "/note", query: { id: data.frontId }});

}

onBeforeMount(async () => {
  // ✅ Vérifier que l'utilisateur est connecté avant de charger les notes
  if (!authStore.isAuthenticated) {
    router.push('/login');
    return;
  }

  // Charger les tags en premier pour qu'ils soient disponibles lors du mapping des notes
  // Ne charger les tags depuis l'API que si le store est vide (première visite)
  // Sinon, on garde les tags restaurés depuis le localStorage
  if (notesStore.tags.length === 0) {
    try {
      // ✅ Utiliser fetchTagsByUser() qui utilise automatiquement le userId du token
      const allTags = await fetchTagsByUser()
      notesStore.setAllTags(allTags)
    } catch (error) {
      console.log('API non disponible pour les tags, utilisation d\'un tableau vide')
      notesStore.setAllTags([])
    }
  }

  // Ne charger les notes depuis l'API que si le store est vide (première visite)
  // Sinon, on garde les notes restaurées depuis le localStorage
  if (notesStore.notes.length === 0) {
    try {
      // ✅ Utiliser fetchNotesByUser() qui utilise automatiquement le userId du token
      // Le backend renvoie maintenant directement des frontId dans les tagsFrontId
      const allNotes = await fetchNotesByUser()
      notesStore.setAllNotes(allNotes)
    } catch (error) {
      console.log('API non disponible, utilisation des données de test')
      // Données de test avec des titres
      const testNotes = [
        {
          frontId: '1',
          contentMd: '# Ma première note\n\nCeci est le contenu de ma première note avec un titre.',
          createdAt: '2024-01-01',
          tagsFrontId: []
        },
        {
          frontId: '2',
          contentMd: '# Note importante\n\nCette note est très importante pour le projet.',
          createdAt: '2024-01-02',
          tagsFrontId: []
        },
        {
          frontId: '3',
          contentMd: 'Cette note n\'a pas de titre dans le markdown.',
          createdAt: '2024-01-03',
          tagsFrontId: []
        }
      ]
      notesStore.setAllNotes(testNotes)
    }
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

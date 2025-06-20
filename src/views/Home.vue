<template>
  <NoteCreation @create="addNote" class="noteCreation"/>
<!--  <div class="noteCreation"></div>-->
  <MozaicArticles :articles="notesStore.notes" @click-on-article="onClickArticle" />
  <ListNote />
<!--  <ListUsers/>-->
  <Parent />
</template>


<script setup lang="ts">

import { MozaicArticles, NoteCreation} from "lidin-app-kit";
import {useNotesStore} from "../stores/notes.ts";
import {onBeforeMount } from "vue";
import { fetchNotes } from "../api/noteApi.ts";
import { initNote } from "../types/NoteType.ts";
import { appendContentToTitle } from "../services/markdownUtils.ts";
import {useRouter} from "vue-router";
import type {NoteCreated} from "lidin-app-kit"
import ListNote from "../components/FrançoisFabrice/ListNote.vue";
import ListUsers from "../components/FrançoisFabrice/ListUsers.vue";
import Parent from "../components/FrançoisFabrice/RefExemple/Parent.vue";

const notesStore = useNotesStore()
const router = useRouter()

const newNote = initNote({contentMd: 'dqdd'})


function addNote(newVal: NoteCreated) {
  const formatedContentMd = appendContentToTitle(newVal.contentMd, newVal.title);
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
  const allNotes =  await fetchNotes()
  notesStore.setAllNotes(allNotes)
})


</script>


<style scoped lang="scss">
.noteCreation {
  padding-bottom: $spacing-24;
}
</style>

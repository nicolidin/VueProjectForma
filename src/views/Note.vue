<template>
 {{note}}
</template>

<script setup lang="ts">
import {useRoute} from "vue-router";
import {useNotesStore} from "@/stores/notes.ts";

const route = useRoute();
const noteId: string = route.query.id as string;

const noteStore = useNotesStore();

const note = noteStore.getNoteById(noteId)





</script>

<style scoped lang="scss">

</style>

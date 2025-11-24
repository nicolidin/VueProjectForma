<script setup lang="ts">
import {Layout} from "vue-lib-exo-corrected";
import {useNotesStore} from "./stores/notes.ts";
import {computed} from "vue";

const notesStore = useNotesStore();

// Convertir les tags du store au format attendu par SidebarTags
const tagsForSidebar = computed(() => {
  return notesStore.tags.map(tag => ({
    libelleName: tag.title,
    isSelected: false,
    color: tag.color
  }));
});

function handleTagCreate(tag: { title: string; color: string }) {
  notesStore.addTag({
    title: tag.title,
    color: tag.color
  });
}
</script>

<template>
  <Layout 
    class="layout" 
    :show-tags-sidebar="true"
    :tags="tagsForSidebar"
    @tag-create="handleTagCreate"
  >
    <router-view />
  </Layout>
</template>

<style scoped>
.layout {
  width: 100%;
  margin: 0;
  padding: 0;
}
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>

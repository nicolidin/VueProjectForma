<script setup lang="ts">
import {Layout} from "vue-lib-exo-corrected";
import {useNotesStore} from "./stores/notes.ts";
import {computed, ref} from "vue";

const notesStore = useNotesStore();

// État local pour gérer la sélection des tags
const selectedTags = ref<Set<string>>(new Set());

// Convertir les tags du store au format attendu par SidebarTags
const tagsForSidebar = computed(() => {
  return notesStore.tags.map(tag => ({
    libelleName: tag.title,
    isSelected: selectedTags.value.has(tag.title),
    color: tag.color
  }));
});

function handleTagClick(tag: { libelleName: string; isSelected: boolean }) {
  if (tag.libelleName === "All Notes") {
    // Si "All Notes" est cliqué, désélectionner tous les tags
    selectedTags.value.clear();
  } else {
    // Toggle la sélection du tag
    if (tag.isSelected) {
      selectedTags.value.delete(tag.libelleName);
    } else {
      selectedTags.value.add(tag.libelleName);
    }
  }
}

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
    @tag-click="handleTagClick"
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

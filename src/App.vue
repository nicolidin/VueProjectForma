<script setup lang="ts">
import {Layout} from "vue-lib-exo-corrected";
import {useNotesStore} from "./stores/notes.ts";
import {useAuthStore} from "./stores/auth.ts";
import {computed, onMounted} from "vue";

const notesStore = useNotesStore();
const authStore = useAuthStore();

// ─── Initialiser l'authentification au démarrage ──────────────────────────────────
// - Vérifie si un token existe dans localStorage
// - Si oui, vérifie s'il est valide en appelant l'API
// - Si valide, récupère les infos utilisateur
onMounted(async () => {
  await authStore.initAuth();
});

// Convertir les tags du store au format attendu par SidebarTags
const tagsForSidebar = computed(() => {
  return notesStore.tags.map(tag => ({
    libelleName: tag.title,
    isSelected: notesStore.selectedTagNames.includes(tag.title),
    color: tag.color
  }));
});

function handleTagClick(tag: { libelleName: string; isSelected: boolean }) {
  // Le composant SidebarTags gère le toggle en interne et émet l'état final souhaité
  // On applique directement l'état isSelected reçu dans le store
  if (tag.libelleName === "All Notes") {
    // Si "All Notes" est cliqué, désélectionner tous les tags
    notesStore.clearSelectedTags();
  } else {
    // Appliquer directement l'état souhaité dans le store
    notesStore.setTagSelected(tag.libelleName, tag.isSelected);
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
  <!-- Afficher le Layout seulement si l'utilisateur est connecté -->
  <Layout 
    v-if="authStore.isAuthenticated"
    class="layout" 
    :show-tags-sidebar="true"
    :tags="tagsForSidebar"
    @tag-click="handleTagClick"
    @tag-create="handleTagCreate"
  >
    <router-view />
  </Layout>
  
  <!-- Sinon, afficher directement le router-view (pour login/register) -->
  <router-view v-else />
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

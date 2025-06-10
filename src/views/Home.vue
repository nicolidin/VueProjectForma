<template>
  <NoteCreation />
  <MozaicArticles :articles="articles" />
</template>

<script setup lang="ts">

import HelloWorld from "../components/HelloWorld.vue";
import {Layout, MozaicArticles, NoteCreation} from "lidin-app-kit";
import {ref} from "vue";
const articles = ref([
  {
    documentId: "1",
    slug: "article-1",
    contentMd: "# Titre Article 1\n\nContenu en markdown de l'article 1 avec un texte assez court.",
    size: "small"
  },
  {
    documentId: "2",
    slug: "article-2",
    contentMd: "## Titre Article 2\n\nUn contenu un peu plus long qui pourrait prendre deux lignes et qui contient plus d'informations sur le sujet traité dans cet article.",
    size: "medium"
  },
  {
    documentId: "3",
    slug: "article-3",
    contentMd: "# Titre Article 3\n\nUn contenu encore plus long qui va probablement prendre trois ou quatre lignes. Il contient beaucoup plus d'informations et de détails sur le sujet traité. On peut même ajouter des listes :\n\n- Point 1\n- Point 2\n- Point 3",
    size: "large"
  }
]);
</script>

<style scoped lang="scss">

</style>

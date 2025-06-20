<template>
  <div>
    <Child
        ref="childRef"
        :initial-count="0"
    />
    <button @click="accessChildData">
      Accéder aux données de l'enfant
    </button>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import Child from './Child.vue'

// Création d'une ref typée pour le composant enfant
const childRef = ref<InstanceType<typeof Child> | null>(null)

// Fonction pour accéder aux données du composant enfant
const accessChildData = () => {
  if (childRef.value) {
    // Accès aux données exposées
    console.log(childRef.value.count)
    console.log(childRef.value.message)

    // Appel de la méthode exposée
    childRef.value.increment()
  }
}
</script>


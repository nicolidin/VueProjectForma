<template>
  <div>
    <p>Count: {{ count }}</p>
    <p>Message: {{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Définition des props
const props = defineProps<{
  initialCount: number
}>()

// Données exposées au parent
const count = ref(props.initialCount)
const message = ref('Hello from child!')

// Méthode exposée au parent
const increment = () => {
  count.value++
}

// Exposition des données et méthodes au parent
defineExpose({
  count,
  message,
  increment
})
</script>

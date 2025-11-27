<template>
  <div class="register">
    <v-container class="register__container">
      <v-card class="register__card">
        <v-card-title class="register__title">Inscription</v-card-title>
        
        <v-card-text>
          <RegisterForm
            v-model:nom="nom"
            v-model:email="email"
            v-model:password="password"
            v-model:confirm-password="confirmPassword"
            :is-loading="authStore.isLoading"
            :error="authStore.error"
            @submit="handleRegister"
          />
        </v-card-text>

        <v-card-actions class="register__footer">
          <v-spacer />
          <div class="register__footer-content">
            <span>Déjà un compte ?</span>
            <router-link to="/login" class="register__link">
              Se connecter
            </router-link>
          </div>
          <v-spacer />
        </v-card-actions>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { RegisterForm } from 'vue-lib-exo-corrected';

// ─── Logique métier : Tout est géré dans la page ──────────────────────────────────
const router = useRouter();
const authStore = useAuthStore();

// État réactif pour les champs du formulaire
const nom = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');

// ─── Fonction : Gérer l'inscription ────────────────────────────────────────────────
// - Appelle le store (logique métier)
// - Gère la redirection (navigation)
// - Toute la logique est ici, pas dans le composant
async function handleRegister() {
  const success = await authStore.registerUser(nom.value, email.value, password.value);
  
  if (success) {
    // Rediriger vers la page d'accueil après inscription réussie
    router.push('/');
  }
}
</script>

<style scoped lang="scss">
.register {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;

  &__container {
    max-width: 400px;
  }

  &__card {
    padding: $spacing-24;
  }

  &__title {
    text-align: center;
    margin-bottom: $spacing-24;
  }

  &__footer {
    flex-direction: column;
    padding: $spacing-16 $spacing-24;

    &-content {
      display: flex;
      gap: $spacing-8;
      align-items: center;
    }
  }

  &__link {
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>


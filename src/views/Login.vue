<template>
  <div class="login">
    <v-container class="login__container">
      <v-card class="login__card">
        <v-card-title class="login__title">Connexion</v-card-title>
        
        <v-card-text>
          <LoginForm
            v-model:email="email"
            v-model:password="password"
            :is-loading="authStore.isLoading"
            :error="authStore.error"
            @submit="handleLogin"
          />
        </v-card-text>

        <v-card-actions class="login__footer">
          <v-spacer />
          <div class="login__footer-content">
            <span>Pas encore de compte ?</span>
            <router-link to="/register" class="login__link">
              Créer un compte
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
import { LoginForm } from 'vue-lib-exo-corrected';

// ─── Logique métier : Tout est géré dans la page ──────────────────────────────────
// - Store : utilisation du store d'authentification
// - Router : gestion de la navigation
// - État local : gestion des champs du formulaire
const router = useRouter();
const authStore = useAuthStore();

// État réactif pour les champs du formulaire
const email = ref('');
const password = ref('');

// ─── Fonction : Gérer la connexion ────────────────────────────────────────────────
// - Appelle le store (logique métier)
// - Gère la redirection (navigation)
// - Toute la logique est ici, pas dans le composant
async function handleLogin() {
  const success = await authStore.loginUser(email.value, password.value);
  
  if (success) {
    // Récupérer la route de redirection depuis la query (si présente)
    const redirect = router.currentRoute.value.query.redirect as string | undefined;
    // Rediriger vers la page demandée ou vers l'accueil
    router.push(redirect || '/');
  }
}
</script>

<style scoped lang="scss">
.login {
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


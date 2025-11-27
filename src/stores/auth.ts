import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { UserType } from '@/types/UserType';
import { login, register, getCurrentUser } from '@/api/authApi';

// ─── Store Pinia pour gérer l'authentification ────────────────────────────────────
// - Stocke le token JWT et les informations de l'utilisateur connecté
// - Persiste dans localStorage pour maintenir la session après rechargement
export const useAuthStore = defineStore('auth', () => {
  // État réactif : token JWT
  // - null si l'utilisateur n'est pas connecté
  // - string contenant le token JWT si l'utilisateur est connecté
  const token = ref<string | null>(localStorage.getItem('auth_token'));

  // État réactif : informations de l'utilisateur connecté
  // - null si l'utilisateur n'est pas connecté
  // - UserType avec les infos de l'utilisateur si connecté
  const user = ref<UserType | null>(null);

  // État réactif : état de chargement (pour les requêtes async)
  const isLoading = ref(false);

  // État réactif : message d'erreur (pour afficher les erreurs)
  const error = ref<string | null>(null);

  // Computed : vérifie si l'utilisateur est connecté
  // - Retourne true si token existe (et donc utilisateur connecté)
  const isAuthenticated = computed(() => !!token.value);

  // ─── Fonction : Connecter l'utilisateur ───────────────────────────────────────────
  // - Sauvegarde le token dans le store et localStorage
  // - Sauvegarde les infos utilisateur dans le store
  // - Appelée après login ou register réussis
  function setAuth(newToken: string, userData: UserType) {
    token.value = newToken;
    user.value = userData;
    error.value = null;
    // ✅ Persister le token dans localStorage
    // - Permet de maintenir la session après rechargement de la page
    localStorage.setItem('auth_token', newToken);
  }

  // ─── Fonction : Déconnecter l'utilisateur ────────────────────────────────────────
  // - Supprime le token et les infos utilisateur
  // - Nettoie localStorage
  function logout() {
    token.value = null;
    user.value = null;
    error.value = null;
    localStorage.removeItem('auth_token');
  }

  // ─── Fonction : Connexion (Login) ────────────────────────────────────────────────
  // - Appelle l'API login avec email et password
  // - Si succès, sauvegarde le token et les infos utilisateur
  // - Gère les erreurs et les affiche
  async function loginUser(email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await login({ email, password });
      setAuth(response.token, response.user);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Erreur lors de la connexion';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ─── Fonction : Inscription (Register) ───────────────────────────────────────────
  // - Appelle l'API register avec nom, email et password
  // - Si succès, sauvegarde le token et les infos utilisateur
  // - Gère les erreurs et les affiche
  async function registerUser(nom: string, email: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await register({ nom, email, password });
      setAuth(response.token, response.user);
      return true;
    } catch (err: any) {
      error.value = err.message || 'Erreur lors de l\'inscription';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // ─── Fonction : Initialiser l'auth depuis localStorage ──────────────────────────
  // - Appelée au démarrage de l'application
  // - Récupère le token depuis localStorage et vérifie s'il est valide
  // - Si valide, récupère les infos utilisateur depuis l'API
  async function initAuth() {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      token.value = storedToken;
      isLoading.value = true;
      try {
        // Vérifier si le token est toujours valide en appelant /api/auth/me
        const userData = await getCurrentUser();
        user.value = userData;
      } catch (err) {
        // Si le token est invalide ou expiré, nettoyer
        console.error('Token invalide, déconnexion...', err);
        logout();
      } finally {
        isLoading.value = false;
      }
    }
  }

  return {
    // État
    token,
    user,
    isLoading,
    error,
    // Computed
    isAuthenticated,
    // Méthodes
    setAuth,
    logout,
    loginUser,
    registerUser,
    initAuth,
  };
}, {
  // Configuration de persistance Pinia
  persist: {
    key: 'auth',
    storage: localStorage,
    // Ne persister que le token (user sera récupéré depuis l'API si nécessaire)
    pick: ['token'],
  },
});


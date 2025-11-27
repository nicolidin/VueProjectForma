// Configuration de base d'axios
import axios from "axios";
import { useAuthStore } from "@/stores/auth";

// Récupération de la base URL depuis les variables d'environnement
// VITE_API_BASE_URL doit être définie dans le fichier .env
// Par défaut, utilise localhost:3000/api si non définie
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Intercepteur de requête : Ajoute le token JWT automatiquement ────────────────
// Un intercepteur axios s'exécute avant chaque requête HTTP
// - Permet de modifier la requête avant qu'elle soit envoyée
// - Ici, on ajoute automatiquement le token JWT dans les headers
axiosClient.interceptors.request.use(
  (config) => {
    // Récupérer le store d'authentification
    const authStore = useAuthStore();
    
    // Si un token existe, l'ajouter dans les headers
    // - Format standard : "Bearer <token>"
    // - Le backend (authMiddleware) attend ce format dans req.headers.authorization
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    
    return config;
  },
  (error) => {
    // En cas d'erreur lors de la configuration de la requête
    return Promise.reject(error);
  }
);

// ─── Intercepteur de réponse : Gère les erreurs d'authentification ───────────────
// Un intercepteur de réponse s'exécute après chaque réponse HTTP
// - Permet de gérer les erreurs globalement (ex: token expiré)
axiosClient.interceptors.response.use(
  (response) => {
    // Si la réponse est OK, la retourner telle quelle
    return response;
  },
  (error) => {
    // Si le serveur retourne 401 (Unauthorized), le token est invalide ou expiré
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      // Déconnecter l'utilisateur et rediriger vers la page de login
      authStore.logout();
      // Optionnel : rediriger vers /login
      // window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

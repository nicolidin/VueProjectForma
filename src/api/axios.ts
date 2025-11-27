// Configuration de base d'axios
import axios from "axios";

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

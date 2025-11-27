import { axiosClient } from "./axios.ts";
import type { UserType } from "@/types/UserType";

// ─── Interface pour les réponses d'authentification ─────────────────────────────
interface AuthResponse {
  user: UserType;
  token: string; // Le token JWT
}

// ─── Interface pour les données de login/register ────────────────────────────────
interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  nom: string;
  email: string;
  password: string;
}

// ─── Inscription (Register) ────────────────────────────────────────────────────────
// POST /api/auth/register
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  try {
    const response = await axiosClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  } catch (error: any) {
    console.error('Erreur lors de l\'inscription:', error);
    // Propager l'erreur avec le message du serveur si disponible
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'inscription');
  }
};

// ─── Connexion (Login) ────────────────────────────────────────────────────────────
// POST /api/auth/login
export const login = async (data: LoginData): Promise<AuthResponse> => {
  try {
    const response = await axiosClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  } catch (error: any) {
    console.error('Erreur lors de la connexion:', error);
    throw new Error(error.response?.data?.error || 'Erreur lors de la connexion');
  }
};

// ─── Récupérer l'utilisateur connecté ────────────────────────────────────────────
// GET /api/auth/me
// - Route protégée : nécessite un token JWT valide
// - Permet de vérifier si le token est toujours valide et récupérer les infos utilisateur
export const getCurrentUser = async (): Promise<UserType> => {
  try {
    const response = await axiosClient.get<UserType>('/auth/me');
    return response.data;
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw new Error(error.response?.data?.error || 'Erreur lors de la récupération de l\'utilisateur');
  }
};


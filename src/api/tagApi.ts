import type { TagType } from "../types/TagType.ts";
import { axiosClient } from "./axios.ts";

// ─── Créer un tag ───────────────────────────────────────────────────────────────
// ✅ Plus besoin de passer userId, il vient automatiquement du token JWT
export const createTag = async (tag: Omit<TagType, '_id' | 'userId'>): Promise<TagType> => {
  try {
    const response = await axiosClient.post<TagType>('/tags', tag);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création du tag:', error);
    throw error;
  }
};

// ─── Récupérer tous les tags de l'utilisateur connecté ──────────────────────────
// ✅ Plus besoin de passer userId, le backend utilise celui du token
export const fetchTagsByUser = async (): Promise<TagType[]> => {
  try {
    // Le backend utilise automatiquement le userId du token JWT
    // On peut passer n'importe quelle valeur car le backend l'ignore et utilise le userId du token
    // Mais pour être cohérent avec la route, on passe 'me'
    const response = await axiosClient.get<TagType[]>('/tags/user/me');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des tags:', error);
    throw error;
  }
};

// ─── Récupérer un tag par ID (frontId ou _id MongoDB) ──────────────────────────
export const fetchTagById = async (id: string): Promise<TagType> => {
  try {
    const response = await axiosClient.get<TagType>(`/tags/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération du tag ${id}:`, error);
    throw error;
  }
};

// ─── Mettre à jour un tag ────────────────────────────────────────────────────────
export const updateTag = async (id: string, tag: Partial<Omit<TagType, '_id' | 'frontId'>>): Promise<TagType> => {
  try {
    const response = await axiosClient.put<TagType>(`/tags/${id}`, tag);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du tag ${id}:`, error);
    throw error;
  }
};

// ─── Supprimer un tag ────────────────────────────────────────────────────────────
export const deleteTag = async (id: string): Promise<void> => {
  try {
    await axiosClient.delete(`/tags/${id}`);
  } catch (error) {
    console.error(`Erreur lors de la suppression du tag ${id}:`, error);
    throw error;
  }
};


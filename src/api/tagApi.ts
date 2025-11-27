import type { TagType } from "../types/TagType.ts";
import { axiosClient } from "./axios.ts";

// ─── Créer un tag ───────────────────────────────────────────────────────────────
export const createTag = async (tag: Omit<TagType, '_id'> & { userId: string }): Promise<TagType> => {
  try {
    const response = await axiosClient.post<TagType>('/tags', tag);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création du tag:', error);
    throw error;
  }
};

// ─── Récupérer tous les tags d'un utilisateur ──────────────────────────────────
export const fetchTagsByUser = async (userId: string): Promise<TagType[]> => {
  try {
    const response = await axiosClient.get<TagType[]>(`/tags/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération des tags de l'utilisateur ${userId}:`, error);
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


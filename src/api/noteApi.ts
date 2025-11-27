import type { NoteType } from "../types/NoteType.ts";
import { axiosClient } from "./axios.ts";

// ─── Créer une note ──────────────────────────────────────────────────────────────
export const createNote = async (note: Omit<NoteType, 'frontId' | 'createdAt' | '_id'> & { 
  userId: string; 
  tags?: string[]; // Peut être des titles, frontIds (UUID) ou _id MongoDB
}): Promise<NoteType> => {
  try {
    const response = await axiosClient.post<NoteType>('/notes', note);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création de la note:', error);
    throw error;
  }
};

// ─── Récupérer toutes les notes ─────────────────────────────────────────────────
export const fetchNotes = async (): Promise<NoteType[]> => {
  try {
    const response = await axiosClient.get<NoteType[]>('/notes');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des notes:', error);
    throw error;
  }
};

// ─── Récupérer toutes les notes d'un utilisateur ────────────────────────────────
export const fetchNotesByUser = async (userId: string): Promise<NoteType[]> => {
  try {
    const response = await axiosClient.get<NoteType[]>(`/notes/user/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération des notes de l'utilisateur ${userId}:`, error);
    throw error;
  }
};

// ─── Récupérer une note par ID (frontId ou _id MongoDB) ─────────────────────────
export const fetchNoteById = async (id: string): Promise<NoteType> => {
  try {
    const response = await axiosClient.get<NoteType>(`/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération de la note ${id}:`, error);
    throw error;
  }
};

// ─── Mettre à jour une note ──────────────────────────────────────────────────────
export const updateNote = async (id: string, note: Partial<{
  contentMd: string;
  tags: string[]; // Peut être des titles, frontIds (UUID) ou _id MongoDB
}>): Promise<NoteType> => {
  try {
    const response = await axiosClient.put<NoteType>(`/notes/${id}`, note);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la note ${id}:`, error);
    throw error;
  }
};

// ─── Supprimer une note ──────────────────────────────────────────────────────────
export const deleteNote = async (id: string): Promise<void> => {
  try {
    await axiosClient.delete(`/notes/${id}`);
  } catch (error) {
    console.error(`Erreur lors de la suppression de la note ${id}:`, error);
    throw error;
  }
};

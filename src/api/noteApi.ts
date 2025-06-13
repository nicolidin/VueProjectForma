import type {NoteType} from "../types/NoteType.ts";
import {axiosClient} from "./axios.ts";

// Fonction pour récupérer toutes les notes
export const fetchNotes = async (): Promise<NoteType[]> => {
  try {
    const response = await axiosClient.get<NoteType[]>('/notes');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des notes:', error);
    throw error;
  }
};

// Fonction pour créer une nouvelle note
export const createNote = async (note: Omit<NoteType, 'id' | 'createdAt'>): Promise<NoteType> => {
  try {
    const response = await axiosClient.post<NoteType>('/notes', note);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création de la note:', error);
    throw error;
  }
};

// Fonction pour récupérer une note par son ID
export const fetchNoteById = async (id: number): Promise<NoteType> => {
  try {
    const response = await axiosClient.get<NoteType>(`/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération de la note ${id}:`, error);
    throw error;
  }
};

// Fonction pour mettre à jour une note
export const updateNote = async (id: number, note: Partial<NoteType>): Promise<NoteType> => {
  try {
    const response = await axiosClient.put<NoteType>(`/notes/${id}`, note);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la note ${id}:`, error);
    throw error;
  }
};

// Fonction pour supprimer une note
export const deleteNote = async (id: number): Promise<void> => {
  try {
    await axiosClient.delete(`/notes/${id}`);
  } catch (error) {
    console.error(`Erreur lors de la suppression de la note ${id}:`, error);
    throw error;
  }
};

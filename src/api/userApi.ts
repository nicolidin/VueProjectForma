import type { UserType } from "../types/UserType.ts";
import { axiosClient } from "./axios.ts";

// ─── Créer un utilisateur ────────────────────────────────────────────────────────
export const createUser = async (user: Omit<UserType, '_id' | 'createdAt' | 'updatedAt'>): Promise<UserType> => {
  try {
    const response = await axiosClient.post<UserType>('/users', user);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw error;
  }
};

// ─── Récupérer tous les utilisateurs ────────────────────────────────────────────
export const fetchUsers = async (): Promise<UserType[]> => {
  try {
    const response = await axiosClient.get<UserType[]>('/users');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
};

// ─── Récupérer un utilisateur par ID ────────────────────────────────────────────
export const fetchUserById = async (id: string): Promise<UserType> => {
  try {
    const response = await axiosClient.get<UserType>(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération de l'utilisateur ${id}:`, error);
    throw error;
  }
};

// ─── Mettre à jour un utilisateur ───────────────────────────────────────────────
export const updateUser = async (id: string, user: Partial<Omit<UserType, '_id' | 'createdAt' | 'updatedAt'>>): Promise<UserType> => {
  try {
    const response = await axiosClient.put<UserType>(`/users/${id}`, user);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de l'utilisateur ${id}:`, error);
    throw error;
  }
};

// ─── Supprimer un utilisateur ────────────────────────────────────────────────────
export const deleteUser = async (id: string): Promise<void> => {
  try {
    await axiosClient.delete(`/users/${id}`);
  } catch (error) {
    console.error(`Erreur lors de la suppression de l'utilisateur ${id}:`, error);
    throw error;
  }
};


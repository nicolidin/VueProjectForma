// Export centralisé de tous les services API
// Séparation des préoccupations : un seul point d'entrée pour les imports

export { axiosClient } from './axios.ts';

// Auth API
export {
  login,
  register,
  getCurrentUser
} from './authApi.ts';

// Users API
export {
  createUser,
  fetchUsers,
  fetchUserById,
  updateUser,
  deleteUser
} from './userApi.ts';

// Tags API
export {
  createTag,
  fetchTagsByUser,
  fetchTagById,
  updateTag,
  deleteTag
} from './tagApi.ts';

// Notes API
export {
  createNote,
  fetchNotes,
  fetchNotesByUser,
  fetchNoteById,
  updateNote,
  deleteNote
} from './noteApi.ts';


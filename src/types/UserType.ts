// Type pour les utilisateurs
export type UserType = {
  _id?: string; // ObjectId MongoDB (venant du backend)
  nom: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}



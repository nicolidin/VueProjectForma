// Type pour les tags
export type TagType = {
  frontId: string;
  _id?: string; // Optionnel : ObjectId MongoDB (venant du backend après synchronisation)
  title: string;
  color: string;
}


// Type pour les notes
import {generateRandomUuid} from "vue-lib-exo-corrected";
import {merge} from "lodash-es";
import moment from "moment";

export type NoteType = {
  frontId: string;
  _id?: string; // Optionnel : ObjectId MongoDB (venant du backend après synchronisation)
  contentMd: string;
  createdAt: string;
  tagsFrontId: string[]; // ✅ Sémantique : tagsFrontId sont TOUJOURS des frontId (jamais des _id MongoDB)
}

export function initNote(noteCtr: Omit<NoteType, 'frontId' | 'createdAt'>): NoteType {
  // ✅ Sécurité : garantir que contentMd est toujours une string
  return merge({
    frontId: generateRandomUuid(),
    createdAt: moment().format("DD/MM/YYYY"),
    contentMd: '', // Valeur par défaut
    tagsFrontId: []
  }, {
    ...noteCtr,
    contentMd: noteCtr.contentMd || '' // S'assurer que contentMd n'est jamais undefined
  })
}

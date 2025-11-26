// Type pour les notes
import {generateRandomUuid} from "vue-lib-exo-corrected";
import {merge} from "lodash-es";
import moment from "moment";

export type NoteType = {
  frontId: string;
  _id?: string; // Optionnel : ObjectId MongoDB (venant du backend après synchronisation)
  contentMd: string;
  createdAt: string;
  tagIds: string[];
}

export function initNote(noteCtr: Omit<NoteType, 'frontId' | 'createdAt'>): NoteType {
  return merge({
    frontId: generateRandomUuid(),
    createdAt: moment().format("DD/MM/YYYY"),
    tagIds: []
  }, noteCtr)
}

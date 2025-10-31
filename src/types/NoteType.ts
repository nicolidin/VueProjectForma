// Type pour les notes
import {generateRandomUuid} from "vue-lib-exo-corrected";
import {merge} from "lodash-es";
import moment from "moment";

export type NoteType = {
  id: string;
  contentMd: string;
  createdAt: string;
  status?: 'active' | 'completed';
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

export function initNote(noteCtr: Omit<NoteType, 'id' | 'frontId' | 'createdAt'>): NoteType {
  return merge({
    id: generateRandomUuid(),
    documentId: generateRandomUuid(),
    date: moment().format("DD/MM/YYYY"),
    createdAt: moment().format("DD/MM/YYYY"),
    tags: []
  }, noteCtr)
}

/**
 * Stratégie de persistance REST API générique
 * Code pur, respecte le principe SOC
 */

import type { PersistenceStrategy, PersistableEntity } from '../core/types'
import { createNote, updateNote, deleteNote } from '@/api/noteApi'
import { createTag, updateTag, deleteTag } from '@/api/tagApi'
import type { NoteType } from '@/types/NoteType'
import type { TagType } from '@/types/TagType'

/**
 * Stratégie REST pour les notes
 */
export class NoteRestApiStrategy implements PersistenceStrategy<NoteType> {
  async persistCreate(entity: PersistableEntity<NoteType>): Promise<PersistableEntity<NoteType>> {
    const note = entity.data
    // createNote attend tagsFrontId (de NoteType) mais accepte aussi tags en option pour le backend
    const persistedNote = await createNote({
      frontId: note.frontId,
      contentMd: note.contentMd,
      tagsFrontId: note.tagsFrontId,
      tags: note.tagsFrontId.length > 0 ? note.tagsFrontId : undefined
    })

    return {
      data: persistedNote,
      metadata: {
        ...entity.metadata,
        backendId: persistedNote._id,
        syncStatus: 'synced',
        lastSyncAt: Date.now()
      }
    }
  }

  async persistUpdate(entity: PersistableEntity<NoteType>): Promise<PersistableEntity<NoteType>> {
    const id = entity.metadata.backendId || entity.metadata.frontId
    const updates = entity.data as Partial<NoteType>

    const apiUpdates: Partial<{
      contentMd: string
      tags: string[]
    }> = {}

    if (updates.contentMd !== undefined) {
      apiUpdates.contentMd = updates.contentMd
    }

    if (updates.tagsFrontId !== undefined) {
      apiUpdates.tags = updates.tagsFrontId.length > 0 ? updates.tagsFrontId : []
    }

    const updatedNote = await updateNote(id, apiUpdates)

    return {
      data: updatedNote,
      metadata: {
        ...entity.metadata,
        backendId: updatedNote._id || entity.metadata.backendId,
        syncStatus: 'synced',
        lastSyncAt: Date.now()
      }
    }
  }

  async persistDelete(id: string, entityType: string): Promise<void> {
    await deleteNote(id)
  }
}

/**
 * Stratégie REST pour les tags
 */
export class TagRestApiStrategy implements PersistenceStrategy<TagType> {
  async persistCreate(entity: PersistableEntity<TagType>): Promise<PersistableEntity<TagType>> {
    const tag = entity.data
    const persistedTag = await createTag({
      frontId: tag.frontId,
      title: tag.title,
      color: tag.color
    })

    return {
      data: persistedTag,
      metadata: {
        ...entity.metadata,
        backendId: persistedTag._id,
        syncStatus: 'synced',
        lastSyncAt: Date.now()
      }
    }
  }

  async persistUpdate(entity: PersistableEntity<TagType>): Promise<PersistableEntity<TagType>> {
    const id = entity.metadata.backendId || entity.metadata.frontId
    const updates = entity.data as Partial<TagType>

    const updatedTag = await updateTag(id, {
      title: updates.title,
      color: updates.color
    })

    return {
      data: updatedTag,
      metadata: {
        ...entity.metadata,
        backendId: updatedTag._id || entity.metadata.backendId,
        syncStatus: 'synced',
        lastSyncAt: Date.now()
      }
    }
  }

  async persistDelete(id: string, entityType: string): Promise<void> {
    await deleteTag(id)
  }
}


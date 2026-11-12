import type React from 'react';
import { NoteBoard } from '@/modules/production/notes/NoteBoard';
import type { NoteTarget } from '@/modules/production/notes/NoteFormDialog';

export type { NoteTarget } from '@/modules/production/notes/NoteFormDialog';

/**
 * The notes about one shot, asset or version: the threads that link it (any of their links, C-RP-09), read with
 * `entity_type` + `entity_id` on the server. New notes are about it first.
 */
export const EntityNotesTab: React.FC<{ target: NoteTarget }> = ({ target }) => (
  <NoteBoard projectId={target.projectId} target={target} emptyDescription={`Nothing has been noted about ${target.code} yet.`} />
);

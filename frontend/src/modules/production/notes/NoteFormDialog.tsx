import { zodResolver } from '@hookform/resolvers/zod';
import type React from 'react';
import { useState } from 'react';
import { z } from 'zod';
import { versionsApi } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { NOTE_CATEGORIES } from '@/api/production/structure';
import type { NoteLinkRef, NoteLinkType, ProjectNote, ProjectNoteInput, ProjectNotePatch } from '@/api/production/structure';
import { assetsApi, shotsApi } from '@/api/production/work';
import type { Asset, Shot } from '@/api/production/work';
import { EntityMultiPicker } from '@/components/forms/EntityMultiPicker';
import { Field, inputClass } from '@/modules/identity/components/ui';
import { TaskPicker } from '@/modules/production/work/pickers';
import { Badge } from '@/shared/components/Badge';
import { FormDialog } from '@/shared/forms/FormDialog';
import { useServerForm } from '@/shared/forms/useServerForm';

/** The record a Notes tab is on. It is always the note's first link and cannot be taken off here. */
export interface NoteTarget {
  type: 'Shot' | 'Asset' | 'Version';
  id: string;
  code: string;
  name: string;
  projectId: string;
}

const schema = z.object({ subject: z.string().trim().min(1, 'Enter a subject'), body: z.string(), category: z.enum(NOTE_CATEGORIES) });
type Values = z.infer<typeof schema>;

/** The kinds the dialog offers to link (the backend also takes Sequence, Episode, Playlist and Review). */
const PICKED: ReadonlyArray<NoteLinkType> = ['Shot', 'Asset', 'Version'];
type Picked = Record<'Shot' | 'Asset' | 'Version', string[]>;

const empty = (): Picked => ({ Shot: [], Asset: [], Version: [] });

function pickedOf(note: ProjectNote | undefined, target: NoteTarget | undefined): { picked: Picked; others: NoteLinkRef[] } {
  const picked = empty();
  const others: NoteLinkRef[] = [];
  for (const link of note?.links ?? []) {
    if (target && link.entity_type === target.type && link.entity_id === target.id) continue;
    if ((PICKED as readonly string[]).includes(link.entity_type)) picked[link.entity_type as keyof Picked].push(link.entity_id);
    else others.push({ entity_type: link.entity_type, entity_id: link.entity_id });
  }
  return { picked, others };
}

/** The links to send: the tab's record first, then what was picked, then the kinds this dialog does not show (kept). */
export function linksToSend(target: NoteTarget | undefined, picked: Picked, others: NoteLinkRef[]): NoteLinkRef[] {
  const out: NoteLinkRef[] = target ? [{ entity_type: target.type, entity_id: target.id }] : [];
  for (const type of PICKED) for (const id of picked[type as keyof Picked]) out.push({ entity_type: type, entity_id: id });
  const seen = new Set<string>();
  return [...out, ...others].filter((l) => {
    const key = `${l.entity_type}:${l.entity_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface NoteFormDialogProps {
  projectId: string;
  /** Present on a shot, asset or version tab. */
  target?: NoteTarget;
  /** Present when editing a thread. */
  note?: ProjectNote;
  onClose: () => void;
  onSave: (body: ProjectNoteInput | ProjectNotePatch) => Promise<void>;
}

/**
 * Add or edit a thread (C-RP-07, C-RP-12): subject, note, category, the records it is about and the task that
 * should act on it. The server checks each record and the task (400 in the banner) and writes their codes.
 */
export const NoteFormDialog: React.FC<NoteFormDialogProps> = ({ projectId, target, note, onClose, onSave }) => {
  const initial = pickedOf(note, target);
  const [picked, setPicked] = useState<Picked>(initial.picked);
  const [taskId, setTaskId] = useState<string | null>(note?.task_id ?? null);
  // An edit sends links and the task only when changed: a record archived since would otherwise refuse the save.
  const [linksTouched, setLinksTouched] = useState(false);
  const [taskTouched, setTaskTouched] = useState(false);
  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, isDirty },
  } = useServerForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { subject: note?.subject ?? '', body: note?.body ?? '', category: (NOTE_CATEGORIES as readonly string[]).includes(note?.category ?? '') ? (note?.category as Values['category']) : 'General' },
  });
  const projectFilter = { project_id: projectId };
  const pick = (type: keyof Picked) => (ids: string[]) => {
    setLinksTouched(true);
    setPicked((p) => ({ ...p, [type]: ids }));
  };

  const onSubmit = submit(async (values) => {
    const links = linksToSend(target, picked, initial.others);
    const text = { subject: values.subject, body: values.body, category: values.category };
    if (note) {
      await onSave({ ...text, ...(linksTouched ? { links } : {}), ...(taskTouched ? { task_id: taskId } : {}) });
    } else {
      await onSave({ ...text, links, ...(taskId ? { task_id: taskId } : {}) });
    }
    onClose();
  });

  return (
    <FormDialog
      title={note ? 'Edit the note' : target ? `Add a note on ${target.code}` : 'Add a note'}
      onClose={onClose}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      isDirty={isDirty || linksTouched || taskTouched}
      serverError={serverError}
      submitLabel={note ? 'Save' : 'Add note'}
    >
      <Field id="note-category" label="Category">
        <select id="note-category" className={inputClass()} {...register('category')}>
          {NOTE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field id="note-subject" label="Subject *" error={errors.subject?.message}>
        <input id="note-subject" className={inputClass(Boolean(errors.subject))} {...register('subject', { onChange: clearServerError })} />
      </Field>
      <Field id="note-body" label="Note">
        <textarea id="note-body" rows={4} className={inputClass()} {...register('body')} />
      </Field>
      {target && (
        <p className="text-[11px] text-slate-400">
          About <Badge variant="info">{target.code}</Badge>
        </p>
      )}
      <EntityMultiPicker<Shot>
        label={target ? 'Also about shots' : 'About shots'}
        queryKey={shotsApi.keys.all}
        fetchPage={shotsApi.list}
        fetchOne={shotsApi.get}
        getLabel={(x) => `${x.code}${x.name ? ` · ${x.name}` : ''}`}
        unknownLabel="Unknown shot"
        filters={projectFilter}
        value={picked.Shot}
        onChange={pick('Shot')}
      />
      <EntityMultiPicker<Asset>
        label={target ? 'Also about assets' : 'About assets'}
        queryKey={assetsApi.keys.all}
        fetchPage={assetsApi.list}
        fetchOne={assetsApi.get}
        getLabel={(x) => `${x.code} · ${x.name}`}
        unknownLabel="Unknown asset"
        filters={projectFilter}
        value={picked.Asset}
        onChange={pick('Asset')}
      />
      <EntityMultiPicker<Version>
        label={target ? 'Also about versions' : 'About versions'}
        queryKey={versionsApi.keys.all}
        fetchPage={versionsApi.list}
        fetchOne={versionsApi.get}
        getLabel={(v) => v.code}
        unknownLabel="Unknown version"
        filters={projectFilter}
        value={picked.Version}
        onChange={pick('Version')}
      />
      <TaskPicker
        label="Task to act on it"
        value={taskId}
        onChange={(id) => {
          setTaskTouched(true);
          setTaskId(id);
        }}
        filters={projectFilter}
      />
    </FormDialog>
  );
};

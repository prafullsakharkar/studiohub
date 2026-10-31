import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { z } from 'zod';
import { auditKeys } from '@/api/audit/audit';
import { NOTE_CATEGORIES, projectScopedApi } from '@/api/production/structure';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Field, FormBanner, formatDate, inputClass } from '@/modules/identity/components/ui';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { fetchAllRows } from '@/shared/data/listing';
import { useServerForm } from '@/shared/forms/useServerForm';

export interface NoteTarget {
  type: 'Shot' | 'Asset';
  id: string;
  code: string;
  name: string;
  projectId: string;
}

const schema = z.object({ subject: z.string().trim().min(1, 'Enter a subject'), body: z.string(), category: z.enum(NOTE_CATEGORIES) });
type Values = z.infer<typeof schema>;

const noteKeys = (target: NoteTarget) => ['entity-notes', target.projectId, target.type, target.id] as const;

const AddNoteDialog: React.FC<{ target: NoteTarget; onClose: () => void }> = ({ target, onClose }) => {
  const queryClient = useQueryClient();
  const {
    register,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<Values>({ resolver: zodResolver(schema), defaultValues: { subject: '', body: '', category: 'General' } });

  const onSubmit = submit(async (values) => {
    await projectScopedApi.addNote(target.projectId, {
      subject: values.subject,
      ...(values.body ? { body: values.body } : {}),
      category: values.category,
      entity_type: target.type,
      entity_id: target.id,
      entity_code: target.code,
      entity_name: target.name,
    });
    await Promise.all([queryClient.invalidateQueries({ queryKey: noteKeys(target) }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
    notify.success('Note added.');
    onClose();
  });

  return (
    <Dialog isOpen onClose={onClose} title={`Add a note on ${target.code}`} size="md">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormBanner error={serverError} />
        <Field id="note-category" label="Category">
          <select id="note-category" className={inputClass()} {...register('category')}>
            {NOTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="note-subject" label="Subject" error={errors.subject?.message}>
          <input id="note-subject" className={inputClass(Boolean(errors.subject))} {...register('subject', { onChange: clearServerError })} />
        </Field>
        <Field id="note-body" label="Note">
          <textarea id="note-body" rows={4} className={inputClass()} {...register('body')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Add note
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

/**
 * The notes written about one shot or asset. The notes route lists a whole project and only searches, so the list is
 * searched by the record's code and then kept only where the note's own `entity_type` and `entity_id` name this record.
 */
export const EntityNotesTab: React.FC<{ target: NoteTarget }> = ({ target }) => {
  const canAdd = useCan('note.create');
  const [adding, setAdding] = useState(false);
  const notes = useQuery({
    queryKey: noteKeys(target),
    queryFn: async ({ signal }) => (await fetchAllRows(projectScopedApi.notesPage(target.projectId), { search: target.code, ordering: '-created_at' }, { signal })).filter((n) => n.entity_type === target.type && n.entity_id === target.id),
  });
  const rows = notes.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Notes{rows.length ? ` (${rows.length})` : ''}</h3>
        {canAdd && (
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
            Add note
          </Button>
        )}
      </div>
      <QueryBoundary isLoading={notes.isLoading} error={notes.error} onRetry={() => void notes.refetch()} entityName="notes" isEmpty={rows.length === 0} empty={{ title: 'No notes', description: `Nothing has been noted about ${target.code} yet.` }}>
        <ul className="space-y-2" aria-label="Notes">
          {rows.map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-200">{n.subject}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="neutral">{n.category}</Badge>
                  <Badge variant={n.status === 'Open' ? 'info' : 'neutral'}>{n.status}</Badge>
                  <time dateTime={n.created_at} className="font-mono text-[10px] text-slate-500">
                    {formatDate(n.created_at)}
                  </time>
                </span>
              </div>
              {n.body && <p className="mt-1 text-slate-400 whitespace-pre-wrap">{n.body}</p>}
              <p className="mt-1 text-[11px] text-slate-500">{n.author_name || 'Unknown author'}</p>
            </li>
          ))}
        </ul>
      </QueryBoundary>
      {adding && <AddNoteDialog target={target} onClose={() => setAdding(false)} />}
    </div>
  );
};

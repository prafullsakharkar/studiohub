import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { projectScopedApi } from '@/api/production/structure';
import type { NoteStatus, ProjectNote, ProjectNoteFilters, ProjectNoteInput, ProjectNotePatch, ProjectNoteThread } from '@/api/production/structure';
import { tasksApi } from '@/api/production/work';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { formatDateTime } from '@/core/locale/studioLocale';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { fetchAllRows } from '@/shared/data/listing';
import { MentionPicker } from './MentionPicker';
import { NoteFormDialog } from './NoteFormDialog';
import type { NoteTarget } from './NoteFormDialog';

/** Every note read of a project starts with this key, so one write refreshes every Notes tab of it. */
export const noteKeys = {
  project: (projectId: string) => ['project-notes', projectId] as const,
  list: (projectId: string, filters: ProjectNoteFilters) => ['project-notes', projectId, 'list', filters] as const,
  thread: (projectId: string, noteId: string) => ['project-notes', projectId, 'thread', noteId] as const,
};

/** Authorship is the note's `author_id` (written by the server from the signed-in user). */
const wrote = (userId: string | undefined, note: ProjectNote) => Boolean(userId) && note.author_id === userId;

/** The next statuses offered from a thread's status (C-RP-13). */
const NEXT: Record<string, ReadonlyArray<{ to: NoteStatus; label: string }>> = {
  Open: [
    { to: 'Addressed', label: 'Mark addressed' },
    { to: 'Closed', label: 'Close' },
  ],
  Addressed: [
    { to: 'Closed', label: 'Close' },
    { to: 'Open', label: 'Reopen' },
  ],
  Closed: [{ to: 'Open', label: 'Reopen' }],
};

function useNoteWrites(projectId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: noteKeys.project(projectId) }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  };
}

const Links: React.FC<{ note: ProjectNote; hide?: NoteTarget }> = ({ note, hide }) => {
  const shown = note.links.filter((l) => !(hide && l.entity_type === hide.type && l.entity_id === hide.id));
  if (!shown.length && !note.task_code) return null;
  return (
    <span className="flex flex-wrap items-center gap-1" aria-label="About">
      {shown.map((l) => (
        <Badge key={`${l.entity_type}:${l.entity_id}`} variant="info" size="sm" title={`${l.entity_type}${l.name ? ` · ${l.name}` : ''}`}>
          {l.code || l.entity_type}
        </Badge>
      ))}
      {note.task_code && (
        <Badge variant="purple" size="sm" title="The task that should act on it">
          Task {note.task_code}
        </Badge>
      )}
    </span>
  );
};

/** The people a note or reply mentions (RP-6, C-RP-25). */
const Mentions: React.FC<{ note: ProjectNote }> = ({ note }) =>
  note.mentions?.length ? (
    <ul className="flex flex-wrap items-center gap-1 text-[11px] text-cyan-300" aria-label="Mentions">
      {note.mentions.map((m) => (
        <li key={m.id}>@{m.name || 'someone'}</li>
      ))}
    </ul>
  ) : null;

const ThreadBody: React.FC<{ projectId: string; note: ProjectNote; onEdit: () => void }> = ({ projectId, note, onEdit }) => {
  const refresh = useNoteWrites(projectId);
  const { user } = useCurrentUser();
  const canCreate = useCan('note.create', { projectId });
  const canUpdate = useCan('note.update', { projectId });
  const canDelete = useCan('note.delete', { projectId });
  const [reply, setReply] = useState('');
  const [replyMentions, setReplyMentions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<ProjectNote | null>(null);
  const thread = useQuery({ queryKey: noteKeys.thread(projectId, note.id), queryFn: ({ signal }) => projectScopedApi.note(projectId, note.id, signal) });
  // Only the assignee's own id matters (they may set the status): read it when the caller has no other right to.
  const needsTask = Boolean(note.task_id) && !canUpdate && !wrote(user?.id, note);
  const task = useQuery({ queryKey: [...tasksApi.keys.detail(note.task_id ?? ''), 'note-assignee'], queryFn: ({ signal }) => tasksApi.get(note.task_id as string, signal), enabled: needsTask, retry: false });
  const author = wrote(user?.id, note);
  const mayEdit = canUpdate || author;
  const maySetStatus = canUpdate || author || (Boolean(user?.id) && task.data?.assignee_id === user?.id);
  const replies: ProjectNote[] = (thread.data as ProjectNoteThread | undefined)?.replies ?? [];
  const othersReplied = replies.some((r) => !wrote(user?.id, r));
  const mayDeleteThread = canDelete || (author && !othersReplied);

  const run = async (work: () => Promise<unknown>, done: string) => {
    try {
      await work();
      await refresh();
      notify.success(done);
    } catch (error) {
      notify.fromError(error);
    }
  };
  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await projectScopedApi.replyToNote(projectId, note.id, reply.trim(), replyMentions);
      setReply('');
      setReplyMentions([]);
      await refresh();
    } catch (error) {
      notify.fromError(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
      <QueryBoundary isLoading={thread.isLoading} error={thread.error} onRetry={() => void thread.refetch()} entityName="replies">
        {replies.length > 0 && (
          <ul className="space-y-2" aria-label="Replies">
            {replies.map((r) => (
              <li key={r.id} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <p className="whitespace-pre-wrap text-slate-300">{r.body}</p>
                <Mentions note={r} />
                <p className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {r.author_name || 'Unknown author'} · <time dateTime={r.created_at}>{formatDateTime(r.created_at)}</time>
                  </span>
                  {(canDelete || wrote(user?.id, r)) && (
                    <button type="button" className="text-rose-400 hover:text-rose-300" onClick={() => setDeleting(r)}>
                      Delete reply
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
      {canCreate && (
        <div className="space-y-2">
          <div className="flex items-end gap-2">
            <label className="flex-1 text-[11px] text-slate-400">
              Reply
              <textarea aria-label={`Reply to ${note.subject}`} rows={2} value={reply} onChange={(e) => setReply(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200" />
            </label>
            <Button size="sm" variant="secondary" isLoading={sending} disabled={!reply.trim()} onClick={() => void send()}>
              Reply
            </Button>
          </div>
          <MentionPicker id={`reply-mentions-${note.id}`} projectId={projectId} value={replyMentions} onChange={setReplyMentions} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {maySetStatus &&
          (NEXT[note.status] ?? []).map((n) => (
            <Button key={n.to} size="sm" variant="secondary" onClick={() => void run(() => projectScopedApi.setNoteStatus(projectId, note.id, n.to), `Note ${n.to.toLowerCase()}.`)}>
              {n.label}
            </Button>
          ))}
        {mayEdit && (
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        )}
        {mayDeleteThread && (
          <Button size="sm" variant="danger" onClick={() => setDeleting(note)}>
            Delete
          </Button>
        )}
        {note.addressed_at && (
          <span className="text-[11px] text-slate-500">
            Addressed by {note.addressed_by || 'someone'} · <time dateTime={note.addressed_at}>{formatDateTime(note.addressed_at)}</time>
          </span>
        )}
      </div>
      <ConfirmDialog
        isOpen={deleting !== null}
        title={deleting?.parent_id ? 'Delete this reply?' : 'Delete this note?'}
        message={deleting?.parent_id ? 'The reply is removed from the thread.' : 'The note and every reply on it are removed.'}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await projectScopedApi.deleteNote(projectId, deleting.id);
          await refresh();
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

const ThreadCard: React.FC<{ projectId: string; note: ProjectNote; target?: NoteTarget }> = ({ projectId, note, target }) => {
  const refresh = useNoteWrites(projectId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="font-semibold text-slate-200">{note.subject}</span>
          <Links note={note} hide={target} />
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <Badge variant="neutral">{note.category}</Badge>
          <StatusBadge status={note.status} />
          <time dateTime={note.created_at} className="font-mono text-[10px] text-slate-500">
            {formatDateTime(note.created_at)}
          </time>
        </span>
      </div>
      {note.body && <p className="mt-1 whitespace-pre-wrap text-slate-400">{note.body}</p>}
      <Mentions note={note} />
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{note.author_name || 'Unknown author'}</span>
        <button type="button" aria-expanded={open} className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200" onClick={() => setOpen((v) => !v)}>
          <MessageSquare className="h-3 w-3" />
          {open ? 'Hide thread' : note.reply_count ? `${note.reply_count} ${note.reply_count === 1 ? 'reply' : 'replies'}` : 'Open thread'}
        </button>
      </div>
      {open && <ThreadBody projectId={projectId} note={note} onEdit={() => setEditing(true)} />}
      {editing && (
        <NoteFormDialog
          projectId={projectId}
          target={target}
          note={note}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            await projectScopedApi.updateNote(projectId, note.id, patch as ProjectNotePatch);
            await refresh();
            notify.success('Note saved.');
          }}
        />
      )}
    </li>
  );
};

export interface NoteBoardProps {
  projectId: string;
  /** A shot, asset or version: the list is that record's notes, and new notes are about it. */
  target?: NoteTarget;
  emptyDescription: string;
}

/**
 * The notes of a project or of one record (review pipeline RP-2): threads, newest first, each with the records it
 * is about, its task and status; opening one shows its replies, a reply box and what the caller may do with it.
 * What is offered follows the server's rules (Q-RP-11, Q-RP-12), which check every request again.
 */
export const NoteBoard: React.FC<NoteBoardProps> = ({ projectId, target, emptyDescription }) => {
  const refresh = useNoteWrites(projectId);
  const canAdd = useCan('note.create', { projectId });
  const [adding, setAdding] = useState(false);
  const filters: ProjectNoteFilters = target ? { entity_type: target.type, entity_id: target.id, ordering: '-created_at' } : { ordering: '-created_at' };
  const notes = useQuery({ queryKey: noteKeys.list(projectId, filters), queryFn: ({ signal }) => fetchAllRows(projectScopedApi.notesPage(projectId), { ...filters }, { signal }) });
  const rows = notes.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Notes{rows.length ? ` (${rows.length})` : ''}</h3>
        {canAdd && (
          <Button size="sm" variant="primary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
            Add note
          </Button>
        )}
      </div>
      <QueryBoundary isLoading={notes.isLoading} error={notes.error} onRetry={() => void notes.refetch()} entityName="notes" isEmpty={rows.length === 0} empty={{ title: 'No notes', description: emptyDescription }}>
        <ul className="space-y-2" aria-label="Notes">
          {rows.map((n) => (
            <ThreadCard key={n.id} projectId={projectId} note={n} target={target} />
          ))}
        </ul>
      </QueryBoundary>
      {adding && (
        <NoteFormDialog
          projectId={projectId}
          target={target}
          onClose={() => setAdding(false)}
          onSave={async (input) => {
            await projectScopedApi.addNote(projectId, input as ProjectNoteInput);
            await refresh();
            notify.success('Note added.');
          }}
        />
      )}
    </div>
  );
};

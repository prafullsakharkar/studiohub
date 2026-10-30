import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { reviewsApi } from '@/api/production/review';
import type { Review, ReviewComment, ReviewReply } from '@/api/production/review';
import { AuthContext } from '@/core/auth/AuthContext';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { MemberSelect } from '@/modules/production/work/pickers';
import { VersionPicker } from './pickers';

/** Runs a write on a review, refreshes the review and its history afterwards, and shows the server's own refusal. */
export function useReviewWrite() {
  const queryClient = useQueryClient();
  return async (write: () => Promise<unknown>): Promise<boolean> => {
    try {
      await write();
      await Promise.all([reviewsApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return true;
    } catch (error) {
      notify.error(serverMessage(error));
      return false;
    }
  };
}

const field = 'bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200';
const Empty: React.FC<{ children: string }> = ({ children }) => <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">{children}</p>;

export const ReviewVersionsPanel: React.FC<{ review: Review }> = ({ review }) => {
  const canEdit = useCan('review.update');
  const write = useReviewWrite();
  const [versionId, setVersionId] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-80">
            <VersionPicker label="Add a version" value={versionId} onChange={setVersionId} filters={{ project_id: review.project_id }} />
          </div>
          <Button size="sm" variant="primary" disabled={!versionId} onClick={async () => (await write(() => reviewsApi.addVersion(review.id, versionId as string))) && setVersionId(null)}>
            Add to review
          </Button>
        </div>
      )}
      {review.versions.length === 0 ? (
        <Empty>No versions on this review yet. Add the versions to be judged.</Empty>
      ) : (
        <table aria-label="Versions on this review" className="w-full text-xs">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-3">#</th>
              <th className="py-1 pr-3">Version</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {review.versions.map((v) => (
              <tr key={v.item_id}>
                <td className="py-1.5 pr-3">{v.order}</td>
                <td className="py-1.5 pr-3">
                  <Link to={`/versions/${v.id}`} className="font-semibold text-cyan-300 hover:underline">
                    {v.code} · {v.version_number}
                  </Link>
                </td>
                <td className="py-1.5 pr-3">
                  <Badge variant="outline">{v.status}</Badge>
                </td>
                <td className="py-1.5 text-right">
                  {canEdit && (
                    <button type="button" className="text-rose-400 hover:text-rose-300" aria-label={`Remove ${v.code}`} onClick={() => void write(() => reviewsApi.removeVersion(review.id, v.id))}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

/** What a participant can answer; free text is accepted by the server but only these mean anything. */
const PARTICIPANT_VERDICTS = ['Approved', 'Changes Requested', 'Rejected'] as const;

export const ReviewParticipantsPanel: React.FC<{ review: Review }> = ({ review }) => {
  const me = useContext(AuthContext)?.user?.id ?? '';
  const canEdit = useCan('review.update');
  const write = useReviewWrite();
  const [member, setMember] = useState('');
  const [role, setRole] = useState('');
  const [verdict, setVerdict] = useState<string>(PARTICIPANT_VERDICTS[0]);
  const [notes, setNotes] = useState('');
  const mine = review.reviewers.find((p) => p.user_id === me);
  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <MemberSelect projectId={review.project_id} value={member} onChange={setMember} label="Add a participant" />
          </div>
          <label className="text-xs text-slate-400">
            Role
            <input aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className={`${field} mt-1 block w-40`} />
          </label>
          <Button size="sm" variant="primary" disabled={!member} onClick={async () => (await write(() => reviewsApi.addParticipant(review.id, { user_id: member, role }))) && (setMember(''), setRole(''))}>
            Add participant
          </Button>
        </div>
      )}
      {review.reviewers.length === 0 ? (
        <Empty>No participants yet. Add the people whose verdict you want.</Empty>
      ) : (
        <table aria-label="Participants" className="w-full text-xs">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-3">Person</th>
              <th className="py-1 pr-3">Role</th>
              <th className="py-1 pr-3">Verdict</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {review.reviewers.map((p) => (
              <tr key={p.id}>
                <td className="py-1.5 pr-3">{p.name}</td>
                <td className="py-1.5 pr-3">{p.role || '—'}</td>
                <td className="py-1.5 pr-3">
                  <Badge variant={p.verdict === 'Approved' ? 'success' : p.verdict === 'Pending Review' ? 'outline' : 'warning'}>{p.verdict}</Badge>
                  {p.verdict_notes && <span className="ml-2 text-slate-400">{p.verdict_notes}</span>}
                </td>
                <td className="py-1.5 text-right">
                  {canEdit && (
                    <button type="button" className="text-rose-400 hover:text-rose-300" aria-label={`Remove ${p.name}`} onClick={() => void write(() => reviewsApi.removeParticipant(review.id, p.id))}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {mine && canEdit && (
        <section aria-label="Your verdict" className="rounded-lg border border-slate-800 p-3 space-y-2">
          <h3 className="text-xs font-semibold text-slate-200">Your verdict</h3>
          <div className="flex flex-wrap items-end gap-2">
            <select aria-label="Verdict" value={verdict} onChange={(e) => setVerdict(e.target.value)} className={field}>
              {PARTICIPANT_VERDICTS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <input aria-label="Verdict notes" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} w-64`} />
            <Button size="sm" variant="primary" onClick={() => void write(() => reviewsApi.participantVerdict(review.id, { participant_id: mine.id, verdict, notes }))}>
              Give verdict
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">A verdict does not decide the review; the supervisor does. You cannot approve a review you submitted.</p>
        </section>
      )}
    </div>
  );
};

const CommentThread: React.FC<{ review: Review; comment: ReviewComment | ReviewReply; reply: boolean; canEdit: boolean }> = ({ review, comment, reply, canEdit }) => {
  const write = useReviewWrite();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  return (
    <li className={`rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs ${reply ? 'ml-6' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 text-slate-400">
        <span className="font-semibold text-slate-200">{comment.author}</span>
        {comment.frame_number !== null && <Badge variant="outline">frame {comment.frame_number}</Badge>}
        {comment.is_resolved && <Badge variant="success">Resolved</Badge>}
        <time className="ml-auto text-[10px] font-mono" dateTime={comment.created_at}>
          {new Date(comment.created_at).toLocaleString()}
        </time>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-slate-200">{comment.text}</p>
      {canEdit && (
        <div className="mt-2 flex gap-3">
          {!reply && (
            <button type="button" className="text-cyan-300 hover:underline" onClick={() => setReplying(!replying)}>
              Reply
            </button>
          )}
          <button type="button" className="text-slate-400 hover:text-slate-200" onClick={() => void write(() => (comment.is_resolved ? reviewsApi.reopenComment(review.id, comment.id) : reviewsApi.resolveComment(review.id, comment.id)))}>
            {comment.is_resolved ? 'Reopen' : 'Resolve'}
          </button>
        </div>
      )}
      {replying && (
        <div className="mt-2 flex gap-2">
          <input aria-label="Reply" value={text} onChange={(e) => setText(e.target.value)} className={`${field} flex-1`} />
          <Button size="sm" variant="primary" disabled={!text.trim()} onClick={async () => (await write(() => reviewsApi.addComment(review.id, { text: text.trim(), parent_id: comment.id }))) && (setText(''), setReplying(false))}>
            Send reply
          </Button>
        </div>
      )}
      {'replies' in comment && comment.replies.length > 0 && (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((r) => (
            <CommentThread key={r.id} review={review} comment={r} reply canEdit={canEdit} />
          ))}
        </ul>
      )}
    </li>
  );
};

export const ReviewCommentsPanel: React.FC<{ review: Review }> = ({ review }) => {
  const canEdit = useCan('review.update');
  const write = useReviewWrite();
  const [text, setText] = useState('');
  const [frame, setFrame] = useState('');
  // The server refuses an empty comment (CR-16) but still accepts comments on a closed review; the screen takes neither.
  const closed = review.status === 'Closed';
  return (
    <div className="space-y-3">
      {canEdit && !closed && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-64 flex-1 text-xs text-slate-400">
            Comment
            <input aria-label="Comment" value={text} onChange={(e) => setText(e.target.value)} className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-xs text-slate-400">
            Frame
            <input aria-label="Frame" type="number" value={frame} onChange={(e) => setFrame(e.target.value)} className={`${field} mt-1 block w-24`} />
          </label>
          <Button size="sm" variant="primary" disabled={!text.trim()} onClick={async () => (await write(() => reviewsApi.addComment(review.id, { text: text.trim(), frame_number: frame === '' ? null : Number(frame) }))) && (setText(''), setFrame(''))}>
            Add comment
          </Button>
        </div>
      )}
      {closed && <p className="text-[11px] text-slate-500">This review is closed; comments are read-only here.</p>}
      {review.comments.length === 0 ? (
        <Empty>No comments yet.</Empty>
      ) : (
        <ul aria-label="Comments" className="space-y-2">
          {review.comments.map((c) => (
            <CommentThread key={c.id} review={review} comment={c} reply={false} canEdit={canEdit && !closed} />
          ))}
        </ul>
      )}
    </div>
  );
};

export const ReviewNotesPanel: React.FC<{ review: Review }> = ({ review }) => {
  const canEdit = useCan('review.update');
  const write = useReviewWrite();
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-64 flex-1 text-xs text-slate-400">
            Note
            <input aria-label="Note" value={content} onChange={(e) => setContent(e.target.value)} className={`${field} mt-1 block w-full`} />
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-300">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin
          </label>
          <Button size="sm" variant="primary" disabled={!content.trim()} onClick={async () => (await write(() => reviewsApi.addNote(review.id, { content: content.trim(), is_pinned: pinned }))) && (setContent(''), setPinned(false))}>
            Add note
          </Button>
        </div>
      )}
      {review.notes.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ul aria-label="Notes" className="space-y-2">
          {[...review.notes].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)).map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="font-semibold text-slate-200">{n.author_name}</span>
                {n.author_role && <span>{n.author_role}</span>}
                {n.is_pinned && <Badge variant="warning">Pinned</Badge>}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-200">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ReviewAnnotationsPanel: React.FC<{ review: Review }> = ({ review }) => {
  const canEdit = useCan('review.update');
  const write = useReviewWrite();
  const [comment, setComment] = useState('');
  const [frame, setFrame] = useState('');
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-64 flex-1 text-xs text-slate-400">
            Annotation
            <input aria-label="Annotation" value={comment} onChange={(e) => setComment(e.target.value)} className={`${field} mt-1 block w-full`} />
          </label>
          <label className="text-xs text-slate-400">
            Frame
            <input aria-label="Annotation frame" type="number" value={frame} onChange={(e) => setFrame(e.target.value)} className={`${field} mt-1 block w-24`} />
          </label>
          <Button size="sm" variant="primary" disabled={!comment.trim()} onClick={async () => (await write(() => reviewsApi.addAnnotation(review.id, { comment: comment.trim(), frame_number: frame === '' ? null : Number(frame) }))) && (setComment(''), setFrame(''))}>
            Add annotation
          </Button>
        </div>
      )}
      {review.annotations.length === 0 ? (
        <Empty>No annotations yet. Drawing on the frame needs the media player, which is not part of this screen.</Empty>
      ) : (
        <ul aria-label="Annotations" className="space-y-2">
          {review.annotations.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <span className="font-semibold text-slate-200">{a.author_name}</span>
              {a.frame_number !== null && <Badge variant="outline">frame {a.frame_number}</Badge>}
              <p className="mt-1 text-slate-200">{a.comment}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ReviewActivityPanel: React.FC<{ review: Review }> = ({ review }) =>
  review.activity.length === 0 ? (
    <Empty>No activity yet.</Empty>
  ) : (
    <ol aria-label="Activity" className="space-y-2">
      {[...review.activity].reverse().map((a) => (
        <li key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
          <span className="font-mono text-slate-200">{a.action}</span> <span className="text-slate-400">by {a.user}</span>
          <time className="float-right text-[10px] font-mono text-slate-500" dateTime={a.timestamp}>
            {new Date(a.timestamp).toLocaleString()}
          </time>
          {a.notes && <p className="mt-1 text-slate-300">{a.notes}</p>}
        </li>
      ))}
    </ol>
  );

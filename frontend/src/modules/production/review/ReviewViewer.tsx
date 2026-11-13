import { useQuery } from '@tanstack/react-query';
import { Layers, SplitSquareVertical } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { reviewMediaRefetchInterval, reviewsApi, versionPlayback, versionsApi } from '@/api/production/review';
import type { Review } from '@/api/production/review';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { MediaCompare } from '@/shared/components/media/MediaCompare';
import { MediaPlayer } from '@/shared/components/media/MediaPlayer';
import type { MediaPlayerHandle, PlayerMarker } from '@/shared/components/media/MediaPlayer';
import { timecode, toFps } from '@/shared/components/media/frameTime';
import { cn } from '@/shared/utils/cn';
import { SELECTED } from '@/shared/utils/kitStyles';
import { AnnotationLayer } from './AnnotationLayer';
import { COLORS, parseDrawing, type Shape, TOOLS, type Tool, toDrawing } from './annotationModel';
import { useReviewWrite } from './ReviewPanels';

interface Feedback {
  key: string;
  kind: 'Comment' | 'Annotation';
  frame: number;
  author: string;
  text: string;
  resolved: boolean;
  /** An annotation that has a drawing on its frame. */
  drawn?: boolean;
  /** On the whole review rather than on the version on show. */
  wholeReview: boolean;
}

/**
 * The review's versions in the player, with the comments and annotations that name a frame marked on the timeline
 * (click one to go to it) and a box to comment on the frame being shown. What is written here is on the version on
 * show (C-RP-05); the timeline and the list show that version's feedback and the feedback on the whole review.
 * Two of the versions can be put against each other (A/B wipe or side by side); `compareWith` opens it on that version.
 */
export const ReviewViewer: React.FC<{ review: Review; compareWith?: string | null }> = ({ review, compareWith = null }) => {
  const canEdit = useCan('review.update');
  const write = useReviewWrite();
  const player = useRef<MediaPlayerHandle>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [text, setText] = useState('');
  // Drawing: the tool and colour, what has been drawn and not saved, and the frame it belongs to (a drawing is one frame's).
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [draft, setDraft] = useState<Shape[]>([]);
  const [draftFrame, setDraftFrame] = useState<number | null>(null);
  const [note, setNote] = useState('');
  // Comparing two of the versions: how (a wipe or side by side; null is the one-version player) and the one against the shown.
  const [compareMode, setCompareMode] = useState<'wipe' | 'side' | null>(compareWith ? 'wipe' : null);
  const [otherId, setOtherId] = useState<string | null>(compareWith);
  const versions = [...review.versions].sort((a, b) => a.order - b.order);
  const current = versions.find((v) => v.id === picked) ?? versions[0];
  const others = versions.filter((v) => v.id !== current?.id);
  const other = others.find((v) => v.id === otherId) ?? others[0];
  const comparing = compareMode !== null && Boolean(other);
  // The server's review copy plays when there is one (RP-5); its signed links are fetched again before they expire.
  const query = useQuery({ queryKey: [...versionsApi.keys.detail(current?.id ?? ''), 'for-viewer'], queryFn: ({ signal }) => versionsApi.get((current as { id: string }).id, signal), enabled: Boolean(current), refetchInterval: (q) => reviewMediaRefetchInterval([q.state.data]) });
  const version = query.data;
  const otherQuery = useQuery({ queryKey: [...versionsApi.keys.detail(other?.id ?? ''), 'for-viewer'], queryFn: ({ signal }) => versionsApi.get((other as { id: string }).id, signal), enabled: comparing, refetchInterval: (q) => reviewMediaRefetchInterval([q.state.data]) });
  const otherVersion = otherQuery.data;
  const shown = versionPlayback(version);
  const otherShown = versionPlayback(otherVersion);
  const startFrame = version?.start_frame ?? 1;
  const fps = toFps(shown.fps);
  const closed = review.status === 'Closed';

  // A comment or annotation on another version of the review is not this picture's; one on the whole review is everyone's.
  const shownId = current?.id;
  const onShown = useCallback((versionId: string | null) => versionId === null || versionId === shownId, [shownId]);
  const feedback = useMemo<Feedback[]>(
    () =>
      [
        ...review.comments.filter((c) => c.frame_number !== null && onShown(c.version_id)).map((c) => ({ key: `c-${c.id}`, kind: 'Comment' as const, frame: c.frame_number as number, author: c.author, text: c.text, resolved: c.is_resolved, wholeReview: c.version_id === null })),
        ...review.annotations.filter((a) => a.frame_number !== null && onShown(a.version_id)).map((a) => ({ key: `a-${a.id}`, kind: 'Annotation' as const, frame: a.frame_number as number, author: a.author_name, text: a.comment, resolved: false, drawn: parseDrawing(a.drawing_coordinates).length > 0, wholeReview: a.version_id === null })),
      ].sort((a, b) => a.frame - b.frame),
    [review.comments, review.annotations, onShown],
  );
  const markers = useMemo<PlayerMarker[]>(() => feedback.map((f) => ({ frame: f.frame, label: `${f.kind.toLowerCase()} by ${f.author || 'someone'}`, tone: f.resolved ? 'resolved' : f.kind === 'Annotation' ? 'annotation' : 'comment' })), [feedback]);

  // The drawings already saved on the frame being shown.
  const savedHere = review.annotations.filter((a) => a.frame_number === frame && onShown(a.version_id)).flatMap((a) => parseDrawing(a.drawing_coordinates));
  const canDraw = canEdit && !closed && !comparing;
  const lockedElsewhere = draft.length > 0 && draftFrame !== frame;
  const layerTool = drawing && !lockedElsewhere ? tool : null;
  const stopDrawing = () => {
    setDrawing(false);
    setDraft([]);
    setDraftFrame(null);
    setNote('');
  };

  if (!current) return <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">This review has no versions yet. Add one on the Versions tab to see it here.</p>;

  return (
    <div className="space-y-4">
      {versions.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Version on show" className="flex flex-wrap gap-1.5">
            {versions.map((v) => (
              <button key={v.id} type="button" aria-pressed={v.id === current.id} onClick={() => { if (v.id !== current.id) stopDrawing(); setPicked(v.id); }} className={cn('rounded-lg border px-2.5 py-1 font-mono text-xs', v.id === current.id ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 text-slate-300 hover:border-slate-700')}>
                {v.code}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Compare versions" className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 text-xs">
            <button type="button" aria-pressed={compareMode === 'wipe'} onClick={() => setCompareMode(compareMode === 'wipe' ? null : 'wipe')} className={cn('flex items-center gap-1.5 rounded px-2 py-1 font-mono font-medium transition-colors', compareMode === 'wipe' ? SELECTED : 'text-slate-400 hover:text-white')}>
              <SplitSquareVertical className="h-3.5 w-3.5" aria-hidden />
              A/B Wipe
            </button>
            <button type="button" aria-pressed={compareMode === 'side'} onClick={() => setCompareMode(compareMode === 'side' ? null : 'side')} className={cn('flex items-center gap-1.5 rounded px-2 py-1 font-mono font-medium transition-colors', compareMode === 'side' ? SELECTED : 'text-slate-400 hover:text-white')}>
              <Layers className="h-3.5 w-3.5" aria-hidden />
              Side-by-Side
            </button>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {query.isLoading || (comparing && otherQuery.isLoading) ? (
            <p className="rounded-lg border border-slate-800 p-6 text-xs text-slate-500">Loading {comparing && other ? `${current.code} and ${other.code}` : current.code}…</p>
          ) : comparing && other ? (
            <MediaCompare
              key={`${current.id}|${other.id}|${compareMode}|${shown.src ?? shown.poster ?? ''}|${otherShown.src ?? otherShown.poster ?? ''}`}
              label={`${current.code} against ${other.code}`}
              a={{ id: current.id, label: current.code, src: shown.src, poster: shown.poster }}
              b={{ id: other.id, label: other.code, src: otherShown.src, poster: otherShown.poster }}
              choices={versions.map((v) => ({ id: v.id, label: v.code }))}
              onPick={(side, id) => (side === 'a' ? setPicked(id) : setOtherId(id))}
              initialMode={compareMode === 'side' ? 'side' : 'wipe'}
              fps={fps}
              startFrame={startFrame}
              onFrameChange={setFrame}
            />
          ) : (
            <MediaPlayer
              key={`${current.id}|${shown.src ?? shown.poster ?? ''}`}
              ref={player}
              label={`${current.code} in review`}
              src={shown.src}
              poster={shown.poster}
              fps={fps}
              startFrame={startFrame}
              markers={markers}
              onFrameChange={setFrame}
              overlay={<AnnotationLayer existing={savedHere} draft={draftFrame === frame ? draft : []} tool={layerTool} color={color} onDraft={(shapes) => { if (draft.length === 0) setDraftFrame(frame); setDraft(shapes); }} />}
            />
          )}
          {comparing && canEdit && !closed && <p className="text-[11px] text-slate-500">Drawing is off while two versions are compared; a comment still names the frame being shown.</p>}
          {canDraw && (
            <section aria-label="Drawing" className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={drawing ? 'primary' : 'outline'}
                  aria-pressed={drawing}
                  onClick={() => {
                    if (drawing) return stopDrawing();
                    player.current?.pause();
                    setDrawing(true);
                  }}
                >
                  {drawing ? 'Stop drawing' : 'Draw on this frame'}
                </Button>
                {drawing && (
                  <>
                    <div role="group" aria-label="Drawing tool" className="inline-flex overflow-hidden rounded-lg border border-slate-800">
                      {TOOLS.map((t) => (
                        <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={cn('px-2.5 py-1 text-xs', tool === t.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200')}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div role="group" aria-label="Drawing colour" className="inline-flex items-center gap-1">
                      {COLORS.map((c) => (
                        <button key={c.value} type="button" aria-label={`Colour ${c.label}`} aria-pressed={color === c.value} onClick={() => setColor(c.value)} className={cn('h-5 w-5 rounded-full border-2', color === c.value ? 'border-white' : 'border-transparent')} style={{ background: c.value }} />
                      ))}
                    </div>
                    <Button size="sm" variant="outline" disabled={draft.length === 0} onClick={() => { const next = draft.slice(0, -1); setDraft(next); if (next.length === 0) setDraftFrame(null); }}>
                      Undo
                    </Button>
                    <Button size="sm" variant="outline" disabled={draft.length === 0} onClick={() => { setDraft([]); setDraftFrame(null); }}>
                      Clear drawing
                    </Button>
                  </>
                )}
              </div>
              {drawing && lockedElsewhere && (
                <p className="text-[11px] text-amber-300">
                  Your drawing is on frame {draftFrame}.{' '}
                  <button type="button" className="underline" onClick={() => player.current?.seekToFrame(draftFrame as number)}>
                    Go to it
                  </button>{' '}
                  to add to it, or save or clear it to draw elsewhere.
                </p>
              )}
              {drawing && (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-64 flex-1 text-xs text-slate-400">
                    {`Note for ${draftFrame ?? frame}`}
                    <input aria-label="Annotation note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200" />
                  </label>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={draft.length === 0 || draftFrame === null}
                    onClick={async () => {
                      const target = draftFrame as number;
                      if (await write(() => reviewsApi.addAnnotation(review.id, { comment: note.trim(), frame_number: target, timecode: timecode(target, startFrame, fps), drawing_coordinates: toDrawing(draft), version_id: current.id }))) stopDrawing();
                    }}
                  >
                    Save annotation
                  </Button>
                </div>
              )}
            </section>
          )}
          {canEdit && !closed && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-64 flex-1 text-xs text-slate-400">
                {versions.length > 1 ? `Comment on ${current.code}, frame ${frame}` : `Comment on frame ${frame}`}
                <input aria-label="Comment on this frame" value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200" />
              </label>
              <Button
                size="sm"
                variant="primary"
                disabled={!text.trim()}
                onClick={async () => (await write(() => reviewsApi.addComment(review.id, { text: text.trim(), frame_number: frame, timecode: timecode(frame, startFrame, fps), version_id: current.id }))) && setText('')}
              >
                Add comment
              </Button>
            </div>
          )}
          {closed && <p className="text-[11px] text-slate-500">This review is closed; comments are read-only here.</p>}
        </div>

        <aside aria-label="Feedback on frames" className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Feedback on frames</h2>
          {feedback.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No comment or annotation names a frame yet.</p>
          ) : (
            <ul className="max-h-96 space-y-1.5 overflow-y-auto">
              {feedback.map((f) => (
                <li key={f.key}>
                  <button type="button" aria-label={`Go to frame ${f.frame}: ${f.text}`} disabled={comparing} title={comparing ? 'Stop comparing to go to a frame' : undefined} onClick={() => player.current?.seekToFrame(f.frame)} className={cn('w-full rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-left text-xs hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-60', f.resolved && 'opacity-60')}>
                    <span className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
                      <span>{`Frame ${f.frame}`}</span>
                      <span>{`${f.resolved ? 'Resolved' : f.drawn ? 'Annotation · drawing' : f.kind}${f.wholeReview && versions.length > 1 ? ' · whole review' : ''}`}</span>
                    </span>
                    <span className="mt-0.5 block text-slate-200">{f.text}</span>
                    <span className="block text-[11px] text-slate-500">{f.author}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
};

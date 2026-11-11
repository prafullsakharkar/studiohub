import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { reviewsApi, versionsApi } from '@/api/production/review';
import type { Review } from '@/api/production/review';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { MediaPlayer } from '@/shared/components/media/MediaPlayer';
import type { MediaPlayerHandle, PlayerMarker } from '@/shared/components/media/MediaPlayer';
import { timecode, toFps } from '@/shared/components/media/frameTime';
import { cn } from '@/shared/utils/cn';
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
}

/**
 * The review's versions in the player, with the comments and annotations that name a frame marked on the timeline
 * (click one to go to it) and a box to comment on the frame being shown. Drawing on the frame is a later step.
 */
export const ReviewViewer: React.FC<{ review: Review }> = ({ review }) => {
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
  const versions = [...review.versions].sort((a, b) => a.order - b.order);
  const current = versions.find((v) => v.id === picked) ?? versions[0];
  const query = useQuery({ queryKey: [...versionsApi.keys.detail(current?.id ?? ''), 'for-viewer'], queryFn: ({ signal }) => versionsApi.get((current as { id: string }).id, signal), enabled: Boolean(current) });
  const version = query.data;
  const startFrame = version?.start_frame ?? 1;
  const fps = toFps(version?.fps);
  const closed = review.status === 'Closed';

  const feedback = useMemo<Feedback[]>(
    () =>
      [
        ...review.comments.filter((c) => c.frame_number !== null).map((c) => ({ key: `c-${c.id}`, kind: 'Comment' as const, frame: c.frame_number as number, author: c.author, text: c.text, resolved: c.is_resolved })),
        ...review.annotations.filter((a) => a.frame_number !== null).map((a) => ({ key: `a-${a.id}`, kind: 'Annotation' as const, frame: a.frame_number as number, author: a.author_name, text: a.comment, resolved: false, drawn: parseDrawing(a.drawing_coordinates).length > 0 })),
      ].sort((a, b) => a.frame - b.frame),
    [review.comments, review.annotations],
  );
  const markers = useMemo<PlayerMarker[]>(() => feedback.map((f) => ({ frame: f.frame, label: `${f.kind.toLowerCase()} by ${f.author || 'someone'}`, tone: f.resolved ? 'resolved' : f.kind === 'Annotation' ? 'annotation' : 'comment' })), [feedback]);

  // The drawings already saved on the frame being shown.
  const savedHere = review.annotations.filter((a) => a.frame_number === frame).flatMap((a) => parseDrawing(a.drawing_coordinates));
  const canDraw = canEdit && !closed;
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
        <div role="group" aria-label="Version on show" className="flex flex-wrap gap-1.5">
          {versions.map((v) => (
            <button key={v.id} type="button" aria-pressed={v.id === current.id} onClick={() => setPicked(v.id)} className={cn('rounded-lg border px-2.5 py-1 font-mono text-xs', v.id === current.id ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 text-slate-300 hover:border-slate-700')}>
              {v.code}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {query.isLoading ? (
            <p className="rounded-lg border border-slate-800 p-6 text-xs text-slate-500">Loading {current.code}…</p>
          ) : (
            <MediaPlayer
              key={current.id}
              ref={player}
              label={`${current.code} in review`}
              src={version?.video_url}
              poster={version?.thumbnail_url}
              fps={fps}
              startFrame={startFrame}
              markers={markers}
              onFrameChange={setFrame}
              overlay={<AnnotationLayer existing={savedHere} draft={draftFrame === frame ? draft : []} tool={layerTool} color={color} onDraft={(shapes) => { if (draft.length === 0) setDraftFrame(frame); setDraft(shapes); }} />}
            />
          )}
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
                      if (await write(() => reviewsApi.addAnnotation(review.id, { comment: note.trim(), frame_number: target, timecode: timecode(target, startFrame, fps), drawing_coordinates: toDrawing(draft) }))) stopDrawing();
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
                {`Comment on frame ${frame}`}
                <input aria-label="Comment on this frame" value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200" />
              </label>
              <Button
                size="sm"
                variant="primary"
                disabled={!text.trim()}
                onClick={async () => (await write(() => reviewsApi.addComment(review.id, { text: text.trim(), frame_number: frame, timecode: timecode(frame, startFrame, fps) }))) && setText('')}
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
                  <button type="button" aria-label={`Go to frame ${f.frame}: ${f.text}`} onClick={() => player.current?.seekToFrame(f.frame)} className={cn('w-full rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-left text-xs hover:border-slate-700', f.resolved && 'opacity-60')}>
                    <span className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-400">
                      <span>{`Frame ${f.frame}`}</span>
                      <span>{f.resolved ? 'Resolved' : f.drawn ? 'Annotation · drawing' : f.kind}</span>
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

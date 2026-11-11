import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { safeWebUrl } from '@/shared/utils/safeUrl';
import { clampFrame, DEFAULT_FPS, frameCount, frameToTime, timeToFrame, timecode } from './frameTime';

export interface CompareSource {
  /** What the side is called: the version's code. */
  label: string;
  src?: string | null;
  poster?: string | null;
}

export type CompareMode = 'side' | 'wipe' | 'difference';
const MODES: ReadonlyArray<{ id: CompareMode; label: string }> = [
  { id: 'side', label: 'Side by side' },
  { id: 'wipe', label: 'Wipe' },
  { id: 'difference', label: 'Difference' },
];

interface MediaCompareProps {
  a: CompareSource;
  b: CompareSource;
  fps?: number;
  startFrame?: number;
  label: string;
}

const Btn: React.FC<{ label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white disabled:opacity-40">
    {children}
  </button>
);

/**
 * Two videos on one transport: side by side, one wiped over the other, or the difference between them (the pixels that
 * changed show light, the rest is black). The first side drives the clock; the second is kept on the same frame. The
 * length is the shorter of the two.
 */
export const MediaCompare: React.FC<MediaCompareProps> = ({ a, b, fps = DEFAULT_FPS, startFrame = 1, label }) => {
  const urlA = safeWebUrl(a.src);
  const urlB = safeWebUrl(b.src);
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<CompareMode>('side');
  const [wipe, setWipe] = useState(50);
  const [lengths, setLengths] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [frame, setFrame] = useState(startFrame);
  const [playing, setPlaying] = useState(false);
  const count = lengths.a > 0 && lengths.b > 0 ? Math.min(lengths.a, lengths.b) : 0;
  const end = startFrame + Math.max(count - 1, 0);
  const ready = count > 0;

  // New sources start from the head.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the addresses (and the first frame number) restart the compare
  useEffect(() => {
    setLengths({ a: 0, b: 0 });
    setFrame(startFrame);
    setPlaying(false);
  }, [urlA, urlB, startFrame]);

  const draw = useCallback(() => {
    const el = canvas.current;
    const one = videoA.current;
    const two = videoB.current;
    const ctx = el?.getContext?.('2d');
    if (!el || !ctx || !one || !two || !one.videoWidth) return;
    if (el.width !== one.videoWidth) {
      el.width = one.videoWidth;
      el.height = one.videoHeight;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(one, 0, 0, el.width, el.height);
    ctx.globalCompositeOperation = 'difference';
    ctx.drawImage(two, 0, 0, el.width, el.height);
  }, []);

  const move = useCallback(
    (next: number) => {
      const target = clampFrame(next, startFrame, count);
      setFrame(target);
      const time = frameToTime(target, startFrame, fps);
      if (videoA.current) videoA.current.currentTime = time;
      if (videoB.current) videoB.current.currentTime = time;
    },
    [count, fps, startFrame],
  );

  // While it plays the first video drives the clock, the second is pulled back onto it if it drifts by half a frame.
  useEffect(() => {
    const one = videoA.current;
    const two = videoB.current;
    if (!playing || !one || !two) return;
    let handle = 0;
    const tick = () => {
      if (Math.abs(two.currentTime - one.currentTime) > 0.5 / fps) two.currentTime = one.currentTime;
      setFrame(timeToFrame(one.currentTime, startFrame, fps, count));
      draw();
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, startFrame, fps, count, draw]);

  const toggle = () => {
    const one = videoA.current;
    const two = videoB.current;
    if (!one || !two || !ready) return;
    if (one.paused) {
      two.currentTime = one.currentTime;
      void Promise.all([Promise.resolve(one.play()), Promise.resolve(two.play())]).then(() => setPlaying(true), () => setPlaying(false));
    } else {
      one.pause();
      two.pause();
      setPlaying(false);
      // Settle both on a frame boundary, so the number shown and both pictures are the same frame.
      const settled = timeToFrame(one.currentTime, startFrame, fps, count);
      setFrame(settled);
      const time = frameToTime(settled, startFrame, fps);
      one.currentTime = time;
      two.currentTime = time;
    }
  };
  const step = (n: number) => {
    videoA.current?.pause();
    videoB.current?.pause();
    setPlaying(false);
    move(frame + n);
  };
  const onLoaded = (side: 'a' | 'b') => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const frames = frameCount(e.currentTarget.duration, fps);
    setLengths((current) => ({ ...current, [side]: frames }));
    // A video made again (the mode changed) goes back to the frame being shown, not to the head.
    e.currentTarget.currentTime = frameToTime(frame, startFrame, fps);
  };

  if (!urlA || !urlB) {
    return <p className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">{`Both versions need a preview to be compared: ${!urlA ? a.label : b.label} has none linked.`}</p>;
  }

  const layers = mode !== 'side';
  const video = (side: 'a' | 'b', source: CompareSource, url: string) => (
    <video
      ref={side === 'a' ? videoA : videoB}
      src={url}
      poster={safeWebUrl(source.poster)}
      aria-label={`${source.label} video`}
      muted
      playsInline
      preload="metadata"
      className={cn('h-full w-full object-contain', layers && 'absolute inset-0', mode === 'difference' && 'opacity-0 pointer-events-none')}
      style={mode === 'wipe' && side === 'b' ? { clipPath: `inset(0 0 0 ${wipe}%)` } : undefined}
      onLoadedMetadata={onLoaded(side)}
      onSeeked={side === 'a' ? (e) => { setFrame(timeToFrame(e.currentTarget.currentTime, startFrame, fps, count)); draw(); } : () => draw()}
      onEnded={side === 'a' ? () => setPlaying(false) : undefined}
    />
  );

  return (
    <div role="group" aria-label={label} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Compare as" className="inline-flex overflow-hidden rounded-lg border border-slate-800">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => {
                videoA.current?.pause();
                videoB.current?.pause();
                setPlaying(false);
                setMode(m.id);
              }} className={cn('px-2.5 py-1 text-xs', mode === m.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200')}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-slate-400">{mode === 'wipe' ? `${a.label} on the left, ${b.label} on the right` : mode === 'difference' ? `${a.label} against ${b.label}: light is what changed` : ''}</span>
      </div>

      <div className={cn('relative w-full overflow-hidden rounded-lg bg-black', mode === 'side' ? 'grid grid-cols-2 gap-1' : 'aspect-video')}>
        {mode === 'side' ? (
          <>
            <figure className="relative aspect-video overflow-hidden">
              {video('a', a, urlA)}
              <figcaption className="absolute left-2 top-2 rounded bg-black/80 px-2 py-0.5 font-mono text-[11px] text-slate-200">{a.label}</figcaption>
            </figure>
            <figure className="relative aspect-video overflow-hidden">
              {video('b', b, urlB)}
              <figcaption className="absolute left-2 top-2 rounded bg-black/80 px-2 py-0.5 font-mono text-[11px] text-slate-200">{b.label}</figcaption>
            </figure>
          </>
        ) : (
          <>
            {video('a', a, urlA)}
            {video('b', b, urlB)}
            {mode === 'difference' && <canvas ref={canvas} aria-label={`Difference between ${a.label} and ${b.label}`} className="absolute inset-0 h-full w-full object-contain" />}
            {mode === 'wipe' && <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan-400" style={{ left: `${wipe}%` }} />}
          </>
        )}
      </div>

      {mode === 'wipe' && (
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Wipe
          <input type="range" aria-label="Wipe position" min={0} max={100} value={wipe} onChange={(e) => setWipe(Number(e.target.value))} className="flex-1 accent-cyan-400" />
        </label>
      )}

      <input type="range" aria-label="Scrub" min={startFrame} max={Math.max(end, startFrame)} value={frame} disabled={!ready} onChange={(e) => step(Number(e.target.value) - frame)} className="w-full accent-cyan-400" />
      <div className="flex flex-wrap items-center gap-1.5">
        <Btn label="Jump to first frame" disabled={!ready} onClick={() => step(-count)}>
          <SkipBack className="h-3.5 w-3.5" aria-hidden />
        </Btn>
        <Btn label="Back 10 frames" disabled={!ready} onClick={() => step(-10)}>
          <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />
        </Btn>
        <Btn label="Back 1 frame" disabled={!ready} onClick={() => step(-1)}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </Btn>
        <Btn label={playing ? 'Pause' : 'Play'} disabled={!ready} onClick={toggle}>
          {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
        </Btn>
        <Btn label="Forward 1 frame" disabled={!ready} onClick={() => step(1)}>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Btn>
        <Btn label="Forward 10 frames" disabled={!ready} onClick={() => step(10)}>
          <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
        </Btn>
        <Btn label="Jump to last frame" disabled={!ready} onClick={() => step(count)}>
          <SkipForward className="h-3.5 w-3.5" aria-hidden />
        </Btn>
        <span className="ml-2 font-mono text-xs text-slate-200">
          <output aria-live="off" aria-label="Current frame">
            {frame}
          </output>
          <output aria-live="off" className="mx-2 text-slate-500" aria-label="Timecode">
            {timecode(frame, startFrame, fps)}
          </output>
          {ready && <span className="text-slate-500">{`${startFrame}–${end}`}</span>}
        </span>
      </div>
    </div>
  );
};

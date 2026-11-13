import { ArrowLeftRight, ChevronLeft, ChevronRight, Columns, Layers, Maximize2, Minimize2, Pause, Play, Repeat, RotateCcw, Sparkles, SplitSquareVertical, Zap } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { PRIMARY_FILL, SELECTED } from '@/shared/utils/kitStyles';
import { safeWebUrl } from '@/shared/utils/safeUrl';
import { clampFrame, DEFAULT_FPS, frameCount, frameToTime, timeToFrame, timecode } from './frameTime';

export interface CompareSource {
  /** The version's id, when the sides can be changed from the toolbar. */
  id?: string;
  /** What the side is called: the version's code. */
  label: string;
  src?: string | null;
  poster?: string | null;
  /** What the video is apart from its address (a review movie's id): a renewed link of it keeps the frame (RP-10). */
  sourceId?: string | null;
}
/** A version the toolbar offers for side A or B. */
export interface CompareChoice {
  id: string;
  label: string;
}

export type CompareMode = 'wipe' | 'side' | 'difference' | 'onion' | 'flip';
const MODES: ReadonlyArray<{ id: CompareMode; label: string; icon: React.ReactNode }> = [
  { id: 'wipe', label: 'Wipe / Split', icon: <SplitSquareVertical className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'side', label: 'Side-by-Side', icon: <Columns className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'difference', label: 'Difference', icon: <Sparkles className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'onion', label: 'Onion Skin', icon: <Layers className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'flip', label: 'A/B Flip', icon: <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden /> },
];
const SPEEDS = [0.5, 1, 2] as const;
const GAINS = [1, 2, 4, 8] as const;
const PRESETS = [25, 50, 75] as const;

interface MediaCompareProps {
  a: CompareSource;
  b: CompareSource;
  fps?: number;
  startFrame?: number;
  label: string;
  /** The versions A and B can be switched to. Without them the two names are only shown. */
  choices?: ReadonlyArray<CompareChoice>;
  /** A side was changed from the toolbar (the parent passes the new source in `a` or `b`). */
  onPick?: (side: 'a' | 'b', id: string) => void;
  initialMode?: CompareMode;
  /** The frame being shown, as it changes. */
  onFrameChange?: (frame: number) => void;
  className?: string;
}

const Tool: React.FC<{ label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }> = ({ label, onClick, disabled, pressed, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
    className={cn('rounded-lg border p-1.5 transition-colors disabled:opacity-40', pressed ? SELECTED : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')}
  >
    {children}
  </button>
);

const Corner: React.FC<{ side: 'a' | 'b'; text: string; className?: string }> = ({ side, text, className }) => (
  <div className={cn('pointer-events-none absolute top-3 rounded border px-2.5 py-1 font-mono text-xs font-bold text-white shadow-lg', side === 'a' ? 'left-3 border-blue-400/40 bg-blue-600/90' : 'right-3 border-amber-400/40 bg-amber-600/90', className)}>{text}</div>
);

/**
 * Two videos on one transport, as the reviewer's compare screen: a wipe with a draggable splitter, side by side, the
 * difference (what changed shows light, the rest is black, with a gain), an onion skin blend, or a flip between A and B.
 * Side A drives the clock; B is kept on the same frame. The length is the shorter of the two.
 */
export const MediaCompare: React.FC<MediaCompareProps> = ({ a, b, fps = DEFAULT_FPS, startFrame = 1, label, choices, onPick, initialMode = 'wipe', onFrameChange, className }) => {
  const [swapped, setSwapped] = useState(false);
  const sideA = swapped ? b : a;
  const sideB = swapped ? a : b;
  const urlA = safeWebUrl(sideA.src);
  const urlB = safeWebUrl(sideB.src);
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [mode, setMode] = useState<CompareMode>(initialMode);
  const [wipe, setWipe] = useState(50);
  const [onion, setOnion] = useState(50);
  const [gain, setGain] = useState<number>(1);
  const [showA, setShowA] = useState(true);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [lengths, setLengths] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [frame, setFrame] = useState(startFrame);
  const [playing, setPlaying] = useState(false);
  const count = lengths.a > 0 && lengths.b > 0 ? Math.min(lengths.a, lengths.b) : 0;
  const end = startFrame + Math.max(count - 1, 0);
  const ready = count > 0;

  const frameCallback = useRef(onFrameChange);
  frameCallback.current = onFrameChange;
  useEffect(() => {
    frameCallback.current?.(frame);
  }, [frame]);

  // A new pair of videos starts from the head. Swapping A and B keeps the frame, and so does a new address for the
  // same source (a renewed link): the frame and whether it played are remembered until that side has loaded again.
  const pair = `${a.sourceId || a.src || ''}|${b.sourceId || b.src || ''}`;
  const resume = useRef<{ frame: number; playing: boolean; a: boolean; b: boolean } | null>(null);
  // Compared on the sources as given (`a`, `b`), not as shown: swapping them is not a new address.
  const givenA = safeWebUrl(a.src);
  const givenB = safeWebUrl(b.src);
  const last = useRef({ pair, givenA, givenB });
  // biome-ignore lint/correctness/useExhaustiveDependencies: read the frame, the playing state and the swap at the moment an address changes
  useLayoutEffect(() => {
    const before = last.current;
    last.current = { pair, givenA, givenB };
    if (before.pair !== pair) return;
    const renewed = { a: Boolean(givenA) && before.givenA !== givenA, b: Boolean(givenB) && before.givenB !== givenB };
    // The video in front (`videoA`) shows `b` while swapped.
    const shownA = swapped ? renewed.b : renewed.a;
    const shownB = swapped ? renewed.a : renewed.b;
    if (!shownA && !shownB) return;
    const held = resume.current;
    resume.current = { frame: held?.frame ?? frame, playing: held?.playing ?? playing, a: shownA || Boolean(held?.a), b: shownB || Boolean(held?.b) };
  }, [pair, givenA, givenB]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the pair of sources (and the first frame number) restart the compare
  useEffect(() => {
    resume.current = null;
    setLengths({ a: 0, b: 0 });
    setFrame(startFrame);
    setPlaying(false);
    setSwapped(false);
  }, [pair, startFrame]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the videos are made again when the mode or a side changes
  useEffect(() => {
    for (const el of [videoA.current, videoB.current]) if (el) el.playbackRate = speed;
  }, [speed, mode, urlA, urlB]);

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

  const playBoth = useCallback(() => {
    const one = videoA.current;
    const two = videoB.current;
    if (!one || !two) return;
    two.currentTime = one.currentTime;
    void Promise.all([Promise.resolve(one.play()), Promise.resolve(two.play())]).then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, []);

  const pauseBoth = useCallback(() => {
    const one = videoA.current;
    const two = videoB.current;
    if (!one || !two) return;
    one.pause();
    two.pause();
    setPlaying(false);
    // Settle both on a frame boundary, so the number shown and both pictures are the same frame.
    const settled = timeToFrame(one.currentTime, startFrame, fps, count);
    setFrame(settled);
    const time = frameToTime(settled, startFrame, fps);
    one.currentTime = time;
    two.currentTime = time;
  }, [count, fps, startFrame]);

  // At the end of the shorter clip: back to the head and on, or stop on the last frame.
  const atEnd = useCallback(() => {
    if (loop) {
      move(startFrame);
      playBoth();
    } else {
      videoA.current?.pause();
      videoB.current?.pause();
      setPlaying(false);
      move(end);
    }
  }, [end, loop, move, playBoth, startFrame]);

  // While it plays the first video drives the clock, the second is pulled back onto it if it drifts by half a frame.
  useEffect(() => {
    const one = videoA.current;
    const two = videoB.current;
    if (!playing || !one || !two) return;
    let handle = 0;
    const tick = () => {
      if (Math.abs(two.currentTime - one.currentTime) > 0.5 / fps) two.currentTime = one.currentTime;
      if (count > 0 && one.currentTime >= count / fps) {
        // The loop goes on (a stop clears `playing`, which ends this effect and cancels the next frame).
        atEnd();
        handle = requestAnimationFrame(tick);
        return;
      }
      setFrame(timeToFrame(one.currentTime, startFrame, fps, count));
      draw();
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, startFrame, fps, count, draw, atEnd]);

  const toggle = () => {
    const one = videoA.current;
    if (!one || !ready) return;
    if (one.paused) playBoth();
    else pauseBoth();
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
    e.currentTarget.playbackRate = speed;
    // A video made again (the mode changed) goes back to the frame being shown, not to the head. While side A loads a
    // renewed address the frame shown is not its clock, so it goes back to the frame remembered then.
    const back = resume.current;
    e.currentTarget.currentTime = frameToTime(back?.a ? back.frame : frame, startFrame, fps);
    if (back?.[side]) {
      if (back.playing) void Promise.resolve(e.currentTarget.play()).catch(() => setPlaying(false));
      const left = { ...back, [side]: false };
      resume.current = left.a || left.b ? left : null;
      if (side === 'a') setFrame(back.frame);
    }
  };
  const changeMode = (next: CompareMode) => {
    videoA.current?.pause();
    videoB.current?.pause();
    setPlaying(false);
    setMode(next);
  };
  const toggleFullscreen = () => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.()?.catch(() => undefined);
    else void el.requestFullscreen?.()?.catch(() => undefined);
  };
  const setWipeFromPointer = (clientX: number) => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setWipe(Math.round(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100))));
  };

  if (!urlA || !urlB) {
    return <p className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">{`Both versions need a preview to be compared: ${!urlA ? sideA.label : sideB.label} has none linked.`}</p>;
  }

  const layers = mode !== 'side';
  const hidden = (side: 'a' | 'b') => mode === 'difference' || (mode === 'flip' && (side === 'a') !== showA);
  const video = (side: 'a' | 'b', source: CompareSource, url: string) => (
    <video
      ref={side === 'a' ? videoA : videoB}
      src={url}
      poster={safeWebUrl(source.poster)}
      aria-label={`${source.label} video`}
      muted
      playsInline
      preload="metadata"
      className={cn('h-full w-full object-contain', layers && 'absolute inset-0', hidden(side) && 'pointer-events-none opacity-0')}
      style={mode === 'wipe' && side === 'b' ? { clipPath: `inset(0 0 0 ${wipe}%)` } : mode === 'onion' && side === 'a' ? { opacity: onion / 100 } : undefined}
      onLoadedMetadata={onLoaded(side)}
      onSeeked={side === 'a' ? (e) => { setFrame(timeToFrame(e.currentTarget.currentTime, startFrame, fps, count)); draw(); } : () => draw()}
      onEnded={side === 'a' ? atEnd : undefined}
    />
  );

  const progress = ready && end > startFrame ? Math.max(0, Math.min(100, ((frame - startFrame) / (end - startFrame)) * 100)) : 0;
  const select = (side: 'a' | 'b', source: CompareSource) => {
    const tone = side === 'a' ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400';
    return (
      <div className={cn('flex items-center gap-1.5 rounded-lg border bg-slate-950 px-2.5 py-1 shadow-inner', tone)}>
        <span className="font-mono text-[10px] font-bold">{side === 'a' ? 'A:' : 'B:'}</span>
        {choices && choices.length > 0 && onPick ? (
          <select aria-label={`Version ${side === 'a' ? 'A' : 'B'}`} value={source.id ?? ''} onChange={(e) => onPick(swapped ? (side === 'a' ? 'b' : 'a') : side, e.target.value)} className="cursor-pointer bg-transparent pr-1 font-mono text-xs text-slate-200 focus:outline-none">
            {choices.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-xs font-bold">{source.label}</span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the compare takes the keyboard (space, arrows, T) when it has focus
      tabIndex={0}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t.getAttribute('role') === 'slider') return;
        if (e.key === ' ' && !(t instanceof HTMLButtonElement)) {
          e.preventDefault();
          toggle();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          step(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          step(1);
        } else if ((e.key === 't' || e.key === 'T') && mode === 'flip') {
          setShowA((v) => !v);
        }
      }}
      className={cn('flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl focus:outline-none focus:ring-1 focus:ring-blue-500/40', className)}
    >
      <div className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {select('a', sideA)}
          <Tool label="Swap A and B" onClick={() => setSwapped((v) => !v)}>
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
          </Tool>
          {select('b', sideB)}
        </div>
        <div role="group" aria-label="Compare as" className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1 shadow-sm">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} title={m.id === 'flip' ? "Rapid A/B flicker (press 'T')" : undefined} onClick={() => changeMode(m.id)} className={cn('flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-xs transition-colors', mode === m.id ? SELECTED : 'text-slate-400 hover:text-slate-200')}>
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <Tool label={fullscreen ? 'Exit fullscreen' : 'Fullscreen compare'} onClick={toggleFullscreen}>
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
        </Tool>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-950">
        <div ref={stage} className={cn('relative w-full select-none overflow-hidden bg-black', mode === 'side' ? 'grid grid-cols-2 gap-3 p-3' : 'aspect-video')}>
          {mode === 'side' ? (
            <>
              <figure className="relative aspect-video overflow-hidden rounded-xl border border-blue-500/40 bg-slate-900 shadow-lg">
                {video('a', sideA, urlA)}
                <figcaption className="absolute left-3 top-3 rounded bg-blue-600/90 px-2.5 py-1 font-mono text-xs font-bold text-white shadow">{`A: ${sideA.label}`}</figcaption>
              </figure>
              <figure className="relative aspect-video overflow-hidden rounded-xl border border-amber-500/40 bg-slate-900 shadow-lg">
                {video('b', sideB, urlB)}
                <figcaption className="absolute right-3 top-3 rounded bg-amber-600/90 px-2.5 py-1 font-mono text-xs font-bold text-white shadow">{`B: ${sideB.label}`}</figcaption>
              </figure>
            </>
          ) : (
            <>
              {/* Later layers are on top: in a wipe B (clipped to the right of the splitter) lies over A; in an onion skin A (faded) lies over B. */}
              {mode === 'wipe' ? (
                <>
                  {video('a', sideA, urlA)}
                  {video('b', sideB, urlB)}
                </>
              ) : (
                <>
                  {video('b', sideB, urlB)}
                  {video('a', sideA, urlA)}
                </>
              )}
              {mode === 'difference' && <canvas ref={canvas} aria-label={`Difference between ${sideA.label} and ${sideB.label}`} className="absolute inset-0 h-full w-full object-contain" style={gain > 1 ? { filter: `brightness(${gain})` } : undefined} />}
              {mode === 'wipe' && (
                <>
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Wipe position"
                    aria-orientation="horizontal"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={wipe}
                    aria-valuetext={`${sideA.label} on the left of ${wipe}%, ${sideB.label} on the right`}
                    onKeyDown={(e) => {
                      const by = e.shiftKey ? 10 : 1;
                      if (e.key === 'ArrowLeft') setWipe((w) => Math.max(0, w - by));
                      else if (e.key === 'ArrowRight') setWipe((w) => Math.min(100, w + by));
                      else return;
                      e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                      dragging.current = true;
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                      setWipeFromPointer(e.clientX);
                    }}
                    onPointerMove={(e) => dragging.current && setWipeFromPointer(e.clientX)}
                    onPointerUp={(e) => {
                      dragging.current = false;
                      e.currentTarget.releasePointerCapture?.(e.pointerId);
                    }}
                    className="absolute inset-y-0 z-30 flex w-1 -translate-x-1/2 cursor-ew-resize items-center justify-center bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    style={{ left: `${wipe}%`, touchAction: 'none' }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-slate-900/95 text-white shadow-2xl transition-transform hover:scale-110 active:scale-95">
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                    </div>
                  </div>
                  <Corner side="a" text={`A: ${sideA.label}`} />
                  <Corner side="b" text={`B: ${sideB.label}`} />
                  <div role="group" aria-label="Split position" className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/90 px-2 py-1 font-mono text-[10px] text-slate-300 shadow-xl">
                    <span className="mr-1 text-slate-500">Split:</span>
                    {PRESETS.map((p) => (
                      <button key={p} type="button" aria-pressed={wipe === p} onClick={() => setWipe(p)} className={cn('rounded px-1.5 py-0.5 hover:bg-slate-800', wipe === p && 'font-bold text-blue-400')}>
                        {p === 50 ? '50% (Center)' : `${p}%`}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {mode === 'difference' && (
                <>
                  <div className="pointer-events-none absolute left-3 top-3 rounded border border-purple-400/40 bg-purple-600/90 px-3 py-1 font-mono text-xs font-bold text-white shadow-lg">Difference map (black = identical pixels)</div>
                  <div role="group" aria-label="Difference gain" className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 font-mono text-xs text-slate-300">
                    <span className="text-slate-400">Diff gain:</span>
                    {GAINS.map((g) => (
                      <button key={g} type="button" aria-pressed={gain === g} onClick={() => setGain(g)} className={cn('rounded px-1.5 py-0.5', gain === g ? 'bg-purple-600 font-bold text-white' : 'hover:bg-slate-800')}>
                        {`${g}x`}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {mode === 'onion' && <div className="pointer-events-none absolute left-3 top-3 rounded border border-indigo-400/40 bg-indigo-600/90 px-3 py-1 font-mono text-xs font-bold text-white shadow-lg">{`Onion blend: ${onion}% A / ${100 - onion}% B`}</div>}
              {mode === 'flip' && (
                <>
                  <Corner side={showA ? 'a' : 'b'} text={`Viewing ${showA ? 'A' : 'B'}: ${showA ? sideA.label : sideB.label}`} className="left-3 right-auto" />
                  <div role="group" aria-label="Flip between" className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1.5 shadow-2xl">
                    <button type="button" aria-pressed={showA} onClick={() => setShowA(true)} className={cn('rounded-full px-3 py-1 font-mono text-xs font-bold', showA ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}>
                      Show A
                    </button>
                    <button type="button" aria-pressed={!showA} onClick={() => setShowA(false)} className={cn('rounded-full px-3 py-1 font-mono text-xs font-bold', !showA ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200')}>
                      Show B
                    </button>
                    <span className="border-l border-slate-700 pl-1 font-mono text-[10px] text-slate-400">(press T to flip)</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {mode === 'onion' && (
        <div className="flex items-center justify-center border-t border-slate-800 bg-slate-900/95 px-4 py-2">
          <div className="flex w-full max-w-lg items-center gap-3">
            <span className="whitespace-nowrap font-mono text-xs font-bold text-amber-400">100% B</span>
            <input type="range" aria-label="Onion blend" min={0} max={100} value={onion} onChange={(e) => setOnion(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-blue-500" />
            <span className="whitespace-nowrap font-mono text-xs font-bold text-blue-400">100% A</span>
          </div>
        </div>
      )}

      <div className="z-20 space-y-2.5 border-t border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="w-12 select-none text-right font-mono text-[10px] text-slate-400">{startFrame}</span>
          <div className="group relative flex h-6 flex-1 items-center">
            <div className="absolute inset-x-0 h-2 overflow-hidden rounded-lg border border-slate-700/50 bg-slate-800">
              <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-amber-500 shadow-sm" style={{ width: `${progress}%` }} />
            </div>
            <input type="range" aria-label="Scrub" min={startFrame} max={Math.max(end, startFrame)} value={frame} disabled={!ready} onChange={(e) => step(Number(e.target.value) - frame)} className="relative z-10 h-4 w-full cursor-pointer opacity-0" />
            <div aria-hidden className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-indigo-500 bg-white shadow-md transition-transform group-hover:scale-125" style={{ left: `calc(${progress}% - 8px)` }} />
          </div>
          <span className="w-12 select-none font-mono text-[10px] text-slate-400">{ready ? end : ''}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-200">
              <span className="mr-1 text-slate-500">Frame:</span>
              <output aria-live="off" aria-label="Current frame" className="font-bold text-blue-400">
                {frame}
              </output>
              {ready && (
                <>
                  <span className="mx-1 text-slate-600">/</span>
                  <span className="text-slate-400">{end}</span>
                </>
              )}
              <output aria-live="off" aria-label="Timecode" className="ml-3 text-slate-500">
                {timecode(frame, startFrame, fps)}
              </output>
            </div>
            <span className="rounded-md border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">{`${fps} FPS lock`}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Tool label="Jump to first frame" disabled={!ready} onClick={() => step(-count)}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            </Tool>
            <Tool label="Back 1 frame" disabled={!ready} onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Tool>
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (space)' : 'Play both (space)'} disabled={!ready} onClick={toggle} className={cn('flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-bold text-white shadow-md transition-colors disabled:opacity-40', playing ? 'bg-amber-600 hover:bg-amber-500' : PRIMARY_FILL)}>
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />}
              <span className="font-mono text-xs" aria-hidden>
                {playing ? 'Pause' : 'Play'}
              </span>
            </button>
            <Tool label="Forward 1 frame" disabled={!ready} onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Tool>
            <Tool label={loop ? 'Loop on' : 'Loop off'} pressed={loop} onClick={() => setLoop((v) => !v)}>
              <Repeat className="h-3.5 w-3.5" aria-hidden />
            </Tool>
          </div>

          <div role="group" aria-label="Playback speed" className="flex items-center gap-1">
            <span className="mr-1 font-mono text-[10px] text-slate-500">Speed:</span>
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={cn('rounded px-2 py-0.5 font-mono text-[11px] transition-colors', speed === s ? SELECTED : 'bg-slate-800 text-slate-400 hover:text-slate-200')}>
                {`${s}x`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

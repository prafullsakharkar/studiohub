import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Maximize, Pause, Play, Repeat, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { cn } from '@/shared/utils/cn';
import { safeWebUrl } from '@/shared/utils/safeUrl';
import { clampFrame, DEFAULT_FPS, frameCount, frameToTime, IMAGE_EXTENSION, timeToFrame, timecode } from './frameTime';

export interface PlayerMarker {
  frame: number;
  label: string;
  tone?: 'comment' | 'annotation' | 'resolved';
}

export interface MediaPlayerHandle {
  seekToFrame: (frame: number) => void;
  getFrame: () => number;
  pause: () => void;
}

interface MediaPlayerProps {
  /** The video (or a still image) to show. Only an http(s) address is used. */
  src?: string | null;
  /** The picture shown before playing, and the picture when there is no video. */
  poster?: string | null;
  /** The accessible name of the player: usually the version's code. */
  label: string;
  fps?: number;
  /** The number of the first frame (a shot often starts at 1001). */
  startFrame?: number;
  /** Where feedback sits on the timeline; a marker seeks to its frame. */
  markers?: ReadonlyArray<PlayerMarker>;
  onFrameChange?: (frame: number) => void;
  /** Laid over the picture (a drawing layer); it covers the same 16:9 box as the video. */
  overlay?: React.ReactNode;
  className?: string;
}

const SPEEDS = [0.25, 0.5, 1, 2] as const;
const MARKER_TONE: Record<NonNullable<PlayerMarker['tone']>, string> = { comment: 'bg-amber-400', annotation: 'bg-cyan-400', resolved: 'bg-slate-500' };

const Control: React.FC<{ label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }> = ({ label, onClick, disabled, pressed, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
    className={cn('rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white disabled:opacity-40', pressed && 'border-cyan-500/60 text-cyan-300')}
  >
    {children}
  </button>
);

/**
 * A review player: the video with frame-accurate stepping, a scrub bar with the feedback marked on it, the frame
 * number and timecode, loop and speed. A video that is only a still image (or has no video) shows the picture and
 * no transport. Keys, with the player focused: Space plays, Left and Right step a frame (Shift: ten), Home and End
 * go to the ends, L loops, M mutes, F goes full screen.
 */
export const MediaPlayer = forwardRef<MediaPlayerHandle, MediaPlayerProps>(function MediaPlayer({ src, poster, label, fps = DEFAULT_FPS, startFrame = 1, markers = [], onFrameChange, overlay, className }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const url = safeWebUrl(src);
  const still = !url || IMAGE_EXTENSION.test(url);
  const picture = safeWebUrl(poster) ?? (url && IMAGE_EXTENSION.test(url) ? url : undefined);
  const [count, setCount] = useState(0);
  const [frame, setFrame] = useState(startFrame);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const [failed, setFailed] = useState(false);
  const end = startFrame + Math.max(count - 1, 0);

  const move = useCallback(
    (next: number) => {
      const target = clampFrame(next, startFrame, count);
      setFrame(target);
      if (video.current) video.current.currentTime = frameToTime(target, startFrame, fps);
    },
    [count, fps, startFrame],
  );
  useImperativeHandle(ref, () => ({ seekToFrame: (target) => move(target), getFrame: () => frame, pause: () => video.current?.pause() }), [move, frame]);

  // A new video starts from its head.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the address (and the first frame number) restart the player
  useEffect(() => {
    setCount(0);
    setFrame(startFrame);
    setPlaying(false);
    setFailed(false);
  }, [url, startFrame]);
  useEffect(() => {
    onFrameChange?.(frame);
  }, [frame, onFrameChange]);

  // While it plays the frame follows the picture. `currentTime` can run behind the frame actually painted, so a browser
  // that reports each presented frame (requestVideoFrameCallback) is read from that; the rest follow the clock.
  useEffect(() => {
    const el = video.current;
    if (!playing || !el) return;
    if (typeof el.requestVideoFrameCallback === 'function') {
      let handle = 0;
      let stopped = false;
      const onFrame: VideoFrameRequestCallback = (_now, meta) => {
        setFrame(timeToFrame(meta.mediaTime, startFrame, fps, count));
        if (!stopped) handle = el.requestVideoFrameCallback(onFrame);
      };
      handle = el.requestVideoFrameCallback(onFrame);
      return () => {
        stopped = true;
        el.cancelVideoFrameCallback(handle);
      };
    }
    let handle = 0;
    const tick = () => {
      setFrame(timeToFrame(el.currentTime, startFrame, fps, count));
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, startFrame, fps, count]);

  const toggle = () => {
    const el = video.current;
    if (!el || count === 0) return;
    if (el.paused) void Promise.resolve(el.play()).catch(() => setPlaying(false));
    else el.pause();
  };
  const step = (n: number) => {
    video.current?.pause();
    move(frame + n);
  };
  const fullscreen = () => void box.current?.requestFullscreen?.();

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (still || (event.target as HTMLElement).closest('input, select, textarea')) return;
    const key = event.key.toLowerCase();
    const jump = event.shiftKey ? 10 : 1;
    const handled = ({
      ' ': toggle,
      arrowleft: () => step(-jump),
      arrowright: () => step(jump),
      home: () => step(-count),
      end: () => step(count),
      l: () => setLoop((on) => !on),
      m: () => setMuted((on) => !on),
      f: fullscreen,
    } as Record<string, (() => void) | undefined>)[key];
    if (handled) {
      event.preventDefault();
      handled();
    }
  };

  const ready = count > 0 && !failed;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a keyboard-driven widget, not a form group
    // biome-ignore lint/a11y/noNoninteractiveTabindex: the player takes the keys (Space, arrows, Home, End) only while it has focus
    <div ref={box} role="group" aria-label={label} tabIndex={0} onKeyDown={onKeyDown} className={cn('space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-2 outline-none focus-visible:ring-1 focus-visible:ring-cyan-500', className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {still ? (
          picture ? (
            <SmartImg src={picture} alt={label} className="h-full w-full object-contain" />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-500">No preview is linked yet.</p>
          )
        ) : (
          <video
            ref={video}
            src={url}
            poster={picture}
            aria-label={`${label} video`}
            className="h-full w-full object-contain"
            preload="metadata"
            playsInline
            loop={loop}
            muted={muted}
            onLoadedMetadata={(e) => {
              setCount(frameCount(e.currentTarget.duration, fps));
              e.currentTarget.playbackRate = rate;
            }}
            onPlay={() => setPlaying(true)}
            onPause={(e) => {
              setPlaying(false);
              // A browser may paint one more frame after a pause, and its clock can trail the picture. Settle on a frame
              // boundary: the player seeks to the clock's frame, so the number shown and the picture are the same frame.
              const el = e.currentTarget;
              if (count > 0 && !el.ended) {
                const settled = timeToFrame(el.currentTime, startFrame, fps, count);
                setFrame(settled);
                el.currentTime = frameToTime(settled, startFrame, fps);
              }
            }}
            onEnded={() => setPlaying(false)}
            onSeeked={(e) => setFrame(timeToFrame(e.currentTarget.currentTime, startFrame, fps, count))}
            onError={() => setFailed(true)}
          />
        )}
        {overlay}
        {failed && <p className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-xs text-rose-300">This video could not be loaded.</p>}
      </div>

      {still ? (
        <p className="px-1 text-[11px] text-slate-500">{url ? 'A still image: there is nothing to play.' : 'Link a preview to the version or media item to play it here.'}</p>
      ) : (
        <>
          <div className="relative px-1 pt-3">
            <input
              type="range"
              aria-label="Scrub"
              min={startFrame}
              max={Math.max(end, startFrame)}
              value={frame}
              disabled={!ready}
              onChange={(e) => {
                video.current?.pause();
                move(Number(e.target.value));
              }}
              className="w-full accent-cyan-400"
            />
            {ready &&
              markers
                .filter((m) => m.frame >= startFrame && m.frame <= end)
                .map((m) => (
                  <button
                    key={`${m.frame}-${m.label}`}
                    type="button"
                    aria-label={`Go to frame ${m.frame}: ${m.label}`}
                    title={`${m.frame}: ${m.label}`}
                    onClick={() => step(m.frame - frame)}
                    className={cn('absolute top-0 h-3 w-1.5 -translate-x-1/2 rounded-sm', MARKER_TONE[m.tone ?? 'comment'])}
                    style={{ left: `${end === startFrame ? 0 : ((m.frame - startFrame) / (end - startFrame)) * 100}%` }}
                  />
                ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Control label="Jump to first frame" disabled={!ready} onClick={() => step(-count)}>
              <SkipBack className="h-3.5 w-3.5" aria-hidden />
            </Control>
            <Control label="Back 10 frames" disabled={!ready} onClick={() => step(-10)}>
              <ChevronsLeft className="h-3.5 w-3.5" aria-hidden />
            </Control>
            <Control label="Back 1 frame" disabled={!ready} onClick={() => step(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </Control>
            <Control label={playing ? 'Pause' : 'Play'} disabled={!ready} onClick={toggle}>
              {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            </Control>
            <Control label="Forward 1 frame" disabled={!ready} onClick={() => step(1)}>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Control>
            <Control label="Forward 10 frames" disabled={!ready} onClick={() => step(10)}>
              <ChevronsRight className="h-3.5 w-3.5" aria-hidden />
            </Control>
            <Control label="Jump to last frame" disabled={!ready} onClick={() => step(count)}>
              <SkipForward className="h-3.5 w-3.5" aria-hidden />
            </Control>
            <span className="ml-2 font-mono text-xs text-slate-200">
              <output aria-live="off" aria-label="Current frame">
                {frame}
              </output>
              <output aria-live="off" className="mx-2 text-slate-500" aria-label="Timecode">
                {timecode(frame, startFrame, fps)}
              </output>
              {ready && <span className="text-slate-500">{`${startFrame}–${end}`}</span>}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <label className="sr-only" htmlFor={`speed-${label}`}>
                Speed
              </label>
              <select
                id={`speed-${label}`}
                aria-label="Speed"
                value={rate}
                disabled={!ready}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setRate(next);
                  if (video.current) video.current.playbackRate = next;
                }}
                className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs text-slate-200"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>{`${s}×`}</option>
                ))}
              </select>
              <Control label="Loop" pressed={loop} disabled={!ready} onClick={() => setLoop((on) => !on)}>
                <Repeat className="h-3.5 w-3.5" aria-hidden />
              </Control>
              <Control label={muted ? 'Unmute' : 'Mute'} pressed={muted} disabled={!ready} onClick={() => setMuted((on) => !on)}>
                {muted ? <VolumeX className="h-3.5 w-3.5" aria-hidden /> : <Volume2 className="h-3.5 w-3.5" aria-hidden />}
              </Control>
              <Control label="Full screen" disabled={!ready} onClick={fullscreen}>
                <Maximize className="h-3.5 w-3.5" aria-hidden />
              </Control>
            </span>
          </div>
        </>
      )}
    </div>
  );
});

/**
 * Frame arithmetic for the media player. A frame has the number a production gives it (a shot often starts at 1001),
 * the video element only knows seconds, and a seek that lands exactly on a frame boundary can show the frame before.
 * So every seek aims at the middle of the frame, and every read floors.
 */
export const DEFAULT_FPS = 24;

/** A usable frame rate: the version's `fps` arrives as a decimal string and may be empty or zero. */
export function toFps(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_FPS;
}

/** How many frames a clip of `duration` seconds holds. */
export const frameCount = (duration: number, fps: number): number => (Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.round(duration * fps)) : 0);

/** The time to seek to for `frame`: the middle of that frame. */
export const frameToTime = (frame: number, startFrame: number, fps: number): number => (frame - startFrame + 0.5) / fps;

/** The frame showing at `time`, kept inside the clip. */
export function timeToFrame(time: number, startFrame: number, fps: number, count: number): number {
  const index = Math.floor(time * fps + 1e-6);
  return startFrame + Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

export const clampFrame = (frame: number, startFrame: number, count: number): number => Math.min(Math.max(Math.round(frame), startFrame), startFrame + Math.max(count - 1, 0));

/** `HH:MM:SS:FF` counted from the first frame (not from the frame number). */
export function timecode(frame: number, startFrame: number, fps: number): string {
  const base = Math.max(1, Math.round(fps));
  const index = Math.max(0, Math.round(frame - startFrame));
  const pad = (n: number) => String(n).padStart(2, '0');
  const seconds = Math.floor(index / base);
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}:${pad(index % base)}`;
}

export const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|avif|svg)(?:[?#].*)?$/i;

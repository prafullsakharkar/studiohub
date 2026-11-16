/**
 * The frames of an image sequence chosen in the browser (RP-12, C-RP-31): which sequence they are, whether it is
 * whole, and how they are sent in parts. The rules are the server's (it checks every frame again); checking here
 * first gives a quick message before anything is sent.
 */

/** The extensions a sequence may have (C-RP-31). */
export const SEQUENCE_EXTENSIONS = ['exr', 'dpx', 'tif', 'tiff', 'png', 'jpg', 'jpeg'] as const;
/** At most this many frames per request (the server refuses more). */
export const PART_MAX_FILES = 50;
/** A part stays well under the server's upload limit (2 GiB by default) and nginx's. */
export const PART_MAX_BYTES = 1024 * 1024 * 1024;
/** The highest frame number (eight digits). */
const MAX_FRAME_NUMBER = 99_999_999;

const FRAME = /^(.*)[._-]([0-9]{1,8})\.([^.]+)$/s;

export interface Frame {
  number: number;
  file: File;
}

export interface SequencePlan {
  name: string;
  extension: string;
  first: number;
  last: number;
  /** In frame order. */
  frames: Frame[];
  bytes: number;
}

export type PlanResult = { ok: true; plan: SequencePlan } | { ok: false; message: string };

/**
 * The sequence among `files` (a picked folder or several files). Files that are not frames of a sequence format
 * (a `.DS_Store`, a movie, notes) are left out; more than one sequence, a frame number twice, or a gap is refused.
 */
export function planSequence(files: readonly File[]): PlanResult {
  const groups = new Map<string, { name: string; extension: string; frames: Frame[] }>();
  for (const file of files) {
    const match = FRAME.exec(file.name);
    if (!match || file.name.startsWith('.')) continue;
    const [, name, digits, rawExtension] = match;
    const extension = rawExtension.toLowerCase();
    if (!(SEQUENCE_EXTENSIONS as readonly string[]).includes(extension)) continue;
    const number = Number(digits);
    if (number > MAX_FRAME_NUMBER) continue;
    const key = `${name}\u0000${extension}`;
    const group = groups.get(key) ?? { name, extension, frames: [] };
    group.frames.push({ number, file });
    groups.set(key, group);
  }
  if (groups.size === 0) return { ok: false, message: `No frames found. Choose EXR, DPX, TIFF, PNG or JPEG frames named like shot.1001.exr.` };
  if (groups.size > 1) {
    const names = [...groups.values()].map((g) => `${g.name}.####.${g.extension}`).join(', ');
    return { ok: false, message: `These files hold more than one sequence (${names}). Choose one.` };
  }
  const [group] = groups.values();
  const frames = [...group.frames].sort((a, b) => a.number - b.number);
  const repeated = frames.filter((f, i) => i > 0 && frames[i - 1].number === f.number).map((f) => f.number);
  if (repeated.length > 0) return { ok: false, message: `Frame ${repeated[0]} is there twice.` };
  const first = frames[0].number;
  const last = frames[frames.length - 1].number;
  const have = new Set(frames.map((f) => f.number));
  const missing: number[] = [];
  for (let n = first; n <= last && missing.length <= 10; n += 1) if (!have.has(n)) missing.push(n);
  if (missing.length > 0) {
    const count = last - first + 1 - frames.length;
    return { ok: false, message: `${count} ${count === 1 ? 'frame is' : 'frames are'} missing between ${first} and ${last}: ${missing.slice(0, 10).join(', ')}${count > 10 ? '…' : '.'}` };
  }
  return { ok: true, plan: { name: group.name, extension: group.extension, first, last, frames, bytes: frames.reduce((sum, f) => sum + f.file.size, 0) } };
}

/** The frames in parts of at most `PART_MAX_FILES` files and `PART_MAX_BYTES` bytes (a larger frame goes alone). */
export function partsOf(frames: readonly Frame[], maxFiles = PART_MAX_FILES, maxBytes = PART_MAX_BYTES): Frame[][] {
  const parts: Frame[][] = [];
  let part: Frame[] = [];
  let bytes = 0;
  for (const frame of frames) {
    if (part.length > 0 && (part.length >= maxFiles || bytes + frame.file.size > maxBytes)) {
      parts.push(part);
      part = [];
      bytes = 0;
    }
    part.push(frame);
    bytes += frame.file.size;
  }
  if (part.length > 0) parts.push(part);
  return parts;
}

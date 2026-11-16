import { describe, expect, it } from 'vitest';
import { partsOf, planSequence } from '../sequenceFrames';

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);
const frames = (name: string, from: number, to: number, ext = 'exr', pad = 4) => Array.from({ length: to - from + 1 }, (_, i) => file(`${name}.${String(from + i).padStart(pad, '0')}.${ext}`));

describe('planSequence (RP-12, C-RP-31): the same rules as the server', () => {
  it('finds the sequence, its range and the frames in order', () => {
    const picked = [...frames('sh010_comp', 1001, 1004)].reverse();
    const result = planSequence(picked);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan).toMatchObject({ name: 'sh010_comp', extension: 'exr', first: 1001, last: 1004, bytes: 40 });
    expect(result.plan.frames.map((f) => f.number)).toEqual([1001, 1002, 1003, 1004]);
  });

  it('takes _ and - before the number, and reads the extension in lower case', () => {
    const result = planSequence([file('plate_0001.DPX'), file('plate_0002.dpx')]);
    expect(result.ok && result.plan).toMatchObject({ name: 'plate', extension: 'dpx', first: 1, last: 2 });
    expect(planSequence([file('plate-7.png')]).ok).toBe(true);
  });

  it('leaves out files that are not frames: hidden files, movies, notes, names without a number', () => {
    const result = planSequence([...frames('sh010', 1, 3), file('.DS_Store'), file('._sh010.0004.exr'), file('notes.txt'), file('ref.mov'), file('sh010.exr'), file('Thumbs.db')]);
    expect(result.ok && result.plan.frames.length).toBe(3);
  });

  it('refuses a gap and names the missing frames', () => {
    const result = planSequence([file('sh010.1001.exr'), file('sh010.1002.exr'), file('sh010.1005.exr')]);
    expect(result).toEqual({ ok: false, message: '2 frames are missing between 1001 and 1005: 1003, 1004.' });
  });

  it('a single missing frame', () => {
    expect(planSequence([file('a.1.exr'), file('a.3.exr')])).toEqual({ ok: false, message: '1 frame is missing between 1 and 3: 2.' });
  });

  it('a long gap is cut short', () => {
    const result = planSequence([file('a.1.exr'), file('a.100.exr')]);
    expect(!result.ok && result.message).toBe('98 frames are missing between 1 and 100: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11…');
  });

  it('refuses two sequences, or one frame twice', () => {
    const two = planSequence([...frames('sh010_comp', 1, 2), ...frames('sh010_plate', 1, 2)]);
    expect(!two.ok && two.message).toBe('These files hold more than one sequence (sh010_comp.####.exr, sh010_plate.####.exr). Choose one.');
    const mixed = planSequence([file('a.1.exr'), file('a.2.dpx')]);
    expect(mixed.ok).toBe(false);
    const twice = planSequence([file('a.1.exr'), file('a_1.exr'), file('a.2.exr')]);
    expect(twice).toEqual({ ok: false, message: 'Frame 1 is there twice.' });
  });

  it('nothing usable', () => {
    const none = planSequence([file('clip.mov'), file('a.123456789.exr')]);
    expect(!none.ok && none.message).toMatch(/^No frames found/);
  });
});

describe('partsOf: at most 50 frames and about a gigabyte a request', () => {
  const plan = (n: number, size = 10) => Array.from({ length: n }, (_, i) => ({ number: i, file: file(`a.${i}.exr`, size) }));

  it('fifty frames a part', () => {
    expect(partsOf(plan(120)).map((p) => p.length)).toEqual([50, 50, 20]);
    expect(partsOf(plan(50)).map((p) => p.length)).toEqual([50]);
  });

  it('a part closes before it passes the byte limit; a frame larger than the limit goes alone', () => {
    expect(partsOf(plan(5, 40), 50, 100).map((p) => p.length)).toEqual([2, 2, 1]);
    expect(partsOf(plan(2, 300), 50, 100).map((p) => p.length)).toEqual([1, 1]);
  });

  it('keeps the order', () => {
    expect(partsOf(plan(7), 3).flat().map((f) => f.number)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

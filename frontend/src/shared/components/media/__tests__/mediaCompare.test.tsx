import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClock } from '@/test/mediaElement';
import { MediaCompare } from '../MediaCompare';

const A = { id: 'a', label: 'SH0010_V001', src: 'https://cdn.example.com/p/a.mp4' };
const B = { id: 'b', label: 'SH0010_V002', src: 'https://cdn.example.com/p/b.mp4' };

/** Both videos get a clock (3 s and 2.5 s: 72 and 60 frames at 24) and report their length. */
function clock(labels: [string, string] = [A.label, B.label], durations: [number, number] = [3, 2.5]) {
  const videos = [screen.getByLabelText(`${labels[0]} video`), screen.getByLabelText(`${labels[1]} video`)] as HTMLVideoElement[];
  videos.forEach((v, i) => {
    fakeClock(v, durations[i]);
    act(() => {
      fireEvent.loadedMetadata(v);
    });
  });
  return videos as [HTMLVideoElement, HTMLVideoElement];
}
const frame = () => screen.getByLabelText('Current frame').textContent;
const open = (props: Partial<React.ComponentProps<typeof MediaCompare>> = {}) => render(<MediaCompare label="Compare" a={A} b={B} startFrame={1001} fps={24} {...props} />);
const mode = (name: string) => fireEvent.click(within(screen.getByRole('group', { name: 'Compare as' })).getByRole('button', { name }));
const slider = () => screen.getByRole('slider', { name: 'Wipe position' });

beforeEach(() => {
  // jsdom has no canvas: a recorder that notes what is drawn and how it is blended
  const ops: string[] = [];
  const ctx = {
    drawImage: vi.fn(() => ops.push(ctx.globalCompositeOperation)),
    globalCompositeOperation: 'source-over',
  };
  (globalThis as unknown as { __ops: string[] }).__ops = ops;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('media compare: the transport', () => {
  it('takes its length from the shorter video and cannot be driven before both have reported theirs', () => {
    open();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
    clock();
    expect(screen.getByLabelText('Scrub').getAttribute('max')).toBe('1060'); // 60 frames: the 2.5 s video
    expect(screen.getByText('24 FPS lock')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('moves both videos to the same frame, aiming at the middle of it, and stops at the shorter end', () => {
    open();
    const [one, two] = clock();
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1011' } });
    expect(frame()).toBe('1011');
    expect(one.currentTime).toBeCloseTo(10.5 / 24);
    expect(two.currentTime).toBeCloseTo(10.5 / 24);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 1 frame' }));
    expect(frame()).toBe('1012');
    fireEvent.click(screen.getByRole('button', { name: 'Back 1 frame' }));
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1060' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forward 1 frame' }));
    expect(frame()).toBe('1060');
    expect(screen.getByLabelText('Timecode').textContent).toBe('00:00:02:11');
    fireEvent.click(screen.getByRole('button', { name: 'Jump to first frame' }));
    expect(frame()).toBe('1001');
    expect(two.currentTime).toBeCloseTo(0.5 / 24);
  });

  it('plays both together, pulls the second back onto the first if it drifts, and pauses both on one frame', async () => {
    open();
    const [one, two] = clock();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(one.play).toHaveBeenCalled();
    expect(two.play).toHaveBeenCalled();
    one.currentTime = 1.0;
    two.currentTime = 0.4; // half a second behind
    await waitFor(() => expect(two.currentTime).toBe(1.0));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await screen.findByRole('button', { name: 'Play' });
    expect(one.pause).toHaveBeenCalled();
    expect(two.pause).toHaveBeenCalled();
    expect(frame()).toBe('1025'); // 1.0 s at 24 fps is index 24
    expect(one.currentTime).toBeCloseTo(24.5 / 24);
    expect(two.currentTime).toBeCloseTo(24.5 / 24);
  });

  it('at the end of the shorter clip it goes back to the head and plays on when looping, and stops on the last frame when not', async () => {
    open();
    const [one, two] = clock();
    expect(screen.getByRole('button', { name: 'Loop on' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await screen.findByRole('button', { name: 'Pause' });
    one.currentTime = 2.5; // 60 frames at 24: the end of the shorter clip
    await waitFor(() => expect(one.currentTime).toBeCloseTo(0.5 / 24));
    expect(two.currentTime).toBeCloseTo(0.5 / 24);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy(); // still playing

    fireEvent.click(screen.getByRole('button', { name: 'Loop on' }));
    expect(screen.getByRole('button', { name: 'Loop off' }).getAttribute('aria-pressed')).toBe('false');
    one.currentTime = 2.5;
    await screen.findByRole('button', { name: 'Play' });
    expect(frame()).toBe('1060');
  });

  it('plays at half, normal or double speed, on both videos', () => {
    open();
    const [one, two] = clock();
    fireEvent.click(screen.getByRole('button', { name: '2x' }));
    expect(one.playbackRate).toBe(2);
    expect(two.playbackRate).toBe(2);
    expect(screen.getByRole('button', { name: '2x' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '0.5x' }));
    expect(one.playbackRate).toBe(0.5);
  });

  it('answers the keyboard: space plays and pauses, the arrows step a frame', async () => {
    open();
    const [one] = clock();
    const group = screen.getByRole('group', { name: 'Compare' });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(frame()).toBe('1002');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(frame()).toBe('1001');
    fireEvent.keyDown(group, { key: ' ' });
    await screen.findByRole('button', { name: 'Pause' });
    expect(one.play).toHaveBeenCalled();
    fireEvent.keyDown(group, { key: ' ' });
    await screen.findByRole('button', { name: 'Play' });
  });

  it('goes fullscreen from its own button', () => {
    open();
    const group = screen.getByRole('group', { name: 'Compare' });
    const request = vi.fn(() => Promise.resolve());
    (group as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    fireEvent.click(screen.getByRole('button', { name: 'Fullscreen compare' }));
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('media compare: the ways to compare', () => {
  it('starts as a wipe, A on the left of a splitter and B on the right, and the splitter moves with the keys, the presets and the pointer', () => {
    open();
    expect(screen.queryByRole('figure')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Compare as' })).getByRole('button', { name: 'Wipe / Split' }).getAttribute('aria-pressed')).toBe('true');
    expect(slider().getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByText(`A: ${A.label}`)).toBeTruthy();
    expect(screen.getByText(`B: ${B.label}`)).toBeTruthy();

    // B lies over A and is cut away to the left of the splitter
    const videos = Array.from(document.querySelectorAll('video'));
    expect(videos.map((v) => v.getAttribute('aria-label'))).toEqual([`${A.label} video`, `${B.label} video`]);
    fireEvent.click(screen.getByRole('button', { name: '25%' }));
    expect((screen.getByLabelText(`${B.label} video`) as HTMLVideoElement).style.clipPath).toMatch(/^inset\(0(px)? 0(px)? 0(px)? 25%\)$/);
    expect((screen.getByLabelText(`${A.label} video`) as HTMLVideoElement).style.clipPath).toBe('');
    expect(screen.getByRole('button', { name: '25%' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.keyDown(slider(), { key: 'ArrowRight' });
    expect(slider().getAttribute('aria-valuenow')).toBe('26');
    fireEvent.keyDown(slider(), { key: 'ArrowRight', shiftKey: true });
    expect(slider().getAttribute('aria-valuenow')).toBe('36');
    fireEvent.keyDown(slider(), { key: 'ArrowLeft' });
    expect(slider().getAttribute('aria-valuenow')).toBe('35');

    // dragging: the position is where the pointer is across the picture, kept off the very edges
    const stage = (screen.getByLabelText(`${A.label} video`) as HTMLElement).parentElement as HTMLElement;
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 1000, top: 0, right: 1100, bottom: 562, height: 562, x: 100, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(slider(), { clientX: 400, pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('30');
    fireEvent.pointerMove(slider(), { clientX: 700, pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('60');
    fireEvent.pointerUp(slider(), { pointerId: 1 });
    fireEvent.pointerMove(slider(), { clientX: 200, pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('60'); // not dragging any more
    fireEvent.pointerDown(slider(), { clientX: 5000, pointerId: 1 });
    expect(slider().getAttribute('aria-valuenow')).toBe('98');
  });

  it('shows the two side by side with their names', () => {
    open();
    mode('Side-by-Side');
    expect(screen.getByText(`A: ${A.label}`, { selector: 'figcaption' })).toBeTruthy();
    expect(screen.getByText(`B: ${B.label}`, { selector: 'figcaption' })).toBeTruthy();
    expect(screen.queryByRole('slider', { name: 'Wipe position' })).toBeNull();
  });

  it('goes back to the frame being shown, not the head, when the mode changes and the videos are made again', () => {
    open();
    clock();
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1011' } });
    expect(frame()).toBe('1011');
    mode('Side-by-Side');
    const [one, two] = clock(); // the new elements report their length
    expect(frame()).toBe('1011');
    expect(one.currentTime).toBeCloseTo(10.5 / 24);
    expect(two.currentTime).toBeCloseTo(10.5 / 24);
  });

  it('draws the difference: the first picture, then the second blended as a difference, with a gain to show faint changes', () => {
    open();
    const ops = (globalThis as unknown as { __ops: string[] }).__ops;
    mode('Difference');
    const [one, two] = clock();
    for (const v of [one, two]) Object.defineProperty(v, 'videoWidth', { configurable: true, get: () => 640 });
    const canvas = screen.getByLabelText(`Difference between ${A.label} and ${B.label}`);
    expect(one.className).toContain('opacity-0'); // the videos stay in the page to be read, but only the blend is seen
    expect(screen.getByText(/black = identical pixels/)).toBeTruthy();
    ops.length = 0;
    act(() => {
      fireEvent.seeked(two);
    });
    expect(ops).toEqual(['source-over', 'difference']);

    expect((canvas as HTMLElement).style.filter).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '4x' }));
    expect((canvas as HTMLElement).style.filter).toBe('brightness(4)');
    expect(screen.getByRole('button', { name: '4x' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('blends A over B in an onion skin, by the slider', () => {
    open();
    mode('Onion Skin');
    expect(screen.getByText('Onion blend: 50% A / 50% B')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Onion blend'), { target: { value: '30' } });
    expect(screen.getByText('Onion blend: 30% A / 70% B')).toBeTruthy();
    expect((screen.getByLabelText(`${A.label} video`) as HTMLVideoElement).style.opacity).toBe('0.3');
    // A is the later layer, so it lies over B
    expect(Array.from(document.querySelectorAll('video')).map((v) => v.getAttribute('aria-label'))).toEqual([`${B.label} video`, `${A.label} video`]);
  });

  it('flips between A and B, by the buttons and by the T key, keeping both on the same frame', () => {
    open();
    mode('A/B Flip');
    const a = () => screen.getByLabelText(`${A.label} video`) as HTMLVideoElement;
    const b = () => screen.getByLabelText(`${B.label} video`) as HTMLVideoElement;
    expect(screen.getByText(`Viewing A: ${A.label}`)).toBeTruthy();
    expect(b().className).toContain('opacity-0');
    expect(a().className).not.toContain('opacity-0');
    fireEvent.keyDown(screen.getByRole('group', { name: 'Compare' }), { key: 't' });
    expect(screen.getByText(`Viewing B: ${B.label}`)).toBeTruthy();
    expect(a().className).toContain('opacity-0');
    expect(b().className).not.toContain('opacity-0');
    expect(screen.getByRole('button', { name: 'Show B' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Show A' }));
    expect(screen.getByText(`Viewing A: ${A.label}`)).toBeTruthy();
  });

  it('T does nothing outside the flip', () => {
    open();
    fireEvent.keyDown(screen.getByRole('group', { name: 'Compare' }), { key: 't' });
    mode('A/B Flip');
    expect(screen.getByText(`Viewing A: ${A.label}`)).toBeTruthy();
  });
});

describe('media compare: the two sides', () => {
  const choices = [A, B, { id: 'c', label: 'SH0010_V003' }].map((v) => ({ id: v.id, label: v.label }));

  it('offers the versions on each side and says which side was changed', () => {
    const onPick = vi.fn();
    open({ choices, onPick });
    const one = screen.getByLabelText('Version A') as HTMLSelectElement;
    const two = screen.getByLabelText('Version B') as HTMLSelectElement;
    expect(one.value).toBe('a');
    expect(two.value).toBe('b');
    fireEvent.change(two, { target: { value: 'c' } });
    expect(onPick).toHaveBeenLastCalledWith('b', 'c');
    fireEvent.change(one, { target: { value: 'c' } });
    expect(onPick).toHaveBeenLastCalledWith('a', 'c');
  });

  it('swaps A and B, keeping the frame, and a change on the swapped A is reported for the side it came from', () => {
    const onPick = vi.fn();
    open({ choices, onPick });
    clock();
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1011' } });
    fireEvent.click(screen.getByRole('button', { name: 'Swap A and B' }));
    expect(screen.getByText(`A: ${B.label}`)).toBeTruthy();
    expect(screen.getByText(`B: ${A.label}`)).toBeTruthy();
    expect((screen.getByLabelText('Version A') as HTMLSelectElement).value).toBe('b');
    expect(frame()).toBe('1011');
    fireEvent.change(screen.getByLabelText('Version A'), { target: { value: 'c' } });
    expect(onPick).toHaveBeenLastCalledWith('b', 'c'); // the screen's A is the caller's B now
    fireEvent.click(screen.getByRole('button', { name: 'Swap A and B' }));
    expect(screen.getByText(`A: ${A.label}`)).toBeTruthy();
  });

  it('only names the two when there is nothing to choose from', () => {
    open();
    expect(screen.queryByLabelText('Version A')).toBeNull();
    expect(screen.getByText(A.label, { selector: 'span' })).toBeTruthy();
  });

  it('reports the frame being shown', () => {
    const seen: number[] = [];
    open({ onFrameChange: (f) => seen.push(f) });
    clock();
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1020' } });
    expect(seen[seen.length - 1]).toBe(1020);
  });

  it('says which side has no preview, and refuses an address that is not a web address', () => {
    render(<MediaCompare label="Compare" a={A} b={{ label: 'SH0010_V002', src: '' }} />);
    expect(screen.getByText(/SH0010_V002 has none linked/)).toBeTruthy();
    cleanup();
    render(<MediaCompare label="Compare" a={{ label: 'X', src: 'javascript:alert(1)' }} b={B} />);
    expect(screen.getByText(/X has none linked/)).toBeTruthy();
    expect(document.querySelector('video')).toBeNull();
  });
});

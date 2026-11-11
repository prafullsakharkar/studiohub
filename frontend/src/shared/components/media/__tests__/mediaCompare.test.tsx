import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClock } from '@/test/mediaElement';
import { MediaCompare } from '../MediaCompare';

const A = { label: 'SH0010_V001', src: 'https://cdn.example.com/p/a.mp4' };
const B = { label: 'SH0010_V002', src: 'https://cdn.example.com/p/b.mp4' };

/** Both videos get a clock (3 s and 2.5 s: 72 and 60 frames at 24) and report their length. */
function clock(durations: [number, number] = [3, 2.5]) {
  const videos = [screen.getByLabelText(`${A.label} video`), screen.getByLabelText(`${B.label} video`)] as HTMLVideoElement[];
  videos.forEach((v, i) => {
    fakeClock(v, durations[i]);
    act(() => {
      fireEvent.loadedMetadata(v);
    });
  });
  return videos as [HTMLVideoElement, HTMLVideoElement];
}
const frame = () => screen.getByLabelText('Current frame').textContent;
const open = () => render(<MediaCompare label="Compare" a={A} b={B} startFrame={1001} fps={24} />);

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

describe('media compare', () => {
  it('takes its length from the shorter video and cannot be driven before both have reported theirs', () => {
    open();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
    clock();
    expect(screen.getByText('1001–1060')).toBeTruthy(); // 60 frames: the 2.5 s video
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('moves both videos to the same frame, aiming at the middle of it, and stops at the shorter end', () => {
    open();
    const [one, two] = clock();
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 frames' }));
    expect(frame()).toBe('1011');
    expect(one.currentTime).toBeCloseTo(10.5 / 24);
    expect(two.currentTime).toBeCloseTo(10.5 / 24);
    fireEvent.click(screen.getByRole('button', { name: 'Jump to last frame' }));
    expect(frame()).toBe('1060');
    fireEvent.click(screen.getByRole('button', { name: 'Forward 1 frame' }));
    expect(frame()).toBe('1060');
    fireEvent.change(screen.getByLabelText('Scrub'), { target: { value: '1030' } });
    expect(frame()).toBe('1030');
    expect(two.currentTime).toBeCloseTo(29.5 / 24);
    expect(screen.getByLabelText('Timecode').textContent).toBe('00:00:01:05');
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

  it('shows the two side by side with their names, then wipes one over the other', () => {
    open();
    expect(screen.getByText(A.label, { selector: 'figcaption' })).toBeTruthy();
    expect(screen.getByText(B.label, { selector: 'figcaption' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Side by side' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    expect(screen.queryByRole('figure')).toBeNull();
    fireEvent.change(screen.getByLabelText('Wipe position'), { target: { value: '30' } });
    expect((screen.getByLabelText(`${B.label} video`) as HTMLVideoElement).style.clipPath).toMatch(/^inset\(0(px)? 0(px)? 0(px)? 30%\)$/);
    expect((screen.getByLabelText(`${A.label} video`) as HTMLVideoElement).style.clipPath).toBe('');
    expect(screen.getByText(/on the left.*on the right/)).toBeTruthy();
  });

  it('goes back to the frame being shown, not the head, when the mode changes and the videos are made again', () => {
    open();
    clock();
    fireEvent.click(screen.getByRole('button', { name: 'Forward 10 frames' }));
    expect(frame()).toBe('1011');
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    const [one, two] = clock(); // the new elements report their length
    expect(frame()).toBe('1011');
    expect(one.currentTime).toBeCloseTo(10.5 / 24);
    expect(two.currentTime).toBeCloseTo(10.5 / 24);
  });

  it('draws the difference: the first picture, then the second blended as a difference', () => {
    open();
    const ops = (globalThis as unknown as { __ops: string[] }).__ops;
    fireEvent.click(screen.getByRole('button', { name: 'Difference' }));
    const [one, two] = clock();
    for (const v of [one, two]) Object.defineProperty(v, 'videoWidth', { configurable: true, get: () => 640 });
    expect(screen.getByLabelText(`Difference between ${A.label} and ${B.label}`)).toBeTruthy();
    expect(one.className).toContain('opacity-0'); // the videos stay in the page to be read, but only the blend is seen
    ops.length = 0;
    act(() => {
      fireEvent.seeked(two);
    });
    expect(ops).toEqual(['source-over', 'difference']);
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

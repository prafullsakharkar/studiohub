import { vi } from 'vitest';

/**
 * jsdom has no media pipeline. This gives a `<video>` a clock, a paused flag and play / pause that raise the events
 * a browser would, so a player can be driven in a test.
 */
export function fakeClock(el: HTMLVideoElement, duration: number) {
  let time = 0;
  let paused = true;
  Object.defineProperty(el, 'duration', { configurable: true, get: () => duration });
  Object.defineProperty(el, 'currentTime', { configurable: true, get: () => time, set: (v: number) => (time = v) });
  Object.defineProperty(el, 'paused', { configurable: true, get: () => paused });
  el.play = vi.fn(async () => {
    paused = false;
    el.dispatchEvent(new Event('play'));
  });
  el.pause = vi.fn(() => {
    if (paused) return;
    paused = true;
    el.dispatchEvent(new Event('pause'));
  });
}

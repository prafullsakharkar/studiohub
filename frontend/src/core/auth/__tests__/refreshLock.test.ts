import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRefreshLock } from '../refreshLock';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const tracker = () => {
  let running = 0;
  let maxRunning = 0;
  return {
    task: async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 25));
      running -= 1;
    },
    max: () => maxRunning,
  };
};

describe('withRefreshLock', () => {
  it('serializes callers through the localStorage lease when navigator.locks is missing', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    const t = tracker();
    await Promise.all([withRefreshLock(t.task), withRefreshLock(t.task), withRefreshLock(t.task)]);
    expect(t.max()).toBe(1);
    expect(localStorage.getItem('studiohub_refresh_lease')).toBeNull();
  });

  it('uses navigator.locks when available', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    await withRefreshLock(async () => 'ok');
    expect(request).toHaveBeenCalledWith('studiohub-token-refresh', expect.any(Function));
  });

  it('releases the lease when the task throws', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    await expect(withRefreshLock(async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(localStorage.getItem('studiohub_refresh_lease')).toBeNull();
  });
});

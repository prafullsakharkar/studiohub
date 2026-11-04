import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A fetch that never answers; it rejects only when the request's signal is aborted, as the browser does. */
function hangingFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (input: Request) =>
        new Promise((_resolve, reject) => {
          input.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
        }),
    ),
  );
}

async function setup() {
  vi.resetModules();
  const { ApiClient } = await import('../ApiClient');
  const { centralErrorHandler } = await import('@/core/api/error-handler');
  const handled = vi.spyOn(centralErrorHandler, 'handleError');
  return { client: new ApiClient(), handled, centralErrorHandler };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a request the page itself cancelled (a link was clicked, a list was left)', () => {
  it('is not reported as an error: no "timed out" toast, no failure counted', async () => {
    hangingFetch();
    const { client, handled, centralErrorHandler } = await setup();
    const controller = new AbortController();

    const pending = client.get('/api/v1/projects/', { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(handled).not.toHaveBeenCalled();
    expect(centralErrorHandler.getConsecutiveNetworkFailures()).toBe(0);
  });

  it('twice in a row does not raise the Connection Lost banner', async () => {
    hangingFetch();
    const { client, centralErrorHandler } = await setup();
    const seen = vi.fn();
    centralErrorHandler.onNetworkFailure(seen);

    for (let i = 0; i < 2; i++) {
      const controller = new AbortController();
      const pending = client.get('/api/v1/projects/', { signal: controller.signal });
      controller.abort();
      await pending.catch(() => undefined);
    }

    expect(seen).not.toHaveBeenCalled();
  });
});

describe('a request that really timed out', () => {
  it('is still reported as a timeout', async () => {
    vi.useFakeTimers();
    hangingFetch();
    const { client, handled } = await setup();

    const pending = client.get('/api/v1/projects/');
    const settled = pending.catch((error) => error);
    await vi.advanceTimersByTimeAsync(31_000);
    const error = await settled;

    expect(error).toMatchObject({ type: 'TIMEOUT' });
    expect(handled).toHaveBeenCalledTimes(1);
  });
});

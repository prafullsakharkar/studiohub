import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A 404 as the backend answers one (a body with `detail` and `error.code`). */
const notFound = () =>
  new Response(JSON.stringify({ detail: 'No default theme.', error: { code: 'not_found', request_id: 'r-1' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });

async function setup() {
  vi.resetModules();
  const { ApiClient } = await import('../ApiClient');
  const { notify } = await import('@/core/notifications/notify');
  vi.stubGlobal('fetch', vi.fn(async () => notFound()));
  return { client: new ApiClient(), toasts: vi.spyOn(notify, 'fromError') };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a request the caller marks silent', () => {
  it('still rejects with the error, but raises no toast', async () => {
    const { client, toasts } = await setup();
    await expect(client.get('/api/v1/themes/default/', { silent: true })).rejects.toMatchObject({ status: 404 });
    expect(toasts).not.toHaveBeenCalled();
  });

  it('a request that is not marked silent still toasts a 404, as before', async () => {
    const { client, toasts } = await setup();
    await expect(client.get('/api/v1/themes/default/')).rejects.toMatchObject({ status: 404 });
    expect(toasts).toHaveBeenCalledTimes(1);
  });
});

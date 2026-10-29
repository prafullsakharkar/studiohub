import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/fetchMock';

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  ontimeout?: () => void;
  status = 0;
  responseText = '';
  headers: Record<string, string> = {};
  responseHeaders = '';
  sent?: FormData;
  aborted = false;
  open = vi.fn();
  setRequestHeader = (k: string, v: string) => {
    this.headers[k] = v;
  };
  getAllResponseHeaders = () => this.responseHeaders;
  send = (body: FormData) => {
    this.sent = body;
  };
  abort = () => {
    this.aborted = true;
    this.onabort?.();
  };
  constructor() {
    FakeXHR.instances.push(this);
  }
  respond(status: number, body: string, headers = '') {
    this.status = status;
    this.responseText = body;
    this.responseHeaders = headers;
    this.onload?.();
  }
}

const file = new File(['hello'], 'shot.mov', { type: 'video/quicktime' });

async function setup() {
  vi.resetModules();
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  vi.stubGlobal('BroadcastChannel', undefined);
  const { tokenStorage } = await import('@/core/auth/tokenStorage');
  const upload = await import('../upload');
  return { tokenStorage, ...upload };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('uploadFile', () => {
  it('posts multipart with the bearer token, reports progress and resolves the body', async () => {
    const { tokenStorage, uploadFile } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const progress = vi.fn();

    const promise = uploadFile<{ id: string }>('/api/v1/core/attachments/', file, { fields: { name: 'shot.mov' }, onProgress: progress });
    const xhr = FakeXHR.instances[0];
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    xhr.respond(201, JSON.stringify({ id: 'x' }));

    await expect(promise).resolves.toEqual({ id: 'x' });
    expect(xhr.open).toHaveBeenCalledWith('POST', 'http://api.test/api/v1/core/attachments/');
    expect(xhr.headers.Authorization).toBe('Bearer a1');
    expect(progress).toHaveBeenCalledWith({ loaded: 50, total: 200, percent: 25 });
    expect(xhr.sent?.get('name')).toBe('shot.mov');
    expect((xhr.sent?.get('file') as File).name).toBe('shot.mov');
  });

  it('413 from a proxy (HTML body) becomes PAYLOAD_TOO_LARGE with the generic message', async () => {
    const { uploadFile } = await setup();
    const promise = uploadFile('/api/v1/core/attachments/', file);
    FakeXHR.instances[0].respond(413, '<html><body>413 Request Entity Too Large</body></html>');
    await expect(promise).rejects.toMatchObject({ status: 413, type: 'PAYLOAD_TOO_LARGE' });
  });

  it('429 carries Retry-After', async () => {
    const { uploadFile } = await setup();
    const promise = uploadFile('/api/v1/core/attachments/', file);
    FakeXHR.instances[0].respond(429, JSON.stringify({ detail: 'Request was throttled.' }), 'Content-Type: application/json\r\nRetry-After: 120\r\n');
    await expect(promise).rejects.toMatchObject({ status: 429, retryAfterMs: 120000 });
  });

  it('on 401 refreshes once and retries the upload with the new token', async () => {
    const { tokenStorage, uploadFile } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(() => ({ body: { access: 'a2', refresh: 'r2' } }));

    const promise = uploadFile<{ id: string }>('/api/v1/core/attachments/', file);
    FakeXHR.instances[0].respond(401, JSON.stringify({ detail: 'Given token not valid for any token type', code: 'token_not_valid' }));
    await vi.waitFor(() => expect(FakeXHR.instances).toHaveLength(2));
    FakeXHR.instances[1].respond(201, JSON.stringify({ id: 'ok' }));

    await expect(promise).resolves.toEqual({ id: 'ok' });
    expect(FakeXHR.instances[1].headers.Authorization).toBe('Bearer a2');
  });

  it('cancelling aborts the request and rejects with AbortError (not reported as an error)', async () => {
    const { uploadFile } = await setup();
    const controller = new AbortController();
    const promise = uploadFile('/api/v1/core/attachments/', file, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXHR.instances[0].aborted).toBe(true);
  });

  it('network failure is a NETWORK error', async () => {
    const { uploadFile } = await setup();
    const promise = uploadFile('/api/v1/core/attachments/', file);
    FakeXHR.instances[0].onerror?.();
    await expect(promise).rejects.toMatchObject({ type: 'NETWORK' });
  });
});

describe('checkUploadable', () => {
  it('rejects empty and oversized files locally', async () => {
    const { checkUploadable, MAX_UPLOAD_BYTES } = await setup();
    expect(checkUploadable(new File([], 'a.mov'))).toBe('The file is empty.');
    const big = { size: MAX_UPLOAD_BYTES + 1 } as File;
    expect(checkUploadable(big)).toMatch(/larger than the 512 MB limit/);
    expect(checkUploadable(file)).toBeNull();
  });
});

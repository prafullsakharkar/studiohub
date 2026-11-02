import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { assetBulk, shotBulk, taskBulk } from '../bulkRoutes';

type Captured = { status: number; body: any };
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const path = (url: string) => new URL(url).pathname;

describe.each([
  ['shots', shotBulk, '/api/v1/shots/'],
  ['assets', assetBulk, '/api/v1/assets/'],
  ['tasks', taskBulk, '/api/v1/tasks/'],
])('%s bulk routes', (_name, service, base) => {
  it('posts each request, unchanged, to its own route', async () => {
    const { calls } = mockFetch(() => ({ body: work.shots_bulk_create.body }));
    const payload = { project_id: 'p1', items: [{ code: 'A', episode_id: 'e1' }] } as never;
    await service.checkExistence({ project_id: 'p1', codes: ['A'] });
    await service.bulkCreate(payload);
    await service.bulkUpdate({ project_id: 'p1', ids: ['x'] });
    await service.bulkArchive({ ids: ['x'] });
    await service.bulkRestore({ ids: ['x'] });
    expect(calls.map((c) => [c.method, path(c.url)])).toEqual(
      ['check-existence', 'bulk-create', 'bulk-update', 'bulk-archive', 'bulk-restore'].map((route) => ['POST', `${base}${route}/`])
    );
    expect(calls[1].body).toEqual(payload); // the manager's own request: the id chain of an episodic shot included
    expect(calls[0].body).toEqual({ project_id: 'p1', codes: ['A'] });
    expect(calls[3].body).toEqual({ ids: ['x'] });
  });
});

describe('what the managers read back', () => {
  it('the captured bulk-create answer carries the summary and the per-item results', () => {
    const body = work.shots_bulk_create.body;
    expect(typeof body.processed).toBe('number');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.summary).toBeTruthy();
  });
});

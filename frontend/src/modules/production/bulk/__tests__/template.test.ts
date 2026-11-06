import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { columnsFor, shotBulkSpec, taskBulkSpec } from '../specs';
import { exampleRows, templateParents } from '../template';

/** "Load template" (CR-48): the parents an example takes, and the current rows of an update. Captured answers only. */
type Captured = { status: number; body: unknown };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const shots = loadSample<Record<string, Captured>>('production/shots.json');
const assets = loadSample<Record<string, Captured>>('production/assets.json');
const taskTypes = loadSample<Record<string, Captured>>('masterdata/platform__master-data__task-types.json');
const empty = { status: 200, body: { count: 0, next: null, previous: null, results: [] } };

const path = (c: MockCall) => new URL(c.url).pathname;
/** The catalog lists are bare arrays; the sample keeps them under `items`. */
const bare = (c: Captured): MockReply => ({ status: c.status, body: (c.body as { items: unknown[] }).items });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => tokenStorage.clearTokens());

describe('templateParents', () => {
  it('a shot example takes the first sequence and that sequence\'s episode (D-12)', async () => {
    mockFetch((c) => {
      if (path(c) === '/api/v1/sequences/') return structure.sequences_list_after_bulk;
      if (path(c) === '/api/v1/episodes/') return structure.episodes_list;
      return empty;
    });
    const parents = await templateParents(shotBulkSpec, 'P', true);
    // SQ010 is filed under EP150, not under the project's first episode EP101.
    expect(parents).toMatchObject({ sequence: 'SQ010', sequenceEpisode: 'EP150' });
    const [row] = exampleRows(shotBulkSpec, columnsFor(shotBulkSpec, { episodic: true, mode: 'create' }), parents);
    expect(row).toEqual({ code: 'SQ010_0100', name: 'Shot 0100', description: '', sequence: 'SQ010', episode: 'EP150', frame_in: '1001', frame_out: '1048', handle_frames: '8', status: 'Not Started' });
  });

  it('a standard project asks for no episode and the example has no episode column', async () => {
    const { calls } = mockFetch((c) => (path(c) === '/api/v1/sequences/' ? structure.sequences_list_after_bulk : empty));
    const parents = await templateParents(shotBulkSpec, 'P', false);
    expect(calls.some((c) => path(c) === '/api/v1/episodes/')).toBe(false);
    expect(Object.keys(exampleRows(shotBulkSpec, columnsFor(shotBulkSpec, { episodic: false, mode: 'create' }), parents)[0])).not.toContain('episode');
  });

  it('a task example is about the first shot, else the first asset; the task type comes from the catalog', async () => {
    mockFetch((c) => {
      if (path(c) === '/api/v1/assets/') return assets.list_admin;
      if (path(c) === '/api/v1/platform/master-data/task-types') return bare(taskTypes.list_admin);
      return empty;
    });
    const [row] = exampleRows(taskBulkSpec, columnsFor(taskBulkSpec, { episodic: false, mode: 'create' }), await templateParents(taskBulkSpec, 'P', false));
    expect(row).toMatchObject({ code: 'code-0010', entity_type: 'Asset', entity: 'AST000', task_type: 'code-0' });
  });

  it('a lookup the caller may not make leaves its cells empty instead of failing', async () => {
    mockFetch((c) => {
      if (path(c) === '/api/v1/shots/') return shots.list_admin;
      if (path(c) === '/api/v1/platform/master-data/task-types') return taskTypes.create_norole_403;
      return empty;
    });
    const [row] = exampleRows(taskBulkSpec, columnsFor(taskBulkSpec, { episodic: false, mode: 'create' }), await templateParents(taskBulkSpec, 'P', false));
    expect(row).toMatchObject({ code: 'TASK010', entity_type: 'Shot', entity: 'SHOT000', task_type: '' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SequenceRepository } from '../repositories/SequenceRepository';
import { IApiClient } from '@/api/client/types';
import { Sequence, BulkResponse, ExistenceResponse } from '@/types/sequences';

function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
  };
}

const seqFixture: Sequence = {
  id: 'seq-1',
  uuid: 'uuid-1',
  project_id: 'proj-1',
  project_code: 'NK',
  project_name: 'Nova Killer',
  code: 'NK_010',
  name: 'Opening',
  status: 'Not Started',
  description: '',
  frame_in: 1001,
  frame_out: 1100,
  department: 'Layout',
  tags: [],
  metadata: {},
  shots_count: 0,
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('SequenceRepository', () => {
  let client: ReturnType<typeof createMockClient>;
  let repo: SequenceRepository;

  beforeEach(() => {
    client = createMockClient();
    repo = new SequenceRepository(client as unknown as IApiClient);
  });

  it('hits bulk-create with { items } and returns the envelope', async () => {
    const envelope: BulkResponse = {
      processed: 1,
      successful: 1,
      failed: 0,
      results: [{ index: 0, status: 'created', id: 'seq-1', entity: seqFixture }],
    };
    client.post.mockResolvedValue(envelope);

    const result = await repo.bulkCreate([{ project_id: 'proj-1', code: 'NK_010' }]);

    expect(client.post).toHaveBeenCalledWith('/api/v1/sequences/bulk-create/', {
      items: [{ project_id: 'proj-1', code: 'NK_010' }],
    });
    expect(result.successful).toBe(1);
    expect(result.results[0].status).toBe('created');
  });

  it('hits bulk-update with PATCH { items }', async () => {
    const envelope: BulkResponse = {
      processed: 1,
      successful: 1,
      failed: 0,
      results: [{ index: 0, status: 'updated', id: 'seq-1', entity: seqFixture }],
    };
    client.patch.mockResolvedValue(envelope);

    await repo.bulkUpdate([{ id: 'seq-1', status: 'Approved' }]);

    expect(client.patch).toHaveBeenCalledWith('/api/v1/sequences/bulk-update/', {
      items: [{ id: 'seq-1', status: 'Approved' }],
    });
  });

  it('hits bulk-archive with { ids }', async () => {
    const envelope: BulkResponse = {
      processed: 1,
      successful: 1,
      failed: 0,
      results: [{ index: 0, status: 'archived', id: 'seq-1' }],
    };
    client.post.mockResolvedValue(envelope);

    await repo.bulkArchive(['seq-1']);

    expect(client.post).toHaveBeenCalledWith('/api/v1/sequences/bulk-archive/', {
      ids: ['seq-1'],
    });
  });

  it('hits bulk-restore with { ids }', async () => {
    const envelope: BulkResponse = {
      processed: 1,
      successful: 1,
      failed: 0,
      results: [{ index: 0, status: 'restored', id: 'seq-1' }],
    };
    client.post.mockResolvedValue(envelope);

    await repo.bulkRestore(['seq-1']);

    expect(client.post).toHaveBeenCalledWith('/api/v1/sequences/bulk-restore/', {
      ids: ['seq-1'],
    });
  });

  it('hits existence-check with { items }', async () => {
    const response: ExistenceResponse = {
      results: [{ index: 0, status: 'new' }],
    };
    client.post.mockResolvedValue(response);

    await repo.existenceCheck([{ project_id: 'proj-1', code: 'NK_010' }]);

    expect(client.post).toHaveBeenCalledWith('/api/v1/sequences/existence-check/', {
      items: [{ project_id: 'proj-1', code: 'NK_010' }],
    });
  });

  it('hits archived endpoint via GET', async () => {
    client.get.mockResolvedValue({ count: 1, next: null, previous: null, results: [seqFixture] });

    await repo.getArchived({ project_id: 'proj-1' });

    expect(client.get).toHaveBeenCalledWith('/api/v1/sequences/archived/', {
      params: { project_id: 'proj-1' },
    });
  });

  it('delegates standard CRUD to the base repository endpoints', async () => {
    client.get.mockResolvedValue({ count: 1, next: null, previous: null, results: [seqFixture] });

    const page = await repo.findAll({ search: 'NK' });

    expect(client.get).toHaveBeenCalledWith('/api/v1/sequences/', {
      params: { search: 'NK' },
    });
    expect(page.results[0].code).toBe('NK_010');
  });

  it('delegates findById to the detail endpoint', async () => {
    client.get.mockResolvedValue(seqFixture);

    await repo.findById('seq-1');

    expect(client.get).toHaveBeenCalledWith('/api/v1/sequences/seq-1/');
  });
});

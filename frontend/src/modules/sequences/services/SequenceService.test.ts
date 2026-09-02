import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SequenceService } from '../services/SequenceService';
import { ISequenceRepository } from '../repositories/ISequenceRepository';
import { Sequence, BulkResponse } from '@/types/sequences';

function createMockRepo() {
  return {
    findAll: vi.fn(),
    getArchived: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
    search: vi.fn(),
    bulkCreate: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkArchive: vi.fn(),
    bulkRestore: vi.fn(),
    existenceCheck: vi.fn(),
  };
}

const seq: Sequence = {
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
  department: '',
  tags: [],
  metadata: {},
  shots_count: 0,
  is_deleted: false,
  deleted_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('SequenceService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: SequenceService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new SequenceService(repo as unknown as ISequenceRepository);
  });

  it('returns a paginated list from the repository', async () => {
    repo.findAll.mockResolvedValue({ count: 1, next: null, previous: null, results: [seq] });
    const data = await service.getSequences({ page: 1 });
    expect(data.count).toBe(1);
    expect(repo.findAll).toHaveBeenCalledWith({ page: 1 });
  });

  it('creates a sequence via bulk-create through the repository', async () => {
    const envelope: BulkResponse = {
      processed: 1,
      successful: 1,
      failed: 0,
      results: [{ index: 0, status: 'created', id: 'seq-1', entity: seq }],
    };
    repo.bulkCreate.mockResolvedValue(envelope);
    const result = await service.bulkCreate([{ project_id: 'proj-1', code: 'NK_010' }]);
    expect(result.successful).toBe(1);
    expect(repo.bulkCreate).toHaveBeenCalledWith([{ project_id: 'proj-1', code: 'NK_010' }]);
  });

  it('archives sequences by id through the repository', async () => {
    const envelope: BulkResponse = {
      processed: 1,
      successful: 1,
      failed: 0,
      results: [{ index: 0, status: 'archived', id: 'seq-1' }],
    };
    repo.bulkArchive.mockResolvedValue(envelope);
    const result = await service.bulkArchive(['seq-1']);
    expect(result.results[0].status).toBe('archived');
    expect(repo.bulkArchive).toHaveBeenCalledWith(['seq-1']);
  });

  it('checks existence through the repository', async () => {
    repo.existenceCheck.mockResolvedValue({ results: [{ index: 0, status: 'new' }] });
    const result = await service.existenceCheck([{ project_id: 'proj-1', code: 'NK_010' }]);
    expect(result.results[0].status).toBe('new');
  });
});

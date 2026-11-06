import { describe, expect, it } from 'vitest';
import type { BulkBatchResponse } from '@/api/production/bulkRoutes';
import { loadSample } from '@/test/samples';
import { readRows, rowReports, toCreateItems, toUpdateItems } from '../rows';
import { assetBulkSpec, columnsFor, sequenceBulkSpec, shotBulkSpec, taskBulkSpec } from '../specs';

type Captured = { status: number; body: any; request: { body: any } };
const flow = loadSample<Record<string, Captured>>('production/_bulk_cr48_flow.json');
const sequences = (episodic: boolean, mode: 'create' | 'update' = 'create') => columnsFor(sequenceBulkSpec, { episodic, mode });

describe('columns per project', () => {
  it('the episode column only on an episodic project', () => {
    expect(sequences(false).map((c) => c.header)).not.toContain('episode');
    expect(sequences(true).map((c) => c.header)).toContain('episode');
    expect(columnsFor(shotBulkSpec, { episodic: true, mode: 'create' }).map((c) => c.header)).toContain('episode');
  });

  it('create-only columns are left out of an update', () => {
    const update = columnsFor(taskBulkSpec, { episodic: false, mode: 'update' }).map((c) => c.key);
    expect(update).not.toContain('entity_type');
    expect(update).not.toContain('entity_id');
    expect(columnsFor(taskBulkSpec, { episodic: false, mode: 'create' }).map((c) => c.key)).toContain('entity_id');
  });
});

describe('readRows', () => {
  it('maps headers by CSV name or API key, any case', () => {
    const read = readRows('Code,episode_id,FRAME_IN\nsq010,ep101,1001\n', sequences(true));
    expect(read.problems).toEqual([]);
    expect(read.rows).toEqual([{ code: 'sq010', episode: 'ep101', frame_in: '1001' }]);
  });

  it('a column given twice (by name and by key) is a problem, not a silent overwrite', () => {
    expect(readRows('code,episode,episode_id\nSQ010,EP101,\n', sequences(true)).problems).toEqual(['The "episode" column is given 2 times.']);
  });

  it('names an unknown column and a missing required one', () => {
    const read = readRows('name,colour\nOpening,red\n', sequences(false));
    expect(read.problems).toEqual([
      'Unknown column "colour". The columns are: code, name, description, frame_in, frame_out, status.',
      'The "code" column is missing.',
    ]);
  });

  it('an episode column is unknown on a standard project', () => {
    expect(readRows('code,episode\nSQ010,EP101', sequences(false)).problems[0]).toMatch(/^Unknown column "episode"/);
  });

  it('refuses more than 500 rows', () => {
    const text = ['code', ...Array.from({ length: 501 }, (_, n) => `SQ${n}`)].join('\n');
    expect(readRows(text, sequences(false)).problems).toEqual(['At most 500 rows at a time; this has 501. Split it into several files.']);
  });

  it('the asset name is required (the backend refuses an asset without one)', () => {
    expect(readRows('code\nHERO', columnsFor(assetBulkSpec, { episodic: false, mode: 'create' })).problems).toEqual(['The "name" column is missing.']);
  });
});

describe('items on the wire', () => {
  const columns = sequences(true);
  const rows = readRows('code,name,episode,frame_in,frame_out\nsq020,Chase,EP101,1001,abc\nSQ030,,,,\n', columns).rows;

  it('create: the code upper case, empty cells left out, numbers as numbers, other text as written', () => {
    expect(toCreateItems(rows, columns)).toEqual([
      { code: 'SQ020', action: 'create', data: { name: 'Chase', episode_id: 'EP101', frame_in: 1001, frame_out: 'abc' } },
      { code: 'SQ030', action: 'create', data: {} },
    ]);
  });

  it('update: the code as the key and only the filled-in fields', () => {
    expect(toUpdateItems(rows, columns)).toEqual([
      { code: 'SQ020', name: 'Chase', episode_id: 'EP101', frame_in: 1001, frame_out: 'abc' },
      { code: 'SQ030' },
    ]);
  });

  it('the captured dry runs were sent in this shape', () => {
    const captured = flow.sequences_create_dry_run_ok.request.body;
    expect(captured.items[0]).toEqual({ code: 'SQ020', action: 'create', data: { name: 'Chase' } });
    expect(flow.sequences_update_dry_run.request.body.items[0]).toEqual({ code: 'SQ010', description: 'Re-cut' });
  });
});

describe('reports from a captured dry run', () => {
  const response = flow.sequences_create_dry_run_errors.body as BulkBatchResponse;
  const columns = sequences(false);

  it('per row: the outcome and the backend reasons with the CSV column', () => {
    expect(rowReports(response, columns)).toEqual([
      { outcome: 'error', status: 'exists', messages: ['code: A record with this code already exists.'] },
      { outcome: 'create', status: 'created', messages: [] },
      { outcome: 'error', status: 'duplicate', messages: ['code: Duplicate code within batch.'] },
      { outcome: 'error', status: 'invalid', messages: ['code: A code cannot contain spaces or slashes.'] },
      { outcome: 'error', status: 'invalid', messages: ['frame_out: Must not be before frame_in.'] },
    ]);
  });

  it('an unknown row names no column: its id is a key', () => {
    const update = flow.sequences_update_dry_run.body as BulkBatchResponse;
    expect(rowReports(update, sequences(false, 'update'))[1]).toEqual({ outcome: 'error', status: 'not_found', messages: ['Sequence not found.'] });
  });
});

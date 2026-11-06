import { describe, expect, it } from 'vitest';
import { mergeBulkResponses } from '../mergeResponses';
import type { BulkOperationResponse } from '../types';

const response = (summary: Record<string, number>, results: Array<{ code: string; success: boolean; actionTaken: string }>): BulkOperationResponse =>
  ({ summary: { total: results.length, ...summary }, results, errors: [], operation_id: `op-${results[0].code}` }) as never;

describe('one result for a run made of a create call and an update call', () => {
  const created = response({ createdCount: 2 }, [
    { code: 'A', success: true, actionTaken: 'created' },
    { code: 'B', success: true, actionTaken: 'created' },
  ]);
  const updated = response({ updatedCount: 1, failedCount: 1 }, [
    { code: 'C', success: true, actionTaken: 'updated' },
    { code: 'D', success: false, actionTaken: 'failed' },
  ]);

  it('adds the counts and keeps every row, numbered in order', () => {
    const merged = mergeBulkResponses(created, updated);
    expect(merged.summary).toMatchObject({ total: 4, createdCount: 2, updatedCount: 1, failedCount: 1, skippedCount: 0 });
    expect(merged.results.map((r) => [r.index, r.code, r.actionTaken])).toEqual([
      [0, 'A', 'created'],
      [1, 'B', 'created'],
      [2, 'C', 'updated'],
      [3, 'D', 'failed'],
    ]);
  });

  it('is a partial success when some rows were stored and some were not', () => {
    expect(mergeBulkResponses(created, updated).partial_success).toBe(true);
    expect(mergeBulkResponses(created, created).partial_success).toBe(false);
  });
});

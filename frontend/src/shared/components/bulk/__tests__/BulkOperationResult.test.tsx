import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BulkOperationResult } from '../BulkOperationResult';
import type { BulkOperationResponse } from '../types';

afterEach(cleanup);

const response = (summary: Record<string, number>, results: BulkOperationResponse['results']): BulkOperationResponse =>
  ({ operation_id: 'op-1', timestamp: '2026-11-06T00:00:00Z', partial_success: false, summary: { total: results.length, ...summary }, results }) as never;

describe('the result of a bulk run', () => {
  it('says how many were created, recovered, updated, skipped and failed', () => {
    render(
      <BulkOperationResult
        entityType="Sequence"
        response={response({ createdCount: 2, recoveredCount: 1, updatedCount: 3, skippedCount: 4, failedCount: 0 }, [{ code: 'A', success: true, actionTaken: 'updated' }])}
        onDone={() => undefined}
      />
    );

    expect(screen.getByText('2 created · 1 recovered · 3 updated · 4 skipped · 0 failed')).toBeTruthy();
  });

  it('a run with no update count (an older answer) shows 0 updated, not "undefined"', () => {
    render(<BulkOperationResult entityType="Shot" response={response({ createdCount: 1, recoveredCount: 0, skippedCount: 0, failedCount: 0 }, [{ code: 'A', success: true, actionTaken: 'created' }])} onDone={() => undefined} />);

    expect(screen.getByText('1 created · 0 recovered · 0 updated · 0 skipped · 0 failed')).toBeTruthy();
  });
});

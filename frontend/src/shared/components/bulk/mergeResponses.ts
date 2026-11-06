import type { BulkOperationResponse, BulkOperationSummary } from './types';

/** Counts of a summary that add up when one run is made of several requests (a create call and an update call). */
const COUNTS = ['total', 'newCount', 'softDeletedCount', 'existingCount', 'duplicateCount', 'invalidCount', 'createdCount', 'recoveredCount', 'skippedCount', 'updatedCount', 'failedCount'] as const;

/** One response for a run that took several requests: summaries added, results in order (re-numbered), errors joined. */
export function mergeBulkResponses<T>(...responses: ReadonlyArray<BulkOperationResponse<T>>): BulkOperationResponse<T> {
  const [first] = responses;
  const summary = Object.fromEntries(COUNTS.map((key) => [key, responses.reduce((sum, r) => sum + (r.summary?.[key] ?? 0), 0)])) as unknown as BulkOperationSummary;
  const results = responses.flatMap((r) => r.results ?? []).map((result, index) => ({ ...result, index }));
  const failed = results.filter((r) => !r.success).length;
  return {
    ...first,
    summary,
    results,
    errors: responses.flatMap((r) => (Array.isArray(r.errors) ? r.errors : [])),
    partial_success: failed > 0 && failed < results.length,
  };
}

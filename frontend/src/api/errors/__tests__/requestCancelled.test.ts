import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../ApiError';
import { isRequestCancelled } from '../errorMapper';
import { queryClient } from '@/providers/QueryProvider';
import { centralErrorHandler } from '@/core/api/error-handler';

const abort = () => new DOMException('The operation was aborted.', 'AbortError');

describe('isRequestCancelled', () => {
  it('is true for an abort, with or without a signal', () => {
    expect(isRequestCancelled(abort())).toBe(true);
    expect(isRequestCancelled(new Error('anything'), AbortSignal.abort())).toBe(true);
  });

  it('is true for an ApiError that wraps an abort', () => {
    expect(isRequestCancelled(new ApiError('x', 504, {}, { type: 'TIMEOUT', originalError: abort() }))).toBe(true);
  });

  it('is false for a real timeout, a network failure, a server error and non-errors', () => {
    const timeout = Object.assign(new Error('Request timed out: GET /x'), { name: 'TimeoutError' });
    expect(isRequestCancelled(timeout)).toBe(false);
    expect(isRequestCancelled(new TypeError('Failed to fetch'))).toBe(false);
    expect(isRequestCancelled(new ApiError('boom', 500))).toBe(false);
    expect(isRequestCancelled(undefined)).toBe(false);
    expect(isRequestCancelled(null, new AbortController().signal)).toBe(false);
  });
});

describe('the query client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('does not report a cancelled query', async () => {
    const handled = vi.spyOn(centralErrorHandler, 'handleError');
    await queryClient.fetchQuery({ queryKey: ['cancelled'], queryFn: () => Promise.reject(abort()), retry: false }).catch(() => undefined);
    expect(handled).not.toHaveBeenCalled();
  });

  it('does not retry a cancelled query', async () => {
    const queryFn = vi.fn(() => Promise.reject(abort()));
    await queryClient.fetchQuery({ queryKey: ['cancelled-retry'], queryFn }).catch(() => undefined);
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('does not report a cancelled mutation', async () => {
    const handled = vi.spyOn(centralErrorHandler, 'handleError');
    await queryClient.getMutationCache().build(queryClient, { mutationFn: () => Promise.reject(abort()) }).execute(undefined).catch(() => undefined);
    expect(handled).not.toHaveBeenCalled();
  });

  it('still reports a query that failed', async () => {
    const handled = vi.spyOn(centralErrorHandler, 'handleError').mockImplementation(() => undefined);
    await queryClient.fetchQuery({ queryKey: ['failed'], queryFn: () => Promise.reject(new ApiError('boom', 500)), retry: false }).catch(() => undefined);
    expect(handled).toHaveBeenCalledTimes(1);
  });
});

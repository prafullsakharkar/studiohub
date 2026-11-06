import type React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

const summary = {
  createdCount: 2, recoveredCount: 1, failedCount: 0,
  updatedCount: 3, archivedCount: 4, restoredCount: 5,
};

function makeService() {
  return {
    checkExistence: vi.fn(async (payload: unknown) => ({ payload, ok: true })),
    bulkCreate: vi.fn(async () => ({ summary, results: [] })),
    bulkUpdate: vi.fn(async () => ({ summary, results: [] })),
    bulkArchive: vi.fn(async () => ({ summary, results: [] })),
    bulkRestore: vi.fn(async () => ({ summary, results: [] })),
  };
}

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const W: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { W, qc };
}

const labels = {
  singular: 'Asset', plural: 'assets', entityType: 'asset',
  bulkId: 'bulk-assets', bulkName: 'Bulk Assets', bulkCode: 'BULK_AST',
};

describe('useBulkEntity', () => {
  it('delegates bulkCreate to the service and invalidates entity + project keys', async () => {
    const service = makeService();
    const { W, qc } = wrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(
      () => useBulkEntity({ service, queryKeyAll: ['assets'], projectQueryKeyAll: ['projects'], labels }),
      { wrapper: W }
    );
    await act(async () => {
      await result.current.bulkCreate({ items: [] } as never);
    });
    expect(service.bulkCreate).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['assets'] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects'] });
    });
  });

  it('emits a labeled success notification on clean bulk create', async () => {
    const service = makeService();
    const { W } = wrapper();
    const { result } = renderHook(
      () => useBulkEntity({ service, queryKeyAll: ['assets'], projectQueryKeyAll: ['projects'], labels }),
      { wrapper: W }
    );
    await act(async () => {
      await result.current.bulkCreate({ items: [] } as never);
    });
    const notes = useNotificationStore.getState().notifications;
    const last = notes[notes.length - 1];
    expect(last.type).toBe('success');
    expect(last.title).toContain('Asset');
  });

  describe('the toasts say "1 asset", not "1 assets"', () => {
    const lastNote = () => {
      return useNotificationStore.getState().notifications[0].message; // the newest comes first
    };
    const run = async (counts: Record<string, number>, call: (hook: ReturnType<typeof useBulkEntity>) => Promise<unknown>) => {
      useNotificationStore.setState({ notifications: [], toasts: [], recentDedupKeys: new Map() });
      const service = makeService();
      const answer = { summary: { ...summary, ...counts }, results: [] };
      for (const op of ['bulkCreate', 'bulkUpdate', 'bulkArchive', 'bulkRestore'] as const) service[op] = vi.fn(async () => answer) as never;
      const { W } = wrapper();
      const { result } = renderHook(() => useBulkEntity({ service, queryKeyAll: ['assets'], projectQueryKeyAll: ['projects'], labels }), { wrapper: W });
      await act(async () => {
        await call(result.current);
      });
      return lastNote();
    };

    it('create', async () => {
      expect(await run({ createdCount: 1, recoveredCount: 0 }, (h) => h.bulkCreate({ items: [] } as never))).toBe('Successfully processed 1 asset (1 created, 0 recovered).');
      expect(await run({ createdCount: 1, recoveredCount: 1 }, (h) => h.bulkCreate({ items: [] } as never))).toBe('Successfully processed 2 assets (1 created, 1 recovered).');
    });
    it('update', async () => {
      expect(await run({ updatedCount: 1 }, (h) => h.bulkUpdate({ items: [] } as never))).toBe('Updated 1 asset successfully.');
      expect(await run({ updatedCount: 3 }, (h) => h.bulkUpdate({ items: [] } as never))).toBe('Updated 3 assets successfully.');
    });
    it('archive and restore', async () => {
      expect(await run({ archivedCount: 1 }, (h) => h.bulkArchive({ ids: [] } as never))).toBe('Archived 1 asset.');
      expect(await run({ restoredCount: 1 }, (h) => h.bulkRestore({ ids: [] } as never))).toBe('Restored 1 asset to active library.');
      expect(await run({ restoredCount: 0 }, (h) => h.bulkRestore({ ids: [] } as never))).toBe('Restored 0 assets to active library.');
    });
  });

  it('exposes the bulk operations contract (flags idle by default)', async () => {
    // isPending is a direct TanStack passthrough (identical pattern to the
    // production twins this hook replaces); pin the contract, not the scheduler.
    const service = makeService();
    const { W } = wrapper();
    const { result } = renderHook(
      () => useBulkEntity({ service, queryKeyAll: ['assets'], projectQueryKeyAll: ['projects'], labels }),
      { wrapper: W }
    );
    expect(Object.keys(result.current).sort()).toEqual(
      ['bulkArchive', 'bulkCreate', 'bulkRestore', 'bulkUpdate', 'checkExistence',
       'isBulkArchiving', 'isBulkCreating', 'isBulkRestoring', 'isBulkUpdating',
       'isCheckingExistence'].sort()
    );
    expect(result.current.isBulkUpdating).toBe(false);
    expect(result.current.isBulkCreating).toBe(false);
  });
});

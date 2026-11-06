import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assetBatch, assetBulk, sequenceBatch, sequenceBulk, shotBatch, shotBulk, taskBatch, taskBulk } from '@/api/production/bulkRoutes';
import { projectsApi } from '@/api/production/structure';
import { assetsApi, shotsApi, tasksApi } from '@/api/production/work';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { columnsFor, sequenceBulkSpec, shotBulkSpec, taskBulkSpec } from '@/modules/production/bulk/specs';
import { toCreateItems } from '@/modules/production/bulk/rows';
import { exampleRows, templateParents } from '@/modules/production/bulk/template';
import { authService } from '@/modules/auth/services/AuthService';
import { freshTotp, live } from './liveBackend';

/**
 * The CR-48 bulk routes the Bulk menu and "Edit fields" post to, against a REAL backend: a dry run stores nothing, an
 * atomic batch with a bad row stores nothing, "skip invalid" stores the others, update by code, the field whitelist, and
 * archive / restore of a bulk-made row. Run on a fresh live_backend.py seed.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
let project = '';

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  project = (await projectsApi.create({ code: `B${uid}`, name: 'Bulk routes', workflow_type: 'standard' })).id;
}, 60000);
afterAll(() => tokenStorage.clearTokens());

const statuses = (response: { results: Array<{ status: string }> }) => response.results.map((r) => r.status);

describe('shots', () => {
  it('a dry run stores nothing; the commit stores; archive and restore', async () => {
    const code = `SB${uid}1`;
    const items = [
      { code, action: 'create' as const, data: { name: 'Bulk A' } },
      { code, action: 'create' as const, data: { name: 'Duplicate' } },
    ];
    const check = await shotBatch.create(project, items, { dry_run: true, atomic: true });
    expect(statuses(check)).toEqual(['created', 'duplicate']);
    expect(check.committed).toBe(false);
    expect((await shotsApi.list({ project, search: code })).count).toBe(0);

    const stored = await shotBatch.create(project, items.slice(0, 1), { dry_run: false, atomic: true });
    expect(stored.committed).toBe(true);
    const row = (await shotsApi.list({ project, search: code })).results[0];
    expect(row.code).toBe(code);
    expect(JSON.stringify(await shotsApi.bulkArchive([row.id]))).toMatch(/archived/);
    await expect(shotsApi.get(row.id)).rejects.toMatchObject({ status: 404 });
    expect(JSON.stringify(await shotsApi.bulkRestore([row.id]))).toMatch(/restored/);
    expect((await shotsApi.get(row.id)).code).toBe(code);
  });
});

describe('assets', () => {
  it('a bad row fails the atomic batch; skipping it stores the other', async () => {
    const items = [
      { code: `AB${uid}1`, action: 'create' as const, data: { name: 'Bulk asset', category: 'Prop' } },
      { code: `AB${uid}2`, action: 'create' as const, data: {} },
    ];
    const atomic = await assetBatch.create(project, items, { dry_run: false, atomic: true });
    expect(atomic.committed).toBe(false);
    expect(atomic.errors).toEqual([{ row: 1, field: 'name', message: 'This field is required.' }]);
    expect((await assetsApi.list({ project, search: `AB${uid}` })).count).toBe(0);

    const partial = await assetBatch.create(project, items, { dry_run: false, atomic: false });
    expect(partial.committed).toBe(true);
    expect((await assetsApi.list({ project, search: `AB${uid}` })).results.map((a) => a.code)).toEqual([`AB${uid}1`]);
  });
});

describe('tasks', () => {
  it('update by code; a field outside the whitelist is refused', async () => {
    const code = `TB${uid}1`;
    expect((await taskBatch.create(project, [{ code, action: 'create', data: { title: 'Bulk task' } }], { dry_run: false, atomic: true })).committed).toBe(true);
    const updated = await taskBatch.update(project, [{ code: code.toLowerCase(), priority: 'High' }], { dry_run: false, atomic: true });
    expect(statuses(updated)).toEqual(['updated']);
    const task = (await tasksApi.list({ project, search: code })).results[0];
    expect(task.priority).toBe('High');

    const refused = await taskBatch.updateIds([task.id], { vendor_id: 'VEND1' }, { dry_run: false, atomic: true });
    expect(refused.errors).toEqual([{ row: 0, field: 'vendor_id', message: 'This field cannot be changed in bulk.' }]);
  });
});

describe('limits', () => {
  it('more than 500 items is a 400 for the whole request', async () => {
    const items = Array.from({ length: 501 }, (_, n) => ({ code: `SQ${n}`, action: 'create' as const, data: {} }));
    await expect(sequenceBatch.create(project, items, { dry_run: true, atomic: true })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Load template', () => {
  it('the create examples of an episodic project pass the check as they are', async () => {
    const episodic = (await projectsApi.create({ code: `E${uid}`, name: 'Bulk template', workflow_type: 'episodic' })).id;
    const check = async (spec: typeof sequenceBulkSpec) => {
      const columns = columnsFor(spec, { episodic: true, mode: 'create' });
      const rows = exampleRows(spec, columns, await templateParents(spec, episodic, true));
      return spec.routes.create(episodic, toCreateItems(rows, columns), { dry_run: false, atomic: true });
    };
    // Sequences under the project's first episode, then shots under the first sequence and its episode.
    expect(await check(sequenceBulkSpec)).toMatchObject({ committed: true, errors: [] });
    expect(await check(shotBulkSpec)).toMatchObject({ committed: true, errors: [] });
    const tasks = await check(taskBulkSpec);
    expect(tasks.errors).toEqual([]);
    expect(statuses(tasks)).toEqual(['created', 'created', 'created']);
  });
});

describe('the Bulk add shots manager (the staged one shots kept)', () => {
  it('check-existence, create, skip and recover per item, as the manager sends them', async () => {
    const code = `SM${uid}1`;
    type Existence = { items: Array<{ code: string; state: string }> };
    type Created = { results: Array<{ status: string; success: boolean }>; summary: Record<string, number> };
    const state = async () => ((await shotBulk.checkExistence({ project_id: project, codes: [code] } as never)) as unknown as Existence).items[0].state;
    expect(await state()).toBe('NEW');

    const created = (await shotBulk.bulkCreate({ project_id: project, items: [{ code, action: 'create', data: { name: 'Staged' } }, { code: `SM${uid}2`, action: 'skip', data: {} }] } as never)) as unknown as Created;
    expect(created.results.map((r) => r.status)).toEqual(['created', 'skipped']);
    expect(created.summary).toMatchObject({ createdCount: 1, skippedCount: 1 });
    expect(await state()).toBe('EXISTS');

    const row = (await shotsApi.list({ project, search: code })).results[0];
    await shotsApi.bulkArchive([row.id]);
    expect(await state()).toBe('SOFT_DELETED');
    const recovered = (await shotBulk.bulkCreate({ project_id: project, items: [{ code, action: 'recover', data: {} }] } as never)) as unknown as Created;
    expect(recovered.results[0]).toMatchObject({ status: 'recovered', success: true });
    expect((await shotsApi.get(row.id)).code).toBe(code);
  });
});

describe('Bulk add sequences, assets and tasks (the staged manager)', () => {
  type Existence = { items: Array<{ code: string; state: string }> };
  type Created = { results: Array<{ status: string; success: boolean; error?: unknown }> };

  it('the same upload again is active existing; an archived row is soft-deleted and recovers; parents go by code', async () => {
    const seq = `SS${uid}`;
    const stored = (await sequenceBulk.bulkCreate({ project_id: project, items: [{ code: seq, action: 'create', data: { name: 'Staged' } }] } as never)) as unknown as Created;
    expect(stored.results[0]).toMatchObject({ status: 'created', success: true });
    const seqState = async () => ((await sequenceBulk.checkExistence({ project_id: project, codes: [seq] } as never)) as unknown as Existence).items[0].state;
    expect(await seqState()).toBe('EXISTS');

    const asset = `SA${uid}`;
    await assetBulk.bulkCreate({ project_id: project, items: [{ code: asset, action: 'create', data: { name: 'Staged asset' } }] } as never);
    const row = (await assetsApi.list({ project, search: asset })).results[0];
    await assetsApi.bulkArchive([row.id]);
    const assetState = async () => ((await assetBulk.checkExistence({ project_id: project, codes: [asset] } as never)) as unknown as Existence).items[0].state;
    expect(await assetState()).toBe('SOFT_DELETED');
    const recovered = (await assetBulk.bulkCreate({ project_id: project, items: [{ code: asset, action: 'recover', data: {} }] } as never)) as unknown as Created;
    expect(recovered.results[0]).toMatchObject({ status: 'recovered', success: true });
    expect(await assetState()).toBe('EXISTS');

    // A task about the asset, written by its code, stored by the per-row route Execute uses.
    const task = `ST${uid}`;
    const tasks = (await taskBulk.bulkCreate({ project_id: project, items: [{ code: task, action: 'create', data: { title: 'Staged task', entity_type: 'Asset', entity_id: asset } }] } as never)) as unknown as Created;
    expect(tasks.results[0]).toMatchObject({ status: 'created', success: true });
    expect((await tasksApi.list({ project, search: task })).results[0].entity_code).toBe(asset);
  });
});


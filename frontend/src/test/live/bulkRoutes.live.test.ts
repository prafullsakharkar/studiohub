import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assetBatch, sequenceBatch, shotBatch, taskBatch } from '@/api/production/bulkRoutes';
import { projectsApi } from '@/api/production/structure';
import { assetsApi, shotsApi, tasksApi } from '@/api/production/work';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { columnsFor, sequenceBulkSpec, shotBulkSpec, taskBulkSpec } from '@/modules/production/bulk/specs';
import { toCreateItems } from '@/modules/production/bulk/rows';
import { currentRows, exampleRows, templateParents } from '@/modules/production/bulk/template';
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
  it('the create examples of an episodic project pass the check as they are; an update loads the rows by code', async () => {
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

    const current = await currentRows(shotBulkSpec, columnsFor(shotBulkSpec, { episodic: true, mode: 'update' }), episodic, true);
    expect(current.total).toBe(3);
    expect(current.rows.map((r) => [r.code, r.sequence, r.episode])).toEqual([
      ['SQ010_0100', 'SQ010', 'EP101'],
      ['SQ010_0200', 'SQ010', 'EP101'],
      ['SQ010_0300', 'SQ010', 'EP101'],
    ]);
  });
});

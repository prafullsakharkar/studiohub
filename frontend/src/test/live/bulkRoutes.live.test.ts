import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assetBulk, shotBulk, taskBulk } from '@/api/production/bulkRoutes';
import { projectsApi } from '@/api/production/structure';
import { assetsApi, shotsApi, tasksApi } from '@/api/production/work';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { freshTotp, live } from './liveBackend';

/**
 * The bulk routes the three bulk managers post to, against a REAL backend: check what exists, create several at once
 * (one of them a duplicate), archive, restore. Run on a fresh live_backend.py seed.
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

const created = (resp: { results: Array<{ code?: string; actionTaken?: string; status?: string }> }, code: string) => resp.results.find((r) => r.code === code);

describe('shots', () => {
  it('checks, creates (a duplicate is refused beside the good one), archives and restores', async () => {
    const code = `SB${uid}1`;
    const before = await shotBulk.checkExistence({ project_id: project, codes: [code] });
    expect(JSON.stringify(before)).toContain(code);
    const first = await shotBulk.bulkCreate({ project_id: project, items: [{ code, data: { name: 'Bulk A', project } }, { code: code.toLowerCase(), data: { name: 'Duplicate', project } }] } as never);
    expect(created(first as never, code)?.actionTaken ?? created(first as never, code)?.status).toMatch(/created/);
    expect(first.summary).toBeTruthy();
    const row = (await shotsApi.list({ project, search: code })).results[0];
    expect(row.code).toBe(code);
    const archived = await shotBulk.bulkArchive({ ids: [row.id] });
    expect(JSON.stringify(archived)).toMatch(/archived/);
    await expect(shotsApi.get(row.id)).rejects.toMatchObject({ status: 404 });
    const restored = await shotBulk.bulkRestore({ ids: [row.id] });
    expect(JSON.stringify(restored)).toMatch(/restored/);
    expect((await shotsApi.get(row.id)).code).toBe(code);
  });
});

describe('assets', () => {
  it('checks, creates, archives and restores', async () => {
    const code = `AB${uid}1`;
    const made = await assetBulk.bulkCreate({ project_id: project, items: [{ code, data: { name: 'Bulk asset', category: 'Prop', project } }] } as never);
    expect(created(made as never, code)?.actionTaken ?? created(made as never, code)?.status).toMatch(/created/);
    const exists = await assetBulk.checkExistence({ project_id: project, codes: [code] });
    expect(JSON.stringify(exists)).toContain(code);
    const row = (await assetsApi.list({ project, search: code })).results[0];
    expect(JSON.stringify(await assetBulk.bulkArchive({ ids: [row.id] }))).toMatch(/archived/);
    expect(JSON.stringify(await assetBulk.bulkRestore({ ids: [row.id] }))).toMatch(/restored/);
    expect((await assetsApi.get(row.id)).code).toBe(code);
  });
});

describe('tasks', () => {
  it('checks and creates', async () => {
    const code = `TB${uid}1`;
    const made = await taskBulk.bulkCreate({ project_id: project, items: [{ code, data: { title: 'Bulk task', project_id: project, status: 'Not Started' } }] } as never);
    expect(JSON.stringify(made)).toContain(code);
    expect(JSON.stringify(await taskBulk.checkExistence({ project_id: project, codes: [code] }))).toContain(code);
    expect((await tasksApi.list({ project, search: code })).results.map((t) => t.code)).toContain(code);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assetBatch, assetBulk, sequenceBatch, sequenceBulk, shotBatch, shotBulk, taskBatch, taskBulk } from '@/api/production/bulkRoutes';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import { assetsApi, shotsApi, tasksApi } from '@/api/production/work';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { withProjectPrefix } from '@/modules/production/codePrefix';
import { buildBulkShotItems, buildBulkShotUpdates } from '@/modules/shots/components/bulk/ShotBulkManager';
import { assetBulkSpec, columnsFor, sequenceBulkSpec, shotBulkSpec, taskBulkSpec } from '@/modules/production/bulk/specs';
import { toCreateItems, toUpdateItems } from '@/modules/production/bulk/rows';
import { exampleRows, templateParents } from '@/modules/production/bulk/template';
import { authService } from '@/modules/auth/services/AuthService';
import { freshTotp, live } from './liveBackend';

/**
 * The CR-48 bulk routes the Bulk menu and "Edit fields" post to, against a REAL backend: a dry run stores nothing, an
 * atomic batch with a bad row stores nothing, "skip invalid" stores the others, update by code, the field whitelist, and
 * archive / restore of a bulk-made row. Run on a fresh live_backend.py seed.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
// A new code starts with its project's (CR-49): `B<uid>_`.
const P = `B${uid}_`;
/** The sequence the shots below belong to (a new shot needs one, CR-49). */
const HOME = `${P}HOME`;
let project = '';

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  project = (await projectsApi.create({ code: `B${uid}`, name: 'Bulk routes', workflow_type: 'standard' })).id;
  await sequenceBulk.bulkCreate({ project_id: project, items: [{ code: HOME, action: 'create', data: { name: 'Home' } }] } as never);
}, 60000);
afterAll(() => tokenStorage.clearTokens());

const statuses = (response: { results: Array<{ status: string }> }) => response.results.map((r) => r.status);

describe('shots', () => {
  it('a dry run stores nothing; the commit stores; archive and restore', async () => {
    const code = `${P}SB${uid}1`;
    const items = [
      { code, action: 'create' as const, data: { name: 'Bulk A', sequence_id: HOME } },
      { code, action: 'create' as const, data: { name: 'Duplicate', sequence_id: HOME } },
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
      { code: `${P}AB${uid}1`, action: 'create' as const, data: { name: 'Bulk asset', category: 'Prop' } },
      { code: `${P}AB${uid}2`, action: 'create' as const, data: {} },
    ];
    const atomic = await assetBatch.create(project, items, { dry_run: false, atomic: true });
    expect(atomic.committed).toBe(false);
    expect(atomic.errors).toEqual([{ row: 1, field: 'name', message: 'This field is required.' }]);
    expect((await assetsApi.list({ project, search: `${P}AB${uid}` })).count).toBe(0);

    const partial = await assetBatch.create(project, items, { dry_run: false, atomic: false });
    expect(partial.committed).toBe(true);
    expect((await assetsApi.list({ project, search: `${P}AB${uid}` })).results.map((a) => a.code)).toEqual([`${P}AB${uid}1`]);
  });
});

describe('tasks', () => {
  it('update by code; a field outside the whitelist is refused', async () => {
    const code = `${P}TB${uid}1`;
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
    const items = Array.from({ length: 501 }, (_, n) => ({ code: `${P}SQ${n}`, action: 'create' as const, data: {} }));
    await expect(sequenceBatch.create(project, items, { dry_run: true, atomic: true })).rejects.toMatchObject({ status: 400 });
  });
});

describe('Load template', () => {
  it('the create examples of an episodic project pass the check as they are', async () => {
    const episodic = (await projectsApi.create({ code: `E${uid}`, name: 'Bulk template', workflow_type: 'episodic' })).id;
    const check = async (spec: typeof sequenceBulkSpec) => {
      const columns = columnsFor(spec, { episodic: true, mode: 'create' });
      const rows = exampleRows(spec, columns, await templateParents(spec, episodic, true));
      // Bulk add puts the project's code in front of each new code at Validate (CR-49).
      const prefixed = rows.map((row) => ({ ...row, code: withProjectPrefix(`E${uid}`, row.code) }));
      return spec.routes.create(episodic, toCreateItems(prefixed, columns), { dry_run: false, atomic: true });
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
    const code = `${P}SM${uid}1`;
    type Existence = { items: Array<{ code: string; state: string }> };
    type Created = { results: Array<{ status: string; success: boolean }>; summary: Record<string, number> };
    const state = async () => ((await shotBulk.checkExistence({ project_id: project, codes: [code] } as never)) as unknown as Existence).items[0].state;
    expect(await state()).toBe('NEW');

    const created = (await shotBulk.bulkCreate({ project_id: project, items: [{ code, action: 'create', data: { name: 'Staged', sequence_id: HOME } }, { code: `${P}SM${uid}2`, action: 'skip', data: {} }] } as never)) as unknown as Created;
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

describe('Bulk add shots: the sequence a shot is linked to', () => {
  type Created = { results: Array<{ status: string; success: boolean }> };

  it('sequence_id links the shot to its sequence; sequence_code (read-only) is dropped, so the shot has none and is refused (CR-49)', async () => {
    const seq = `${P}LK${uid}`;
    await sequenceBulk.bulkCreate({ project_id: project, items: [{ code: seq, action: 'create', data: {} }] } as never);
    const byId = `${P}LK${uid}A`;
    const byCode = `${P}LK${uid}B`;
    const created = (await shotBulk.bulkCreate({
      project_id: project,
      items: [
        { code: byId, action: 'create', data: { sequence_id: seq } },
        { code: byCode, action: 'create', data: { sequence_code: seq } },
      ],
    } as never)) as unknown as Created;
    expect(created.results.map((r) => r.status)).toEqual(['created', 'invalid']);
    const linked = async (code: string) => (await shotsApi.list({ project, search: code })).results.find((r) => r.code === code)?.sequence_code;
    expect(await linked(byId)).toBe(seq);
    expect(await linked(byCode)).toBeUndefined(); // no shot without a sequence
  });

  it('the project\'s code in front and a sequence are required of every client, not just the screens', async () => {
    const bare = (await shotBulk.bulkCreate({ project_id: project, items: [{ code: `BARE${uid}`, action: 'create', data: { sequence_id: HOME } }] } as never)) as unknown as Created & { errors: Array<{ field: string; message: string }> };
    expect(bare.results[0].status).toBe('invalid');
    expect(bare.errors[0]).toMatchObject({ field: 'code', message: `Codes in project B${uid} start with B${uid}_.` });

    const loose = (await shotBulk.bulkCreate({ project_id: project, items: [{ code: `${P}NOSEQ${uid}`, action: 'create', data: {} }] } as never)) as unknown as Created & { errors: Array<{ field: string; message: string }> };
    expect(loose.results[0].status).toBe('invalid');
    expect(loose.errors[0]).toMatchObject({ field: 'sequence_id', message: 'A shot needs a sequence.' });
  });

  it('the Bulk add shots manager\'s own payload links the shot', async () => {
    const seq = `${P}LM${uid}`;
    const code = `${P}LM${uid}S`;
    await sequenceBulk.bulkCreate({ project_id: project, items: [{ code: seq, action: 'create', data: {} }] } as never);
    const items = buildBulkShotItems([{ code, state: 'NEW', userAction: 'create', proposedData: { code, sequence_code: seq, name: 'Linked' } } as never], { projectId: project, projectCode: 'X', defaultSequenceCode: '', isEpisodic: false });
    await shotBulk.bulkCreate({ project_id: project, items } as never);
    const row = (await shotsApi.list({ project, search: code })).results.find((r) => r.code === code);
    expect(row?.sequence_code).toBe(seq);
  });
});

describe('Bulk add: Update Existing Entity, as the managers send it', () => {
  it('a sequence, an asset, a task and a shot are updated by code from the cells the row filled in; the others stay', async () => {
    // Created first, as an upload of the same rows would find them.
    const seq = `${P}UP${uid}Q`;
    const asset = `${P}UP${uid}A`;
    const task = `${P}UP${uid}T`;
    const shot = `${P}UP${uid}S`;
    await sequenceBulk.bulkCreate({ project_id: project, items: [{ code: seq, action: 'create', data: { name: 'Old', description: 'Keep me' } }] } as never);
    await assetBulk.bulkCreate({ project_id: project, items: [{ code: asset, action: 'create', data: { name: 'Old', category: 'Character' } }] } as never);
    await taskBulk.bulkCreate({ project_id: project, items: [{ code: task, action: 'create', data: { title: 'Old' } }] } as never);
    await shotBulk.bulkCreate({ project_id: project, items: [{ code: shot, action: 'create', data: { name: 'Old', sequence_id: seq } }] } as never);

    // The managers' own update items: the update columns of the spec, the shot manager's builder.
    const update = async (spec: typeof sequenceBulkSpec, row: Record<string, unknown>) => {
      const items = toUpdateItems([row], columnsFor(spec, { episodic: false, mode: 'update' }));
      const dry = await spec.routes.update(project, items, { dry_run: true, atomic: false });
      expect(dry.errors).toEqual([]);
      const done = await spec.routes.update(project, items, { dry_run: false, atomic: false });
      expect(done).toMatchObject({ committed: true, errors: [] });
      expect(statuses(done)).toEqual(['updated']);
    };
    await update(sequenceBulkSpec, { code: seq, name: 'New' });
    await update(assetBulkSpec, { code: asset, name: 'New', category: 'Prop' });
    // A task's About / entity columns are create-only: the update leaves them out.
    await update(taskBulkSpec, { code: task, title: 'New', entity_type: 'Shot', entity: shot, priority: 'High' });

    const shotUpdates = buildBulkShotUpdates([{ code: shot, state: 'EXISTS', userAction: 'update_existing', proposedData: { code: shot, name: 'New', sequence_code: seq, priority: 'Low', notes: 'n', frame_in: 1001, frame_out: 1200, handle_frames: 8 } } as never]);
    const shotDone = await shotBatch.update(project, shotUpdates, { dry_run: false, atomic: false });
    expect(shotDone).toMatchObject({ committed: true, errors: [] });

    const one = async (list: (p: object) => Promise<{ results: Array<Record<string, unknown>> }>, code: string) => (await list({ project, search: code })).results.find((r) => r.code === code) as Record<string, unknown>;
    expect(await one(sequencesApi.list as never, seq)).toMatchObject({ name: 'New', description: 'Keep me' }); // description was empty in the row: left as it is
    expect(await one(assetsApi.list as never, asset)).toMatchObject({ name: 'New', category: 'Prop' });
    expect(await one(tasksApi.list as never, task)).toMatchObject({ title: 'New', priority: 'High' });
    expect(await one(shotsApi.list as never, shot)).toMatchObject({ name: 'New', frame_out: 1200, sequence_code: seq });
  });
});

describe('Bulk add sequences, assets and tasks (the staged manager)', () => {
  type Existence = { items: Array<{ code: string; state: string }> };
  type Created = { results: Array<{ status: string; success: boolean; error?: unknown }> };

  it('the same upload again is active existing; an archived row is soft-deleted and recovers; parents go by code', async () => {
    const seq = `${P}SS${uid}`;
    const stored = (await sequenceBulk.bulkCreate({ project_id: project, items: [{ code: seq, action: 'create', data: { name: 'Staged' } }] } as never)) as unknown as Created;
    expect(stored.results[0]).toMatchObject({ status: 'created', success: true });
    const seqState = async () => ((await sequenceBulk.checkExistence({ project_id: project, codes: [seq] } as never)) as unknown as Existence).items[0].state;
    expect(await seqState()).toBe('EXISTS');

    const asset = `${P}SA${uid}`;
    await assetBulk.bulkCreate({ project_id: project, items: [{ code: asset, action: 'create', data: { name: 'Staged asset' } }] } as never);
    const row = (await assetsApi.list({ project, search: asset })).results[0];
    await assetsApi.bulkArchive([row.id]);
    const assetState = async () => ((await assetBulk.checkExistence({ project_id: project, codes: [asset] } as never)) as unknown as Existence).items[0].state;
    expect(await assetState()).toBe('SOFT_DELETED');
    const recovered = (await assetBulk.bulkCreate({ project_id: project, items: [{ code: asset, action: 'recover', data: {} }] } as never)) as unknown as Created;
    expect(recovered.results[0]).toMatchObject({ status: 'recovered', success: true });
    expect(await assetState()).toBe('EXISTS');

    // A task about the asset, written by its code, stored by the per-row route Execute uses.
    const task = `${P}ST${uid}`;
    const tasks = (await taskBulk.bulkCreate({ project_id: project, items: [{ code: task, action: 'create', data: { title: 'Staged task', entity_type: 'Asset', entity_id: asset } }] } as never)) as unknown as Created;
    expect(tasks.results[0]).toMatchObject({ status: 'created', success: true });
    expect((await tasksApi.list({ project, search: task })).results[0].entity_code).toBe(asset);
  });
});


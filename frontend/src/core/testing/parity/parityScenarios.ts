import { ParityScenario, normalizePaginated } from './parityHarness';
import { RepositoryBundle } from '@/api/repositories/factory';

/**
 * Parity scenarios that exercise the SAME operation through the Mock adapter
 * and the REST adapter, verifying contract equivalence.
 *
 * Each scenario uses only the standard IRepository operations so both adapters
 * implement the identical interface. Scenario bodies are backend-agnostic.
 */

function uniqueCode(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export const projectCrudParity: ParityScenario = {
  id: 'parity-project-crud',
  name: 'Project CRUD Parity',
  description:
    'Create → read → patch → list → delete a project through Mock and REST adapters, comparing status/shape.',
  run: async (bundle: RepositoryBundle) => {
    const code = uniqueCode('PARITY');
    const created = await bundle.project.create({
      name: `Parity Project ${code}`,
      code,
      type: 'Feature Film',
      status: 'In Progress',
    });
    const read = await bundle.project.findById(created.id);
    const patched = await bundle.project.patch(created.id, { status: 'Completed' });
    const list = await bundle.project.findAll({ page: 1, page_size: 20 });
    await bundle.project.delete(created.id);
    return { created, read, patched, list };
  },
  normalizeResult: (result) => {
    const r = result as {
      created: { id?: string; name?: string; code?: string };
      read: { id?: string };
      patched: { status?: string };
      list: Parameters<typeof normalizePaginated>[0];
    };
    return {
      createdId: !!r.created.id,
      createdHasName: typeof r.created.name === 'string',
      createdHasCode: typeof r.created.code === 'string',
      readResolved: r.read.id === r.created.id,
      patchApplied: r.patched.status === 'Completed',
      list: normalizePaginated(r.list),
    };
  },
};

export const taskCrudParity: ParityScenario = {
  id: 'parity-task-crud',
  name: 'Task CRUD Parity',
  description:
    'Create → read → update → search → delete a task through both adapters, comparing status/shape.',
  run: async (bundle: RepositoryBundle) => {
    const created = await bundle.task.create({
      title: `Parity Task ${uniqueCode('TSK')}`,
      status: 'Todo',
      entity_id: 'shot-001',
      project_id: 'proj-001',
    });
    const read = await bundle.task.findById(created.id);
    const updated = await bundle.task.update(created.id, { status: 'In Progress' });
    const search = await bundle.task.search('Parity Task');
    await bundle.task.delete(created.id);
    return { created, read, updated, search };
  },
  normalizeResult: (result) => {
    const r = result as {
      created: { id?: string; title?: string };
      read: { id?: string };
      updated: { status?: string };
      search: Parameters<typeof normalizePaginated>[0];
    };
    return {
      createdId: !!r.created.id,
      createdHasTitle: typeof r.created.title === 'string',
      readResolved: r.read.id === r.created.id,
      updateApplied: r.updated.status === 'In Progress',
      search: normalizePaginated(r.search),
    };
  },
};

export const assetCrudParity: ParityScenario = {
  id: 'parity-asset-crud',
  name: 'Asset CRUD Parity',
  description:
    'Create → read → patch → list an asset through both adapters, comparing status/shape.',
  run: async (bundle: RepositoryBundle) => {
    const created = await bundle.asset.create({
      name: `Parity Asset ${uniqueCode('AST')}`,
      asset_type: 'Character',
      project_id: 'proj-001',
    });
    const read = await bundle.asset.findById(created.id);
    const patched = await bundle.asset.patch(created.id, { asset_type: 'Prop' });
    const list = await bundle.asset.findAll({ page: 1, page_size: 20 });
    await bundle.asset.delete(created.id);
    return { created, read, patched, list };
  },
  normalizeResult: (result) => {
    const r = result as {
      created: { id?: string; name?: string };
      read: { id?: string };
      patched: { asset_type?: string };
      list: Parameters<typeof normalizePaginated>[0];
    };
    return {
      createdId: !!r.created.id,
      createdHasName: typeof r.created.name === 'string',
      readResolved: r.read.id === r.created.id,
      patchApplied: r.patched.asset_type === 'Prop',
      list: normalizePaginated(r.list),
    };
  },
};

export const shotCrudParity: ParityScenario = {
  id: 'parity-shot-crud',
  name: 'Shot CRUD Parity',
  description:
    'Create → read → patch → delete a shot through both adapters, comparing status/shape.',
  run: async (bundle: RepositoryBundle) => {
    const created = await bundle.shot.create({
      code: uniqueCode('SH'),
      name: `Parity Shot ${uniqueCode('SHT')}`,
      project_id: 'proj-001',
      sequence_id: 'seq-001',
    });
    const read = await bundle.shot.findById(created.id);
    const patched = await bundle.shot.patch(created.id, { status: 'Approved' });
    await bundle.shot.delete(created.id);
    return { created, read, patched };
  },
  normalizeResult: (result) => {
    const r = result as {
      created: { id?: string; code?: string };
      read: { id?: string };
      patched: { status?: string };
    };
    return {
      createdId: !!r.created.id,
      createdHasCode: typeof r.created.code === 'string',
      readResolved: r.read.id === r.created.id,
      patchApplied: r.patched.status === 'Approved',
    };
  },
};

export const notFoundParity: ParityScenario = {
  id: 'parity-404-shape',
  name: '404 Error Format Parity',
  description:
    'Request a non-existent project and verify both adapters produce the same 404 error format.',
  run: async (bundle: RepositoryBundle) => {
    await bundle.project.findById('non-existent-parity-id-0000');
    throw new Error('Expected 404 but operation succeeded');
  },
  normalizeResult: (result) => {
    const err = result as {
      status?: number;
      isNotFound?: boolean;
      message?: string;
    };
    return {
      status: err.status,
      isNotFound: err.isNotFound,
      hasMessage: typeof err.message === 'string',
    };
  },
};

export const paginationParity: ParityScenario = {
  id: 'parity-pagination-contract',
  name: 'Pagination Envelope Parity',
  description:
    'Verify both adapters return a DRF pagination envelope with the same structure.',
  run: async (bundle: RepositoryBundle) => {
    const page1 = await bundle.project.findAll({ page: 1, page_size: 5 });
    const page2 = await bundle.project.findAll({ page: 2, page_size: 5 });
    return { page1, page2 };
  },
  normalizeResult: (result) => {
    const r = result as {
      page1: Parameters<typeof normalizePaginated>[0];
      page2: Parameters<typeof normalizePaginated>[0];
    };
    return {
      page1: normalizePaginated(r.page1),
      page2: normalizePaginated(r.page2),
    };
  },
};

export const parityScenarios: ParityScenario[] = [
  projectCrudParity,
  taskCrudParity,
  assetCrudParity,
  shotCrudParity,
  notFoundParity,
  paginationParity,
];

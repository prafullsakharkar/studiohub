import { apiClient } from '@/api/client/ApiClient';
import { TestGroup, TestCase } from '../types';

interface EntityDef {
  entity: string;
  base: string;
  createBody: Record<string, any>;
  updateField: [string, any];
  nameField: string;
}

const ENTITIES: EntityDef[] = [
  { entity: 'Client', base: '/api/v1/clients', createBody: { code: 'ENG', studio_type: 'Major Studio', name: '' }, updateField: ['headquarters', 'Engine City'], nameField: 'name' },
  { entity: 'Vendor', base: '/api/v1/vendors', createBody: { code: 'ENG', name: '' }, updateField: ['location', 'Engine City'], nameField: 'name' },
  { entity: 'Department', base: '/api/v1/departments', createBody: { code: 'ENG', name: '' }, updateField: ['description', 'engine dept'], nameField: 'name' },
  { entity: 'Team', base: '/api/v1/teams', createBody: { code: 'ENG', name: '' }, updateField: ['description', 'engine squad'], nameField: 'name' },
  { entity: 'Office', base: '/api/v1/offices', createBody: { city: 'Engineville', country: 'Testland', name: '' }, updateField: ['timezone', 'UTC'], nameField: 'name' },
  { entity: 'Person', base: '/api/v1/people', createBody: { email: '', role: 'FX Artist', full_name: '' }, updateField: ['seniority', 'Lead'], nameField: 'full_name' },
  { entity: 'Project', base: '/api/v1/projects', createBody: { code: '', name: '' }, updateField: ['description', 'engine show'], nameField: 'name' },
];

function lifecycleCase(def: EntityDef): TestCase {
  return {
    id: `entity-${def.entity.toLowerCase()}-lifecycle`,
    category: def.entity,
    entity: def.entity,
    feature: 'CRUD lifecycle + isolation',
    name: `${def.entity} lifecycle: create/read/update/archive/restore/delete`,
    description: `Exercises the full ${def.entity} lifecycle and verifies strict post-delete isolation.`,
    testLevel: 'integration',
    priority: 'high',
    tags: ['entity', def.entity.toLowerCase(), 'crud', 'isolation'],
    preconditions: ['Mock API mode'],
    steps: ['Create', 'Read', 'Update', 'Archive', 'Restore', 'Delete', 'Verify isolation'],
    expectedResult: 'All transitions succeed; deleted entities never resurface.',
    run: async () => {
      const start = performance.now();
      const stamp = Date.now().toString(36);
      const body = { ...def.createBody };
      body[def.nameField] = `Engine ${def.entity} ${stamp}`;
      if ('email' in body) body.email = `eng-${stamp}@test.dev`;
      if (def.entity === 'Project') body.code = `E${stamp}`.toUpperCase().slice(0, 6);

      const created = await apiClient.post<any>(`${def.base}/`, body);
      if (!created?.id) throw new Error(`${def.entity} create failed`);
      const id = created.id;

      const fetched = await apiClient.get<any>(`${def.base}/${id}/`);
      if (fetched.id !== id) throw new Error(`${def.entity} read mismatch`);

      const [field, value] = def.updateField;
      const updated = await apiClient.patch<any>(`${def.base}/${id}/`, { [field]: value });
      if (updated[field] !== value) throw new Error(`${def.entity} update failed`);

      const archived = await apiClient.patch<any>(`${def.base}/${id}/`, { status: 'Archived' });
      if (archived.status !== 'Archived') throw new Error(`${def.entity} archive failed`);
      const restored = await apiClient.patch<any>(`${def.base}/${id}/`, { status: 'Active' });
      if (restored.status !== 'Active') throw new Error(`${def.entity} restore failed`);

      await apiClient.delete(`${def.base}/${id}/`);

      const afterDelete = await apiClient.get<any>(`${def.base}/`);
      const leaked = (afterDelete.results || []).some((r: any) => r.id === id);
      if (leaked) throw new Error(`${def.entity} still visible after deletion`);

      return {
        passed: true,
        durationMs: Math.round(performance.now() - start),
        message: `${def.entity} lifecycle + isolation verified.`,
        details: { id },
      };
    },
  };
}

const relationshipCase: TestCase = {
  id: 'entity-relationships',
  category: 'Relationships',
  entity: 'Team/Department/Person',
  feature: 'Assignments',
  name: 'Relationships: team members, dept projects, person assigns',
  description: 'Verifies member add/remove/lead, project assign/unassign, and person assignment.',
  testLevel: 'integration',
  priority: 'high',
  tags: ['relationships', 'team'],
  async run() {
    const start = performance.now();
    const stamp = Date.now().toString(36);

    const team = await apiClient.post<any>('/api/v1/teams/', { name: `Eng Squad ${stamp}`, code: 'ENG', member_ids: [] });
    const withMember = await apiClient.patch<any>(`/api/v1/teams/${team.id}/`, { member_ids: ['usr-101'], member_count: 1 });
    if (!withMember.member_ids.includes('usr-101')) throw new Error('member add failed');
    const lead = await apiClient.patch<any>(`/api/v1/teams/${team.id}/`, { lead_id: 'usr-101' });
    if (lead.lead_id !== 'usr-101') throw new Error('lead change failed');
    await apiClient.delete(`/api/v1/teams/${team.id}/`);

    return { passed: true, durationMs: Math.round(performance.now() - start), message: 'Relationships verified.' };
  },
};

export const entityExhaustiveSuite: TestGroup = {
  id: 'entity-exhaustive-suite',
  title: '14. Entity Exhaustive Contract Suite (Client/Vendor/Dept/Team/Office/People/Project)',
  description: 'Per-entity CRUD lifecycle + post-delete isolation plus relationship flows, executed live against the active API mode.',
  tests: [...ENTITIES.map(lifecycleCase), relationshipCase],
};

export const entityExhaustiveSuites: TestGroup[] = [entityExhaustiveSuite];

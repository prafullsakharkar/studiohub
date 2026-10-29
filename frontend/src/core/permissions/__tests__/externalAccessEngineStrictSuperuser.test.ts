/**
 * Fix round 1 (reviewer finding): `externalAccessEngine` role-label bypasses
 * (`Platform Admin`/`Super Admin` → global allow) are removed — strict
 * superuser-only, mirroring `rbac.ts:794-796`. A role label alone grants
 * nothing; membership/project assignment is the source of truth.
 */
import { describe, it, expect } from 'vitest';
import {
  isUserAssignedToProject,
  evaluateEntityVisibility,
  evaluateExternalAccess,
  filterEntitiesForExternalUser,
} from '../externalAccessEngine';
import { accessControl, filterAccessibleProjects } from '../accessControl';

const LABELED_MEMBER = {
  id: 'u-labeled',
  email: 'labeled@studiohub.vfx',
  is_superuser: false,
  is_active: true,
  role: 'Platform Admin',
  organization_id: 'org-A',
  permissions: [] as string[],
  memberships: [{ organization_id: 'org-A', status: 'Active', role: 'Platform Admin' }],
  project_memberships: [{ project_id: 'proj-a1', organization_id: 'org-A', status: 'active' }],
} as any;

const LABELED_NON_MEMBER = {
  id: 'u-labeled-out',
  email: 'outsider@studiohub.vfx',
  is_superuser: false,
  is_active: true,
  role: 'Super Admin',
  organization_id: 'org-Z',
  permissions: [] as string[],
  memberships: [{ organization_id: 'org-Z', status: 'Active', role: 'Super Admin' }],
  project_memberships: [] as any[],
} as any;

const SUPERUSER = {
  id: 'u-root',
  email: 'root@studiohub.vfx',
  is_superuser: true,
  is_active: true,
  role: 'Artist',
  permissions: [] as string[],
  memberships: [] as any[],
} as any;

function projectFixture(id: string, orgId: string) {
  return { id, organization_id: orgId, status: 'In Progress' };
}

describe('externalAccessEngine strict superuser (no role-label bypass)', () => {
  it('labeled non-superuser member sees only assigned projects (same-org over-grant closed)', () => {
    expect(isUserAssignedToProject(LABELED_MEMBER, 'proj-a1')).toBe(true);
    expect(isUserAssignedToProject(LABELED_MEMBER, 'proj-a2')).toBe(false);
  });

  it('project access denies the labeled non-superuser without assignment', () => {
    expect(accessControl.canAccessProject(LABELED_MEMBER, 'proj-a2')).toBe(false);
    expect(accessControl.canAccessProject(LABELED_NON_MEMBER, 'proj-a1')).toBe(false);
  });

  it('project access still allows via explicit project assignment', () => {
    expect(accessControl.canAccessProject(LABELED_MEMBER, 'proj-a1')).toBe(true);
  });

  it('filterAccessibleProjects returns only assigned projects for the labeled member', () => {
    const projects = [projectFixture('proj-a1', 'org-A'), projectFixture('proj-a2', 'org-A')];
    const visible = filterAccessibleProjects(LABELED_MEMBER, projects);
    expect(visible.map((p) => p.id)).toEqual(['proj-a1']);
  });

  it('superuser keeps global project access', () => {
    expect(isUserAssignedToProject(SUPERUSER, 'proj-a2')).toBe(true);
    expect(accessControl.canAccessProject(SUPERUSER, 'proj-a2')).toBe(true);
  });

  it('entity visibility no longer bypasses on role label', () => {
    // Vendor-typed user carrying a Super Admin label: pre-fix the label
    // bypass allowed everything; post-fix vendor boundaries apply.
    const labeledVendor = {
      ...LABELED_NON_MEMBER,
      role: 'Platform Admin',
      organization_id: 'org-A',
      memberships: [{ organization_id: 'org-A', status: 'Active', role: 'Platform Admin' }],
      vendor_id: 'v-1',
    };
    const internal = { id: 'e-1', visibility: 'INTERNAL', organization_id: 'org-A' };
    const decision = evaluateEntityVisibility(labeledVendor as any, internal, {
      organizationId: 'org-A',
    } as any);
    expect(decision.allowed).toBe(false);
    expect(evaluateEntityVisibility(SUPERUSER, internal, { organizationId: 'org-A' } as any).allowed).toBe(
      true
    );
  });

  it('external access evaluation no longer grants GLOBAL scope on role label', () => {
    const labeledVendor = {
      ...LABELED_NON_MEMBER,
      role: 'Platform Admin',
      organization_id: 'org-A',
      memberships: [{ organization_id: 'org-A', status: 'Active', role: 'Platform Admin' }],
      vendor_id: 'v-1',
    };
    const decision = evaluateExternalAccess(labeledVendor as any, 'view', 'project', { id: 'proj-a1' }, {
      organizationId: 'org-A',
    } as any);
    expect(decision.allowed).toBe(false);
    expect(decision.effectiveScope).not.toBe('GLOBAL');
  });

  it('entity filtering still applies the project boundary without role-label bypass', () => {
    const entities = [
      { id: 'e-a', project_id: 'proj-a1' },
      { id: 'e-b', project_id: 'proj-a2' },
    ];
    const filtered = filterEntitiesForExternalUser(LABELED_MEMBER, entities, 'project');
    expect(filtered.map((e: any) => e.id)).toEqual(['e-a']);
    expect(filterEntitiesForExternalUser(SUPERUSER, entities, 'project')).toHaveLength(2);
  });
});

describe('Org-role labels no longer grant project access (de-orged)', () => {
  const OWNER_OUTSIDER = {
    id: 'u-owner-out',
    email: 'owner-out@studiohub.vfx',
    is_superuser: false,
    is_active: true,
    role: 'Organization Owner',
    organization_id: 'org-Z',
    permissions: [] as string[],
    memberships: [] as any[],
    project_memberships: [] as any[],
  } as any;

  const OWNER_MEMBER_A = {
    id: 'u-owner-a',
    email: 'owner-a@studiohub.vfx',
    is_superuser: false,
    is_active: true,
    role: 'Organization Owner',
    organization_id: 'org-A',
    permissions: [] as string[],
    memberships: [{ organization_id: 'org-A', status: 'Active', role: 'Organization Owner' }],
    project_memberships: [] as any[],
  } as any;

  it('Owner-labeled outsider without project membership is denied everywhere', async () => {
    const { checkUserHasRole } = await import('../rbac');
    expect(isUserAssignedToProject(OWNER_OUTSIDER, 'proj-a1')).toBe(false);
    expect(accessControl.canAccessProject(OWNER_OUTSIDER, 'proj-a1')).toBe(false);
    expect(checkUserHasRole(OWNER_OUTSIDER, 'Editor')).toBe(false);
  });

  it('org membership alone does not grant project access — project assignment is the only dimension', async () => {
    // Legacy 'Organization Owner' template carries '*', but production access
    // is gated exclusively on explicit project membership/assignment.
    expect(isUserAssignedToProject(OWNER_MEMBER_A, 'proj-a1')).toBe(false);
    expect(accessControl.canAccessProject(OWNER_MEMBER_A, 'proj-a1')).toBe(false);
  });

  it('superuser break-glass bypasses project assignment', () => {
    expect(isUserAssignedToProject(SUPERUSER, 'proj-x')).toBe(true);
    expect(accessControl.canAccessProject(SUPERUSER, 'proj-x')).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { can as canonicalCan } from '@/core/permissions/can';
import { can as legacyCan, hasElevatedAccess, isBreakGlass } from '@/core/permissions/rbac';
import type { User } from '@/types/identity';

const user = { id: 'u1', email: 'a@x.io', role: 'org_admin', is_superuser: false } as unknown as User;

describe('can() canonical surface', () => {
  it('legacy rbac.can matches canonical can() for a permission string', () => {
    const ctx = { organizationId: 'org1' };
    expect(legacyCan(user, 'shot.view', ctx)).toBe(
      canonicalCan(user, { permission: 'shot.view', organizationId: 'org1' }),
    );
  });

  it('legacy rbac.can preserves extended context (department/team/vendor/client)', () => {
    const ctx = { organizationId: 'org1', departmentId: 'd1', teamId: 't1' };
    expect(legacyCan(user, 'shot.view', ctx)).toBe(
      canonicalCan(user, { permission: 'shot.view', organizationId: 'org1' }),
    );
  });

  it('legacy rbac.can warns once about deprecation', async () => {
    vi.resetModules();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fresh = await import('@/core/permissions/rbac');
    fresh.can(user, 'shot.view', { organizationId: 'org1' });
    fresh.can(user, 'shot.view', { organizationId: 'org1' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('hostile role code containing "admin" as substring gains nothing by itself', () => {
    const hostile = { ...user, role: 'Readministrator', permissions: [] } as unknown as User;
    expect(canonicalCan(hostile, { permission: 'page.testing', organizationId: 'org1' })).toBe(false);
  });
});

describe('hasElevatedAccess', () => {
  it('returns true for superuser break-glass', () => {
    const su = { ...user, is_superuser: true } as unknown as User;
    expect(hasElevatedAccess(su)).toBe(true);
  });

  it('returns false for hostile substring role without grants', () => {
    const hostile = {
      ...user,
      role: 'Readministrator',
      permissions: [],
      memberships: [],
    } as unknown as User;
    expect(hasElevatedAccess(hostile)).toBe(false);
  });

  it('a role label alone grants nothing, even "Platform Admin" (the backend sends codes, not templates)', () => {
    const admin = { ...user, role: 'Platform Admin', permissions: [] } as unknown as User;
    expect(hasElevatedAccess(admin)).toBe(false);
  });

  it('returns true when the user holds an administrator-only backend code', () => {
    const admin = { ...user, role: 'Artist', permissions: ['identity.role.update'] } as unknown as User;
    expect(hasElevatedAccess(admin)).toBe(true);
  });
});

describe('isBreakGlass', () => {
  it('matches strict superuser semantics (owner is NOT break-glass)', () => {
    const su = { ...user, is_superuser: true } as unknown as User;
    const owner = { ...user, is_superuser: false, role: 'Organization Owner' } as unknown as User;
    expect(isBreakGlass(su)).toBe(true);
    expect(isBreakGlass(owner)).toBe(false);
  });
});

describe('hasElevatedAccess by backend code', () => {
  it.each([['identity.role.update'], ['identity.permission.update'], ['settings.manage'], ['masterdata.catalog.manage']])(
    'honors administrator-only code %s',
    (code) => {
      const u = { ...user, role: 'Tester', permissions: [code] } as unknown as User;
      expect(hasElevatedAccess(u)).toBe(true);
    },
  );

  it.each([['shot.view'], ['project.update'], ['masterdata.directory.manage'], ['testing.view'], ['permissions.manage'], ['platform.admin.view']])(
    'does not treat %s as elevated (ordinary or invented code)',
    (code) => {
      const u = { ...user, role: 'Tester', permissions: [code] } as unknown as User;
      expect(hasElevatedAccess(u)).toBe(false);
    },
  );
});

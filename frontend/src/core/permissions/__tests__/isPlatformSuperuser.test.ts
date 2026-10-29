import { describe, expect, it } from 'vitest';
import {
  checkUserHasRole,
  evaluateUserPermission,
  isPlatformSuperuser,
} from '../rbac';

describe('isPlatformSuperuser (strict)', () => {
  it('returns false for Platform Admin role label without is_superuser', () => {
    expect(isPlatformSuperuser({ id: 'u', role: 'Platform Admin', is_superuser: false } as any)).toBe(false);
  });
  it('returns true for is_superuser regardless of role', () => {
    expect(isPlatformSuperuser({ id: 'u', role: 'Artist', is_superuser: true } as any)).toBe(true);
  });
});

describe('checkUserHasRole (strict)', () => {
  it('does not grant arbitrary roles for Platform Admin label without is_superuser', () => {
    expect(
      checkUserHasRole({ id: 'u', role: 'Platform Admin', is_superuser: false } as any, 'Artist')
    ).toBe(false);
  });
  it('grants any role for is_superuser', () => {
    expect(
      checkUserHasRole({ id: 'u', role: 'Artist', is_superuser: true } as any, 'Platform Admin')
    ).toBe(true);
  });
});

describe('evaluateUserPermission (strict)', () => {
  it('denies platform permission for Super Admin label without is_superuser or grant', () => {
    // 'Super Admin' has no system-role template grants, so this isolates the
    // removed label bypass ('Platform Admin' template carries '*' via
    // ROLE_PERMISSIONS, which is a legitimate explicit grant, not a bypass).
    expect(
      evaluateUserPermission(
        { id: 'u', role: 'Super Admin', is_superuser: false, permissions: [] } as any,
        'platform.admin.view'
      )
    ).toBe(false);
  });
  it('allows platform permission for is_superuser', () => {
    expect(
      evaluateUserPermission(
        { id: 'u', role: 'Artist', is_superuser: true, permissions: [] } as any,
        'platform.admin.view'
      )
    ).toBe(true);
  });
  it('does not bypass the project boundary for Platform Admin label without is_superuser', () => {
    expect(
      evaluateUserPermission(
        {
          id: 'u',
          role: 'Platform Admin',
          is_superuser: false,
          project_memberships: [],
        } as any,
        'shot.view',
        { projectId: 'proj-other' }
      )
    ).toBe(false);
  });
  it('allows cross-project access for is_superuser', () => {
    expect(
      evaluateUserPermission(
        {
          id: 'u',
          role: 'Artist',
          is_superuser: true,
          project_memberships: [],
        } as any,
        'shot.view',
        { projectId: 'proj-other' }
      )
    ).toBe(true);
  });
});

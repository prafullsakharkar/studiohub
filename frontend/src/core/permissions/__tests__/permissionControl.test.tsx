import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { usePermissionControl } from '@/core/permissions/PermissionControl';
import { AuthContext } from '@/core/auth/AuthContext';

function harness(user: any, options: any) {
  const stub = {
    user,
    isAuthenticated: true,
    isLoading: false,
    hasRole: () => false,
    hasPermission: () => false,
    can: () => false,
    login: async () => undefined,
    logout: async () => undefined,
    refreshUser: async () => undefined,
    updateUserProfile: async () => user,
  } as any;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthContext.Provider value={stub}>{children}</AuthContext.Provider>
  );
  return renderHook(() => usePermissionControl(options), { wrapper });
}

function memberUser(role: string, perms: string[], projectId?: string) {
  return {
    id: 'u1',
    email: 'a@x.io',
    role,
    is_active: true,
    is_superuser: false,
    permissions: perms,
    project_memberships: projectId
      ? [
          {
            id: 'pm1',
            user_id: 'u1',
            project_id: projectId,
            roles: [role],
            permissions: perms,
            status: 'Active',
          },
        ]
      : [],
  };
}

describe('usePermissionControl role matching', () => {
  it('does not treat substring "admin" in a custom code as admin (prohibitedRoles exact match)', () => {
    const { result } = harness(memberUser('Readministrator', ['shot.view']), {
      permission: 'shot.view',
      prohibitedRoles: ['admin'],
    });
    expect(result.current.isAllowed).toBe(true);
  });

  it('engine-explicit CRUD grants are honored for artist-coded roles', () => {
    const { result } = harness(memberUser('artist', ['task.create'], 'proj-1'), {
      entityType: 'task',
      action: 'create',
      projectId: 'proj-1',
    });
    expect(result.current.isAllowed).toBe(true);
  });
});

/**
 * SIMULATOR ONLY — "what-if" role preview for PermissionsSimulatorModal /
 * PermissionSimulatorSection. NEVER import from production guards, tables,
 * switchers, or route components (enforced by simulatorBoundary.test.ts).
 * Session truth lives in AuthProvider + usePermissions(). isSimulating
 * defaults OFF.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PermissionKey, PermissionAction } from '@/types/identity';
import type { EntityType } from '@/types/common';
import type { Role } from '@/types/identity';
import { SYSTEM_ROLE_TEMPLATES } from '@/core/permissions/systemRoles';
import {
  checkPermission,
  canPerformAction,
} from '@/core/permissions/enterprisePermissions';

interface PermissionState {
  currentRoleId: string;
  customOverrides: Record<string, boolean>; // key -> boolean (true = granted, false = denied)
  isSimulating: boolean;
  roles: Role[];

  // Actions
  setRole: (roleId: string) => void;
  toggleCustomPermission: (permission: PermissionKey | string) => void;
  resetCustomOverrides: () => void;
  resetToDefault: () => void;
  setIsSimulating: (simulating: boolean) => void;

  // Computed Selectors
  getActiveRole: () => Role;
  getEffectivePermissions: () => (string | PermissionKey)[];
  hasPermission: (permission: PermissionKey | string) => boolean;
  hasAnyPermission: (permissions: (PermissionKey | string)[]) => boolean;
  hasAllPermissions: (permissions: (PermissionKey | string)[]) => boolean;
  canPerform: (entityType: EntityType, action: PermissionAction) => boolean;
}

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      currentRoleId: 'role-org-admin',
      customOverrides: {},
      isSimulating: false,
      roles: SYSTEM_ROLE_TEMPLATES,

      setRole: (roleId: string) => {
        set({ currentRoleId: roleId, customOverrides: {} });
      },

      toggleCustomPermission: (perm: PermissionKey | string) => {
        const { customOverrides } = get();
        const effective = get().hasPermission(perm);
        set({
          customOverrides: {
            ...customOverrides,
            [perm]: !effective,
          },
        });
      },

      resetCustomOverrides: () => set({ customOverrides: {} }),

      resetToDefault: () =>
        set({
          currentRoleId: 'role-org-admin',
          customOverrides: {},
          isSimulating: false,
        }),

      setIsSimulating: (simulating: boolean) => set({ isSimulating: simulating }),

      getActiveRole: () => {
        const { currentRoleId, roles } = get();
        const found = roles.find((r) => r.id === currentRoleId || r.code === currentRoleId);
        return found || roles[0] || SYSTEM_ROLE_TEMPLATES[0];
      },

      getEffectivePermissions: () => {
        const role = get().getActiveRole();
        const basePerms = [...(role?.permissions || [])];
        const overrides = get().customOverrides;

        // Start with base
        const result = new Set<string>(basePerms);

        // Apply overrides
        Object.entries(overrides).forEach(([key, granted]) => {
          if (granted) {
            result.add(key);
          } else {
            result.delete(key);
            // If superuser wildcard was present and user disabled a specific one, remove *
            if (result.has('*')) {
              result.delete('*');
            }
          }
        });

        return Array.from(result);
      },

      hasPermission: (permission: PermissionKey | string) => {
        const overrides = get().customOverrides;
        if (overrides[permission] !== undefined) {
          return overrides[permission];
        }
        const effectivePerms = get().getEffectivePermissions();
        return checkPermission(effectivePerms, permission);
      },

      hasAnyPermission: (permissions: (PermissionKey | string)[]) => {
        return permissions.some((p) => get().hasPermission(p));
      },

      hasAllPermissions: (permissions: (PermissionKey | string)[]) => {
        return permissions.every((p) => get().hasPermission(p));
      },

      canPerform: (entityType: EntityType, action: PermissionAction) => {
        const effectivePerms = get().getEffectivePermissions();
        return canPerformAction(effectivePerms, entityType, action);
      },
    }),
    {
      name: 'studiohub-permissions-v1',
    }
  )
);

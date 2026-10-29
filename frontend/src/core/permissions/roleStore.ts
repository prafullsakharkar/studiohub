/**
 * Role-catalog editor state (system/custom role templates + overrides for the
 * access-management UI). NOT session truth — never import from production
 * guards or route components (enforced by simulatorBoundary.test.ts).
 * Session truth lives in AuthProvider + usePermissions().
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Role, RoleCategory, Permission } from '@/types/identity';
import { SYSTEM_ROLE_TEMPLATES, SYSTEM_ROLES_MAP } from './systemRoles';
import { PERMISSION_CATALOG, PERMISSION_MAP } from './permissionCatalog';
import { checkPermission } from './enterprisePermissions';

interface RoleState {
  systemRoles: Role[];
  customRoles: Role[];
  roleOverrides: Record<string, Record<string, boolean>>; // roleId -> { permissionCode -> granted }
  activeRoleId: string;
  groupBy: 'resource' | 'role';
  searchTerm: string;
  categoryFilter: 'all' | RoleCategory;
  resourceFilter: string;

  // Actions
  getAllRoles: () => Role[];
  getRoleById: (id: string) => Role | undefined;
  getEffectiveRolePermissions: (roleId: string) => string[];
  isPermissionGranted: (roleId: string, permissionCode: string) => boolean;
  isPermissionDirect: (roleId: string, permissionCode: string) => boolean;
  isPermissionInherited: (roleId: string, permissionCode: string) => boolean;
  
  togglePermission: (roleId: string, permissionCode: string) => void;
  setPermission: (roleId: string, permissionCode: string, granted: boolean) => void;
  resetRoleOverrides: (roleId: string) => void;
  
  createCustomRole: (newRole: Omit<Role, 'id' | 'created_at' | 'updated_at' | 'type'>) => Role;
  cloneRole: (sourceRoleId: string, overrides: { name: string; code: string; description: string; category?: RoleCategory }) => Role;
  updateRole: (roleId: string, updates: Partial<Role>) => void;
  deleteCustomRole: (roleId: string) => void;

  setActiveRoleId: (id: string) => void;
  setGroupBy: (groupBy: 'resource' | 'role') => void;
  setSearchTerm: (term: string) => void;
  setCategoryFilter: (category: 'all' | RoleCategory) => void;
  setResourceFilter: (resource: string) => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      systemRoles: SYSTEM_ROLE_TEMPLATES,
      customRoles: [],
      roleOverrides: {},
      activeRoleId: 'role-platform-admin',
      groupBy: 'resource',
      searchTerm: '',
      categoryFilter: 'all',
      resourceFilter: 'all',

      getAllRoles: () => {
        const { systemRoles, customRoles } = get();
        return [...systemRoles, ...customRoles];
      },

      getRoleById: (id: string) => {
        const all = get().getAllRoles();
        return all.find((r) => r.id === id || r.code === id);
      },

      getEffectiveRolePermissions: (roleId: string) => {
        const role = get().getRoleById(roleId);
        if (!role) return [];

        let perms = new Set<string>(role.permissions);

        // If role has parent, inherit
        if (role.parent_role_id) {
          const parentPerms = get().getEffectiveRolePermissions(role.parent_role_id);
          parentPerms.forEach((p) => perms.add(p));
        }

        // Apply overrides
        const overrides = get().roleOverrides[roleId] || {};
        Object.entries(overrides).forEach(([permCode, granted]) => {
          if (granted) {
            perms.add(permCode);
          } else {
            perms.delete(permCode);
            if (perms.has('*')) perms.delete('*');
          }
        });

        return Array.from(perms);
      },

      isPermissionGranted: (roleId: string, permissionCode: string) => {
        const overrides = get().roleOverrides[roleId] || {};
        if (overrides[permissionCode] !== undefined) {
          return overrides[permissionCode];
        }
        const effective = get().getEffectiveRolePermissions(roleId);
        return checkPermission(effective, permissionCode);
      },

      isPermissionDirect: (roleId: string, permissionCode: string) => {
        const role = get().getRoleById(roleId);
        if (!role) return false;
        return role.permissions.includes(permissionCode) || role.permissions.includes('*');
      },

      isPermissionInherited: (roleId: string, permissionCode: string) => {
        const role = get().getRoleById(roleId);
        if (!role) return false;
        // Check wildcard inheritance
        if (role.permissions.includes('*')) return true;
        const [res] = permissionCode.split('.');
        if (role.permissions.includes(`${res}.*`)) return true;
        // Check parent inheritance
        if (role.parent_role_id) {
          return get().isPermissionGranted(role.parent_role_id, permissionCode);
        }
        return false;
      },

      togglePermission: (roleId: string, permissionCode: string) => {
        const { roleOverrides } = get();
        const currentVal = get().isPermissionGranted(roleId, permissionCode);
        const currentRoleOverrides = roleOverrides[roleId] || {};

        set({
          roleOverrides: {
            ...roleOverrides,
            [roleId]: {
              ...currentRoleOverrides,
              [permissionCode]: !currentVal,
            },
          },
        });
      },

      setPermission: (roleId: string, permissionCode: string, granted: boolean) => {
        const { roleOverrides } = get();
        const currentRoleOverrides = roleOverrides[roleId] || {};
        set({
          roleOverrides: {
            ...roleOverrides,
            [roleId]: {
              ...currentRoleOverrides,
              [permissionCode]: granted,
            },
          },
        });
      },

      resetRoleOverrides: (roleId: string) => {
        const { roleOverrides } = get();
        const copy = { ...roleOverrides };
        delete copy[roleId];
        set({ roleOverrides: copy });
      },

      createCustomRole: (newRole) => {
        const roleId = `role-custom-${Date.now()}`;
        const created: Role = {
          ...newRole,
          id: roleId,
          type: 'custom',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          customRoles: [...state.customRoles, created],
          activeRoleId: roleId,
        }));

        return created;
      },

      cloneRole: (sourceRoleId: string, overrides) => {
        const sourceRole = get().getRoleById(sourceRoleId);
        const effectivePerms = sourceRole ? get().getEffectiveRolePermissions(sourceRoleId) : [];
        
        const roleId = `role-custom-${Date.now()}`;
        const cloned: Role = {
          id: roleId,
          code: overrides.code || `custom_${Date.now()}`,
          name: overrides.name,
          description: overrides.description,
          type: 'custom',
          category: overrides.category || sourceRole?.category || 'custom',
          parent_role_id: sourceRoleId,
          permissions: [...effectivePerms],
          badge_color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          customRoles: [...state.customRoles, cloned],
          activeRoleId: roleId,
        }));

        return cloned;
      },

      updateRole: (roleId: string, updates: Partial<Role>) => {
        set((state) => ({
          customRoles: state.customRoles.map((r) =>
            r.id === roleId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
          ),
        }));
      },

      deleteCustomRole: (roleId: string) => {
        set((state) => ({
          customRoles: state.customRoles.filter((r) => r.id !== roleId),
          activeRoleId: state.activeRoleId === roleId ? 'role-platform-admin' : state.activeRoleId,
        }));
      },

      setActiveRoleId: (id: string) => set({ activeRoleId: id }),
      setGroupBy: (groupBy) => set({ groupBy }),
      setSearchTerm: (searchTerm) => set({ searchTerm }),
      setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
      setResourceFilter: (resourceFilter) => set({ resourceFilter }),
    }),
    {
      name: 'studiohub-enterprise-roles-v2',
    }
  )
);

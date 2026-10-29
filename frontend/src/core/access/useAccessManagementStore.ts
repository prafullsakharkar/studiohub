import { create } from 'zustand';

import { persist } from 'zustand/middleware';

import {
  AccessWorkspaceTab,
  AccessGroupItem,
  UserEffectiveAccess,
  SimulationRequest,
  SimulationResult,
  AccessAuditEvent,
  AccessRoleTemplate,
} from '@/types/identity';

import { Role, RoleCategory } from '@/types/identity';

import { SYSTEM_ROLE_TEMPLATES } from '@/core/permissions/systemRoles';

import { ACCESS_ROLE_TEMPLATES, DOMAIN_PERMISSIONS_CATALOG } from './domainPermissions';

import { checkPermission } from '@/core/permissions/enterprisePermissions';

// Default initial groups

export const INITIAL_ACCESS_GROUPS: AccessGroupItem[] = [
  {
    id: 'grp-lighting-dept',
    name: 'Lighting Department',
    code: 'GRP-LIGHT-DEPT',
    description: 'Lighting TDs, lookdev artists, and master lighting leads.',
    roles: ['Artist', 'Lead Artist'],
    memberUserIds: ['usr-005', 'usr-009'],
    status: 'Active',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'grp-comp-leads',
    name: 'Compositing Leads',
    code: 'GRP-COMP-LEADS',
    description: 'Senior compositing squad leaders and final quality approvers.',
    roles: ['Lead Artist'],
    memberUserIds: ['usr-003'],
    status: 'Active',
    createdAt: '2025-02-01T11:00:00Z',
    updatedAt: '2026-08-10T14:00:00Z',
  },
  {
    id: 'grp-mumbai-artists',
    name: 'Mumbai Artists',
    code: 'GRP-MUM-ARTISTS',
    description: 'Mumbai facility roto, prep, and matchmove craft specialists.',
    roles: ['Artist'],
    memberUserIds: ['usr-006', 'usr-007'],
    status: 'Active',
    createdAt: '2025-03-01T09:00:00Z',
    updatedAt: '2026-08-15T09:00:00Z',
  },
  {
    id: 'grp-project-a-prod',
    name: 'Project A Production',
    code: 'GRP-PROJ-A-PROD',
    description: 'Dedicated showrunners, coordinators, and supervisors on Project Alpha.',
    roles: ['Producer', 'Production Manager', 'VFX Supervisor'],
    memberUserIds: ['usr-001', 'usr-002'],
    status: 'Active',
    createdAt: '2025-04-10T08:00:00Z',
    updatedAt: '2026-08-20T11:00:00Z',
  },
  {
    id: 'grp-vendor-a-artists',
    name: 'Vendor A Artists',
    code: 'GRP-VND-A-ARTISTS',
    description: 'Outsourced digital matte painting and FX vendor personnel.',
    roles: ['Vendor Artist'],
    memberUserIds: ['usr-008'],
    status: 'Active',
    createdAt: '2025-05-01T12:00:00Z',
    updatedAt: '2026-08-22T15:00:00Z',
  },
  {
    id: 'grp-client-a-reviewers',
    name: 'Client A Reviewers',
    code: 'GRP-CLI-A-REVIEWERS',
    description: 'External client review committee with screening room approval rights.',
    roles: ['Client Reviewer'],
    memberUserIds: ['usr-004'],
    status: 'Active',
    createdAt: '2025-06-01T14:00:00Z',
    updatedAt: '2026-08-25T16:00:00Z',
  },
];

export interface AccessManagementState {
  activeTab: AccessWorkspaceTab;
  selectedRoleId: string | null;
  selectedUserId: string | null;
  selectedGroupId: string | null;
  selectedProjectId: string;

  // Roles state
  customRoles: Role[];
  archivedRoleIds: string[];
  rolePermissionOverrides: Record<string, Record<string, boolean>>; // roleId -> permCode -> bool

  // Groups state
  groups: AccessGroupItem[];

  // User project membership overrides (userId -> projectMemberships)
  userProjectOverrides: Record<string, any[]>;

  // Audit Logs
  accessAuditLogs: AccessAuditEvent[];

  // Actions
  setActiveTab: (tab: AccessWorkspaceTab) => void;
  setSelectedRoleId: (id: string | null) => void;
  setSelectedUserId: (id: string | null) => void;
  setSelectedGroupId: (id: string | null) => void;
  setSelectedProjectId: (id: string) => void;

  // Role Operations
  getAllRoles: () => Role[];
  getRoleById: (id: string) => Role | undefined;
  getEffectiveRolePermissions: (roleId: string) => string[];
  createRole: (role: Omit<Role, 'id' | 'created_at' | 'updated_at' | 'type'> & { organization_id?: string }, actor?: { id: string; name: string; email: string }) => Role;
  createRoleFromTemplate: (templateId: string, customName?: string, actor?: { id: string; name: string; email: string }) => Role;
  editRole: (roleId: string, updates: Partial<Role>, actor?: { id: string; name: string; email: string }) => void;
  cloneRole: (sourceRoleId: string, overrides: { name: string; code: string; description: string }, actor?: { id: string; name: string; email: string }) => Role;
  archiveRole: (roleId: string, actor?: { id: string; name: string; email: string }) => void;
  restoreRole: (roleId: string, actor?: { id: string; name: string; email: string }) => void;
  deleteRole: (roleId: string, actor?: { id: string; name: string; email: string }) => void;
  setRolePermission: (roleId: string, permissionCode: string, granted: boolean, actor?: { id: string; name: string; email: string }) => void;
  setRolePermissionsBulk: (roleId: string, permissions: string[], actor?: { id: string; name: string; email: string }) => void;

  // Group Operations
  getGroupsForOrg: () => AccessGroupItem[];
  createGroup: (group: Omit<AccessGroupItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>, actor?: { id: string; name: string; email: string }) => AccessGroupItem;
  editGroup: (groupId: string, updates: Partial<AccessGroupItem>, actor?: { id: string; name: string; email: string }) => void;
  archiveGroup: (groupId: string, actor?: { id: string; name: string; email: string }) => void;
  restoreGroup: (groupId: string, actor?: { id: string; name: string; email: string }) => void;
  deleteGroup: (groupId: string, actor?: { id: string; name: string; email: string }) => void;
  addGroupMember: (groupId: string, userId: string, actor?: { id: string; name: string; email: string }) => void;
  removeGroupMember: (groupId: string, userId: string, actor?: { id: string; name: string; email: string }) => void;
  assignGroupRoles: (groupId: string, roles: string[], actor?: { id: string; name: string; email: string }) => void;

  // User & Project Access Operations
  assignUserProjectRole: (userId: string, projectId: string, roleName: string, scope?: string, extra?: { department?: string; team?: string; vendorId?: string; projectName?: string; projectCode?: string }, actor?: { id: string; name: string; email: string }) => void;
  removeUserFromProject: (userId: string, projectId: string, actor?: { id: string; name: string; email: string }) => void;
  getUserEffectiveAccess: (userId: string, customUser?: any, customProjects?: any[]) => UserEffectiveAccess | null;

  // Simulation
  simulatePermission: (req: SimulationRequest) => SimulationResult;

  // Audit
  getAuditLogsForOrg: () => AccessAuditEvent[];
  logAccessEvent: (event: Omit<AccessAuditEvent, 'id' | 'timestamp'>) => void;
}

export const useAccessManagementStore = create<AccessManagementState>()(
  persist(
    (set, get) => ({
      activeTab: 'overview',
      selectedRoleId: null,
      selectedUserId: null,
      selectedGroupId: null,
      selectedProjectId: 'proj-01',
      customRoles: [],
      archivedRoleIds: [],
      rolePermissionOverrides: {},
      groups: INITIAL_ACCESS_GROUPS,
      userProjectOverrides: {},
      accessAuditLogs: [
        {
          id: 'aud-init-1',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          actorId: 'usr-001',
          actorName: 'Alex Chen',
          actorEmail: 'alex.chen@apex.vfx',
          action: 'role.created',
          targetType: 'Role',
          targetId: 'role-org-admin',
          targetName: 'Organization Admin',
          details: { permissions_count: 28 },
        },
        {
          id: 'aud-init-2',
          timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
          actorId: 'usr-001',
          actorName: 'Alex Chen',
          actorEmail: 'alex.chen@apex.vfx',
          action: 'group.member_added',
          targetType: 'Group',
          targetId: 'grp-lighting-dept',
          targetName: 'Lighting Department',
          details: { userId: 'usr-005', userName: 'Maya Lin' },
        },
      ],

      setActiveTab: (tab) => set({ activeTab: tab }),
      setSelectedRoleId: (id) => set({ selectedRoleId: id }),
      setSelectedUserId: (id) => set({ selectedUserId: id }),
      setSelectedGroupId: (id) => set({ selectedGroupId: id }),
      setSelectedProjectId: (id) => set({ selectedProjectId: id }),

      getAllRoles: () => {
        const { customRoles, archivedRoleIds } = get();
        return [...SYSTEM_ROLE_TEMPLATES, ...customRoles].map((r) => ({
          ...r,
          is_archived: archivedRoleIds.includes(r.id),
        }));
      },

      getRoleById: (id: string) => {
        const all = get().getAllRoles();
        return all.find((r) => r.id === id || r.code === id || r.name.toLowerCase() === id.toLowerCase());
      },

      getEffectiveRolePermissions: (roleId: string) => {
        const role = get().getRoleById(roleId);
        if (!role) return [];
        let perms = new Set<string>(role.permissions || []);
        // Apply overrides
        const overrides = get().rolePermissionOverrides[roleId] || {};
        Object.entries(overrides).forEach(([permCode, granted]) => {
          if (granted) {
            perms.add(permCode);
          } else {
            perms.delete(permCode);
          }
        });
        return Array.from(perms);
      },

      createRole: (roleData, actor) => {
        const roleId = `role-custom-${Date.now()}`;
        const newRole: Role = {
          ...roleData,
          id: roleId,
          type: 'custom',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          customRoles: [...state.customRoles, newRole],
          selectedRoleId: roleId,
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.created',
          targetType: 'Role',
          targetId: roleId,
          targetName: newRole.name,
          details: { permissions: newRole.permissions, category: newRole.category },
        });
        return newRole;
      },

      createRoleFromTemplate: (templateId, customName, actor) => {
        const template = ACCESS_ROLE_TEMPLATES.find((t) => t.id === templateId || t.code === templateId);
        if (!template) {
          throw new Error(`Role template ${templateId} not found`);
        }
        const roleId = `role-custom-${Date.now()}`;
        const newRole: Role = {
          id: roleId,
          name: customName || `${template.name} (Custom)`,
          code: `custom_${template.code}_${Date.now()}`,
          description: template.description,
          type: 'custom',
          category: template.category,
          permissions: [...(template.defaultPermissions || [])],
          badge_color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          customRoles: [...state.customRoles, newRole],
          selectedRoleId: roleId,
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.created',
          targetType: 'Role',
          targetId: roleId,
          targetName: newRole.name,
          details: { createdFromTemplate: template.name, permissionsCount: newRole.permissions.length },
        });
        return newRole;
      },

      editRole: (roleId, updates, actor) => {
        const currentRole = get().getRoleById(roleId);
        set((state) => ({
          customRoles: state.customRoles.map((r) =>
            r.id === roleId ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
          ),
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.updated',
          targetType: 'Role',
          targetId: roleId,
          targetName: currentRole?.name || roleId,
          details: { updates },
        });
      },

      cloneRole: (sourceRoleId, overrides, actor) => {
        const sourceRole = get().getRoleById(sourceRoleId);
        const sourcePerms = sourceRole ? get().getEffectiveRolePermissions(sourceRoleId) : [];
        const roleId = `role-custom-${Date.now()}`;
        const clonedRole: Role = {
          id: roleId,
          name: overrides.name || `${sourceRole?.name} (Copy)`,
          code: overrides.code || `copy_${sourceRole?.code || 'role'}_${Date.now()}`,
          description: overrides.description || `Cloned from ${sourceRole?.name}. ${sourceRole?.description || ''}`,
          type: 'custom',
          category: sourceRole?.category || 'custom',
          parent_role_id: sourceRoleId,
          permissions: [...sourcePerms],
          badge_color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          customRoles: [...state.customRoles, clonedRole],
          selectedRoleId: roleId,
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.cloned',
          targetType: 'Role',
          targetId: roleId,
          targetName: clonedRole.name,
          details: { sourceRoleId, sourceRoleName: sourceRole?.name },
        });
        return clonedRole;
      },

      archiveRole: (roleId, actor) => {
        const role = get().getRoleById(roleId);
        set((state) => ({
          archivedRoleIds: Array.from(new Set([...state.archivedRoleIds, roleId])),
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.archived',
          targetType: 'Role',
          targetId: roleId,
          targetName: role?.name || roleId,
          details: { archived: true },
        });
      },

      restoreRole: (roleId, actor) => {
        const role = get().getRoleById(roleId);
        set((state) => ({
          archivedRoleIds: state.archivedRoleIds.filter((id) => id !== roleId),
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.restored',
          targetType: 'Role',
          targetId: roleId,
          targetName: role?.name || roleId,
          details: { restored: true },
        });
      },

      deleteRole: (roleId, actor) => {
        const role = get().getRoleById(roleId);
        set((state) => ({
          customRoles: state.customRoles.filter((r) => r.id !== roleId),
          archivedRoleIds: state.archivedRoleIds.filter((id) => id !== roleId),
          selectedRoleId: state.selectedRoleId === roleId ? null : state.selectedRoleId,
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'role.deleted',
          targetType: 'Role',
          targetId: roleId,
          targetName: role?.name || roleId,
          details: { permanent: true },
        });
      },

      setRolePermission: (roleId, permissionCode, granted, actor) => {
        const role = get().getRoleById(roleId);
        const { rolePermissionOverrides } = get();
        const roleOverrides = rolePermissionOverrides[roleId] || {};
        set({
          rolePermissionOverrides: {
            ...rolePermissionOverrides,
            [roleId]: {
              ...roleOverrides,
              [permissionCode]: granted,
            },
          },
        });
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: granted ? 'permission.granted' : 'permission.revoked',
          targetType: 'Permission',
          targetId: permissionCode,
          targetName: permissionCode,
          details: { roleId, roleName: role?.name, granted },
        });
      },

      setRolePermissionsBulk: (roleId, permissions, actor) => {
        const role = get().getRoleById(roleId);
        if (role?.type === 'custom') {
          get().editRole(roleId, { permissions });
        } else {
          // For system templates, create overrides
          const overrides: Record<string, boolean> = {};
          DOMAIN_PERMISSIONS_CATALOG.forEach((p) => {
            overrides[p.code] = permissions.includes(p.code);
          });
          set((state) => ({
            rolePermissionOverrides: {
              ...state.rolePermissionOverrides,
              [roleId]: overrides,
            },
          }));
        }
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'permission.granted',
          targetType: 'Role',
          targetId: roleId,
          targetName: role?.name || roleId,
          details: { totalPermissions: permissions.length },
        });
      },

      // Groups

      getGroupsForOrg: () => {
        return get().groups;
      },

      createGroup: (groupData, actor) => {
        const groupId = `grp-${Date.now()}`;
        const newGroup: AccessGroupItem = {
          ...groupData,
          id: groupId,
          status: 'Active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          groups: [...state.groups, newGroup],
          selectedGroupId: groupId,
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'group.created',
          targetType: 'Group',
          targetId: groupId,
          targetName: newGroup.name,
          details: { roles: newGroup.roles, memberCount: newGroup.memberUserIds?.length },
        });
        return newGroup;
      },

      editGroup: (groupId, updates, actor) => {
        const group = get().groups.find((g) => g.id === groupId);
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'group.updated',
          targetType: 'Group',
          targetId: groupId,
          targetName: group?.name || groupId,
          details: { updates },
        });
      },

      archiveGroup: (groupId, actor) => {
        get().editGroup(groupId, { status: 'Archived' }, actor);
      },

      restoreGroup: (groupId, actor) => {
        get().editGroup(groupId, { status: 'Active' }, actor);
      },

      deleteGroup: (groupId, actor) => {
        const group = get().groups.find((g) => g.id === groupId);
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
          selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId,
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'group.deleted',
          targetType: 'Group',
          targetId: groupId,
          targetName: group?.name || groupId,
          details: { permanent: true },
        });
      },

      addGroupMember: (groupId, userId, actor) => {
        const group = get().groups.find((g) => g.id === groupId);
        if (!group) return;
        if (!group.memberUserIds?.includes(userId)) {
          const updatedMembers = [...(group.memberUserIds || []), userId];
          get().editGroup(groupId, { memberUserIds: updatedMembers }, actor);
          get().logAccessEvent({
            actorId: actor?.id || 'usr-001',
            actorName: actor?.name || 'Administrator',
            actorEmail: actor?.email || 'admin@studiohub.vfx',
            action: 'group.member_added',
            targetType: 'Group',
            targetId: groupId,
            targetName: group.name,
            details: { userId },
          });
        }
      },

      removeGroupMember: (groupId, userId, actor) => {
        const group = get().groups.find((g) => g.id === groupId);
        if (!group) return;
        const updatedMembers = (group.memberUserIds || []).filter((id) => id !== userId);
        get().editGroup(groupId, { memberUserIds: updatedMembers }, actor);
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'group.member_removed',
          targetType: 'Group',
          targetId: groupId,
          targetName: group.name,
          details: { userId },
        });
      },

      assignGroupRoles: (groupId, roles, actor) => {
        const group = get().groups.find((g) => g.id === groupId);
        get().editGroup(groupId, { roles }, actor);
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'group.role_assigned',
          targetType: 'Group',
          targetId: groupId,
          targetName: group?.name || groupId,
          details: { roles },
        });
      },

      // User & Project Access

      assignUserProjectRole: (userId, projectId, roleName, scope = 'PROJECT', extra: { department?: string; team?: string; vendorId?: string; projectName?: string; projectCode?: string } = {}, actor?: { id: string; name: string; email: string }) => {
        const currentOverrides = get().userProjectOverrides[userId] || [];
        const existingIdx = currentOverrides.findIndex(
          (p: any) => (p.projectId === projectId || p.project_id === projectId)
        );

        const projectItem = {
          projectId,
          project_id: projectId,
          projectName: extra.projectName || (projectId === 'proj-01' ? 'Project Alpha' : projectId === 'proj-02' ? 'Project Beta' : `Project ${projectId}`),
          projectCode: extra.projectCode || (projectId === 'proj-01' ? 'APX-SHOW-01' : projectId === 'proj-02' ? 'APX-SHOW-02' : 'PRJ'),
          roles: [roleName],
          role: roleName,
          scope,
          status: 'Active',
          department: extra.department,
          team: extra.team,
          vendorId: extra.vendorId,
        };

        let updated = [...currentOverrides];
        if (existingIdx >= 0) {
          updated[existingIdx] = { ...updated[existingIdx], ...projectItem };
        } else {
          updated.push(projectItem);
        }

        set((state) => ({
          userProjectOverrides: {
            ...state.userProjectOverrides,
            [userId]: updated,
          },
        }));

        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'project.role_assigned',
          targetType: 'Project',
          targetId: projectId,
          targetName: projectItem.projectName,
          details: { userId, roleName, scope, extra },
        });
      },

      removeUserFromProject: (userId, projectId, actor) => {
        const currentOverrides = get().userProjectOverrides[userId] || [];
        const updated = currentOverrides.filter(
          (p: any) => !(p.projectId === projectId || p.project_id === projectId)
        );
        set((state) => ({
          userProjectOverrides: {
            ...state.userProjectOverrides,
            [userId]: updated,
          },
        }));
        get().logAccessEvent({
          actorId: actor?.id || 'usr-001',
          actorName: actor?.name || 'Administrator',
          actorEmail: actor?.email || 'admin@studiohub.vfx',
          action: 'project.role_removed',
          targetType: 'Project',
          targetId: projectId,
          targetName: projectId,
          details: { userId },
        });
      },

      getUserEffectiveAccess: (userId, customUser, customProjects) => {
        const user = customUser || null; // REST-only: real user resolved via auth context / API
        if (!user) return null;

        const { userProjectOverrides, groups } = get();

        // 1. User Groups
        const userGroups = groups.filter((g) => g.memberUserIds?.includes(userId));

        // 2. Project Memberships
        const overrideProjects = userProjectOverrides[userId] || [];
        let userProjects: any[] = [];
        if (overrideProjects.length > 0) {
          userProjects = overrideProjects;
        } else if (customProjects && customProjects.length > 0) {
          userProjects = customProjects.map((p) => ({
            projectId: p.id,
            project_id: p.id,
            projectName: p.name,
            projectCode: p.code,
            roles: [user.role || 'Viewer'],
            role: user.role || 'Viewer',
            scope: 'PROJECT',
            status: 'Active',
          }));
        } else if (user.project_memberships) {
          userProjects = user.project_memberships;
        }

        // 3. Calculate Effective Permissions with Lineage
        const permLineageMap = new Map<string, { sourceType: 'User Role' | 'Group Role' | 'Project Role' | 'Direct'; sourceName: string; scope: string }[]>();

        const registerPerm = (perm: string, source: { sourceType: 'User Role' | 'Group Role' | 'Project Role' | 'Direct'; sourceName: string; scope: string }) => {
          if (perm === '*') {
            DOMAIN_PERMISSIONS_CATALOG.forEach((p) => {
              const current = permLineageMap.get(p.code) || [];
              permLineageMap.set(p.code, [...current, source]);
            });
            return;
          }
          if (perm.endsWith('.*')) {
            const prefix = perm.replace('.*', '');
            DOMAIN_PERMISSIONS_CATALOG.filter((p) => p.code.startsWith(prefix)).forEach((p) => {
              const current = permLineageMap.get(p.code) || [];
              permLineageMap.set(p.code, [...current, source]);
            });
            return;
          }
          const current = permLineageMap.get(perm) || [];
          permLineageMap.set(perm, [...current, source]);
        };

        // From User Base Role
        const baseRoleDef = get().getRoleById(user.role || 'Viewer');
        const basePerms = baseRoleDef ? get().getEffectiveRolePermissions(baseRoleDef.id) : [];
        basePerms.forEach((p) => {
          registerPerm(p, {
            sourceType: 'User Role',
            sourceName: user.role || 'Viewer',
            scope: 'GLOBAL',
          });
        });

        // From Groups
        userGroups.forEach((group) => {
          (group.roles || []).forEach((gRoleName) => {
            const gRoleDef = get().getRoleById(gRoleName);
            const gPerms = gRoleDef ? get().getEffectiveRolePermissions(gRoleDef.id) : [];
            gPerms.forEach((p) => {
              registerPerm(p, {
                sourceType: 'Group Role',
                sourceName: `${group.name} (${gRoleName})`,
                scope: 'GLOBAL',
              });
            });
          });
        });

        // From Projects
        userProjects.forEach((proj: any) => {
          const roles = proj.roles || [proj.role || 'Viewer'];
          roles.forEach((pRoleName: string) => {
            const pRoleDef = get().getRoleById(pRoleName);
            const pPerms = pRoleDef ? get().getEffectiveRolePermissions(pRoleDef.id) : [];
            pPerms.forEach((p) => {
              registerPerm(p, {
                sourceType: 'Project Role',
                sourceName: `${proj.projectName || proj.projectId} (${pRoleName})`,
                scope: proj.scope || 'PROJECT',
              });
            });
          });
        });

        const effectivePermissions = Array.from(permLineageMap.entries()).map(([permissionCode, grantedBy]) => ({
          permissionCode,
          grantedBy,
        }));

        return {
          userId: user.id,
          userName: user.full_name || (user.first_name ? `${user.first_name} ${user.last_name}` : user.email),
          userEmail: user.email,
          groups: userGroups.map((g) => ({ id: g.id, name: g.name, roles: g.roles })),
          projectMemberships: userProjects.map((p: any) => ({
            projectId: p.projectId || p.project_id,
            projectName: p.projectName || `Project ${p.projectId}`,
            projectCode: p.projectCode || 'PRJ',
            roles: p.roles || [p.role || 'Viewer'],
            scope: p.scope || 'PROJECT',
            department: p.department,
            team: p.team,
            vendorId: p.vendorId,
            status: p.status || 'Active',
          })),
          effectivePermissions,
        };
      },

      simulatePermission: (req: SimulationRequest) => {
        // REST-only: real user resolution via auth/API is required; without a
        // resolved identity the simulation UI cannot authoritatively evaluate.
        const steps: SimulationResult['evaluationSteps'] = [];
        steps.push({
          step: '1. Identity Resolution',
          status: 'FAILED',
          detail: `User ID "${req.userId}" not found in identity directory.`,
        });
        return {
          allowed: false,
          permissionCode: `${req.resource || req.resourceType || ''}.${req.action || ''}`,
          reason: 'User not found in directory.',
          evaluationSteps: steps,
        };
      },

      getAuditLogsForOrg: () => {
        return get().accessAuditLogs;
      },

      logAccessEvent: (eventData) => {
        const event: AccessAuditEvent = {
          ...eventData,
          id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          accessAuditLogs: [event, ...state.accessAuditLogs].slice(0, 100),
        }));

        // Backend ChangeLog signal records role/project membership mutations
        // during the actual DB write; no separate POST to the read-only audit
        // surface.
      },
    }),
    {
      name: 'studiohub-access-management-v1',
    }
  )
);

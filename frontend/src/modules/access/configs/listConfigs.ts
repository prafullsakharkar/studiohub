import type { FieldDefinition } from '@/types/common';
import type { AccessGroupItem, Role } from '@/types/identity';
import type { Person } from '@/types/masterData';

/**
 * Unified card/table shell contract for access workspace entity rosters.
 *
 * Re-homed from the deleted organization module (`…/tabs/configs/`) so the
 * access module keeps its own list configs against flat platform endpoints.
 */
export interface OrgEntityViewConfig<T extends { id: string }> {
  entityType: string;
  searchPlaceholder: string;
  fields: FieldDefinition<T>[];
  cardFields: {
    title: (i: T) => string;
    subtitle?: (i: T) => string;
    badges: (i: T) => { label: string; variant: string }[];
    meta: (i: T) => { label: string; value: string }[];
  };
  permissions: {
    create: string;
    update: string;
    delete: string;
    view: string;
  };
  createLabel: string;
  detailRoute: (i: T) => string;
  workspaceType: string;
  deletable: boolean;
  bulkDeletable: boolean;
}

/**
 * Groups list config. Only the left roster converts to the shell; the
 * inspector and all modals (create/edit/add-member/assign-role) stay verbatim.
 */
export const groupsListConfig: OrgEntityViewConfig<AccessGroupItem> = {
  entityType: 'group',
  searchPlaceholder: 'Search access groups...',
  fields: [
    { key: 'name', label: 'Group', sortable: true },
    // `code` keys render mono automatically in TableView.
    { key: 'code', label: 'Code', sortable: true },
    { key: 'status', label: 'Status', type: 'badge', sortable: false },
    { key: 'description', label: 'Description', sortable: false },
  ],
  cardFields: {
    title: (g) => g.name || '',
    subtitle: (g) => (g.code as string | undefined) || '',
    badges: (g) => [{ label: (g.status as string | undefined) || 'Active', variant: 'neutral' }],
    meta: (g) => [{ label: 'Description', value: g.description || '' }],
  },
  permissions: {
    create: 'group.create',
    update: 'group.update',
    delete: 'group.delete',
    view: 'group.view',
  },
  createLabel: 'Create Access Group',
  // No dedicated workspace route: selection drives the inspector panel.
  detailRoute: (g) => `/groups/${g.id}`,
  workspaceType: 'group',
  deletable: true,
  bulkDeletable: false,
};

/**
 * Roles list config. Only the left roster converts to the shell; the
 * inspector, RoleEditorModal, and template modal stay verbatim.
 */
export const rolesListConfig: OrgEntityViewConfig<Role> = {
  entityType: 'role',
  searchPlaceholder: 'Search roles by name or code...',
  fields: [
    { key: 'name', label: 'Role', sortable: true },
    // `code` keys render mono automatically in TableView.
    { key: 'code', label: 'Code', sortable: true },
    { key: 'type', label: 'Type', type: 'badge', sortable: false },
    { key: 'category', label: 'Category', sortable: false },
    { key: 'description', label: 'Description', sortable: false },
  ],
  cardFields: {
    title: (r) => r.name || '',
    subtitle: (r) => (r.code as string | undefined) || '',
    badges: (r) => [
      { label: r.type === 'system' ? 'System' : 'Custom', variant: 'indigo' },
      ...((r as { is_archived?: boolean }).is_archived
        ? [{ label: 'Archived', variant: 'neutral' }]
        : []),
    ],
    meta: (r) => [
      { label: 'Description', value: r.description || '' },
      { label: 'Category', value: (r.category as string | undefined) || 'General' },
    ],
  },
  permissions: {
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
    view: 'roles.view',
  },
  createLabel: 'Create Role',
  // No dedicated workspace route: selection drives the inspector panel.
  detailRoute: (r) => `/roles/${r.id}`,
  workspaceType: 'role',
  deletable: true,
  bulkDeletable: false,
};

/**
 * Users (crew roster) list config. Only the left roster converts to the
 * shell; the effective-access inspector and all modals stay verbatim.
 */
export const usersListConfig: OrgEntityViewConfig<Person> = {
  entityType: 'user',
  searchPlaceholder: 'Search users by name, email, role...',
  fields: [
    { key: 'full_name', label: 'Member', sortable: true },
    { key: 'email', label: 'Email', sortable: false },
    { key: 'role', label: 'Role', type: 'badge', sortable: false },
    { key: 'department_name', label: 'Department', sortable: false },
  ],
  cardFields: {
    title: (u) => u.full_name,
    subtitle: (u) => u.email,
    badges: (u) => [{ label: u.role || '', variant: 'neutral' }],
    meta: (u) => [{ label: 'Department', value: u.department_name || 'Studio' }],
  },
  permissions: {
    create: 'people.create',
    update: 'people.update',
    delete: 'people.delete',
    view: 'people.view',
  },
  createLabel: 'Add Member',
  // No dedicated workspace route: selection drives the inspector panel.
  detailRoute: (u) => `/users/${u.id}`,
  workspaceType: 'user',
  // The roster surfaces no delete affordance (inspect + assign only).
  deletable: false,
  bulkDeletable: false,
};

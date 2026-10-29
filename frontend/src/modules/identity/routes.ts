/** Sections of the access-administration area (`/access/*`). */
export const ACCESS_TABS = [
  { to: '/access/roles', label: 'Roles' },
  { to: '/access/groups', label: 'Groups' },
  { to: '/access/permissions', label: 'Permissions' },
  { to: '/access/security', label: 'Security log' },
] as const;

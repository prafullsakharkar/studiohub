export * from './permissionCatalog';
export * from './systemRoles';
export * from './rbac';
export * from './PermissionComponents';
export * from './enterprisePermissions';
export * from './routePermissionsRegistry';
export * from './usePermissionEvaluator';
export * from './workflowStateEngine';
export * from './fieldPermissionEngine';
export * from './externalAccessEngine';
export * from './components';
export * from './PermissionControl';
export { can as canQuery, canAny, canAll, resolvePermissionCode, legacyCanArgs } from './can';
export type { CanQuery } from './can';
// usePermissions().can is the canonical engine entry inside components —
// rbac.ts' string-form `can` remains exported via the rbac barrel above.
export { usePermissions } from './usePermissions';
export { Can } from './Can';
export { HasRole } from './HasRole';


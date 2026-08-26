import React, { ReactNode } from 'react';
import { usePermissionStore } from '@/shared/stores/usePermissionStore';
import { PermissionKey, PermissionAction } from '@/types/enterprise';
import { EntityType } from '@/types/crud';
import { ENTERPRISE_ROLES } from './enterprisePermissions';

export function usePermissions() {
  const store = usePermissionStore();

  return {
    currentRoleId: store.currentRoleId,
    currentRole: store.getActiveRole(),
    roles: ENTERPRISE_ROLES,
    effectivePermissions: store.getEffectivePermissions(),
    customOverrides: store.customOverrides,
    isSimulating: store.isSimulating,
    setRole: store.setRole,
    toggleCustomPermission: store.toggleCustomPermission,
    resetCustomOverrides: store.resetCustomOverrides,
    resetToDefault: store.resetToDefault,
    setIsSimulating: store.setIsSimulating,
    hasPermission: store.hasPermission,
    hasAnyPermission: store.hasAnyPermission,
    hasAllPermissions: store.hasAllPermissions,
    can: store.canPerform,
  };
}

export interface PermissionGateProps {
  permission?: PermissionKey | string;
  permissions?: (PermissionKey | string)[];
  requireAll?: boolean;
  entityType?: EntityType;
  action?: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGate = ({
  permission,
  permissions,
  requireAll = false,
  entityType,
  action,
  fallback = null,
  children,
}: PermissionGateProps): React.JSX.Element | null => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, can } = usePermissions();

  let isAllowed = true;

  if (permission) {
    isAllowed = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    isAllowed = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  } else if (entityType && action) {
    isAllowed = can(entityType, action);
  }

  if (!isAllowed) {
    return fallback ? <React.Fragment>{fallback}</React.Fragment> : null;
  }

  return <React.Fragment>{children}</React.Fragment>;
};

export interface HasPermissionProps {
  permission?: PermissionKey | string;
  permissions?: (PermissionKey | string)[];
  entityType?: EntityType;
  action?: PermissionAction;
  children: (isAllowed: boolean) => ReactNode;
}

export const HasPermission = ({
  permission,
  permissions,
  entityType,
  action,
  children,
}: HasPermissionProps): React.JSX.Element => {
  const { hasPermission, hasAnyPermission, can } = usePermissions();

  let isAllowed = true;
  if (permission) {
    isAllowed = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    isAllowed = hasAnyPermission(permissions);
  } else if (entityType && action) {
    isAllowed = can(entityType, action);
  }

  return <React.Fragment>{children(isAllowed)}</React.Fragment>;
};

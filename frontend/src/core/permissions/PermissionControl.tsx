import { useAuth } from '@/modules/auth';
import React, { ComponentType, ReactElement, ReactNode, forwardRef, useMemo } from 'react';
;
import { isPlatformSuperuser } from './rbac';
import { usePermissions } from './usePermissions';
import { EntityType } from '@/types/common';

export type PermissionControlMode = 'disable' | 'hide' | 'readOnly' | 'visible';

export interface PermissionControlOptions {
  /** Permission key string, e.g. 'shot.create', 'task.bulk_update' */
  permission?: string;
  /** List of permission keys */
  permissions?: string[];
  /** Require all listed permissions (default: false = require any) */
  requireAll?: boolean;
  /** Entity type for CRUD checking, e.g. 'shot', 'task', 'asset', 'version' */
  entityType?: EntityType | string;
  /** Action type, e.g. 'create', 'update', 'delete', 'bulk_create', 'bulk_update', 'bulk_delete' */
  action?: string;
  /** Specific required role(s) */
  role?: string | string[];
  roles?: string | string[];
  /** Prohibited role(s) */
  prohibitedRoles?: string[];
  /** Custom tooltip or error message when unauthorized */
  unauthorizedTooltip?: string;
  /** Control mode when unauthorized: 'disable' (default), 'hide', 'readOnly', 'visible' */
  mode?: PermissionControlMode;
  /** Explicit override switch to disable element regardless of permissions */
  disabled?: boolean;
  /** Project context ID */
  projectId?: string;
}

export interface PermissionControlResult {
  isAllowed: boolean;
  isArtist: boolean;
  userRole: string;
  reason: string;
  mode: PermissionControlMode;
  controlProps: {
    disabled?: boolean;
    'aria-disabled'?: boolean;
    title?: string;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
  };
}

/**
 * Custom hook wrapper that centralizes visibility and interactivity logic for UI elements,
 * automatically evaluating permissions from AuthContext and permission stores.
 */
export function usePermissionControl(options: PermissionControlOptions = {}): PermissionControlResult {
  const {
    permission,
    permissions,
    requireAll = false,
    entityType,
    action,
    role,
    roles,
    prohibitedRoles,
    unauthorizedTooltip,
    mode = 'disable',
    disabled = false,
    projectId,
  } = options;

  const auth = useAuth();
  const storePermissions = usePermissions();

  const activeRole = storePermissions.currentRole;
  const userRole = auth.user?.role || activeRole?.name || 'Guest';

  // ADR-0033: tier checks use the canonical helpers (no role-name comparisons).
  const isBreakGlass = isPlatformSuperuser(auth.user as never);
  const roleStr = userRole.toLowerCase();
  // Exact role-code match only: substring heuristics (e.g. a custom
  // 'Readministrator' code containing 'admin') must never elevate or gate.
  const ARTIST_ROLE_CODES = new Set([
    'artist',
    'lead_artist',
    'vendor_artist',
    'client_reviewer',
    'client_viewer',
  ]);
  const isArtist = ARTIST_ROLE_CODES.has(roleStr) && !isBreakGlass;

  const { isAllowed, reason } = useMemo(() => {
    // 1. If explicit disabled prop passed
    if (disabled) {
      return { isAllowed: false, reason: unauthorizedTooltip || 'Element disabled' };
    }

    // 2. Check if any permission or role constraints are defined
    const hasConstraints = Boolean(
      permission ||
      (permissions && permissions.length > 0) ||
      entityType ||
      action ||
      role ||
      roles ||
      (prohibitedRoles && prohibitedRoles.length > 0)
    );

    if (!hasConstraints) {
      return { isAllowed: true, reason: '' };
    }

    // 3. Superuser bypass (canonical platform break-glass only; everything
    // else resolves through the canonical permission evaluation below).
    if (isBreakGlass) {
      return { isAllowed: true, reason: '' };
    }

    // 3. Artist role CRUD & Bulk operation restriction
    const actionStr = (action || '').toLowerCase();
    const permStr = (permission || '').toLowerCase();
    const isCrudOrBulkAction =
      actionStr.startsWith('bulk') ||
      actionStr === 'create' ||
      actionStr === 'update' ||
      actionStr === 'delete' ||
      actionStr === 'archive' ||
      actionStr === 'restore' ||
      actionStr === 'assign' ||
      permStr.includes('bulk') ||
      permStr.endsWith('.create') ||
      permStr.endsWith('.update') ||
      permStr.endsWith('.delete') ||
      permStr.endsWith('.archive') ||
      permStr.endsWith('.restore');

    if (isArtist && isCrudOrBulkAction) {
      // Engine-first: an explicit grant always wins over the artist heuristic.
      const engineProbe =
        permission || (entityType && action ? `${entityType}.${action}` : null);
      const engineAllows = engineProbe
        ? storePermissions.can({
            permission: engineProbe,
            projectId: projectId || storePermissions.activeProjectId,
          })
        : false;
      if (!engineAllows) {
        return {
          isAllowed: false,
          reason:
            unauthorizedTooltip ||
            `Action restricted for role '${userRole}' (Artists are not permitted to perform CRUD or bulk operations).`,
        };
      }
    }

    // 4. Prohibited roles check (exact code match only)
    if (prohibitedRoles && prohibitedRoles.length > 0) {
      const isProhibited = prohibitedRoles.some((r) => r.toLowerCase() === roleStr);
      if (isProhibited) {
        return {
          isAllowed: false,
          reason: unauthorizedTooltip || `Action is prohibited for role '${userRole}'.`,
        };
      }
    }

    // 5. Explicit role(s) check (exact match via session membership only)
    const requiredRoles = roles || role;
    if (requiredRoles) {
      const roleList = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
      const hasReqRole = roleList.some((r) => auth.hasRole(r, projectId));
      if (!hasReqRole) {
        return {
          isAllowed: false,
          reason: unauthorizedTooltip || `Action requires role: ${roleList.join(', ')}.`,
        };
      }
    }

    // 6. Permission string check (canonical engine; ADR-0033)
    if (permission) {
      const granted = storePermissions.can({
        permission,
        projectId: projectId || storePermissions.activeProjectId,
      });
      if (!granted) {
        return {
          isAllowed: false,
          reason: unauthorizedTooltip || `Missing required permission '${permission}' for role '${userRole}'.`,
        };
      }
    }

    // 7. Permissions array check (canonical engine; ADR-0033)
    if (permissions && permissions.length > 0) {
      const checkPerm = (code: string) =>
        storePermissions.can({
          permission: code,
          projectId: projectId || storePermissions.activeProjectId,
        });

      const hasPerms = requireAll ? permissions.every(checkPerm) : permissions.some(checkPerm);

      if (!hasPerms) {
        return {
          isAllowed: false,
          reason: unauthorizedTooltip || `Missing required permissions for role '${userRole}'.`,
        };
      }
    }

    // 8. EntityType + Action check (canonical engine; ADR-0033)
    if (entityType && action) {
      const granted = storePermissions.can({
        resource: entityType,
        action,
        projectId: projectId || storePermissions.activeProjectId,
      });
      if (!granted) {
        return {
          isAllowed: false,
          reason: unauthorizedTooltip || `Missing permission to ${action} ${entityType} for role '${userRole}'.`,
        };
      }
    }

    return { isAllowed: true, reason: '' };
  }, [
    disabled,
    auth,
    storePermissions,
    isArtist,
    userRole,
    roleStr,
    action,
    permission,
    permissions,
    requireAll,
    prohibitedRoles,
    roles,
    role,
    projectId,
    entityType,
    unauthorizedTooltip,
  ]);

  const controlProps = useMemo(() => {
    if (isAllowed) {
      return {};
    }

    if (mode === 'readOnly') {
      return {
        readOnly: true,
        'aria-disabled': true,
        title: reason,
        className: 'opacity-70 cursor-default bg-slate-800/50',
      };
    }

    return {
      disabled: true,
      'aria-disabled': true,
      title: reason,
      className: 'opacity-40 cursor-not-allowed pointer-events-auto select-none',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
    };
  }, [isAllowed, mode, reason]);

  return {
    isAllowed,
    isArtist,
    userRole,
    reason,
    mode,
    controlProps,
  };
}

/**
 * Higher-Order Component (HOC) that wraps any React component and automatically
 * enforces permission control, disabling or hiding it based on user role permissions.
 */
export function withPermissionControl<P extends object>(
  WrappedComponent: ComponentType<P>,
  defaultOptions: PermissionControlOptions = {}
) {
  const ComponentWithPermissionControl = forwardRef<any, P & PermissionControlOptions>(
    (props, ref) => {
      const mergedOptions: PermissionControlOptions = { ...defaultOptions, ...props };
      const { isAllowed, reason, mode, controlProps } = usePermissionControl(mergedOptions);

      if (!isAllowed && mode === 'hide') {
        return null;
      }

      const mergedProps = {
        ...props,
        ref,
        ...(mode === 'readOnly'
          ? { readOnly: true, 'aria-disabled': true }
          : !isAllowed
          ? { disabled: true, 'aria-disabled': true }
          : {}),
        title: !isAllowed ? reason : (props as any).title,
        onClick: (e: React.MouseEvent) => {
          if (!isAllowed) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if ((props as any).onClick) {
            (props as any).onClick(e);
          }
        },
        className: `${(props as any).className || ''} ${
          !isAllowed ? controlProps.className || 'opacity-40 cursor-not-allowed pointer-events-auto' : ''
        }`.trim(),
      };

      return <WrappedComponent {...(mergedProps as P)} />;
    }
  );

  ComponentWithPermissionControl.displayName = `WithPermissionControl(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithPermissionControl;
}

/**
 * Wrapper component that wraps children elements (e.g. Buttons, Bulk Action Bars, Input Controls)
 * and automatically centralizes permission checks, disabling or hiding children based on role.
 */
export interface PermissionControlledProps extends PermissionControlOptions {
  children: ReactNode | ((result: PermissionControlResult) => ReactNode);
  fallback?: ReactNode;
}

export const PermissionControlled: React.FC<PermissionControlledProps> = ({
  children,
  fallback = null,
  ...options
}) => {
  const result = usePermissionControl(options);
  const { isAllowed, mode, reason, controlProps } = result;

  if (typeof children === 'function') {
    return <>{children(result)}</>;
  }

  if (!isAllowed && mode === 'hide') {
    return fallback ? <>{fallback}</> : null;
  }

  if (!React.isValidElement(children)) {
    return <>{children}</>;
  }

  const child = children as ReactElement<any>;

  if (!isAllowed) {
    if (mode === 'readOnly') {
      return React.cloneElement(child, {
        ...child.props,
        readOnly: true,
        'aria-disabled': true,
        title: reason || child.props.title,
        className: `${child.props.className || ''} opacity-70 cursor-default`.trim(),
      });
    }

    return React.cloneElement(child, {
      ...child.props,
      disabled: true,
      'aria-disabled': true,
      title: reason || child.props.title,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
      className: `${child.props.className || ''} ${
        controlProps.className || 'opacity-40 cursor-not-allowed pointer-events-auto'
      }`.trim(),
    });
  }

  return children;
};

/**
 * Pre-configured Permission Action Button using PermissionControlled
 */
export interface PermissionActionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'role'>,
    PermissionControlOptions {
  children: ReactNode;
  variantClassName?: string;
  buttonRole?: string;
}

export const PermissionActionButton: React.FC<PermissionActionButtonProps> = ({
  children,
  className = '',
  variantClassName = '',
  permission,
  permissions,
  requireAll,
  entityType,
  action,
  role,
  roles,
  prohibitedRoles,
  unauthorizedTooltip,
  mode = 'disable',
  disabled,
  projectId,
  onClick,
  ...buttonProps
}) => {
  return (
    <PermissionControlled
      permission={permission}
      permissions={permissions}
      requireAll={requireAll}
      entityType={entityType}
      action={action}
      role={role}
      roles={roles}
      prohibitedRoles={prohibitedRoles}
      unauthorizedTooltip={unauthorizedTooltip}
      mode={mode}
      disabled={disabled}
      projectId={projectId}
    >
      <button
        type="button"
        className={`${variantClassName} ${className}`.trim()}
        onClick={onClick}
        {...buttonProps}
      >
        {children}
      </button>
    </PermissionControlled>
  );
};

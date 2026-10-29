import React, { ReactNode } from 'react';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateUserPermission } from './rbac';
import { Button, ButtonProps } from '@/shared/components/Button';

export interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  pagePermission?: string;
  requireAll?: boolean;
  context?: PermissionEvaluationContext;
  fallback?: ReactNode;
  children: ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  permissions,
  pagePermission,
  requireAll = false,
  context,
  fallback = null,
  children,
}) => {
  const { user } = useCurrentUser();

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  let isAllowed = true;

  if (pagePermission) {
    const code = pagePermission.startsWith('page.') ? pagePermission : `page.${pagePermission}`;
    isAllowed = evaluateUserPermission(user, code, evalContext);
  } else if (permission) {
    isAllowed = evaluateUserPermission(user, permission, evalContext);
  } else if (permissions && permissions.length > 0) {
    isAllowed = requireAll
      ? permissions.every((p) => evaluateUserPermission(user, p, evalContext))
      : permissions.some((p) => evaluateUserPermission(user, p, evalContext));
  }

  if (!isAllowed) {
    return fallback ? <React.Fragment>{fallback}</React.Fragment> : null;
  }

  return <React.Fragment>{children}</React.Fragment>;
};

export interface PermissionButtonProps extends ButtonProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  context?: PermissionEvaluationContext;
  hideWhenUnauthorized?: boolean;
  unauthorizedTooltip?: string;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  permissions,
  requireAll = false,
  context,
  hideWhenUnauthorized = false,
  unauthorizedTooltip = 'You do not have permission for this action',
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...buttonProps
}) => {
  const { user } = useCurrentUser();

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  let isAllowed = true;
  if (permission) {
    isAllowed = evaluateUserPermission(user, permission, evalContext);
  } else if (permissions && permissions.length > 0) {
    isAllowed = requireAll
      ? permissions.every((p) => evaluateUserPermission(user, p, evalContext))
      : permissions.some((p) => evaluateUserPermission(user, p, evalContext));
  }

  if (!isAllowed && hideWhenUnauthorized) {
    return null;
  }

  const isActuallyDisabled = disabled || !isAllowed;

  return (
    <Button
      {...buttonProps}
      disabled={isActuallyDisabled}
      title={!isAllowed ? unauthorizedTooltip : buttonProps.title}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      className={`${className} ${
        !isAllowed ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
      }`}
    >
      {children}
    </Button>
  );
};

export interface PermissionMenuItemProps {
  permission?: string;
  permissions?: string[];
  context?: PermissionEvaluationContext;
  hideWhenUnauthorized?: boolean;
  icon?: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export const PermissionMenuItem: React.FC<PermissionMenuItemProps> = ({
  permission,
  permissions,
  context,
  hideWhenUnauthorized = true,
  icon,
  label,
  onClick,
  className = '',
  disabled = false,
}) => {
  const { user } = useCurrentUser();

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  let isAllowed = true;
  if (permission) {
    isAllowed = evaluateUserPermission(user, permission, evalContext);
  } else if (permissions && permissions.length > 0) {
    isAllowed = permissions.some((p) => evaluateUserPermission(user, p, evalContext));
  }

  if (!isAllowed && hideWhenUnauthorized) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={isAllowed && !disabled ? onClick : undefined}
      disabled={!isAllowed || disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-md transition-colors ${
        !isAllowed || disabled
          ? 'opacity-40 cursor-not-allowed text-slate-500'
          : 'text-slate-200 hover:bg-slate-800 hover:text-white'
      } ${className}`}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

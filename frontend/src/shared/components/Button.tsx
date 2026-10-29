import type React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../utils/cn';
import { Loader2 } from 'lucide-react';
import { usePermissionControl, type PermissionControlMode } from '@/core/permissions/PermissionControl';
import type { PermissionKey } from '@/types/identity';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** RBAC: Required permission key (e.g., 'shot.create', 'task.bulk_update') */
  permission?: PermissionKey | string;
  /** RBAC: Array of permission keys */
  permissions?: (PermissionKey | string)[];
  /** RBAC: Require all permissions if array provided */
  requireAll?: boolean;
  /** RBAC: Entity type for CRUD checking */
  entityType?: string;
  /** RBAC: Action type for checking */
  action?: string;
  /** RBAC: Required role name(s) */
  role?: string | string[];
  roles?: string | string[];
  /** RBAC: Prohibited role(s) */
  prohibitedRoles?: string[];
  /** RBAC: Custom unauthorized tooltip */
  unauthorizedTooltip?: string;
  /** RBAC: Mode when unauthorized: 'disable' (default) or 'hide' */
  permissionMode?: PermissionControlMode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  id,
  permission,
  permissions,
  requireAll,
  entityType,
  action,
  role,
  roles,
  prohibitedRoles,
  unauthorizedTooltip,
  permissionMode = 'disable',
  title,
  onClick,
  ...props
}) => {
  const hasPermissionGating = Boolean(
    permission ||
    (permissions && permissions.length > 0) ||
    entityType ||
    action ||
    role ||
    roles ||
    (prohibitedRoles && prohibitedRoles.length > 0)
  );

  const permResult = usePermissionControl({
    permission,
    permissions,
    requireAll,
    entityType,
    action,
    role,
    roles,
    prohibitedRoles,
    unauthorizedTooltip,
    mode: permissionMode,
    disabled: Boolean(disabled),
  });

  if (hasPermissionGating && !permResult.isAllowed && (permissionMode === 'hide' || permResult.mode === 'hide')) {
    return null;
  }

  const isUnauthorized = hasPermissionGating && !permResult.isAllowed;
  const isButtonDisabled = Boolean(disabled || isLoading || (isUnauthorized && permResult.mode === 'disable'));
  const tooltipText = isUnauthorized ? (permResult.reason || unauthorizedTooltip || title) : title;

  const baseStyles =
    'inline-flex flex-row items-center justify-center font-medium leading-none transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-lg whitespace-nowrap active:scale-[0.98] shrink-0';

  const sizeStyles = {
    xs: 'px-2.5 py-1 text-[11px] font-medium gap-1.5',
    sm: 'px-3 py-1.5 text-xs font-semibold gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base font-semibold gap-2.5',
  };

  const variantStyles = {
    primary:
      'accent-gradient-primary accent-gradient-primary-hover text-white font-medium shadow-md shadow-cyan-500/20 border border-white/20 focus:ring-cyan-500/50',
    secondary:
      'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-300 shadow-2xs focus:ring-cyan-500/50 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:active:bg-slate-750 dark:text-slate-200 dark:border-slate-700/80 dark:hover:border-slate-600',
    outline:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 hover:text-slate-900 border border-slate-300 hover:border-slate-400 shadow-2xs focus:ring-cyan-500 dark:bg-slate-950/60 dark:hover:bg-slate-900 dark:text-slate-200 dark:hover:text-white dark:border-slate-700/80 dark:hover:border-cyan-500/40',
    danger:
      'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold shadow-xs hover:shadow-sm focus:ring-rose-500 border border-rose-500/40',
    warning:
      'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold shadow-xs hover:shadow-sm focus:ring-amber-500 border border-amber-500/40',
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-900 border border-transparent focus:ring-slate-400 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70 dark:active:bg-slate-800',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isUnauthorized && permResult.mode === 'disable') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      id={id || `btn-${Math.random().toString(36).substring(2, 9)}`}
      className={cn(
        baseStyles,
        sizeStyles[size],
        variantStyles[variant],
        isUnauthorized && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={isButtonDisabled}
      title={tooltipText}
      aria-disabled={isButtonDisabled}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
      ) : (
        leftIcon && <span className="inline-flex items-center justify-center shrink-0">{leftIcon}</span>
      )}
      {children && <span className="inline-flex items-center leading-none whitespace-nowrap">{children}</span>}
      {!isLoading && rightIcon && (
        <span className="inline-flex items-center justify-center shrink-0">{rightIcon}</span>
      )}
    </button>
  );
};

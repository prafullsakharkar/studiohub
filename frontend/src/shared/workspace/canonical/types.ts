import type React from 'react';
import type { PermissionEvaluationContext } from '@/types/identity';

export type WorkspaceActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';

export interface WorkspaceActionConfirm {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface WorkspaceAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: WorkspaceActionVariant;
  disabled?: boolean;
  loading?: boolean;
  visible?: boolean;
  danger?: boolean;
  shortcut?: string;
  tooltip?: string;
  className?: string;
  dividerBefore?: boolean;
  permission?: string;
  permissions?: string[];
  requireAllPermissions?: boolean;
  permissionContext?: PermissionEvaluationContext;
  confirm?: WorkspaceActionConfirm;
  onClick: (e?: React.MouseEvent) => void | Promise<void>;
}

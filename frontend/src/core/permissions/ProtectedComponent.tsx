import React from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Role, AnyPermission } from '@/types/auth';

interface ProtectedComponentProps {
  roles?: Role | Role[];
  permissions?: AnyPermission | AnyPermission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  roles,
  permissions,
  children,
  fallback = null,
}) => {
  const { hasRole, hasPermission } = useAuth();

  const roleCheck = roles ? hasRole(roles) : true;
  const permissionCheck = permissions ? hasPermission(permissions) : true;

  if (roleCheck && permissionCheck) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

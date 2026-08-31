import React from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { AnyPermission } from '@/types/auth';

interface HasPermissionProps {
  permission: AnyPermission | AnyPermission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const HasPermission: React.FC<HasPermissionProps> = ({
  permission,
  children,
  fallback = null,
}) => {
  const { hasPermission } = useAuth();
  if (hasPermission(permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

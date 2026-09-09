import React from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { AnyPermission } from '@/types/auth';

interface CanProps {
  permission: AnyPermission | AnyPermission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const { can } = useAuth();
  if (can(permission)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

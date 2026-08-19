import React from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Permission } from '@/types/auth';

interface CanProps {
  permission: Permission | Permission[];
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

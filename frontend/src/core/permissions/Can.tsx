import { useAuth } from '@/modules/auth';
import React from 'react';
;
import { Permission } from '@/types/identity';

interface CanProps {
  permission: Permission | Permission[] | string | string[];
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

import { useAuth } from '@/modules/auth';
import React from 'react';
;
import { Role } from '@/types/identity';

interface HasRoleProps {
  role: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const HasRole: React.FC<HasRoleProps> = ({ role, children, fallback = null }) => {
  const { hasRole } = useAuth();
  if (hasRole(role)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
};

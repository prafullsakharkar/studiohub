import React from 'react';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Role } from '@/types/auth';

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

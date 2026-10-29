import React, { ReactNode } from 'react';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { PermissionEvaluationContext } from '@/types/identity';
import { canAccessField } from '../fieldPermissionEngine';

export interface FieldPermissionGateProps {
  entityType: string;
  field: string;
  action?: 'view' | 'edit';
  context?: PermissionEvaluationContext;
  fallback?: ReactNode;
  children: ReactNode;
}

export const FieldPermissionGate: React.FC<FieldPermissionGateProps> = ({
  entityType,
  field,
  action = 'view',
  context,
  fallback = null,
  children,
}) => {
  const { user } = useCurrentUser();

  const evalContext: PermissionEvaluationContext = {
    ...context,
  };

  const isAllowed = canAccessField(user, entityType, field, action, evalContext);

  if (!isAllowed) {
    return fallback ? <React.Fragment>{fallback}</React.Fragment> : null;
  }

  return <React.Fragment>{children}</React.Fragment>;
};

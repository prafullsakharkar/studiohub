import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { evaluateUserPermission, hasElevatedAccess } from '@/core/permissions/rbac';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { PermissionEvaluationContext } from '@/types/identity';
import { PermissionScope } from '@/types/identity';

export interface PermissionRouteProps {
  permission?: string;
  pagePermission?: string;
  permissions?: string[];
  requireAny?: boolean;
  requireAdmin?: boolean;
  scope?: PermissionScope;
  context?: PermissionEvaluationContext;
  fallbackPath?: string;
  children?: React.ReactNode;
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({
  permission,
  pagePermission,
  permissions,
  requireAny = false,
  requireAdmin = false,
  scope,
  context,
  fallbackPath = '/forbidden',
  children,
}) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useCurrentUser();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <LoadingSpinner size="lg" label="Checking route permissions..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const evalContext: PermissionEvaluationContext = {
    scope: scope || context?.scope,
    ...context,
  };

  let isAllowed = true;

  if (pagePermission) {
    const code = pagePermission.startsWith('page.') ? pagePermission : `page.${pagePermission}`;
    isAllowed = evaluateUserPermission(user, code, evalContext);
  }

  if (isAllowed && permission) {
    isAllowed = evaluateUserPermission(user, permission, evalContext);
  }

  if (isAllowed && permissions && permissions.length > 0) {
    isAllowed = requireAny
      ? permissions.some((p) => evaluateUserPermission(user, p, evalContext))
      : permissions.every((p) => evaluateUserPermission(user, p, evalContext));
  }

  if (isAllowed && requireAdmin) {
    isAllowed = hasElevatedAccess(user);
  }

  if (!isAllowed) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

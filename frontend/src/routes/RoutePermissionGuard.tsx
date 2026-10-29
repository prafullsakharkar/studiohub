import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import {
  evaluateRouteAccess,
  getRoutePermissionMetadata,
  extractRouteParams,
} from '@/core/permissions/routePermissionsRegistry';
import { logger } from '@/core/logging/logger';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export interface RoutePermissionGuardProps {
  children?: React.ReactNode;
  fallbackPath?: string;
}

/**
 * Registry-driven route guard for AppLayout content (fail-closed).
 *
 * ADR-0033: every route declared in ROUTE_PERMISSIONS_REGISTRY is enforced,
 * unconditionally — no "provisioned-aware" bypass. Unregistered routes
 * inside the protected shell are allowed but logged (registry coverage is
 * verified by tests; new routes must be added to the registry).
 */
export const RoutePermissionGuard: React.FC<RoutePermissionGuardProps> = ({
  children,
  fallbackPath = '/forbidden',
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

  const meta = getRoutePermissionMetadata(location.pathname);

  const required =
    (meta ? [meta.pagePermission, ...(meta.permissions || [])].filter(Boolean) : []) as string[];

  // No registry metadata or no permissions required -> nothing to enforce
  // (the surrounding AuthenticatedRoute still protects the shell).
  if (!meta || required.length === 0) {
    if (!meta) {
      logger.warn('routes', 'route_guard.unregistered_path', { path: location.pathname });
    }
    return children ? <>{children}</> : <Outlet />;
  }

  const extractedParams = meta?.path ? extractRouteParams(meta.path, location.pathname) : {};
  const extractedProjectId =
    extractedParams.projectId ||
    (meta?.path.includes('/projects/') || meta?.path.includes('/shows/')
      ? extractedParams.id || extractedParams.showId
      : undefined);

  const result = evaluateRouteAccess(user, location.pathname, {
    projectId: extractedProjectId,
  });

  if (!result.allowed) {
    logger.warn('routes', 'route_guard.denied', {
      path: location.pathname,
      reason: result.reason,
      requiredPermission: result.requiredPermission,
    });
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

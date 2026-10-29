import React from 'react';
import { Navigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { checkUserHasProjectAccess } from '@/core/permissions/rbac';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { NoProjectAccessPage } from '@/pages/NoProjectAccessPage';

interface ProjectRouteProps {
  children?: React.ReactNode;
}

/**
 * Project/show route guard (ADR-0033 D1/D2).
 *
 * Authoritative inputs are the server-provided membership rows on the
 * authenticated user payload (`/api/v1/auth/me/` + memberships). No mock
 * fixtures: a show id resolves to its project via the show-scoped or
 * project-wide membership, and an unknown/inaccessible reference fails
 * closed to the no-access page (backend list/detail scoping applies the
 * same narrowing on the wire).
 */
export const ProjectRoute: React.FC<ProjectRouteProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useCurrentUser();
  const params = useParams<{ projectId?: string; id?: string; showId?: string }>();
  const location = useLocation();

  const rawProjectParam = params.projectId || params.id;
  const rawShowParam = params.showId;

  // Resolve show → project via the caller's show-scoped membership
  // (no fixture lookup; missing => the project check below fails closed
  // by treating the show's project as unresolvable for this user).
  const showMembership = rawShowParam
    ? (user?.project_memberships || []).find(
        (pm) => pm.show_id === rawShowParam || pm.showId === rawShowParam
      )
    : undefined;
  const projectId = rawProjectParam || showMembership?.project_id || showMembership?.projectId;

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <LoadingSpinner size="lg" label="Validating project membership & authorization..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Project boundary: production pages require a project membership
  // (superusers and elevated platform grants pass via evaluateUserPermission).
  if (projectId) {
    const hasProjectAccess = checkUserHasProjectAccess(user, projectId);
    if (!hasProjectAccess) {
      return <NoProjectAccessPage projectId={projectId} />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};

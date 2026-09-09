import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Role, Permission } from '@/types/auth';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

interface ProtectedRouteProps {
  roles?: Role | Role[];
  permissions?: Permission | Permission[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ roles, permissions }) => {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" label="Verifying security credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !hasRole(roles)) {
    return <Navigate to="/forbidden" replace />;
  }

  if (permissions && !hasPermission(permissions)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};

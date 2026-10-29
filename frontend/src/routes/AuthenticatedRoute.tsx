import { shouldForcePasswordChange, useAuth } from '@/modules/auth';
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
;
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

interface AuthenticatedRouteProps {
  children?: React.ReactNode;
}

export const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <LoadingSpinner size="lg" label="Verifying StudioHub credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (shouldForcePasswordChange(user) && location.pathname !== '/auth/change-password') {
    return <Navigate to="/auth/change-password" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

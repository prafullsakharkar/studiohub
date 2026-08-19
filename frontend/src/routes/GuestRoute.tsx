import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export const GuestRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" label="Checking session state..." />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

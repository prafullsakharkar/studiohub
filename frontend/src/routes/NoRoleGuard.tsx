import React from 'react';
import { Outlet } from 'react-router-dom';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { hasAnyAccess } from '@/core/permissions/hasAnyAccess';
import { NoRolePage } from '@/pages/NoRolePage';

export interface NoRoleGuardProps {
  children?: React.ReactNode;
}

/**
 * Closes the app shell to a signed-in user who has no role: no superuser flag, no permission and no
 * project membership. They see only NoRolePage (with sign out) on every path until an administrator
 * assigns a role. Sits inside AuthenticatedRoute, which has already sent anonymous users to /login
 * and settled password change / MFA enrollment.
 */
export const NoRoleGuard: React.FC<NoRoleGuardProps> = ({ children }) => {
  const { user, isLoading } = useCurrentUser();

  // AuthenticatedRoute already shows the loading state; render nothing rather than flash the page.
  if (isLoading || !user) return null;

  if (!hasAnyAccess(user)) return <NoRolePage />;

  return children ? <>{children}</> : <Outlet />;
};

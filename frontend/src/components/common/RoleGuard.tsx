import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@/types/user.types';

export interface RoleGuardProps {
  userRole?: UserRole | null;
  allowedRoles: UserRole[];
  children?: ReactNode;
  fallbackRedirect?: string;
}

/**
 * RoleGuard — Guard ensuring user holds one of the required platform roles.
 * If role mismatch, redirects to the user's role portal or login.
 */
export function RoleGuard({
  userRole,
  allowedRoles,
  children,
  fallbackRedirect,
}: RoleGuardProps) {
  if (!userRole || !allowedRoles.includes(userRole)) {
    const target = fallbackRedirect ?? (userRole ? `/${userRole}/dashboard` : '/login');
    return <Navigate to={target} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default RoleGuard;

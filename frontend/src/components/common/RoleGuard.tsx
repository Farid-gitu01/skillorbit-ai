import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/user.types';

export interface RoleGuardProps {
  userRole?: UserRole | null;
  allowedRoles: UserRole[];
  children?: ReactNode;
  fallbackRedirect?: string;
}

/**
 * RoleGuard — Guard ensuring user holds one of the required platform roles.
 * Automatically accesses useAuth() by default, with optional prop overrides.
 * If role mismatch, redirects to the user's role portal or login.
 */
export function RoleGuard({
  userRole: propUserRole,
  allowedRoles,
  children,
  fallbackRedirect,
}: RoleGuardProps) {
  const auth = useAuth();
  const userRole = propUserRole !== undefined ? propUserRole : auth.user?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    const target = fallbackRedirect ?? (userRole ? `/${userRole}/dashboard` : '/login');
    return <Navigate to={target} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default RoleGuard;

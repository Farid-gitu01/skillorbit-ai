import type { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';

export interface ProtectedRouteProps {
  isAuthenticated?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute — Route guard ensuring user authentication.
 * If authentication state is pending, shows a minimal accessible loading state.
 * If unauthenticated, redirects to `/login` preserving target location in `state.from`.
 */
export function ProtectedRoute({
  isAuthenticated = false,
  isLoading = false,
  children,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-midnight-navy text-muted-slate text-sm">
        Checking authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;

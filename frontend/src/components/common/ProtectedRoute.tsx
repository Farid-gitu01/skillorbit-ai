import type { ReactNode } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export interface ProtectedRouteProps {
  isAuthenticated?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute — Route guard ensuring user authentication.
 * Automatically accesses useAuth() by default, with optional prop overrides.
 * If authentication state is pending, displays an accessible loading indicator.
 * If unauthenticated, redirects to `/login` preserving target location in `state.from`.
 */
export function ProtectedRoute({
  isAuthenticated: propIsAuthenticated,
  isLoading: propIsLoading,
  children,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const location = useLocation();
  const auth = useAuth();

  const isAuthenticated = propIsAuthenticated ?? auth.isAuthenticated;
  const isLoading = propIsLoading ?? auth.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-midnight-navy text-muted-slate text-sm gap-3">
        <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
        <p className="font-medium">Checking session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;

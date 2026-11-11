import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout, AuthLayout, DashboardLayout } from '@/components/layout';
import { ProtectedRoute, RoleGuard } from '@/components/common';
import type { AuthState } from '@/types/user.types';

export interface AppRoutesProps {
  auth?: AuthState;
}

/**
 * AppRoutes — Central declarative route configuration for SkillOrbit AI.
 *
 * Implements the architecture specified in Phase 2.0.5:
 * - Public routes under AppLayout and AuthLayout
 * - Role-segmented protected routes with ProtectedRoute and RoleGuard:
 *   - /seeker/*
 *   - /employer/*
 *   - /provider/*
 *   - /admin/*
 */
export function AppRoutes({ auth }: AppRoutesProps) {
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isLoading = auth?.isLoading ?? false;
  const userRole = auth?.user?.role ?? null;

  return (
    <Routes>
      {/* ── Public General Routes ─────────────────────────────────────────── */}
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <div className="py-12 text-center">
              <h1 className="text-3xl font-bold text-brand-blue mb-2">Welcome to SkillOrbit AI</h1>
              <p className="text-muted-slate max-w-lg mx-auto">
                AI-Powered Career Development &amp; Opportunity Platform.
              </p>
            </div>
          }
        />
      </Route>

      {/* ── Public Authentication Routes ──────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route
          path="login"
          element={
            <div className="text-center text-sm text-muted-slate py-4">
              Authentication Portal (Phase 2.1)
            </div>
          }
        />
        <Route
          path="register"
          element={
            <div className="text-center text-sm text-muted-slate py-4">
              Registration Portal (Phase 2.1)
            </div>
          }
        />
        <Route
          path="forgot-password"
          element={
            <div className="text-center text-sm text-muted-slate py-4">
              Password Reset Request (Phase 2.1)
            </div>
          }
        />
        <Route
          path="reset-password/:token"
          element={
            <div className="text-center text-sm text-muted-slate py-4">
              Reset Password Confirmation (Phase 2.1)
            </div>
          }
        />
      </Route>

      {/* ── Protected Job Seeker Portal ────────────────────────────────────── */}
      <Route
        path="seeker"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
            <RoleGuard userRole={userRole} allowedRoles={['seeker']}>
              <DashboardLayout role="seeker" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<div className="p-4 text-muted-slate">Job Seeker Dashboard Foundation</div>}
        />
      </Route>

      {/* ── Protected Employer Portal ──────────────────────────────────────── */}
      <Route
        path="employer"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
            <RoleGuard userRole={userRole} allowedRoles={['employer']}>
              <DashboardLayout role="employer" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<div className="p-4 text-muted-slate">Employer Dashboard Foundation</div>}
        />
      </Route>

      {/* ── Protected Training Provider Portal ─────────────────────────────── */}
      <Route
        path="provider"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
            <RoleGuard userRole={userRole} allowedRoles={['provider']}>
              <DashboardLayout role="provider" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<div className="p-4 text-muted-slate">Training Provider Dashboard Foundation</div>}
        />
      </Route>

      {/* ── Protected Admin Portal ─────────────────────────────────────────── */}
      <Route
        path="admin"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={isLoading}>
            <RoleGuard userRole={userRole} allowedRoles={['admin']}>
              <DashboardLayout role="admin" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route
          path="dashboard"
          element={<div className="p-4 text-muted-slate">Admin Dashboard Foundation</div>}
        />
      </Route>

      {/* ── 404 Not Found Fallback ────────────────────────────────────────── */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-midnight-navy text-surface-white text-center">
            <h1 className="text-4xl font-bold text-brand-blue mb-2">404</h1>
            <p className="text-muted-slate mb-6">The requested page does not exist.</p>
            <a href="/" className="text-sm font-semibold text-brand-cyan hover:underline">
              Return Home
            </a>
          </div>
        }
      />
    </Routes>
  );
}

export default AppRoutes;

import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AppLayout, AuthLayout, DashboardLayout } from '@/components/layout';
import { ProtectedRoute, RoleGuard } from '@/components/common';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from '@/pages/auth';
import {
  SeekerDashboardPage,
  SeekerProfilePage,
  ResumeManagementPage,
  JobSearchPage,
  JobDetailsPage,
  ApplicationManagementPage,
  SavedJobsPage,
  NotificationsPage,
  AiResumeAnalysisPage,
  AiSkillGapRoadmapPage,
  AiJobInsightsPage,
  AiCareerAssistantPage,
} from '@/pages/seeker';
import {
  EmployerDashboardPage,
  OrganizationProfilePage,
  EmployerJobsPage,
  JobFormPage,
  EmployerJobDetailsPage,
  EmployerApplicationsPage,
  EmployerApplicationDetailsPage,
  EmployerCandidatesPage,
  EmployerCandidateDetailsPage,
  EmployerNotificationsPage,
} from '@/pages/employer';
import {
  ProviderDashboardPage,
  ProviderProfilePage,
  ProviderCoursesPage,
  CourseFormPage,
  ProviderCourseDetailsPage,
  ProviderEngagementsPage,
  ProviderEngagementDetailsPage,
  ProviderNotificationsPage,
} from '@/pages/provider';
import { AdminAuditLogsPage, AdminCoursesPage, AdminDashboardPage, AdminEmployerDetailsPage, AdminEmployersPage, AdminJobDetailsPage, AdminJobsPage, AdminNotificationsPage, AdminProviderDetailsPage, AdminProvidersPage, AdminUserDetailsPage, AdminUsersPage, AdminVerificationsPage } from '@/pages/admin';
import { LandingPage } from '@/pages/landing';
import { Button } from '@/components/ui';

/**
 * AppRoutes — Central declarative route configuration for SkillOrbit AI.
 *
 * Implements Phase 2.1:
 * - Public routes under AppLayout
 * - Public authentication screens under AuthLayout
 * - Role-segmented protected portals with ProtectedRoute and RoleGuard:
 *   - /seeker/*
 *   - /employer/*
 *   - /provider/*
 *   - /admin/*
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* ── Public General Routes ─────────────────────────────────────────── */}
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
      </Route>

      {/* ── Public Authentication Routes ──────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="verify-email/:token" element={<VerifyEmailPage />} />
      </Route>

      {/* ── Protected Job Seeker Portal ────────────────────────────────────── */}
      <Route path="dashboard" element={<Navigate to="/seeker/dashboard" replace />} />
      <Route
        path="seeker"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['seeker']}>
              <DashboardLayout role="seeker" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SeekerDashboardPage />} />
        <Route path="profile" element={<SeekerProfilePage />} />
        <Route path="resume" element={<ResumeManagementPage />} />
        <Route path="jobs" element={<JobSearchPage />} />
        <Route path="jobs/:id" element={<JobDetailsPage />} />
        <Route path="applications" element={<ApplicationManagementPage />} />
        <Route path="saved-jobs" element={<SavedJobsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="ai/resume" element={<AiResumeAnalysisPage />} />
        <Route path="ai/skill-gap" element={<AiSkillGapRoadmapPage />} />
        <Route path="ai/job-matches" element={<AiJobInsightsPage />} />
        <Route path="ai/assistant" element={<AiCareerAssistantPage />} />
      </Route>

      {/* ── Protected Employer Portal ──────────────────────────────────────── */}
      <Route
        path="employer"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['employer']}>
              <DashboardLayout role="employer" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<EmployerDashboardPage />} />
        <Route path="organization" element={<OrganizationProfilePage />} />
        <Route path="jobs" element={<EmployerJobsPage />} />
        <Route path="jobs/new" element={<JobFormPage />} />
        <Route path="jobs/:id" element={<EmployerJobDetailsPage />} />
        <Route path="jobs/:id/edit" element={<JobFormPage />} />
        <Route path="applications" element={<EmployerApplicationsPage />} />
        <Route path="applications/:id" element={<EmployerApplicationDetailsPage />} />
        <Route path="candidates" element={<EmployerCandidatesPage />} />
        <Route path="candidates/:id" element={<EmployerCandidateDetailsPage />} />
        <Route path="notifications" element={<EmployerNotificationsPage />} />
      </Route>

      {/* ── Protected Training Provider Portal ─────────────────────────────── */}
      <Route
        path="provider"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['provider']}>
              <DashboardLayout role="provider" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ProviderDashboardPage />} />
        <Route path="profile" element={<ProviderProfilePage />} />
        <Route path="courses" element={<ProviderCoursesPage />} />
        <Route path="courses/new" element={<CourseFormPage />} />
        <Route path="courses/:id" element={<ProviderCourseDetailsPage />} />
        <Route path="courses/:id/edit" element={<CourseFormPage />} />
        <Route path="courses/:id/learners" element={<ProviderEngagementsPage />} />
        <Route path="engagements" element={<ProviderEngagementsPage />} />
        <Route path="engagements/:id" element={<ProviderEngagementDetailsPage />} />
        <Route path="notifications" element={<ProviderNotificationsPage />} />
      </Route>

      {/* ── Protected Admin Portal ─────────────────────────────────────────── */}
      <Route
        path="admin"
        element={
          <ProtectedRoute>
            <RoleGuard allowedRoles={['admin']}>
              <DashboardLayout role="admin" />
            </RoleGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailsPage />} />
        <Route path="employers" element={<AdminEmployersPage />} />
        <Route path="employers/:id" element={<AdminEmployerDetailsPage />} />
        <Route path="providers" element={<AdminProvidersPage />} />
        <Route path="providers/:id" element={<AdminProviderDetailsPage />} />
        <Route path="verifications" element={<AdminVerificationsPage />} />
        <Route path="jobs" element={<AdminJobsPage />} />
        <Route path="jobs/:id" element={<AdminJobDetailsPage />} />
        <Route path="courses" element={<AdminCoursesPage />} />
        <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
      </Route>

      {/* ── 404 Not Found Fallback ────────────────────────────────────────── */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-midnight-navy text-surface-white text-center">
            <h1 className="text-5xl font-extrabold text-brand-blue mb-2">404</h1>
            <h2 className="text-lg font-semibold text-surface-white mb-1">Page Not Found</h2>
            <p className="text-xs text-muted-slate mb-6 max-w-sm">
              The page you are looking for does not exist or may have been moved.
            </p>
            <Link to="/">
              <Button variant="primary" size="sm">
                Return Home
              </Button>
            </Link>
          </div>
        }
      />
    </Routes>
  );
}

export default AppRoutes;

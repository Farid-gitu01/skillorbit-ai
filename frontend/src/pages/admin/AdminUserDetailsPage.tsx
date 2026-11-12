import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Building2,
  ExternalLink,
  GraduationCap,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AdminActionDialog } from '@/components/admin/AdminActionDialog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { adminService } from '@/services/admin.service';
import { normalizeApiError } from '@/services/api';
import type { AdminUserDetailData } from '@/types/admin.types';
import {
  formatAdminTimestamp,
  getAccountStatusBadge,
  getRoleBadge,
  getVerificationBadge,
} from '@/utils/admin-validation';

export function AdminUserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentAdmin } = useAuth();

  const [detail, setDetail] = useState<AdminUserDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dialogNextActive, setDialogNextActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadDetail = async () => {
      try {
        const res = await adminService.getUserById(id);
        if (active) {
          setDetail(res);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(normalizeApiError(err).message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadDetail();
    return () => {
      active = false;
    };
  }, [id]);

  const handleStatusSubmit = async (payload: { reason: string }) => {
    if (!detail || dialogNextActive === null) return;
    const updated = await adminService.updateUserStatus(detail.user._id, {
      isActive: dialogNextActive,
      reason: payload.reason || undefined,
    });
    setDetail((prev) => (prev ? { ...prev, user: updated.user } : null));
    setFeedback(updated.message);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Users
          </Button>
        </Link>
        <Alert variant="error">{error ?? 'User record not found.'}</Alert>
      </div>
    );
  }

  const { user, roleSummary, activities } = detail;
  const roleBadge = getRoleBadge(user.role);
  const statusBadge = getAccountStatusBadge(user.isActive);
  const isProtected = user.role === 'admin' || user._id === currentAdmin?._id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/users">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            All Users
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {user.role === 'employer' && (
            <Link to={`/admin/employers/${user._id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                Employer Workspace View
              </Button>
            </Link>
          )}
          {user.role === 'provider' && (
            <Link to={`/admin/providers/${user._id}`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <GraduationCap className="w-3.5 h-3.5" />
                Provider Workspace View
              </Button>
            </Link>
          )}
          {!isProtected && (
            <Button
              size="sm"
              variant={user.isActive ? 'danger' : 'secondary'}
              className="gap-1.5 text-xs"
              onClick={() => setDialogNextActive(!user.isActive)}
            >
              {user.isActive ? (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  Suspend Account
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  Reinstate Account
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}

      {/* Account Header */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-surface-white">{user.name}</h1>
                <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                {isProtected && (
                  <Badge variant="purple">
                    <Shield className="w-3 h-3 mr-1 inline" /> Protected Admin Account
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-slate">{user.email}</p>
            </div>
            <div className="text-xs text-muted-slate space-y-0.5 sm:text-right">
              <p>Created: {formatAdminTimestamp(user.createdAt)}</p>
              <p>Last Login: {formatAdminTimestamp(user.lastLoginAt)}</p>
            </div>
          </div>

          {!user.isActive && (
            <Alert variant="warning">
              Account suspended{user.suspendedAt ? ` on ${formatAdminTimestamp(user.suspendedAt)}` : ''}:{' '}
              {user.suspensionReason ?? 'Administrative action'}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Role Context & Profile Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-surface-white">
              Role & Profile Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {roleSummary.type === 'seeker' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-midnight-navy p-3 border border-navy-surface">
                    <p className="text-muted-slate">Applications Submitted</p>
                    <p className="text-lg font-bold text-surface-white mt-0.5">
                      {roleSummary.applicationsCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-midnight-navy p-3 border border-navy-surface">
                    <p className="text-muted-slate">Saved Resumes</p>
                    <p className="text-lg font-bold text-surface-white mt-0.5">
                      {roleSummary.resumesCount ?? 0}
                    </p>
                  </div>
                </div>
                {roleSummary.profile ? (
                  <div className="space-y-2 pt-2">
                    <p className="font-medium text-surface-white">
                      {roleSummary.profile.headline || 'Career Seeker Profile'}
                    </p>
                    {roleSummary.profile.location && (
                      <p className="text-muted-slate">Location: {roleSummary.profile.location}</p>
                    )}
                    {roleSummary.profile.availability && (
                      <p className="text-muted-slate">
                        Availability: {roleSummary.profile.availability}
                      </p>
                    )}
                    <p className="text-muted-slate">
                      Skills: {roleSummary.profile.skillsCount} · Experience:{' '}
                      {roleSummary.profile.experienceCount} · Education:{' '}
                      {roleSummary.profile.educationCount}
                    </p>
                    {roleSummary.profile.bio && (
                      <p className="text-muted-slate leading-relaxed">{roleSummary.profile.bio}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-slate">Seeker has not filled out their career profile yet.</p>
                )}
              </>
            )}

            {(roleSummary.type === 'employer' || roleSummary.type === 'provider') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-midnight-navy p-3 border border-navy-surface">
                    <p className="text-muted-slate">
                      {roleSummary.type === 'employer' ? 'Total Jobs Posted' : 'Total Courses'}
                    </p>
                    <p className="text-lg font-bold text-surface-white mt-0.5">
                      {roleSummary.type === 'employer'
                        ? (roleSummary.totalJobs ?? 0)
                        : (roleSummary.totalCourses ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-midnight-navy p-3 border border-navy-surface">
                    <p className="text-muted-slate">
                      {roleSummary.type === 'employer' ? 'Active Jobs' : 'Published Courses'}
                    </p>
                    <p className="text-lg font-bold text-surface-white mt-0.5">
                      {roleSummary.type === 'employer'
                        ? (roleSummary.activeJobs ?? 0)
                        : (roleSummary.publishedCourses ?? 0)}
                    </p>
                  </div>
                </div>
                {roleSummary.organization ? (
                  <div className="rounded-lg border border-navy-surface bg-midnight-navy p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-surface-white">
                        {roleSummary.organization.name}
                      </span>
                      <Badge
                        variant={
                          getVerificationBadge(roleSummary.organization.verificationStatus).variant
                        }
                      >
                        {getVerificationBadge(roleSummary.organization.verificationStatus).label}
                      </Badge>
                    </div>
                    {roleSummary.organization.industry && (
                      <p className="text-muted-slate">
                        Industry: {roleSummary.organization.industry}
                      </p>
                    )}
                    {roleSummary.organization.location && (
                      <p className="text-muted-slate">
                        Location: {roleSummary.organization.location}
                      </p>
                    )}
                    {roleSummary.organization.websiteUrl && (
                      <a
                        href={roleSummary.organization.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-brand-cyan hover:underline"
                      >
                        {roleSummary.organization.websiteUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-slate">No organization profile submitted yet.</p>
                )}
              </>
            )}

            {roleSummary.type === 'admin' && (
              <div className="rounded-lg border border-navy-surface bg-midnight-navy p-4 flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-brand-cyan shrink-0" />
                <p className="text-muted-slate">
                  System administrator account with full governance privileges. Protected from external modification.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Account Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-surface-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-cyan" />
              Recent Account Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {activities.length === 0 ? (
              <p className="text-xs text-muted-slate py-4 text-center">
                No audit events recorded for this account yet.
              </p>
            ) : (
              activities.map((entry) => (
                <div
                  key={entry._id}
                  className="rounded-lg border border-navy-surface bg-midnight-navy/60 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-surface-white">{entry.title}</span>
                    <span className="text-[10px] text-muted-slate">
                      {formatAdminTimestamp(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-slate">{entry.description}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {dialogNextActive !== null && (
        <AdminActionDialog
          open={dialogNextActive !== null}
          title={
            dialogNextActive ? `Reinstate ${user.name}` : `Suspend ${user.name}`
          }
          description={
            dialogNextActive
              ? 'This restores login and portal access for the user.'
              : 'Suspending immediately locks login and invalidates portal access.'
          }
          mode="user-status"
          confirmLabel={dialogNextActive ? 'Reinstate Account' : 'Confirm Suspension'}
          confirmVariant={dialogNextActive ? 'primary' : 'danger'}
          requireReason={!dialogNextActive}
          onClose={() => setDialogNextActive(null)}
          onSubmit={handleStatusSubmit}
        />
      )}
    </div>
  );
}

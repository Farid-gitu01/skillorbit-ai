import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  UserCheck,
  UserX,
  XCircle,
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
import { adminService } from '@/services/admin.service';
import { normalizeApiError } from '@/services/api';
import type { AdminProviderDetailData } from '@/types/admin.types';
import {
  formatAdminTimestamp,
  getAccountStatusBadge,
  getVerificationBadge,
} from '@/utils/admin-validation';

export function AdminProviderDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<AdminProviderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<
    | { kind: 'account'; nextIsActive: boolean }
    | { kind: 'verification'; decision: 'verified' | 'rejected' }
    | null
  >(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadDetail = async () => {
      try {
        const res = await adminService.getProviderById(id);
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

  const handleDialogSubmit = async (payload: { reason: string }) => {
    if (!detail || !activeDialog) return;
    if (activeDialog.kind === 'account') {
      const res = await adminService.updateUserStatus(detail.user._id, {
        isActive: activeDialog.nextIsActive,
        reason: payload.reason || undefined,
      });
      setDetail((prev) => (prev ? { ...prev, user: res.user } : null));
      setFeedback(res.message);
    } else if (detail.organization) {
      const res = await adminService.reviewVerification(detail.organization._id, {
        status: activeDialog.decision,
        reason: payload.reason,
      });
      setDetail((prev) => (prev ? { ...prev, organization: res.organization } : null));
      setFeedback(res.message);
    }
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link to="/admin/providers">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Providers
          </Button>
        </Link>
        <Alert variant="error">{error ?? 'Training provider record not found.'}</Alert>
      </div>
    );
  }

  const { user, organization, courses, activities } = detail;
  const accountBadge = getAccountStatusBadge(user.isActive);
  const verBadge = getVerificationBadge(organization?.verificationStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/providers">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            All Providers
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {organization && organization.verificationStatus !== 'verified' && (
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setActiveDialog({ kind: 'verification', decision: 'verified' })}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verify Provider
            </Button>
          )}
          {organization && organization.verificationStatus !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs text-red-400 border-red-500/40 hover:bg-red-500/10"
              onClick={() => setActiveDialog({ kind: 'verification', decision: 'rejected' })}
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject Verification
            </Button>
          )}
          <Button
            size="sm"
            variant={user.isActive ? 'danger' : 'secondary'}
            className="gap-1.5 text-xs"
            onClick={() => setActiveDialog({ kind: 'account', nextIsActive: !user.isActive })}
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
        </div>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-surface-white">
              Provider Account & Organization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-surface-white">{user.name}</span>
              <Badge variant={accountBadge.variant}>{accountBadge.label}</Badge>
              {organization && <Badge variant={verBadge.variant}>{verBadge.label}</Badge>}
            </div>
            <p className="text-muted-slate">{user.email}</p>

            {organization ? (
              <div className="rounded-lg border border-navy-surface bg-midnight-navy p-4 space-y-2">
                <p className="font-semibold text-surface-white">{organization.name}</p>
                {organization.specialization && (
                  <p className="text-brand-cyan text-[11px]">{organization.specialization}</p>
                )}
                {organization.description && (
                  <p className="text-muted-slate leading-relaxed">{organization.description}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-muted-slate">
                  {organization.industry && <p>Category: {organization.industry}</p>}
                  {organization.location && <p>Location: {organization.location}</p>}
                  {organization.contactEmail && <p>Email: {organization.contactEmail}</p>}
                  {organization.contactPhone && <p>Phone: {organization.contactPhone}</p>}
                </div>
                {organization.websiteUrl && (
                  <a
                    href={organization.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-brand-cyan hover:underline"
                  >
                    {organization.websiteUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {organization.verificationReason && (
                  <p className="text-[11px] text-muted-slate pt-1 border-t border-navy-surface">
                    Verification Note: {organization.verificationReason}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-slate">Provider organization profile not completed yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-surface-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-cyan" />
              Course Offerings ({courses.length})
            </CardTitle>
            <Link to="/admin/courses" className="text-xs text-brand-cyan hover:underline">
              Moderate Courses
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {courses.length === 0 ? (
              <p className="text-xs text-muted-slate py-4 text-center">
                No training courses created yet.
              </p>
            ) : (
              courses.map((course) => (
                <div
                  key={course._id}
                  className="rounded-lg border border-navy-surface bg-midnight-navy/60 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-surface-white truncate">
                      {course.title}
                    </span>
                    <Badge variant={course.status === 'published' ? 'success' : 'default'}>
                      {course.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-slate">
                    {course.category || 'General'} · {course.enrollmentCount} enrollments
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-surface-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-cyan" />
            Recent Activity ({activities.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activities.length === 0 ? (
            <p className="text-xs text-muted-slate">No recorded audit events for this provider.</p>
          ) : (
            activities.map((entry) => (
              <div
                key={entry._id}
                className="rounded-lg border border-navy-surface bg-midnight-navy/50 p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-medium text-surface-white">{entry.title}</p>
                  <p className="text-[11px] text-muted-slate">{entry.description}</p>
                </div>
                <span className="text-[10px] text-muted-slate shrink-0">
                  {formatAdminTimestamp(entry.createdAt)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {activeDialog && (
        <AdminActionDialog
          open={Boolean(activeDialog)}
          title={
            activeDialog.kind === 'account'
              ? activeDialog.nextIsActive
                ? `Reinstate ${user.name}`
                : `Suspend ${user.name}`
              : activeDialog.decision === 'verified'
                ? `Verify ${organization?.name ?? 'Provider'}`
                : `Reject Verification: ${organization?.name ?? 'Provider'}`
          }
          description={
            activeDialog.kind === 'account'
              ? 'Update provider account status with audit logging.'
              : 'Record a required verification decision reason and notify the provider.'
          }
          mode={activeDialog.kind === 'account' ? 'user-status' : 'verification'}
          confirmLabel={
            activeDialog.kind === 'account'
              ? activeDialog.nextIsActive
                ? 'Reinstate Account'
                : 'Confirm Suspension'
              : activeDialog.decision === 'verified'
                ? 'Approve Verification'
                : 'Confirm Rejection'
          }
          confirmVariant={
            (activeDialog.kind === 'account' && !activeDialog.nextIsActive) ||
            (activeDialog.kind === 'verification' && activeDialog.decision === 'rejected')
              ? 'danger'
              : 'primary'
          }
          requireReason={
            activeDialog.kind === 'verification' ||
            (activeDialog.kind === 'account' && !activeDialog.nextIsActive)
          }
          onClose={() => setActiveDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      )}
    </div>
  );
}

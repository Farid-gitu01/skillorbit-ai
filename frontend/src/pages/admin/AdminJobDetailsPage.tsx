import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, ShieldAlert } from 'lucide-react';
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
import type { AdminJobRecord, ContentModerationStatus } from '@/types/admin.types';
import { formatAdminTimestamp, getModerationBadge } from '@/utils/admin-validation';

export function AdminJobDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<AdminJobRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadJob = async () => {
      try {
        const res = await adminService.getJobById(id);
        if (active) {
          setJob(res);
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
    void loadJob();
    return () => {
      active = false;
    };
  }, [id]);

  const handleModerateSubmit = async (payload: {
    reason: string;
    moderationStatus?: ContentModerationStatus;
    contentStatus?: string;
  }) => {
    if (!job || !payload.moderationStatus) return;
    const res = await adminService.moderateJob(job._id, {
      moderationStatus: payload.moderationStatus,
      status: (payload.contentStatus as 'active' | 'closed' | 'draft') || undefined,
      reason: payload.reason,
    });
    setJob(res.job);
    setFeedback(res.message);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Link to="/admin/jobs">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Jobs
          </Button>
        </Link>
        <Alert variant="error">{error ?? 'Job listing not found.'}</Alert>
      </div>
    );
  }

  const modBadge = getModerationBadge(job.moderationStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/jobs">
          <Button size="sm" variant="outline" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            All Jobs
          </Button>
        </Link>

        <Button
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowDialog(true)}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Moderate Listing
        </Button>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-surface-white">{job.title}</h1>
            <Badge variant={job.status === 'active' ? 'success' : 'default'}>{job.status}</Badge>
            <Badge variant={modBadge.variant}>{modBadge.label}</Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-slate">
            <span>Organization: {job.organization?.name ?? 'Direct Employer'}</span>
            <span>Location: {job.location} ({job.locationType})</span>
            <span>Employment: {job.type}</span>
            <span>Experience: {job.experienceLevel}</span>
            <span>Applicants: {job.applicantCount}</span>
          </div>

          {job.employer && (
            <div className="flex items-center gap-3 pt-1">
              <Link
                to={`/admin/employers/${job.employer._id}`}
                className="inline-flex items-center gap-1.5 text-xs text-brand-cyan hover:underline"
              >
                <Building2 className="w-3.5 h-3.5" />
                Employer Account: {job.employer.name} ({job.employer.email})
              </Link>
            </div>
          )}

          {job.moderationReason && (
            <Alert variant={job.moderationStatus === 'rejected' ? 'error' : 'warning'}>
              Latest Moderation Decision ({job.moderationStatus}): {job.moderationReason}
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-surface-white">
              Job Description & Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-muted-slate leading-relaxed">
            <div>
              <h2 className="text-surface-white font-semibold mb-1">Description</h2>
              <p className="whitespace-pre-line">{job.description}</p>
            </div>
            {job.responsibilities && job.responsibilities.length > 0 && (
              <div>
                <h2 className="text-surface-white font-semibold mb-1">Responsibilities</h2>
                <ul className="list-disc pl-5 space-y-1">
                  {job.responsibilities.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {job.qualifications && job.qualifications.length > 0 && (
              <div>
                <h2 className="text-surface-white font-semibold mb-1">Qualifications</h2>
                <ul className="list-disc pl-5 space-y-1">
                  {job.qualifications.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-surface-white">
              Moderation History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {!job.moderationHistory || job.moderationHistory.length === 0 ? (
              <p className="text-muted-slate">No moderation changes logged for this job yet.</p>
            ) : (
              [...job.moderationHistory].reverse().map((item, idx) => {
                const histBadge = getModerationBadge(item.status);
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-navy-surface bg-midnight-navy p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={histBadge.variant}>{histBadge.label}</Badge>
                      <span className="text-[10px] text-muted-slate">
                        {formatAdminTimestamp(item.changedAt)}
                      </span>
                    </div>
                    {item.reason && <p className="text-muted-slate">{item.reason}</p>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <AdminActionDialog
        open={showDialog}
        title={`Moderate Job: ${job.title}`}
        description="Update job moderation status, adjust visibility, and record the required policy explanation."
        mode="job-moderation"
        confirmLabel="Apply Decision"
        confirmVariant="primary"
        requireReason
        initialModerationStatus={job.moderationStatus}
        initialContentStatus={job.status}
        onClose={() => setShowDialog(false)}
        onSubmit={handleModerateSubmit}
      />
    </div>
  );
}

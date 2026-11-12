import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Edit3,
  MapPin,
  Trash2,
  Users,
} from 'lucide-react';
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
import { normalizeApiError } from '@/services/api';
import { employerService } from '@/services/employer.service';
import type { Job, JobStatus } from '@/types/job.types';
import { formatDate, formatSalary, getJobStatusBadge } from '@/utils/job-helpers';

export function EmployerJobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialFlash =
    (location.state as { flashMessage?: string } | null)?.flashMessage ?? null;

  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(initialFlash);
  const [isMutating, setIsMutating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refreshJob = useCallback(async () => {
    if (!id) return;
    try {
      const fetched = await employerService.getJobById(id);
      setJob(fetched);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const fetched = await employerService.getJobById(id);
        if (active) {
          setJob(fetched);
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
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleStatusUpdate = async (
    nextStatus: Extract<JobStatus, 'draft' | 'active' | 'closed'>
  ) => {
    if (!job) return;
    setIsMutating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await employerService.updateJobStatus(job._id, nextStatus);
      setJob(res.job);
      setSuccessMsg(res.message);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!job) return;
    setIsMutating(true);
    setError(null);
    try {
      await employerService.deleteJob(job._id);
      navigate('/employer/jobs', { replace: true });
    } catch (err) {
      setError(normalizeApiError(err).message);
      setIsMutating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Link
          to="/employer/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Job Management
        </Link>
        <Alert variant="error" title="Could not load job details">
          {error}
        </Alert>
        <Button
          variant="primary"
          onClick={() => {
            setIsLoading(true);
            void refreshJob();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!job) return null;

  const statusInfo = getJobStatusBadge(job.status);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/employer/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to All Jobs
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/employer/applications?jobId=${job._id}`}>
            <Button variant="secondary" size="sm">
              <Users className="w-4 h-4 mr-1.5" />
              Applications ({job.applicantCount})
            </Button>
          </Link>
          <Link to={`/employer/jobs/${job._id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit3 className="w-4 h-4 mr-1.5" />
              Edit Job
            </Button>
          </Link>
          {job.status !== 'active' && (
            <Button
              variant="primary"
              size="sm"
              isLoading={isMutating}
              onClick={() => void handleStatusUpdate('active')}
            >
              Publish
            </Button>
          )}
          {job.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isMutating}
              onClick={() => void handleStatusUpdate('closed')}
            >
              Close Job
            </Button>
          )}
          {job.status === 'closed' && (
            <Button
              variant="ghost"
              size="sm"
              isLoading={isMutating}
              onClick={() => void handleStatusUpdate('draft')}
            >
              Move to Draft
            </Button>
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/40 rounded-btn px-2.5 py-1">
              <span className="text-xs text-red-200">Delete job?</span>
              <Button variant="danger" size="sm" isLoading={isMutating} onClick={() => void handleDelete()}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Header Summary */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold text-surface-white">{job.title}</h1>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-slate">
          {job.organization && (
            <span className="flex items-center gap-1.5 text-surface-white/90">
              <Building2 className="w-4 h-4 text-brand-cyan" />
              {job.organization.name}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            {job.location || 'Remote'} ({job.locationType ?? 'remote'})
          </span>
          <span className="flex items-center gap-1.5 capitalize">
            <Briefcase className="w-4 h-4" />
            {job.type ?? 'full-time'} • {job.experienceLevel ?? 'mid'} level
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {job.openings ?? 1} opening(s)
          </span>
          {job.applicationDeadline && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Deadline: {formatDate(job.applicationDeadline)}
            </span>
          )}
        </div>

        <div className="pt-2 border-t border-navy-surface flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <span className="text-muted-slate">Compensation: </span>
            <span className="font-medium text-surface-white">
              {job.salary && (job.salary.min !== undefined || job.salary.max !== undefined)
                ? `${job.salary.currency ?? 'USD'} ${job.salary.min?.toLocaleString() ?? '0'} - ${job.salary.max?.toLocaleString() ?? 'Open'} (${job.salary.isPublic ? 'Public' : 'Hidden from candidates'})`
                : formatSalary(job.salary)}
            </span>
          </div>
          <span className="text-xs text-muted-slate">
            Updated {formatDate(job.updatedAt)}
          </span>
        </div>
      </Card>

      {/* Body Details */}
      <Card>
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-surface-white/90 whitespace-pre-line leading-relaxed">
            {job.description}
          </p>

          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-navy-surface">
              <h3 className="text-base font-semibold text-surface-white">Responsibilities</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-surface-white/90">
                {job.responsibilities.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {job.qualifications && job.qualifications.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-navy-surface">
              <h3 className="text-base font-semibold text-surface-white">Required Qualifications</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-surface-white/90">
                {job.qualifications.map((item, idx) => (
                  <li key={`${item}-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 pt-4 border-t border-navy-surface">
            <h3 className="text-base font-semibold text-surface-white">Required Skills</h3>
            {job.skills.length === 0 ? (
              <p className="text-sm text-muted-slate">No specific skills listed.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <Badge key={skill._id} variant="primary">
                    {skill.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

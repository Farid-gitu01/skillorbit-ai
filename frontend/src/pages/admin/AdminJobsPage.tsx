import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { AdminActionDialog } from '@/components/admin/AdminActionDialog';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Skeleton,
} from '@/components/ui';
import { adminService } from '@/services/admin.service';
import { normalizeApiError } from '@/services/api';
import type {
  AdminJobRecord,
  AdminJobsQuery,
  ContentModerationStatus,
} from '@/types/admin.types';
import { formatAdminTimestamp, getModerationBadge } from '@/utils/admin-validation';

export function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJobRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<NonNullable<AdminJobsQuery['status']>>('all');
  const [moderationFilter, setModerationFilter] =
    useState<NonNullable<AdminJobsQuery['moderationStatus']>>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [moderatingJob, setModeratingJob] = useState<AdminJobRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadJobs = async () => {
      try {
        const res = await adminService.getJobs({
          q: debouncedSearch || undefined,
          status: statusFilter,
          moderationStatus: moderationFilter,
          page,
          limit: 12,
        });
        if (active) {
          setJobs(res.jobs);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.jobs.length);
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
    void loadJobs();
    return () => {
      active = false;
    };
  }, [debouncedSearch, statusFilter, moderationFilter, page]);

  const handleModerateSubmit = async (payload: {
    reason: string;
    moderationStatus?: ContentModerationStatus;
    contentStatus?: string;
  }) => {
    if (!moderatingJob || !payload.moderationStatus) return;
    const res = await adminService.moderateJob(moderatingJob._id, {
      moderationStatus: payload.moderationStatus,
      status: (payload.contentStatus as 'active' | 'closed' | 'draft') || undefined,
      reason: payload.reason,
    });
    setJobs((prev) => prev.map((item) => (item._id === res.job._id ? res.job : item)));
    setFeedback(res.message);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">Job Content Moderation</h1>
          <p className="text-xs text-muted-slate mt-1">
            Inspect platform job postings ({totalCount}), flag policy violations, or close non-compliant listings.
          </p>
        </div>
        <Link to="/admin/courses">
          <Button size="sm" variant="outline" className="text-xs">
            Moderate Courses
          </Button>
        </Link>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Search Jobs"
            placeholder="Job title, location, keyword..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Publication Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as NonNullable<AdminJobsQuery['status']>);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Job Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
              { value: 'closed', label: 'Closed' },
              { value: 'expired', label: 'Expired' },
            ]}
          />
          <Select
            label="Moderation State"
            value={moderationFilter}
            onChange={(e) => {
              setModerationFilter(
                e.target.value as NonNullable<AdminJobsQuery['moderationStatus']>
              );
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Moderation States' },
              { value: 'approved', label: 'Approved' },
              { value: 'flagged', label: 'Flagged' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Briefcase className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">No jobs matched filters</p>
            <p className="text-xs text-muted-slate">
              Adjust search or moderation filters to inspect other job postings.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const modBadge = getModerationBadge(job.moderationStatus);
            return (
              <Card key={job._id}>
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-surface-white">{job.title}</span>
                      <Badge variant={job.status === 'active' ? 'success' : 'default'}>
                        {job.status}
                      </Badge>
                      <Badge variant={modBadge.variant}>{modBadge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-slate">
                      {job.organization?.name ?? 'Direct Employer'} · {job.location} ({job.locationType})
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-slate">
                      <span>Owner: {job.employer?.name ?? 'Unknown'}</span>
                      <span>Applicants: {job.applicantCount}</span>
                      <span>Posted: {formatAdminTimestamp(job.createdAt)}</span>
                      {job.moderationReason && (
                        <span className="text-amber-300">Note: {job.moderationReason}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/admin/jobs/${job._id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 text-xs"
                      onClick={() => setModeratingJob(job)}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Moderate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-slate">
            Page {page} of {totalPages} ({totalCount} jobs)
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setIsLoading(true);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                setIsLoading(true);
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {moderatingJob && (
        <AdminActionDialog
          key={moderatingJob._id}
          open={Boolean(moderatingJob)}
          title={`Moderate Job: ${moderatingJob.title}`}
          description="Set moderation state, optional publication status, and record the required policy reason."
          mode="job-moderation"
          confirmLabel="Save Moderation Decision"
          confirmVariant="primary"
          requireReason
          initialModerationStatus={moderatingJob.moderationStatus}
          initialContentStatus={moderatingJob.status}
          onClose={() => setModeratingJob(null)}
          onSubmit={handleModerateSubmit}
        />
      )}
    </div>
  );
}

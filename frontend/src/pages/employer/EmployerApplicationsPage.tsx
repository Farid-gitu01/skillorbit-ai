import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
} from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { employerService } from '@/services/employer.service';
import type { PaginationMeta } from '@/types/api.types';
import type { Application, ApplicationStatus } from '@/types/application.types';
import type {
  EmployerApplicationJobOption,
  EmployerApplicationsStatusCounts,
} from '@/types/employer.types';
import { formatDate, formatFileSize, getApplicationStatusBadge } from '@/utils/job-helpers';

const INITIAL_STATUS_COUNTS: EmployerApplicationsStatusCounts = {
  all: 0,
  pending: 0,
  reviewed: 0,
  shortlisted: 0,
  accepted: 0,
  rejected: 0,
  withdrawn: 0,
};

type AppStatusFilter = 'all' | ApplicationStatus;
type AppSort = 'newest' | 'oldest' | 'match_desc';

export function EmployerApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialJobId = searchParams.get('jobId') ?? '';

  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<EmployerApplicationJobOption[]>([]);
  const [statusCounts, setStatusCounts] =
    useState<EmployerApplicationsStatusCounts>(INITIAL_STATUS_COUNTS);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, pages: 1 });

  const [jobFilter, setJobFilter] = useState(initialJobId);
  const [statusFilter, setStatusFilter] = useState<AppStatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sort, setSort] = useState<AppSort>('newest');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await employerService.getApplications({
        jobId: jobFilter || undefined,
        status: statusFilter,
        q: appliedSearch || undefined,
        sort,
        page,
        limit: 10,
      });
      setApplications(res.applications);
      setJobs(res.jobs);
      setStatusCounts(res.statusCounts);
      setMeta(res.meta);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, jobFilter, page, sort, statusFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await employerService.getApplications({
          jobId: jobFilter || undefined,
          status: statusFilter,
          q: appliedSearch || undefined,
          sort,
          page,
          limit: 10,
        });
        if (active) {
          setApplications(res.applications);
          setJobs(res.jobs);
          setStatusCounts(res.statusCounts);
          setMeta(res.meta);
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
  }, [appliedSearch, jobFilter, page, sort, statusFilter]);

  const handleJobChange = (nextJobId: string) => {
    setIsLoading(true);
    setJobFilter(nextJobId);
    setPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (nextJobId) {
      nextParams.set('jobId', nextJobId);
    } else {
      nextParams.delete('jobId');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleStatusTab = (nextStatus: AppStatusFilter) => {
    setIsLoading(true);
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const handleQuickStatus = async (
    applicationId: string,
    status: Exclude<ApplicationStatus, 'withdrawn'>
  ) => {
    setBusyAppId(applicationId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await employerService.updateApplicationStatus(applicationId, status);
      setSuccessMsg(res.message);
      await fetchApplications();
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setBusyAppId(null);
    }
  };

  const handleDownloadResume = async (resumeId: string, fileName: string) => {
    setDownloadingResumeId(resumeId);
    setError(null);
    try {
      await employerService.downloadCandidateResume(resumeId, fileName);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const statusTabs: Array<{ key: AppStatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'reviewed', label: 'Reviewed', count: statusCounts.reviewed },
    { key: 'shortlisted', label: 'Shortlisted', count: statusCounts.shortlisted },
    { key: 'accepted', label: 'Accepted', count: statusCounts.accepted },
    { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
    { key: 'withdrawn', label: 'Withdrawn', count: statusCounts.withdrawn },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-white">Application Management</h1>
        <p className="text-sm text-muted-slate mt-1">
          Review candidates across your posted jobs, inspect resumes safely, and manage hiring stages.
        </p>
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

      {/* Status Pills */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusTab(tab.key)}
              className={`px-3 py-1.5 rounded-btn text-xs sm:text-sm font-medium border transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-brand-blue/20 text-brand-cyan border-brand-blue/40'
                  : 'bg-navy border-navy-surface text-muted-slate hover:text-surface-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-navy-surface text-surface-white/90">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <Input
              label="Search Candidates or Job"
              placeholder="Candidate name, email, skill, or job..."
              prefixIcon={<Search className="w-4 h-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="md:col-span-4">
            <Select
              label="Filter by Job"
              value={jobFilter}
              onChange={(e) => handleJobChange(e.target.value)}
              options={[
                { value: '', label: 'All employer jobs' },
                ...jobs.map((j) => ({ value: j._id, label: j.title })),
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              label="Sort Order"
              value={sort}
              onChange={(e) => {
                setIsLoading(true);
                setSort(e.target.value as AppSort);
                setPage(1);
              }}
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'match_desc', label: 'Highest Match' },
              ]}
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1">
              Apply
            </Button>
            {(appliedSearch || jobFilter || statusFilter !== 'all' || sort !== 'newest') && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsLoading(true);
                  setSearchInput('');
                  setAppliedSearch('');
                  setStatusFilter('all');
                  setSort('newest');
                  setJobFilter('');
                  setPage(1);
                  setSearchParams({}, { replace: true });
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Applications List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-36 w-full rounded-card" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Users className="w-12 h-12 text-muted-slate/50 mx-auto" />
          <h2 className="text-lg font-semibold text-surface-white">No applications found</h2>
          <p className="text-sm text-muted-slate max-w-md mx-auto">
            {statusCounts.all === 0
              ? 'Once candidates apply to your published jobs, their applications will appear here.'
              : 'No applications match your current job, status, or keyword filters.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const seeker =
              typeof app.seeker === 'object' && app.seeker !== null
                ? app.seeker
                : { _id: '', name: 'Candidate', email: '' };
            const jobObj = typeof app.job === 'object' && app.job !== null ? app.job : null;
            const statusInfo = getApplicationStatusBadge(app.status);
            const isBusy = busyAppId === app._id;
            const isWithdrawn = app.status === 'withdrawn';

            return (
              <Card key={app._id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        to={`/employer/applications/${app._id}`}
                        className="text-lg font-semibold text-surface-white hover:text-brand-cyan transition-colors"
                      >
                        {seeker.name}
                      </Link>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {typeof app.aiMatchScore === 'number' && (
                        <Badge variant="primary">{app.aiMatchScore}% AI Match</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-slate">
                      {app.candidateProfile?.headline && (
                        <span className="text-surface-white/90">{app.candidateProfile.headline}</span>
                      )}
                      {seeker.email && <span>{seeker.email}</span>}
                      {app.candidateProfile?.location && <span>{app.candidateProfile.location}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-slate">
                      {jobObj && (
                        <span className="flex items-center gap-1 text-surface-white/80">
                          <Briefcase className="w-3.5 h-3.5 text-brand-cyan" />
                          {jobObj.title}
                        </span>
                      )}
                      <span>Applied {formatDate(app.createdAt)}</span>
                      {app.resume && (
                        <span>
                          Resume: {app.resume.fileName} (
                          {app.resume.fileSize ? formatFileSize(app.resume.fileSize) : 'File'})
                        </span>
                      )}
                    </div>

                    {app.candidateProfile?.skills && app.candidateProfile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {app.candidateProfile.skills.slice(0, 6).map((skill) => (
                          <span
                            key={skill}
                            className="text-[11px] px-2 py-0.5 rounded bg-midnight-navy text-muted-slate border border-navy-surface"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {app.resume && !isWithdrawn && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={downloadingResumeId === app.resume._id}
                        onClick={() =>
                          void handleDownloadResume(app.resume!._id, app.resume!.fileName)
                        }
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Resume
                      </Button>
                    )}

                    {seeker._id && !isWithdrawn && (
                      <Link to={`/employer/candidates/${seeker._id}`}>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Profile
                        </Button>
                      </Link>
                    )}

                    <Link to={`/employer/applications/${app._id}`}>
                      <Button variant="secondary" size="sm">
                        Review Details
                      </Button>
                    </Link>

                    {!isWithdrawn && app.status !== 'shortlisted' && app.status !== 'accepted' && (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isBusy}
                        disabled={isBusy}
                        onClick={() => void handleQuickStatus(app._id, 'shortlisted')}
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1" />
                        Shortlist
                      </Button>
                    )}

                    {!isWithdrawn && app.status !== 'rejected' && app.status !== 'accepted' && (
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={isBusy}
                        disabled={isBusy}
                        onClick={() => void handleQuickStatus(app._id, 'rejected')}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>
                    )}

                    {app.status === 'shortlisted' && (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isBusy}
                        disabled={isBusy}
                        onClick={() => void handleQuickStatus(app._id, 'accepted')}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Accept
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {meta.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-slate">
                Showing page {meta.page} of {meta.pages} ({meta.total} applications)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => {
                    setIsLoading(true);
                    setPage((p) => Math.max(1, p - 1));
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.pages}
                  onClick={() => {
                    setIsLoading(true);
                    setPage((p) => p + 1);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

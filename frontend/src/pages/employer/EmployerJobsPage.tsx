import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Calendar,
  Edit3,
  Eye,
  MapPin,
  PlusCircle,
  Search,
  Trash2,
  Users,
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
import type { EmployerJobStatusCounts } from '@/types/employer.types';
import type { Job, JobLocationType, JobStatus, JobType } from '@/types/job.types';
import { JOB_LOCATION_TYPES, JOB_TYPES } from '@/utils/employer-validation';
import { formatDate, formatSalary, getJobStatusBadge } from '@/utils/job-helpers';

const INITIAL_COUNTS: EmployerJobStatusCounts = {
  all: 0,
  active: 0,
  draft: 0,
  closed: 0,
  expired: 0,
};

type StatusFilter = 'all' | JobStatus;
type SortOption = 'newest' | 'oldest' | 'deadline' | 'applicants';

export function EmployerJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statusCounts, setStatusCounts] = useState<EmployerJobStatusCounts>(INITIAL_COUNTS);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, pages: 1 });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [locationType, setLocationType] = useState<JobLocationType | ''>('');
  const [jobType, setJobType] = useState<JobType | ''>('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await employerService.getJobs({
        q: appliedSearch || undefined,
        status: statusFilter,
        locationType: locationType || undefined,
        type: jobType || undefined,
        sort,
        page,
        limit: 10,
      });
      setJobs(res.jobs);
      setStatusCounts(res.statusCounts);
      setMeta(res.meta);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, jobType, locationType, page, sort, statusFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await employerService.getJobs({
          q: appliedSearch || undefined,
          status: statusFilter,
          locationType: locationType || undefined,
          type: jobType || undefined,
          sort,
          page,
          limit: 10,
        });
        if (active) {
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
  }, [appliedSearch, jobType, locationType, page, sort, statusFilter]);

  const handleStatusTab = (next: StatusFilter) => {
    setIsLoading(true);
    setStatusFilter(next);
    setPage(1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAppliedSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearFilters = () => {
    setIsLoading(true);
    setSearchInput('');
    setAppliedSearch('');
    setStatusFilter('all');
    setLocationType('');
    setJobType('');
    setSort('newest');
    setPage(1);
  };

  const handleStatusChange = async (
    id: string,
    nextStatus: Extract<JobStatus, 'draft' | 'active' | 'closed'>
  ) => {
    setBusyJobId(id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await employerService.updateJobStatus(id, nextStatus);
      setSuccessMsg(res.message);
      await fetchJobs();
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setBusyJobId(null);
    }
  };

  const handleDeleteJob = async (id: string) => {
    setBusyJobId(id);
    setError(null);
    setSuccessMsg(null);
    try {
      await employerService.deleteJob(id);
      setConfirmDeleteId(null);
      setSuccessMsg('Job deleted successfully');
      await fetchJobs();
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setBusyJobId(null);
    }
  };

  const statusTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All Jobs', count: statusCounts.all },
    { key: 'active', label: 'Published', count: statusCounts.active },
    { key: 'draft', label: 'Drafts', count: statusCounts.draft },
    { key: 'closed', label: 'Closed', count: statusCounts.closed },
    { key: 'expired', label: 'Expired', count: statusCounts.expired },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">Job Management</h1>
          <p className="text-sm text-muted-slate mt-1">
            Create, publish, update, and monitor your organization&apos;s job postings.
          </p>
        </div>
        <Link to="/employer/jobs/new">
          <Button variant="primary" size="md">
            <PlusCircle className="w-4 h-4 mr-2" />
            Post a New Job
          </Button>
        </Link>
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

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusTab(tab.key)}
              className={`px-3.5 py-2 rounded-btn text-sm font-medium border transition-colors flex items-center gap-2 ${
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

      {/* Filters Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <Input
              label="Search Jobs"
              placeholder="Title, keyword, or location..."
              prefixIcon={<Search className="w-4 h-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              label="Work Mode"
              value={locationType}
              onChange={(e) => {
                setIsLoading(true);
                setLocationType(e.target.value as JobLocationType | '');
                setPage(1);
              }}
              options={[
                { value: '', label: 'All modes' },
                ...JOB_LOCATION_TYPES,
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              label="Employment"
              value={jobType}
              onChange={(e) => {
                setIsLoading(true);
                setJobType(e.target.value as JobType | '');
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                ...JOB_TYPES,
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              label="Sort By"
              value={sort}
              onChange={(e) => {
                setIsLoading(true);
                setSort(e.target.value as SortOption);
                setPage(1);
              }}
              options={[
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
                { value: 'deadline', label: 'Soonest Deadline' },
                { value: 'applicants', label: 'Most Applicants' },
              ]}
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" variant="secondary" size="md" className="flex-1">
              Search
            </Button>
            {(appliedSearch || statusFilter !== 'all' || locationType || jobType || sort !== 'newest') && (
              <Button type="button" variant="ghost" size="md" onClick={handleClearFilters}>
                Reset
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Jobs Listing */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-card" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Briefcase className="w-12 h-12 text-muted-slate/50 mx-auto" />
          <h2 className="text-lg font-semibold text-surface-white">No jobs match your filters</h2>
          <p className="text-sm text-muted-slate max-w-md mx-auto">
            {statusCounts.all === 0
              ? 'Get started by creating a draft or publishing your first opening for candidates.'
              : 'Try adjusting your search keywords, status filter, or employment type.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {statusCounts.all === 0 ? (
              <Link to="/employer/jobs/new">
                <Button variant="primary">Create Job Posting</Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const statusInfo = getJobStatusBadge(job.status);
            const isBusy = busyJobId === job._id;
            const isConfirmingDelete = confirmDeleteId === job._id;

            return (
              <Card key={job._id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        to={`/employer/jobs/${job._id}`}
                        className="text-lg font-semibold text-surface-white hover:text-brand-cyan transition-colors"
                      >
                        {job.title}
                      </Link>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      {job.type && (
                        <Badge variant="default" className="capitalize">
                          {job.type}
                        </Badge>
                      )}
                      {job.openings && job.openings > 1 && (
                        <Badge variant="info">{job.openings} openings</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-slate">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location || 'Remote'} ({job.locationType ?? 'remote'})
                      </span>
                      <span>{formatSalary(job.salary)}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-brand-cyan" />
                        {job.applicantCount} applicants
                      </span>
                      {job.applicationDeadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Deadline: {formatDate(job.applicationDeadline)}
                        </span>
                      )}
                      <span>Created {formatDate(job.createdAt)}</span>
                    </div>

                    {job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {job.skills.slice(0, 6).map((skill) => (
                          <span
                            key={skill._id}
                            className="text-[11px] px-2 py-0.5 rounded bg-midnight-navy text-muted-slate border border-navy-surface"
                          >
                            {skill.name}
                          </span>
                        ))}
                        {job.skills.length > 6 && (
                          <span className="text-[11px] text-muted-slate">
                            +{job.skills.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link to={`/employer/applications?jobId=${job._id}`}>
                      <Button variant="secondary" size="sm">
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        Applications ({job.applicantCount})
                      </Button>
                    </Link>
                    <Link to={`/employer/jobs/${job._id}`}>
                      <Button variant="outline" size="sm" aria-label={`View ${job.title}`}>
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                    </Link>
                    <Link to={`/employer/jobs/${job._id}/edit`}>
                      <Button variant="ghost" size="sm" aria-label={`Edit ${job.title}`}>
                        <Edit3 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                    </Link>

                    {job.status !== 'active' && (
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isBusy}
                        disabled={isBusy}
                        onClick={() => void handleStatusChange(job._id, 'active')}
                      >
                        Publish
                      </Button>
                    )}
                    {job.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={isBusy}
                        disabled={isBusy}
                        onClick={() => void handleStatusChange(job._id, 'closed')}
                      >
                        Close
                      </Button>
                    )}
                    {job.status === 'closed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={isBusy}
                        disabled={isBusy}
                        onClick={() => void handleStatusChange(job._id, 'draft')}
                      >
                        Move to Draft
                      </Button>
                    )}

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/40 rounded-btn px-2 py-1">
                        <span className="text-xs text-red-200">Delete?</span>
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={isBusy}
                          onClick={() => void handleDeleteJob(job._id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        aria-label={`Delete ${job.title}`}
                        className="text-red-400 hover:text-red-300"
                        onClick={() => setConfirmDeleteId(job._id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-slate">
                Showing page {meta.page} of {meta.pages} ({meta.total} total jobs)
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

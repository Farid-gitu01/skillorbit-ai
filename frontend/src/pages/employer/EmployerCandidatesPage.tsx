import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Download,
  ExternalLink,
  MapPin,
  Search,
  Star,
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
import type { ApplicationStatus } from '@/types/application.types';
import type { EmployerCandidateSummary } from '@/types/employer.types';
import type { Job } from '@/types/job.types';
import { formatDate, getApplicationStatusBadge } from '@/utils/job-helpers';

type CandidateStatusFilter = 'all' | Exclude<ApplicationStatus, 'withdrawn'>;

export function EmployerCandidatesPage() {
  const [candidates, setCandidates] = useState<EmployerCandidateSummary[]>([]);
  const [shortlistedCount, setShortlistedCount] = useState(0);
  const [employerJobs, setEmployerJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 12, total: 0, pages: 1 });

  const [shortlistedOnly, setShortlistedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CandidateStatusFilter>('all');
  const [jobFilter, setJobFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadJobsForFilter = async () => {
      try {
        const res = await employerService.getJobs({ limit: 50, page: 1 });
        if (active) {
          setEmployerJobs(res.jobs);
        }
      } catch {
        // Non-blocking filter enhancement
      }
    };
    void loadJobsForFilter();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await employerService.getCandidates({
          q: appliedSearch || undefined,
          status: statusFilter,
          jobId: jobFilter || undefined,
          shortlistedOnly,
          page,
          limit: 12,
        });
        if (active) {
          setCandidates(res.candidates);
          setShortlistedCount(res.shortlistedCount);
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
  }, [appliedSearch, jobFilter, page, shortlistedOnly, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAppliedSearch(searchInput.trim());
    setPage(1);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">Candidate Directory</h1>
          <p className="text-sm text-muted-slate mt-1">
            Browse applicants who have applied to your jobs, review qualifications, and manage shortlisted talent.
          </p>
        </div>

        {/* All Applicants vs Shortlisted Candidates Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setShortlistedOnly(false);
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-btn text-sm font-medium border transition-colors flex items-center gap-2 ${
              !shortlistedOnly
                ? 'bg-brand-blue/20 text-brand-cyan border-brand-blue/40'
                : 'bg-navy border-navy-surface text-muted-slate hover:text-surface-white'
            }`}
          >
            <Users className="w-4 h-4" />
            All Candidates
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setShortlistedOnly(true);
              setStatusFilter('all');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-btn text-sm font-medium border transition-colors flex items-center gap-2 ${
              shortlistedOnly
                ? 'bg-brand-violet/25 text-brand-purple border-brand-purple/40'
                : 'bg-navy border-navy-surface text-muted-slate hover:text-surface-white'
            }`}
          >
            <Star className="w-4 h-4" />
            Shortlisted ({shortlistedCount})
          </button>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <Input
              label="Search Candidates"
              placeholder="Name, skill, headline, or location..."
              prefixIcon={<Search className="w-4 h-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              label="Applied Job"
              value={jobFilter}
              onChange={(e) => {
                setIsLoading(true);
                setJobFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All posted jobs' },
                ...employerJobs.map((j) => ({ value: j._id, label: j.title })),
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              label="Application Stage"
              disabled={shortlistedOnly}
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value as CandidateStatusFilter);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All stages' },
                { value: 'pending', label: 'Pending' },
                { value: 'reviewed', label: 'Reviewed' },
                { value: 'shortlisted', label: 'Shortlisted' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" variant="secondary" className="flex-1">
              Search
            </Button>
            {(appliedSearch || jobFilter || statusFilter !== 'all' || shortlistedOnly) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsLoading(true);
                  setSearchInput('');
                  setAppliedSearch('');
                  setJobFilter('');
                  setStatusFilter('all');
                  setShortlistedOnly(false);
                  setPage(1);
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Candidates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-60 w-full rounded-card" />
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Users className="w-12 h-12 text-muted-slate/50 mx-auto" />
          <h2 className="text-lg font-semibold text-surface-white">
            {shortlistedOnly ? 'No shortlisted candidates yet' : 'No matching candidates found'}
          </h2>
          <p className="text-sm text-muted-slate max-w-md mx-auto">
            {shortlistedOnly
              ? 'Shortlist qualified applicants from your Applications view to build your talent pool.'
              : 'Candidates appear here automatically once they apply to any of your job postings.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((candidate) => {
              const latestBadge = getApplicationStatusBadge(candidate.latestApplication.status);
              const latestResume = candidate.latestApplication.resume;

              return (
                <Card key={candidate._id} className="p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/employer/candidates/${candidate._id}`}
                          className="text-base font-semibold text-surface-white hover:text-brand-cyan transition-colors block truncate"
                        >
                          {candidate.name}
                        </Link>
                        {candidate.profile.headline && (
                          <p className="text-xs text-muted-slate line-clamp-1 mt-0.5">
                            {candidate.profile.headline}
                          </p>
                        )}
                      </div>
                      {candidate.isShortlisted && (
                        <Badge variant="purple" className="shrink-0">
                          Shortlisted
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-muted-slate">
                      {candidate.profile.location && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {candidate.profile.location}
                        </p>
                      )}
                      <p className="flex items-center gap-1.5 text-surface-white/90">
                        <Briefcase className="w-3.5 h-3.5 text-brand-cyan" />
                        <span className="truncate">{candidate.latestApplication.job.title}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={latestBadge.variant}>{latestBadge.label}</Badge>
                      {candidate.highestMatchScore > 0 && (
                        <Badge variant="primary">{candidate.highestMatchScore}% Match</Badge>
                      )}
                      {candidate.applications.length > 1 && (
                        <Badge variant="default">
                          {candidate.applications.length} applications
                        </Badge>
                      )}
                    </div>

                    {candidate.profile.skills && candidate.profile.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.profile.skills.slice(0, 5).map((skill) => (
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

                  <div className="pt-3 border-t border-navy-surface flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-slate">
                      Applied {formatDate(candidate.latestApplication.createdAt)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {latestResume && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Download resume for ${candidate.name}`}
                          isLoading={downloadingResumeId === latestResume._id}
                          onClick={() =>
                            void handleDownloadResume(latestResume._id, latestResume.fileName)
                          }
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Link to={`/employer/candidates/${candidate._id}`}>
                        <Button variant="secondary" size="sm">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Profile
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {meta.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-slate">
                Showing page {meta.page} of {meta.pages} ({meta.total} candidates)
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
        </>
      )}
    </div>
  );
}

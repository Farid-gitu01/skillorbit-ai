import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { jobService } from '@/services';
import type {
  ExperienceLevel,
  Job,
  JobLocationType,
  JobType,
  PaginationMeta,
} from '@/types';
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
import { formatDate, formatSalary } from '@/utils/job-helpers';
import {
  Bookmark,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Search,
  Sparkles,
} from 'lucide-react';

export function JobSearchPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recommended, setRecommended] = useState<Job[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [locationTypeFilter, setLocationTypeFilter] = useState<JobLocationType | ''>('');
  const [jobTypeFilter, setJobTypeFilter] = useState<JobType | ''>('');
  const [experienceFilter, setExperienceFilter] = useState<ExperienceLevel | ''>('');
  const [sortOption, setSortOption] = useState<'newest' | 'oldest' | 'deadline'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await jobService.getJobs({
          q: searchQuery,
          location: locationFilter,
          locationType: locationTypeFilter,
          type: jobTypeFilter,
          experienceLevel: experienceFilter,
          sort: sortOption,
          page: currentPage,
          limit: 10,
        });
        if (active) {
          setJobs(result.jobs);
          setMeta(result.meta);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to fetch job listings';
          setError(msg);
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
  }, [
    searchQuery,
    locationFilter,
    locationTypeFilter,
    jobTypeFilter,
    experienceFilter,
    sortOption,
    currentPage,
    refreshTick,
  ]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const recs = await jobService.getRecommendedJobs();
        if (active) {
          setRecommended(recs.slice(0, 3));
        }
      } catch {
        // Optional recommendations
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);
    setRefreshTick((t) => t + 1);
  };

  const handleResetFilters = () => {
    setIsLoading(true);
    setError(null);
    setSearchQuery('');
    setLocationFilter('');
    setLocationTypeFilter('');
    setJobTypeFilter('');
    setExperienceFilter('');
    setSortOption('newest');
    setCurrentPage(1);
    setRefreshTick((t) => t + 1);
  };

  const handleToggleSave = async (jobId: string, currentlySaved?: boolean) => {
    try {
      if (currentlySaved) {
        await jobService.unsaveJob(jobId);
      } else {
        await jobService.saveJob(jobId);
      }
      setJobs((prev) =>
        prev.map((j) => (j._id === jobId ? { ...j, isSaved: !currentlySaved } : j))
      );
      setRecommended((prev) =>
        prev.map((j) => (j._id === jobId ? { ...j, isSaved: !currentlySaved } : j))
      );
    } catch {
      // Handled gracefully
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-white">Find Your Next Opportunity</h1>
        <p className="text-xs text-muted-slate">
          Search verified job postings tailored to your skillset and preferences
        </p>
      </div>

      {/* Recommended Strip (if available and no active query) */}
      {recommended.length > 0 && !searchQuery && !locationFilter && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-cyan">
            <Sparkles className="w-4 h-4" />
            <span>Recommended for Your Skills</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommended.map((job) => (
              <Card key={job._id} className="border-brand-blue/30 bg-brand-blue/5">
                <CardContent className="p-4 flex flex-col justify-between gap-3 h-full">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/seeker/jobs/${job._id}`}
                        className="text-sm font-semibold text-surface-white hover:text-brand-cyan line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleToggleSave(job._id, job.isSaved)}
                        aria-label={job.isSaved ? 'Unsave' : 'Save'}
                        className={`p-1 rounded ${
                          job.isSaved ? 'text-brand-cyan' : 'text-muted-slate hover:text-surface-white'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" fill={job.isSaved ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                    <p className="text-xs text-muted-slate">
                      {job.organization?.name ?? 'Verified Employer'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-navy-surface/50">
                    <span className="text-emerald-400 font-medium">{formatSalary(job.salary)}</span>
                    <Link to={`/seeker/jobs/${job._id}`} className="text-brand-cyan hover:underline">
                      Apply
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-slate absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by job title, skills, or keywords..."
                value={searchQuery}
                onChange={(e) => {
                  setIsLoading(true);
                  setError(null);
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-btn bg-midnight-navy border border-navy-surface text-surface-white placeholder:text-muted-slate focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>
            <Input
              placeholder="City / Country"
              value={locationFilter}
              onChange={(e) => {
                setIsLoading(true);
                setError(null);
                setLocationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="sm:w-44"
            />
            <Button type="submit" variant="primary" size="md">
              Search
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-navy-surface/60">
            <span className="text-xs text-muted-slate flex items-center gap-1.5 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </span>

            <Select
              value={locationTypeFilter}
              onChange={(e) => {
                setIsLoading(true);
                setError(null);
                setLocationTypeFilter(e.target.value as JobLocationType | '');
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Workplaces' },
                { value: 'remote', label: 'Remote' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'on-site', label: 'On-site' },
              ]}
            />

            <Select
              value={jobTypeFilter}
              onChange={(e) => {
                setIsLoading(true);
                setError(null);
                setJobTypeFilter(e.target.value as JobType | '');
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Job Types' },
                { value: 'full-time', label: 'Full-Time' },
                { value: 'part-time', label: 'Part-Time' },
                { value: 'contract', label: 'Contract' },
                { value: 'internship', label: 'Internship' },
                { value: 'freelance', label: 'Freelance' },
              ]}
            />

            <Select
              value={experienceFilter}
              onChange={(e) => {
                setIsLoading(true);
                setError(null);
                setExperienceFilter(e.target.value as ExperienceLevel | '');
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Experience Levels' },
                { value: 'entry', label: 'Entry Level' },
                { value: 'mid', label: 'Mid Level' },
                { value: 'senior', label: 'Senior' },
                { value: 'lead', label: 'Lead' },
                { value: 'executive', label: 'Executive' },
              ]}
            />

            <Select
              value={sortOption}
              onChange={(e) => {
                setIsLoading(true);
                setError(null);
                setSortOption(e.target.value as 'newest' | 'oldest' | 'deadline');
                setCurrentPage(1);
              }}
              options={[
                { value: 'newest', label: 'Sort: Newest First' },
                { value: 'oldest', label: 'Sort: Oldest First' },
                { value: 'deadline', label: 'Sort: Closing Soon' },
              ]}
            />

            <Button type="button" variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="error" title="Error Loading Jobs">
          {error}
        </Alert>
      )}

      {/* Results List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-slate">
          <span>Showing {jobs.length} of {meta.total} active opportunities</span>
          <span>Page {meta.page} of {meta.pages}</span>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-32 rounded-card" />
            <Skeleton className="h-32 rounded-card" />
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Briefcase className="w-10 h-10 text-muted-slate mx-auto opacity-40" />
              <h3 className="text-sm font-semibold text-surface-white">
                No matching jobs found
              </h3>
              <p className="text-xs text-muted-slate max-w-md mx-auto">
                Try adjusting your search keywords or clearing filters to explore more openings.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear All Filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card
                key={job._id}
                className="hover:border-brand-blue/50 transition-colors"
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          to={`/seeker/jobs/${job._id}`}
                          className="text-base font-bold text-surface-white hover:text-brand-cyan transition-colors"
                        >
                          {job.title}
                        </Link>
                        <p className="text-xs text-brand-cyan font-medium">
                          {job.organization?.name ?? 'Verified Employer'}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-slate line-clamp-2 max-w-2xl">
                      {job.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {job.location && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-slate">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location}
                        </span>
                      )}
                      {job.locationType && <Badge variant="primary">{job.locationType}</Badge>}
                      {job.type && <Badge variant="default">{job.type}</Badge>}
                      {job.experienceLevel && <Badge variant="info">{job.experienceLevel}</Badge>}
                      {job.skills?.slice(0, 4).map((skill) => (
                        <Badge key={skill._id} variant="purple">
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-navy-surface">
                    <div className="text-left md:text-right">
                      <p className="text-sm font-semibold text-emerald-400">
                        {formatSalary(job.salary)}
                      </p>
                      <p className="text-[11px] text-muted-slate flex items-center md:justify-end gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Posted {formatDate(job.createdAt)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleSave(job._id, job.isSaved)}
                        aria-label={job.isSaved ? 'Unsave job' : 'Save job'}
                        className={job.isSaved ? 'border-brand-blue text-brand-cyan' : ''}
                      >
                        <Bookmark
                          className="w-3.5 h-3.5"
                          fill={job.isSaved ? 'currentColor' : 'none'}
                        />
                      </Button>
                      <Link to={`/seeker/jobs/${job._id}`}>
                        <Button variant="primary" size="sm">
                          View & Apply
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => {
                setIsLoading(true);
                setError(null);
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>
            <span className="text-xs text-muted-slate px-3">
              Page {meta.page} of {meta.pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.pages}
              onClick={() => {
                setIsLoading(true);
                setError(null);
                setCurrentPage((p) => Math.min(meta.pages, p + 1));
              }}
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default JobSearchPage;

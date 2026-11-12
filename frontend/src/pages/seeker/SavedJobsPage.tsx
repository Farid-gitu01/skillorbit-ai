import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobService } from '@/services';
import type { Job } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '@/components/ui';
import { formatDate, formatSalary } from '@/utils/job-helpers';
import { Bookmark, Building2, Clock, MapPin, Trash2 } from 'lucide-react';

export function SavedJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await jobService.getSavedJobs();
        if (active) {
          setJobs(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to fetch saved jobs';
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
  }, []);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      await jobService.unsaveJob(id);
      setJobs((prev) => prev.filter((j) => j._id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove saved job';
      setError(msg);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">Saved Jobs</h1>
          <p className="text-xs text-muted-slate">
            Review bookmarked opportunities and apply whenever you are ready
          </p>
        </div>
        <Link to="/seeker/jobs">
          <Button variant="primary" size="sm">
            Discover More Jobs
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Bookmark className="w-10 h-10 text-muted-slate mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-surface-white">
              No saved jobs yet
            </h3>
            <p className="text-xs text-muted-slate max-w-md mx-auto">
              Bookmark interesting job postings while searching so you can revisit and apply later.
            </p>
            <Link to="/seeker/jobs">
              <Button variant="outline" size="sm">
                Browse Job Board
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job._id} className="hover:border-brand-blue/50 transition-colors">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Link
                    to={`/seeker/jobs/${job._id}`}
                    className="text-base font-bold text-surface-white hover:text-brand-cyan transition-colors"
                  >
                    {job.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-slate">
                    <span className="inline-flex items-center gap-1 text-brand-cyan font-medium">
                      <Building2 className="w-3.5 h-3.5" />
                      {job.organization?.name ?? 'Verified Employer'}
                    </span>
                    {job.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </span>
                    )}
                    {job.locationType && <Badge variant="primary">{job.locationType}</Badge>}
                    {job.type && <Badge>{job.type}</Badge>}
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
                      variant="ghost"
                      size="sm"
                      isLoading={removingId === job._id}
                      onClick={() => handleRemove(job._id)}
                      className="text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
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
    </div>
  );
}

export default SavedJobsPage;

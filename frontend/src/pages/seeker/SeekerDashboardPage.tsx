import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { seekerService, jobService } from '@/services';
import type { SeekerDashboardData } from '@/types';
import { useAuth } from '@/hooks/useAuth';
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
import { formatDate, formatSalary, getApplicationStatusBadge } from '@/utils/job-helpers';
import {
  ArrowRight,
  Bell,
  Bookmark,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Search,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export function SeekerDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<SeekerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await seekerService.getDashboardData();
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load dashboard statistics.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await seekerService.getDashboardData();
        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to load dashboard statistics.';
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

  const handleToggleSave = async (jobId: string, currentlySaved?: boolean) => {
    try {
      if (currentlySaved) {
        await jobService.unsaveJob(jobId);
      } else {
        await jobService.saveJob(jobId);
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          savedJobsCount: currentlySaved ? Math.max(0, prev.savedJobsCount - 1) : prev.savedJobsCount + 1,
          recommendedJobs: prev.recommendedJobs.map((j) =>
            j._id === jobId ? { ...j, isSaved: !currentlySaved } : j
          ),
        };
      });
    } catch {
      // Errors handled silently or shown via toast
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-card" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Dashboard Load Failed">
          {error ?? 'Unexpected error loading dashboard'}
        </Alert>
        <Button variant="primary" size="sm" onClick={loadDashboard}>
          Retry Loading
        </Button>
      </div>
    );
  }

  const displayName = data.user?.name ?? user?.name ?? 'Job Seeker';
  const completionPct = data.profileCompletion.percentage;

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Actions */}
      <div className="rounded-card bg-gradient-to-r from-navy via-navy to-brand-blue/20 border border-navy-surface p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-brand-cyan text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Career Command Center</span>
          </div>
          <h1 className="text-2xl font-bold text-surface-white">
            Welcome back, {displayName}
          </h1>
          <p className="text-xs text-muted-slate max-w-xl">
            {data.profile.headline || 'Complete your career profile and let SkillOrbit AI connect you to verified opportunities.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link to="/seeker/jobs">
            <Button variant="primary" size="sm" className="gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>Find Jobs</span>
            </Button>
          </Link>
          <Link to="/seeker/profile">
            <Button variant="outline" size="sm" className="gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Button>
          </Link>
          <Link to="/seeker/resume">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Resumes</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Profile Completion Reminder Alert */}
      {completionPct < 100 && (
        <Card className="border-brand-blue/30 bg-brand-blue/5">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-surface-white">
                  Profile Completion: {completionPct}%
                </span>
                <span className="text-[11px] text-brand-cyan">
                  Complete to boost AI match scores
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-navy-surface overflow-hidden">
                <div
                  className="h-full bg-brand-blue transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              {data.profileCompletion.missingFields.length > 0 && (
                <p className="text-[11px] text-muted-slate">
                  Missing: {data.profileCompletion.missingFields.join(', ')}
                </p>
              )}
            </div>
            <Link to="/seeker/profile">
              <Button variant="primary" size="sm" className="shrink-0">
                Complete Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-slate font-medium">Total Applications</p>
              <p className="text-2xl font-bold text-surface-white mt-1">
                {data.applicationStats.total}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-slate font-medium">Pending Review</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {data.applicationStats.pending}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-slate font-medium">Shortlisted</p>
              <p className="text-2xl font-bold text-brand-purple mt-1">
                {data.applicationStats.shortlisted}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-purple/15 text-brand-purple flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-slate font-medium">Saved Jobs</p>
              <p className="text-2xl font-bold text-brand-cyan mt-1">
                {data.savedJobsCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-brand-cyan/15 text-brand-cyan flex items-center justify-center">
              <Bookmark className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Recommended Jobs + Recent Applications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recommended Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recommended Jobs</CardTitle>
                <p className="text-xs text-muted-slate mt-0.5">
                  Opportunities matched to your skills and career interests
                </p>
              </div>
              <Link
                to="/seeker/jobs"
                className="text-xs text-brand-cyan hover:underline flex items-center gap-1"
              >
                <span>Browse All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {data.recommendedJobs.length === 0 ? (
                <div className="py-8 text-center space-y-2 border border-dashed border-navy-surface rounded-lg">
                  <p className="text-xs text-muted-slate">
                    No active job recommendations found yet.
                  </p>
                  <Link to="/seeker/jobs">
                    <Button variant="outline" size="sm">
                      Explore Open Positions
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.recommendedJobs.map((job) => (
                    <div
                      key={job._id}
                      className="p-4 rounded-lg bg-midnight-navy/60 border border-navy-surface hover:border-brand-blue/50 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              to={`/seeker/jobs/${job._id}`}
                              className="text-sm font-semibold text-surface-white hover:text-brand-cyan transition-colors line-clamp-1"
                            >
                              {job.title}
                            </Link>
                            <p className="text-xs text-muted-slate">
                              {job.organization?.name ?? 'Verified Employer'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleSave(job._id, job.isSaved)}
                            aria-label={job.isSaved ? 'Unsave job' : 'Save job'}
                            className={`p-1.5 rounded-md border transition-colors ${
                              job.isSaved
                                ? 'bg-brand-blue/20 border-brand-blue text-brand-cyan'
                                : 'border-navy-surface text-muted-slate hover:text-surface-white'
                            }`}
                          >
                            <Bookmark className="w-3.5 h-3.5" fill={job.isSaved ? 'currentColor' : 'none'} />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-slate">
                          {job.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.location}
                            </span>
                          )}
                          {job.locationType && <Badge variant="primary">{job.locationType}</Badge>}
                          {job.type && <Badge>{job.type}</Badge>}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-navy-surface/60 flex items-center justify-between text-xs">
                        <span className="text-emerald-400 font-medium">
                          {formatSalary(job.salary)}
                        </span>
                        <Link
                          to={`/seeker/jobs/${job._id}`}
                          className="text-brand-blue hover:text-brand-cyan font-medium"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Applications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recent Applications</CardTitle>
                <p className="text-xs text-muted-slate mt-0.5">
                  Track status updates on your submitted applications
                </p>
              </div>
              <Link
                to="/seeker/applications"
                className="text-xs text-brand-cyan hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentApplications.length === 0 ? (
                <div className="py-8 text-center space-y-2 border border-dashed border-navy-surface rounded-lg">
                  <p className="text-xs text-muted-slate">
                    You have not applied to any jobs yet.
                  </p>
                  <Link to="/seeker/jobs">
                    <Button variant="primary" size="sm">
                      Search Open Roles
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-navy-surface">
                  {data.recentApplications.map((app) => {
                    const statusBadge = getApplicationStatusBadge(app.status);
                    return (
                      <div
                        key={app._id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <Link
                            to={`/seeker/jobs/${app.job?._id}`}
                            className="text-sm font-medium text-surface-white hover:text-brand-cyan"
                          >
                            {app.job?.title ?? 'Job Position'}
                          </Link>
                          <p className="text-xs text-muted-slate">
                            {app.job?.organization?.name ?? 'Employer'} • Applied {formatDate(app.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {app.aiMatchScore !== undefined && (
                            <span className="text-xs text-brand-cyan font-medium">
                              {app.aiMatchScore}% Fit
                            </span>
                          )}
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3): Skills Overview + Recent Activity & Notifications */}
        <div className="space-y-6">
          {/* Skills Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Skills Overview</CardTitle>
              <Link to="/seeker/profile" className="text-xs text-brand-cyan hover:underline">
                Manage
              </Link>
            </CardHeader>
            <CardContent>
              {data.profile.skills.length === 0 ? (
                <div className="space-y-3 text-center py-4">
                  <p className="text-xs text-muted-slate">
                    No skills listed yet. Adding skills improves your job match accuracy.
                  </p>
                  <Link to="/seeker/profile">
                    <Button variant="outline" size="sm">
                      Add Skills
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.profile.skills.map((skill) => (
                    <Badge key={skill} variant="primary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity & Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-cyan" />
                <span>Recent Notifications</span>
              </CardTitle>
              <Link to="/seeker/notifications" className="text-xs text-brand-cyan hover:underline">
                All
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentActivity.length === 0 ? (
                <p className="text-xs text-muted-slate text-center py-4">
                  No recent notifications.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.recentActivity.map((item) => (
                    <div
                      key={item._id}
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        item.read
                          ? 'bg-midnight-navy/30 border-navy-surface text-muted-slate'
                          : 'bg-brand-blue/5 border-brand-blue/30 text-surface-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{item.title}</span>
                        <span className="text-[10px] text-muted-slate shrink-0">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      {item.message && <p className="text-[11px] opacity-90">{item.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default SeekerDashboardPage;

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  PlusCircle,
  Sparkles,
  UserCheck,
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
import { notificationService } from '@/services/notification.service';
import type { EmployerDashboardData } from '@/types/employer.types';
import {
  formatDate,
  formatSalary,
  getApplicationStatusBadge,
  getJobStatusBadge,
} from '@/utils/job-helpers';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-card" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-28 w-full rounded-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 w-full rounded-card lg:col-span-2" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    </div>
  );
}

export function EmployerDashboardPage() {
  const [data, setData] = useState<EmployerDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const dashboard = await employerService.getDashboard();
      setData(dashboard);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const dashboard = await employerService.getDashboard();
        if (active) {
          setData(dashboard);
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
  }, []);

  const handleRetry = () => {
    setIsLoading(true);
    setError(null);
    void fetchDashboard();
  };

  const handleMarkNotificationRead = async (id: string) => {
    setMarkingNotificationId(id);
    try {
      await notificationService.markAsRead(id);
      setData((prev) => {
        if (!prev) return prev;
        let decremented = 0;
        const updatedNotifications = prev.notifications.map((n) => {
          if (n._id === id && !n.read) {
            decremented = 1;
            return { ...n, read: true };
          }
          return n;
        });
        return {
          ...prev,
          notifications: updatedNotifications,
          unreadNotificationsCount: Math.max(0, prev.unreadNotificationsCount - decremented),
        };
      });
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setMarkingNotificationId(null);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Unable to load dashboard">
          {error}
        </Alert>
        <Button variant="primary" onClick={handleRetry}>
          Try Again
        </Button>
      </div>
    );
  }

  const dashboard = data!;
  const employerName = dashboard.user?.name?.split(' ')[0] ?? 'there';
  const orgName = dashboard.organization?.name;
  const completionPct = dashboard.organizationCompletion.percentage;

  const stats = [
    {
      label: 'Total Jobs Posted',
      value: dashboard.jobStats.total,
      icon: Briefcase,
      color: 'text-brand-cyan',
      bg: 'bg-brand-blue/15',
    },
    {
      label: 'Active Jobs',
      value: dashboard.jobStats.active,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
    },
    {
      label: 'Draft Jobs',
      value: dashboard.jobStats.draft,
      icon: FileText,
      color: 'text-amber-400',
      bg: 'bg-amber-500/15',
    },
    {
      label: 'Total Applications',
      value: dashboard.applicationStats.total,
      icon: Users,
      color: 'text-brand-cyan',
      bg: 'bg-brand-cyan/15',
    },
    {
      label: 'Pending Review',
      value: dashboard.applicationStats.pending,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/15',
    },
    {
      label: 'Shortlisted Candidates',
      value: dashboard.applicationStats.shortlisted,
      icon: UserCheck,
      color: 'text-brand-purple',
      bg: 'bg-brand-violet/20',
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Welcome Header & Quick Actions */}
      <Card className="p-6 bg-gradient-to-br from-navy via-navy to-brand-blue/10 border-brand-blue/25">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-cyan">
              <Sparkles className="w-4 h-4" />
              <span>Employer Hiring Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-white">
              Welcome back, {employerName}
            </h1>
            <p className="text-sm text-muted-slate max-w-2xl">
              {orgName
                ? `Manage hiring pipelines, review top applicants, and grow your team at ${orgName}.`
                : 'Set up your organization profile and start publishing roles to reach matched candidates.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/employer/jobs/new">
              <Button variant="primary" size="md">
                <PlusCircle className="w-4 h-4 mr-2" />
                Post a Job
              </Button>
            </Link>
            <Link to="/employer/applications">
              <Button variant="secondary" size="md">
                <Users className="w-4 h-4 mr-2" />
                Review Applications
              </Button>
            </Link>
            <Link to="/employer/candidates">
              <Button variant="outline" size="md">
                Browse Candidates
              </Button>
            </Link>
            <Link to="/employer/organization">
              <Button variant="ghost" size="md">
                <Building2 className="w-4 h-4 mr-2" />
                Company Profile
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Organization Profile Completion Banner / Card */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-brand-cyan" />
                <h2 className="text-base font-semibold text-surface-white">
                  Organization Profile Completion
                </h2>
                <Badge variant={completionPct >= 80 ? 'success' : 'warning'}>
                  {completionPct}%
                </Badge>
              </div>
              {orgName && (
                <span className="text-xs text-muted-slate hidden sm:inline">{orgName}</span>
              )}
            </div>
            <div className="w-full h-2.5 bg-navy-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all duration-500"
                style={{ width: `${completionPct}%` }}
                role="progressbar"
                aria-valuenow={completionPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Organization profile completion"
              />
            </div>
            {dashboard.organizationCompletion.missingFields.length > 0 ? (
              <p className="text-xs text-muted-slate">
                Missing to reach 100%:{' '}
                <span className="text-surface-white/90">
                  {dashboard.organizationCompletion.missingFields.slice(0, 4).join(', ')}
                  {dashboard.organizationCompletion.missingFields.length > 4
                    ? ` +${dashboard.organizationCompletion.missingFields.length - 4} more`
                    : ''}
                </span>
              </p>
            ) : (
              <p className="text-xs text-emerald-400">
                Your organization profile is complete and builds trust with candidates.
              </p>
            )}
          </div>

          <Link to="/employer/organization" className="shrink-0">
            <Button variant={completionPct < 100 ? 'primary' : 'outline'} size="sm">
              {dashboard.organization ? 'Update Profile' : 'Setup Organization'}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-slate">{stat.label}</p>
                  <p className="text-2xl font-bold text-surface-white mt-1.5">{stat.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 columns: Recent Jobs + Recent Applications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Job Postings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Recent Job Postings</CardTitle>
                <p className="text-xs text-muted-slate mt-0.5">
                  Your latest openings and application intake
                </p>
              </div>
              <Link
                to="/employer/jobs"
                className="text-xs font-medium text-brand-cyan hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {dashboard.recentJobs.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <Briefcase className="w-10 h-10 text-muted-slate/50 mx-auto" />
                  <p className="text-sm text-muted-slate">
                    You have not posted any jobs yet.
                  </p>
                  <Link to="/employer/jobs/new">
                    <Button variant="primary" size="sm">
                      Create Your First Job
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-navy-surface">
                  {dashboard.recentJobs.map((job) => {
                    const statusInfo = getJobStatusBadge(job.status);
                    return (
                      <div
                        key={job._id}
                        className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/employer/jobs/${job._id}`}
                              className="font-medium text-surface-white hover:text-brand-cyan transition-colors truncate"
                            >
                              {job.title}
                            </Link>
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-slate">
                            <span>{job.location || 'Remote'}</span>
                            <span className="capitalize">{job.locationType}</span>
                            <span>{formatSalary(job.salary)}</span>
                            <span>{job.applicantCount} applicants</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link to={`/employer/applications?jobId=${job._id}`}>
                            <Button variant="outline" size="sm">
                              Applicants
                            </Button>
                          </Link>
                          <Link to={`/employer/jobs/${job._id}/edit`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Applications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Recent Applications</CardTitle>
                <p className="text-xs text-muted-slate mt-0.5">
                  Latest candidates applying to your open positions
                </p>
              </div>
              <Link
                to="/employer/applications"
                className="text-xs font-medium text-brand-cyan hover:underline flex items-center gap-1"
              >
                Review all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {dashboard.recentApplications.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Users className="w-10 h-10 text-muted-slate/50 mx-auto" />
                  <p className="text-sm text-muted-slate">
                    No applications received yet. Publish a job to start receiving candidates.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-navy-surface">
                  {dashboard.recentApplications.map((app) => {
                    const seekerObj =
                      typeof app.seeker === 'object' && app.seeker !== null
                        ? app.seeker
                        : { _id: '', name: 'Candidate', email: '' };
                    const jobTitle =
                      typeof app.job === 'object' && app.job !== null
                        ? app.job.title
                        : 'Job Posting';
                    const appBadge = getApplicationStatusBadge(app.status);

                    return (
                      <div
                        key={app._id}
                        className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/employer/applications/${app._id}`}
                              className="font-medium text-surface-white hover:text-brand-cyan transition-colors truncate"
                            >
                              {seekerObj.name}
                            </Link>
                            <Badge variant={appBadge.variant}>{appBadge.label}</Badge>
                            {typeof app.aiMatchScore === 'number' && (
                              <Badge variant="primary">{app.aiMatchScore}% Match</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-slate truncate">
                            Applied for <span className="text-surface-white/90">{jobTitle}</span> •{' '}
                            {formatDate(app.createdAt)}
                          </p>
                        </div>
                        <Link to={`/employer/applications/${app._id}`} className="shrink-0">
                          <Button variant="secondary" size="sm">
                            Inspect
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Notifications + Recent Activity */}
        <div className="space-y-6">
          {/* Relevant Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>Notifications</CardTitle>
                {dashboard.unreadNotificationsCount > 0 && (
                  <Badge variant="primary">{dashboard.unreadNotificationsCount} new</Badge>
                )}
              </div>
              <Link
                to="/employer/notifications"
                className="text-xs font-medium text-brand-cyan hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {dashboard.notifications.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <Bell className="w-8 h-8 text-muted-slate/50 mx-auto" />
                  <p className="text-xs text-muted-slate">No recent notifications.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.notifications.map((item) => (
                    <div
                      key={item._id}
                      className={`p-3 rounded-lg border transition-colors ${
                        item.read
                          ? 'bg-midnight-navy/40 border-navy-surface'
                          : 'bg-brand-blue/10 border-brand-blue/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-surface-white">{item.title}</p>
                        {!item.read && (
                          <button
                            type="button"
                            onClick={() => void handleMarkNotificationRead(item._id)}
                            disabled={markingNotificationId === item._id}
                            className="text-[11px] text-brand-cyan hover:underline shrink-0"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-slate mt-1 line-clamp-2">{item.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-muted-slate/80">
                          {formatDate(item.createdAt)}
                        </span>
                        {item.link && (
                          <Link
                            to={item.link}
                            className="text-[11px] font-medium text-brand-cyan hover:underline"
                          >
                            Open
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-brand-cyan" />
                <CardTitle>Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {dashboard.recentActivity.length === 0 ? (
                <p className="text-xs text-muted-slate text-center py-6">
                  Activity will appear here as you create jobs and review candidates.
                </p>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentActivity.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-start gap-3 pb-3 border-b border-navy-surface last:border-b-0 last:pb-0"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-cyan mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-surface-white">{item.title}</p>
                        <p className="text-xs text-muted-slate mt-0.5">{item.description}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] text-muted-slate/70">
                            {formatDate(item.timestamp)}
                          </span>
                          {item.link && (
                            <Link
                              to={item.link}
                              className="text-[11px] text-brand-cyan hover:underline"
                            >
                              View
                            </Link>
                          )}
                        </div>
                      </div>
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

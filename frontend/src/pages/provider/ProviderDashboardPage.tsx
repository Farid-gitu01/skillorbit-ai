import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Archive,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  FileEdit,
  GraduationCap,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { providerService } from '@/services/provider.service';
import type { ProviderDashboardData } from '@/types/provider.types';
import { formatDate } from '@/utils/job-helpers';
import {
  formatCoursePrice,
  getCourseStatusBadge,
  getEngagementStatusBadge,
} from '@/utils/provider-validation';

export function ProviderDashboardPage() {
  const [data, setData] = useState<ProviderDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    try {
      const dashboard = await providerService.getDashboard();
      setData(dashboard);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const dashboard = await providerService.getDashboard();
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
    void init();
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-72 w-full rounded-card" />
            <Skeleton className="h-72 w-full rounded-card" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-56 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert variant="error" title="Unable to load provider dashboard">
          {error}
        </Alert>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            void loadDashboard();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  const user = data?.user;
  const organization = data?.organization;
  const completion = data?.organizationCompletion ?? { percentage: 0, missingFields: [] };
  const courseStats = data?.courseStats ?? {
    total: 0,
    published: 0,
    draft: 0,
    archived: 0,
    totalEnrollments: 0,
    averageRating: null,
  };
  const engagementStats = data?.engagementStats ?? {
    total: 0,
    pending: 0,
    enrolled: 0,
    active: 0,
    completed: 0,
    declined: 0,
    enquiries: 0,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left">
      {error && (
        <Alert variant="warning" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Welcome Header & Quick Actions */}
      <Card variant="elevated" className="border-brand-blue/25 bg-gradient-to-br from-navy via-navy to-midnight-navy">
        <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">
                <GraduationCap className="w-3.5 h-3.5" />
                Training Provider Workspace
              </Badge>
              {organization && (
                <Badge variant={organization.isVerified ? 'success' : 'warning'}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {organization.isVerified ? 'Verified Provider' : 'Pending Verification'}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-surface-white tracking-tight">
              Welcome back{user?.name ? `, ${user.name}` : ''}
            </h1>
            <p className="text-sm text-muted-slate max-w-2xl">
              {organization
                ? `${organization.name}${organization.specialization ? ` · ${organization.specialization}` : ''} — publish skill curricula, track learner cohorts, and respond to training enquiries.`
                : 'Set up your training provider profile and publish your first certified course or learning track.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link to="/provider/courses/new">
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Create Offering
              </Button>
            </Link>
            <Link to="/provider/engagements">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Users className="w-4 h-4" />
                Learners ({engagementStats.total})
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadDashboard(true)}
              disabled={isRefreshing}
              aria-label="Refresh dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Provider Profile Completion Meter */}
      <Card>
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-cyan shrink-0" />
                <span className="text-sm font-semibold text-surface-white">
                  Provider Profile Completion
                </span>
              </div>
              <span className="text-sm font-bold text-brand-cyan">{completion.percentage}%</span>
            </div>
            <div className="h-2 rounded-full bg-midnight-navy overflow-hidden border border-navy-surface">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all duration-300"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
            {completion.missingFields.length > 0 ? (
              <p className="text-xs text-muted-slate">
                Complete your profile ({completion.missingFields.slice(0, 3).join(', ')}
                {completion.missingFields.length > 3 ? ` +${completion.missingFields.length - 3} more` : ''}) to
                improve learner trust and verification readiness.
              </p>
            ) : (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Your provider profile is 100% complete and learner-ready.
              </p>
            )}
          </div>
          <Link to="/provider/profile" className="shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5">
              {organization ? 'Edit Provider Profile' : 'Setup Provider Profile'}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-slate">Total Offerings</span>
              <BookOpen className="w-4 h-4 text-brand-blue" />
            </div>
            <div className="text-2xl font-bold text-surface-white">{courseStats.total}</div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-slate">
              <span className="text-emerald-400">{courseStats.published} Published</span>
              <span>·</span>
              <span className="text-amber-400">{courseStats.draft} Draft</span>
              {courseStats.archived > 0 && (
                <>
                  <span>·</span>
                  <span>{courseStats.archived} Archived</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-slate">Confirmed Enrollments</span>
              <Users className="w-4 h-4 text-brand-cyan" />
            </div>
            <div className="text-2xl font-bold text-surface-white">
              {courseStats.totalEnrollments}
            </div>
            <p className="text-[11px] text-muted-slate">
              {engagementStats.active} active · {engagementStats.completed} completed learners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-slate">Pending Reviews & Enquiries</span>
              <MessageSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-surface-white">{engagementStats.pending}</div>
            <p className="text-[11px] text-muted-slate">
              {engagementStats.enquiries} total learner enquiries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-slate">Unread Notifications</span>
              <Bell className="w-4 h-4 text-brand-purple" />
            </div>
            <div className="text-2xl font-bold text-surface-white">
              {data?.unreadNotificationsCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-slate">
              {courseStats.averageRating !== null
                ? `Avg course rating: ${courseStats.averageRating} / 5`
                : 'Course enrollments & platform updates'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Course Offerings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-cyan" />
                Recent Offerings
              </CardTitle>
              <Link
                to="/provider/courses"
                className="text-xs font-medium text-brand-cyan hover:underline flex items-center gap-1"
              >
                Manage All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!data?.recentCourses || data.recentCourses.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-muted-slate mx-auto opacity-70" />
                  <p className="text-sm font-medium text-surface-white">
                    No course offerings created yet
                  </p>
                  <p className="text-xs text-muted-slate max-w-sm mx-auto">
                    Publish training courses, workshops, or certification tracks to connect with SkillOrbit AI learners.
                  </p>
                  <Link to="/provider/courses/new">
                    <Button size="sm" className="mt-1 gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Create First Offering
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-navy-surface/70">
                  {data.recentCourses.map((course) => {
                    const badge = getCourseStatusBadge(course.status);
                    return (
                      <div
                        key={course._id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-navy-surface/30 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/provider/courses/${course._id}`}
                              className="text-sm font-semibold text-surface-white hover:text-brand-cyan truncate"
                            >
                              {course.title}
                            </Link>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            {course.certificationOffered && (
                              <Badge variant="purple">
                                <Award className="w-3 h-3" />
                                Certificate
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-slate">
                            {course.category && <span>{course.category}</span>}
                            <span className="capitalize">{course.level ?? 'beginner'}</span>
                            <span>{formatCoursePrice(course.price, course.currency)}</span>
                            <span>{course.enrollmentCount} enrolled</span>
                            {(course.pendingEngagementsCount ?? 0) > 0 && (
                              <span className="text-amber-400 font-medium">
                                {course.pendingEngagementsCount} pending
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link to={`/provider/courses/${course._id}/edit`}>
                            <Button variant="ghost" size="sm" className="text-xs gap-1">
                              <FileEdit className="w-3.5 h-3.5" />
                              Edit
                            </Button>
                          </Link>
                          <Link to={`/provider/courses/${course._id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              Details
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

          {/* Recent Learner Engagements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-blue" />
                Recent Enrollments & Enquiries
              </CardTitle>
              <Link
                to="/provider/engagements"
                className="text-xs font-medium text-brand-cyan hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!data?.recentEngagements || data.recentEngagements.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Users className="w-8 h-8 text-muted-slate mx-auto opacity-70" />
                  <p className="text-sm font-medium text-surface-white">
                    No learner engagements yet
                  </p>
                  <p className="text-xs text-muted-slate max-w-sm mx-auto">
                    Once seekers enroll or submit course enquiries on your published offerings, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-navy-surface/70">
                  {data.recentEngagements.map((item) => {
                    const statusBadge = getEngagementStatusBadge(item.status);
                    return (
                      <div
                        key={item._id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-navy-surface/30 transition-colors"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-surface-white">
                              {item.learner.name}
                            </span>
                            <Badge variant={item.type === 'enquiry' ? 'purple' : 'info'}>
                              {item.type === 'enquiry' ? 'Enquiry' : 'Enrollment'}
                            </Badge>
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-slate truncate">
                            {item.course.title}
                            {item.learner.profile.headline
                              ? ` · ${item.learner.profile.headline}`
                              : ''}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-slate">
                            <span>Progress: {item.progress}%</span>
                            <span>Updated {formatDate(item.updatedAt ?? item.enrolledAt)}</span>
                          </div>
                        </div>

                        <Link to={`/provider/engagements/${item._id}`} className="shrink-0">
                          <Button variant="outline" size="sm" className="text-xs">
                            Manage
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

        {/* Right Sidebar Panels */}
        <div className="space-y-6">
          {/* Quick Actions & Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Archive className="w-4 h-4 text-brand-cyan" />
                Quick Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                to="/provider/courses/new"
                className="flex items-center justify-between p-2.5 rounded-btn bg-midnight-navy/70 hover:bg-navy-surface transition-colors text-xs font-medium text-surface-white"
              >
                <span>Publish a new training course</span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-cyan" />
              </Link>
              <Link
                to="/provider/profile"
                className="flex items-center justify-between p-2.5 rounded-btn bg-midnight-navy/70 hover:bg-navy-surface transition-colors text-xs font-medium text-surface-white"
              >
                <span>Update provider brand & links</span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-cyan" />
              </Link>
              <Link
                to="/provider/engagements"
                className="flex items-center justify-between p-2.5 rounded-btn bg-midnight-navy/70 hover:bg-navy-surface transition-colors text-xs font-medium text-surface-white"
              >
                <span>Review pending learner enquiries</span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-cyan" />
              </Link>
              <Link
                to="/provider/notifications"
                className="flex items-center justify-between p-2.5 rounded-btn bg-midnight-navy/70 hover:bg-navy-surface transition-colors text-xs font-medium text-surface-white"
              >
                <span>Notification inbox ({data?.unreadNotificationsCount ?? 0} unread)</span>
                <ArrowRight className="w-3.5 h-3.5 text-brand-cyan" />
              </Link>
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-purple" />
                Notifications
              </CardTitle>
              <Link to="/provider/notifications" className="text-xs text-brand-cyan hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!data?.notifications || data.notifications.length === 0 ? (
                <div className="p-5 text-center text-xs text-muted-slate">
                  No recent notifications yet.
                </div>
              ) : (
                <div className="divide-y divide-navy-surface/70">
                  {data.notifications.map((notif) => (
                    <Link
                      key={notif._id}
                      to={notif.link || '/provider/notifications'}
                      className={`block p-3.5 hover:bg-navy-surface/40 transition-colors ${
                        !notif.read ? 'bg-brand-blue/5' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-surface-white line-clamp-1">
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-brand-cyan shrink-0 mt-1" />
                        )}
                      </div>
                      {notif.message && (
                        <p className="text-[11px] text-muted-slate line-clamp-2 mt-0.5">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-slate mt-1">
                        {formatDate(notif.createdAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Audit / Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!data?.recentActivity || data.recentActivity.length === 0 ? (
                <div className="p-5 text-center text-xs text-muted-slate">
                  No recorded activity yet.
                </div>
              ) : (
                <div className="divide-y divide-navy-surface/70">
                  {data.recentActivity.map((item) => (
                    <div key={item._id} className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-surface-white">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-muted-slate shrink-0">
                          {formatDate(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-slate">{item.description}</p>
                      {item.link && (
                        <Link
                          to={item.link}
                          className="inline-block text-[11px] text-brand-cyan hover:underline"
                        >
                          Open record
                        </Link>
                      )}
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

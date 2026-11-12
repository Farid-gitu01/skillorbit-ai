import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  FileWarning,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
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
import { useAuth } from '@/hooks/useAuth';
import { adminService } from '@/services/admin.service';
import { normalizeApiError } from '@/services/api';
import type { AdminDashboardData } from '@/types/admin.types';
import {
  formatAdminTimestamp,
  getAccountStatusBadge,
  getRoleBadge,
  getVerificationBadge,
} from '@/utils/admin-validation';

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await adminService.getDashboard();
        if (active) {
          setDashboard(data);
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-card" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="space-y-4">
        <Alert variant="error">
          {error ?? 'Failed to load platform administration metrics.'}
        </Alert>
        <Button size="sm" onClick={fetchDashboard} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  const { stats, recentUsers, pendingVerifications, recentActivities, recentNotifications } =
    dashboard;

  const statCards = [
    {
      label: 'Total Registered Users',
      value: stats.totalUsers,
      hint: `${stats.seekersCount} Seekers · ${stats.employersCount} Employers · ${stats.providersCount} Providers`,
      icon: Users,
      tone: 'text-brand-cyan bg-brand-blue/15',
      to: '/admin/users',
    },
    {
      label: 'Active vs Suspended',
      value: stats.activeAccountsCount,
      hint: `${stats.suspendedAccountsCount} suspended accounts`,
      icon: stats.suspendedAccountsCount > 0 ? UserX : UserCheck,
      tone: 'text-emerald-400 bg-emerald-500/15',
      to: '/admin/users?status=suspended',
    },
    {
      label: 'Jobs Oversight',
      value: stats.activeJobsCount,
      hint: `${stats.totalJobs} total · ${stats.flaggedJobsCount} flagged`,
      icon: Briefcase,
      tone: 'text-sky-400 bg-sky-500/15',
      to: '/admin/jobs',
    },
    {
      label: 'Pending Verifications',
      value: stats.pendingVerificationsCount,
      hint: `${stats.verifiedOrganizationsCount} verified · ${stats.rejectedOrganizationsCount} rejected`,
      icon: ShieldCheck,
      tone:
        stats.pendingVerificationsCount > 0
          ? 'text-amber-400 bg-amber-500/15'
          : 'text-emerald-400 bg-emerald-500/15',
      to: '/admin/verifications',
    },
    {
      label: 'Employers Registered',
      value: stats.employersCount,
      hint: `${stats.totalApplications} total job applications`,
      icon: Building2,
      tone: 'text-indigo-400 bg-indigo-500/15',
      to: '/admin/employers',
    },
    {
      label: 'Training Providers',
      value: stats.providersCount,
      hint: `${stats.publishedCoursesCount} published of ${stats.totalCourses} offerings`,
      icon: GraduationCap,
      tone: 'text-purple-400 bg-purple-500/15',
      to: '/admin/providers',
    },
    {
      label: 'Flagged Content',
      value: stats.flaggedJobsCount + stats.flaggedCoursesCount,
      hint: `${stats.rejectedJobsCount + stats.rejectedCoursesCount} rejected items`,
      icon: FileWarning,
      tone:
        stats.flaggedJobsCount + stats.flaggedCoursesCount > 0
          ? 'text-amber-400 bg-amber-500/15'
          : 'text-muted-slate bg-navy-surface',
      to: '/admin/jobs',
    },
    {
      label: 'Unread Notifications',
      value: stats.unreadNotificationsCount,
      hint: 'Platform & admin alerts',
      icon: Bell,
      tone: 'text-brand-cyan bg-brand-blue/15',
      to: '/admin/notifications',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Actions Header */}
      <Card className="border-navy-surface bg-gradient-to-br from-navy to-midnight-navy">
        <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-brand-cyan">
              <ShieldCheck className="w-3.5 h-3.5" />
              Platform Governance & Operations
            </div>
            <h1 className="text-xl font-bold text-surface-white">
              Welcome back, {user?.name ?? 'Administrator'}
            </h1>
            <p className="text-xs text-muted-slate max-w-2xl leading-relaxed">
              Monitor real-time platform accounts, review employer and training-provider
              verification requests, moderate opportunity listings, and audit system events.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/admin/verifications">
              <Button size="sm" className="gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verification Queue ({stats.pendingVerificationsCount})
              </Button>
            </Link>
            <Link to="/admin/users">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Users
              </Button>
            </Link>
            <Link to="/admin/jobs">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Briefcase className="w-3.5 h-3.5" />
                Moderate Jobs
              </Button>
            </Link>
            <Link to="/admin/courses">
              <Button size="sm" variant="outline" className="gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Courses
              </Button>
            </Link>
            <Link to="/admin/audit-logs">
              <Button size="sm" variant="outline" className="gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Audit Logs
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.to} className="block group">
              <Card className="h-full transition-colors group-hover:border-brand-blue/60">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-slate">{card.label}</p>
                    <p className="text-2xl font-bold text-surface-white">{card.value}</p>
                    <p className="text-[11px] text-muted-slate truncate">{card.hint}</p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.tone}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Verification Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-surface-white">
                Pending Organization Verifications
              </CardTitle>
              <p className="text-xs text-muted-slate mt-0.5">
                Employers and training providers awaiting trust approval
              </p>
            </div>
            <Link
              to="/admin/verifications"
              className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
            >
              Review Queue <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingVerifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-navy-surface p-6 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                <p className="text-xs font-medium text-surface-white">
                  Verification queue is clear
                </p>
                <p className="text-[11px] text-muted-slate">
                  No pending employer or provider verification requests require action.
                </p>
              </div>
            ) : (
              pendingVerifications.map((org) => {
                const verBadge = getVerificationBadge(org.verificationStatus);
                const detailLink =
                  org.type === 'training-provider' && org.owner?._id
                    ? `/admin/providers/${org.owner._id}`
                    : org.owner?._id
                      ? `/admin/employers/${org.owner._id}`
                      : '/admin/verifications';

                return (
                  <div
                    key={org._id}
                    className="rounded-lg border border-navy-surface bg-midnight-navy/60 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-surface-white truncate">
                          {org.name}
                        </span>
                        <Badge variant={verBadge.variant}>{verBadge.label}</Badge>
                        <Badge variant={org.type === 'employer' ? 'primary' : 'info'}>
                          {org.type === 'employer' ? 'Employer' : 'Provider'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-slate truncate">
                        Owner: {org.owner?.name ?? 'Unknown'} ({org.owner?.email ?? 'N/A'})
                      </p>
                    </div>
                    <Link to={detailLink}>
                      <Button size="sm" variant="outline" className="text-xs shrink-0">
                        Inspect
                      </Button>
                    </Link>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent User Registrations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-surface-white">
                Recent User Registrations
              </CardTitle>
              <p className="text-xs text-muted-slate mt-0.5">
                Newest accounts joined across all platform roles
              </p>
            </div>
            <Link
              to="/admin/users"
              className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
            >
              All Users <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentUsers.length === 0 ? (
              <p className="text-xs text-muted-slate py-4 text-center">
                No registered users recorded yet.
              </p>
            ) : (
              recentUsers.map((account) => {
                const roleBadge = getRoleBadge(account.role);
                const statusBadge = getAccountStatusBadge(account.isActive);
                return (
                  <Link
                    key={account._id}
                    to={`/admin/users/${account._id}`}
                    className="block rounded-lg border border-navy-surface bg-midnight-navy/60 p-3 hover:border-brand-blue/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-surface-white truncate">
                          {account.name}
                        </p>
                        <p className="text-[11px] text-muted-slate truncate">{account.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-slate mt-1.5">
                      Joined {formatAdminTimestamp(account.createdAt)}
                    </p>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit Activity & Admin Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-surface-white">
                Recent Platform Activity
              </CardTitle>
              <p className="text-xs text-muted-slate mt-0.5">
                Append-only operational and governance events
              </p>
            </div>
            <Link
              to="/admin/audit-logs"
              className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
            >
              Full Audit Trail <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-muted-slate py-4 text-center">
                No audit events logged yet.
              </p>
            ) : (
              recentActivities.slice(0, 6).map((item) => {
                const actorBadge = getRoleBadge(item.actorRole);
                return (
                  <div
                    key={item._id}
                    className="rounded-lg border border-navy-surface bg-midnight-navy/50 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-surface-white">
                        {item.title}
                      </span>
                      <Badge variant={actorBadge.variant}>{actorBadge.label}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-slate">{item.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-slate">
                      <span>{item.actor?.name ?? 'System'}</span>
                      <span>{formatAdminTimestamp(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-surface-white">
                Platform Notifications
              </CardTitle>
              <p className="text-xs text-muted-slate mt-0.5">
                Recent alerts delivered to your administrator account
              </p>
            </div>
            <Link
              to="/admin/notifications"
              className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recentNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-navy-surface p-6 text-center space-y-1.5">
                <Bell className="w-6 h-6 text-muted-slate mx-auto" />
                <p className="text-xs text-muted-slate">No recent admin notifications.</p>
              </div>
            ) : (
              recentNotifications.map((notif) => (
                <div
                  key={notif._id}
                  className="rounded-lg border border-navy-surface bg-midnight-navy/50 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-surface-white">{notif.title}</span>
                    <Badge variant={notif.read ? 'default' : 'primary'}>
                      {notif.read ? 'Read' : 'Unread'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-slate">{notif.message}</p>
                  <p className="text-[10px] text-muted-slate">
                    {formatAdminTimestamp(notif.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

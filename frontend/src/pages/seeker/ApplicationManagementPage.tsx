import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationService } from '@/services';
import type { Application, ApplicationStatus } from '@/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
} from '@/components/ui';
import { formatDate, formatSalary, getApplicationStatusBadge } from '@/utils/job-helpers';
import {
  Briefcase,
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  MapPin,
  XCircle,
} from 'lucide-react';

const STATUS_TABS: Array<{ value: ApplicationStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Applications' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Not Selected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export function ApplicationManagementPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeTab, setActiveTab] = useState<ApplicationStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await applicationService.getMyApplications(activeTab);
        if (active) {
          setApplications(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to fetch applications';
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
  }, [activeTab]);

  const handleWithdraw = async (id: string, jobTitle: string) => {
    setWithdrawingId(id);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await applicationService.withdrawApplication(id);
      setApplications((prev) =>
        prev.map((app) => (app._id === id ? { ...app, status: updated.status, withdrawnAt: updated.withdrawnAt } : app))
      );
      setSuccessMsg(`Application for "${jobTitle}" has been withdrawn.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to withdraw application';
      setError(msg);
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">My Applications</h1>
          <p className="text-xs text-muted-slate">
            Track the status and progress of your submitted job applications
          </p>
        </div>
        <Link to="/seeker/jobs">
          <Button variant="primary" size="sm">
            Browse More Jobs
          </Button>
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-navy-surface pb-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              if (activeTab === tab.value) return;
              setIsLoading(true);
              setError(null);
              setActiveTab(tab.value);
            }}
            className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-brand-blue text-white'
                : 'bg-navy text-muted-slate hover:text-surface-white hover:bg-navy-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" title="Updated">
          {successMsg}
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-32 rounded-card" />
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Briefcase className="w-10 h-10 text-muted-slate mx-auto opacity-40" />
            <h3 className="text-sm font-semibold text-surface-white">
              No applications found
            </h3>
            <p className="text-xs text-muted-slate max-w-md mx-auto">
              {activeTab === 'all'
                ? "You haven't submitted any job applications yet. Start exploring open roles!"
                : `You don't have any applications with status "${activeTab}".`}
            </p>
            <Link to="/seeker/jobs">
              <Button variant="outline" size="sm">
                Explore Opportunities
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const statusInfo = getApplicationStatusBadge(app.status);
            const canWithdraw =
              app.status === 'pending' ||
              app.status === 'reviewed' ||
              app.status === 'shortlisted';

            return (
              <Card key={app._id} className="hover:border-navy-surface/80">
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          to={`/seeker/jobs/${app.job?._id}`}
                          className="text-base font-bold text-surface-white hover:text-brand-cyan inline-flex items-center gap-1.5"
                        >
                          <span>{app.job?.title ?? 'Job Position'}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                        </Link>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-slate">
                        <span className="inline-flex items-center gap-1 text-brand-cyan">
                          <Building2 className="w-3.5 h-3.5" />
                          {app.job?.organization?.name ?? 'Verified Employer'}
                        </span>
                        {app.job?.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {app.job.location}
                          </span>
                        )}
                        {app.job?.salary && (
                          <span className="text-emerald-400 font-medium">
                            {formatSalary(app.job.salary)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-2 shrink-0">
                      <span className="text-xs text-muted-slate inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Applied on {formatDate(app.createdAt)}
                      </span>
                      {app.aiMatchScore !== undefined && (
                        <Badge variant="primary">AI Match Score: {app.aiMatchScore}%</Badge>
                      )}
                    </div>
                  </div>

                  {/* Additional Application Details */}
                  <div className="pt-3 border-t border-navy-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-muted-slate">
                      {app.resume && (
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-brand-blue" />
                          <span>Resume: {app.resume.fileName}</span>
                        </span>
                      )}
                      {app.coverLetter && (
                        <span className="italic line-clamp-1 max-w-md">
                          &quot;{app.coverLetter}&quot;
                        </span>
                      )}
                    </div>

                    {canWithdraw && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        isLoading={withdrawingId === app._id}
                        onClick={() => handleWithdraw(app._id, app.job?.title ?? 'this job')}
                        className="text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-1.5 shrink-0"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Withdraw Application</span>
                      </Button>
                    )}
                  </div>

                  {app.employerNote && (
                    <div className="p-3 rounded-lg bg-midnight-navy/60 border border-navy-surface text-xs">
                      <span className="font-semibold text-surface-white block mb-0.5">
                        Employer Feedback:
                      </span>
                      <span className="text-muted-slate">{app.employerNote}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ApplicationManagementPage;

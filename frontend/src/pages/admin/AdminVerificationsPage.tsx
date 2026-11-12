import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AdminActionDialog } from '@/components/admin/AdminActionDialog';
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
import { adminService } from '@/services/admin.service';
import { normalizeApiError } from '@/services/api';
import type {
  AdminOrganizationSummary,
  AdminVerificationsQuery,
  OrganizationVerificationStatus,
} from '@/types/admin.types';
import { formatAdminTimestamp, getVerificationBadge } from '@/utils/admin-validation';

const STATUS_TABS: Array<{ value: NonNullable<AdminVerificationsQuery['status']>; label: string }> = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'verified', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All Organizations' },
];

export function AdminVerificationsPage() {
  const [organizations, setOrganizations] = useState<AdminOrganizationSummary[]>([]);
  const [statusTab, setStatusTab] =
    useState<NonNullable<AdminVerificationsQuery['status']>>('pending');
  const [orgType, setOrgType] = useState<NonNullable<AdminVerificationsQuery['type']>>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{
    org: AdminOrganizationSummary;
    decision: Extract<OrganizationVerificationStatus, 'verified' | 'rejected'>;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadQueue = async () => {
      try {
        const res = await adminService.getVerifications({
          q: debouncedSearch || undefined,
          type: orgType,
          status: statusTab,
          page,
          limit: 12,
        });
        if (active) {
          setOrganizations(res.organizations);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.organizations.length);
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
    void loadQueue();
    return () => {
      active = false;
    };
  }, [debouncedSearch, orgType, statusTab, page]);

  const handleDecisionConfirm = async (payload: { reason: string }) => {
    if (!decisionTarget) return;
    const res = await adminService.reviewVerification(decisionTarget.org._id, {
      status: decisionTarget.decision,
      reason: payload.reason,
    });
    setOrganizations((prev) => {
      if (statusTab !== 'all' && statusTab !== res.organization.verificationStatus) {
        return prev.filter((item) => item._id !== res.organization._id);
      }
      return prev.map((item) => (item._id === res.organization._id ? res.organization : item));
    });
    setFeedback(res.message);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-surface-white">Verification & Trust Queue</h1>
        <p className="text-xs text-muted-slate mt-1">
          Approve or reject organization verification requests for employers and training providers ({totalCount}).
        </p>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Queue Status Tabs & Filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            size="sm"
            variant={statusTab === tab.value ? 'primary' : 'outline'}
            onClick={() => {
              setStatusTab(tab.value);
              setPage(1);
              setIsLoading(true);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Search Organizations or Owners"
            placeholder="Organization name, owner email, location..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Organization Type"
            value={orgType}
            onChange={(e) => {
              setOrgType(e.target.value as NonNullable<AdminVerificationsQuery['type']>);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Organization Types' },
              { value: 'employer', label: 'Employers' },
              { value: 'training-provider', label: 'Training Providers' },
            ]}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32 w-full rounded-card" />
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">
              No verification records in this view
            </p>
            <p className="text-xs text-muted-slate">
              Switch status tabs or adjust filters to inspect other organizations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {organizations.map((org) => {
            const verBadge = getVerificationBadge(org.verificationStatus);
            const detailPath =
              org.type === 'training-provider' && org.owner?._id
                ? `/admin/providers/${org.owner._id}`
                : org.owner?._id
                  ? `/admin/employers/${org.owner._id}`
                  : null;

            return (
              <Card key={org._id}>
                <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-surface-white">{org.name}</span>
                      <Badge variant={verBadge.variant}>{verBadge.label}</Badge>
                      <Badge variant={org.type === 'employer' ? 'primary' : 'info'}>
                        {org.type === 'employer' ? 'Employer' : 'Training Provider'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-slate">
                      Owner: {org.owner?.name ?? 'Unknown'} ({org.owner?.email ?? 'N/A'})
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-slate">
                      {org.industry && <span>Industry: {org.industry}</span>}
                      {org.specialization && <span>Specialization: {org.specialization}</span>}
                      {org.location && <span>Location: {org.location}</span>}
                      {org.contactEmail && <span>Contact: {org.contactEmail}</span>}
                    </div>
                    {org.websiteUrl && (
                      <a
                        href={org.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-brand-cyan hover:underline"
                      >
                        {org.websiteUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {org.verificationReason && (
                      <p className="text-[11px] text-muted-slate">
                        Last Decision Note: {org.verificationReason}
                        {org.verifiedAt ? ` (${formatAdminTimestamp(org.verifiedAt)})` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {detailPath && (
                      <Link to={detailPath}>
                        <Button size="sm" variant="outline" className="text-xs">
                          Full Profile
                        </Button>
                      </Link>
                    )}
                    {org.verificationStatus !== 'verified' && (
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setDecisionTarget({ org, decision: 'verified' })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </Button>
                    )}
                    {org.verificationStatus !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="danger"
                        className="gap-1.5 text-xs"
                        onClick={() => setDecisionTarget({ org, decision: 'rejected' })}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-slate">
            Page {page} of {totalPages} ({totalCount} organizations)
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setIsLoading(true);
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                setIsLoading(true);
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {decisionTarget && (
        <AdminActionDialog
          open={Boolean(decisionTarget)}
          title={
            decisionTarget.decision === 'verified'
              ? `Verify ${decisionTarget.org.name}`
              : `Reject Verification: ${decisionTarget.org.name}`
          }
          description={
            decisionTarget.decision === 'verified'
              ? 'Marks the organization as platform-verified and notifies the organization owner.'
              : 'Rejects verification status and sends the required explanation to the organization owner.'
          }
          mode="verification"
          confirmLabel={
            decisionTarget.decision === 'verified' ? 'Approve Verification' : 'Confirm Rejection'
          }
          confirmVariant={decisionTarget.decision === 'verified' ? 'primary' : 'danger'}
          requireReason
          onClose={() => setDecisionTarget(null)}
          onSubmit={handleDecisionConfirm}
        />
      )}
    </div>
  );
}

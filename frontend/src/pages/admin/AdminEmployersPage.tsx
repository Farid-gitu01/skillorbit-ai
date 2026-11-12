import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronLeft, ChevronRight, Eye, Search } from 'lucide-react';
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
import type { AdminEmployerRecord, AdminPartnersQuery } from '@/types/admin.types';
import { getAccountStatusBadge, getVerificationBadge } from '@/utils/admin-validation';

export function AdminEmployersPage() {
  const [employers, setEmployers] = useState<AdminEmployerRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [accountStatus, setAccountStatus] =
    useState<NonNullable<AdminPartnersQuery['accountStatus']>>('all');
  const [verificationStatus, setVerificationStatus] =
    useState<NonNullable<AdminPartnersQuery['verificationStatus']>>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadEmployers = async () => {
      try {
        const res = await adminService.getEmployers({
          q: debouncedSearch || undefined,
          accountStatus,
          verificationStatus,
          page,
          limit: 12,
        });
        if (active) {
          setEmployers(res.employers);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.employers.length);
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
    void loadEmployers();
    return () => {
      active = false;
    };
  }, [debouncedSearch, accountStatus, verificationStatus, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">Employer Management</h1>
          <p className="text-xs text-muted-slate mt-1">
            Oversee registered hiring employers ({totalCount}), review organizations, and monitor posted roles.
          </p>
        </div>
        <Link to="/admin/verifications">
          <Button size="sm" variant="outline" className="text-xs">
            Verification Queue
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Search Employers"
            placeholder="Employer name, email, organization..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Account Standing"
            value={accountStatus}
            onChange={(e) => {
              setAccountStatus(e.target.value as NonNullable<AdminPartnersQuery['accountStatus']>);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Accounts' },
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
          <Select
            label="Verification Status"
            value={verificationStatus}
            onChange={(e) => {
              setVerificationStatus(
                e.target.value as NonNullable<AdminPartnersQuery['verificationStatus']>
              );
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Verification States' },
              { value: 'pending', label: 'Pending Review' },
              { value: 'verified', label: 'Verified' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-24 w-full rounded-card" />
          ))}
        </div>
      ) : employers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Building2 className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">No employers matched</p>
            <p className="text-xs text-muted-slate">
              Adjust your filters to inspect other employer organizations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {employers.map((item) => {
            const accountBadge = getAccountStatusBadge(item.user.isActive);
            const verBadge = getVerificationBadge(item.verificationStatus);
            return (
              <Card key={item.user._id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-surface-white">
                        {item.organization?.name ?? item.user.name}
                      </span>
                      <Badge variant={accountBadge.variant}>{accountBadge.label}</Badge>
                      <Badge variant={verBadge.variant}>{verBadge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-slate">
                      Contact: {item.user.name} ({item.user.email})
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-slate">
                      <span>Jobs: {item.metrics.totalJobs} ({item.metrics.activeJobs} active)</span>
                      {item.organization?.industry && (
                        <span>Industry: {item.organization.industry}</span>
                      )}
                      {item.organization?.location && (
                        <span>Location: {item.organization.location}</span>
                      )}
                    </div>
                  </div>
                  <Link to={`/admin/employers/${item.user._id}`} className="shrink-0">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Eye className="w-3.5 h-3.5" />
                      Inspect Employer
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-slate">
            Page {page} of {totalPages} ({totalCount} employers)
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
    </div>
  );
}

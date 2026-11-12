import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, GraduationCap, Search } from 'lucide-react';
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
import type { AdminPartnersQuery, AdminProviderRecord } from '@/types/admin.types';
import { getAccountStatusBadge, getVerificationBadge } from '@/utils/admin-validation';

export function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProviderRecord[]>([]);
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
    const loadProviders = async () => {
      try {
        const res = await adminService.getProviders({
          q: debouncedSearch || undefined,
          accountStatus,
          verificationStatus,
          page,
          limit: 12,
        });
        if (active) {
          setProviders(res.providers);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.providers.length);
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
    void loadProviders();
    return () => {
      active = false;
    };
  }, [debouncedSearch, accountStatus, verificationStatus, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">Provider Management</h1>
          <p className="text-xs text-muted-slate mt-1">
            Review training providers ({totalCount}), verify credentials, and oversee course offerings.
          </p>
        </div>
        <Link to="/admin/courses">
          <Button size="sm" variant="outline" className="text-xs">
            Moderate Courses
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Search Providers"
            placeholder="Provider name, specialization, email..."
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
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <GraduationCap className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">
              No training providers matched
            </p>
            <p className="text-xs text-muted-slate">
              Adjust your search keyword or verification status filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {providers.map((item) => {
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
                      Account: {item.user.name} ({item.user.email})
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-slate">
                      <span>
                        Courses: {item.metrics.totalCourses} ({item.metrics.publishedCourses} published)
                      </span>
                      <span>Enrollments: {item.metrics.totalEnrollments}</span>
                      {item.organization?.specialization && (
                        <span>Focus: {item.organization.specialization}</span>
                      )}
                    </div>
                  </div>
                  <Link to={`/admin/providers/${item.user._id}`} className="shrink-0">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                      <Eye className="w-3.5 h-3.5" />
                      Inspect Provider
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
            Page {page} of {totalPages} ({totalCount} providers)
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

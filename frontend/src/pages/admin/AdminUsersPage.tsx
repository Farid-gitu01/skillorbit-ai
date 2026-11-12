import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  Shield,
  UserCheck,
  UserX,
  Users,
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
import { useAuth } from '@/hooks/useAuth';
import { adminService } from '@/services/admin.service';
import { normalizeApiError } from '@/services/api';
import type { AdminUserRecord, AdminUsersQuery } from '@/types/admin.types';
import {
  formatAdminTimestamp,
  getAccountStatusBadge,
  getRoleBadge,
} from '@/utils/admin-validation';

export function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') ?? '');
  const [roleFilter, setRoleFilter] = useState<NonNullable<AdminUsersQuery['role']>>(
    (searchParams.get('role') as AdminUsersQuery['role']) || 'all'
  );
  const [statusFilter, setStatusFilter] = useState<NonNullable<AdminUsersQuery['status']>>(
    (searchParams.get('status') as AdminUsersQuery['status']) || 'all'
  );
  const [sortOrder, setSortOrder] = useState<NonNullable<AdminUsersQuery['sort']>>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dialogTarget, setDialogTarget] = useState<{
    user: AdminUserRecord;
    nextIsActive: boolean;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      try {
        const res = await adminService.getUsers({
          q: debouncedSearch || undefined,
          role: roleFilter,
          status: statusFilter,
          sort: sortOrder,
          page,
          limit: 12,
        });
        if (active) {
          setUsers(res.users);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.users.length);
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
    void loadUsers();
    return () => {
      active = false;
    };
  }, [debouncedSearch, roleFilter, statusFilter, sortOrder, page]);

  const handleStatusConfirm = async (payload: { reason: string }) => {
    if (!dialogTarget) return;
    const result = await adminService.updateUserStatus(dialogTarget.user._id, {
      isActive: dialogTarget.nextIsActive,
      reason: payload.reason || undefined,
    });
    setUsers((prev) =>
      prev.map((item) => (item._id === result.user._id ? result.user : item))
    );
    setFeedback(result.message);
    setError(null);
  };

  const applyFilterReset = (updates: Record<string, string>) => {
    const nextParams = new URLSearchParams(searchParams);
    for (const [key, val] of Object.entries(updates)) {
      if (!val || val === 'all') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    }
    setSearchParams(nextParams, { replace: true });
    setPage(1);
    setIsLoading(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">User Management</h1>
          <p className="text-xs text-muted-slate mt-1">
            Inspect registered accounts ({totalCount}), monitor account standing, and manage suspensions safely.
          </p>
        </div>
        <Link to="/admin/audit-logs">
          <Button size="sm" variant="outline" className="text-xs">
            View Audit Trail
          </Button>
        </Link>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            label="Search Users"
            placeholder="Name or email..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Role"
            value={roleFilter}
            onChange={(e) => {
              const value = e.target.value as NonNullable<AdminUsersQuery['role']>;
              setRoleFilter(value);
              applyFilterReset({ role: value });
            }}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'seeker', label: 'Job Seeker' },
              { value: 'employer', label: 'Employer' },
              { value: 'provider', label: 'Training Provider' },
              { value: 'admin', label: 'Administrator' },
            ]}
          />
          <Select
            label="Account Status"
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value as NonNullable<AdminUsersQuery['status']>;
              setStatusFilter(value);
              applyFilterReset({ status: value });
            }}
            options={[
              { value: 'all', label: 'All Accounts' },
              { value: 'active', label: 'Active Only' },
              { value: 'suspended', label: 'Suspended Only' },
            ]}
          />
          <Select
            label="Sort Order"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as NonNullable<AdminUsersQuery['sort']>);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'newest', label: 'Newest Joined' },
              { value: 'oldest', label: 'Oldest Joined' },
              { value: 'name', label: 'Name (A–Z)' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Listing */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20 w-full rounded-card" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">No matching users found</p>
            <p className="text-xs text-muted-slate">
              Adjust your search keyword or role/status filters to inspect accounts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((account) => {
            const roleBadge = getRoleBadge(account.role);
            const statusBadge = getAccountStatusBadge(account.isActive);
            const isProtected =
              account.role === 'admin' || account._id === currentAdmin?._id;

            return (
              <Card key={account._id} className="hover:border-brand-blue/40 transition-colors">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-surface-white">
                        {account.name}
                      </span>
                      <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      {account.isEmailVerified ? (
                        <Badge variant="info">Email Verified</Badge>
                      ) : (
                        <Badge variant="default">Unverified Email</Badge>
                      )}
                      {isProtected && (
                        <Badge variant="purple">
                          <Shield className="w-3 h-3 mr-1 inline" /> Protected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-slate">{account.email}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-slate">
                      <span>Joined: {formatAdminTimestamp(account.createdAt)}</span>
                      {account.lastLoginAt && (
                        <span>Last Login: {formatAdminTimestamp(account.lastLoginAt)}</span>
                      )}
                      {!account.isActive && account.suspensionReason && (
                        <span className="text-red-400">
                          Suspension Reason: {account.suspensionReason}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/admin/users/${account._id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </Button>
                    </Link>

                    {!isProtected && (
                      <Button
                        size="sm"
                        variant={account.isActive ? 'danger' : 'secondary'}
                        className="gap-1.5 text-xs"
                        onClick={() =>
                          setDialogTarget({
                            user: account,
                            nextIsActive: !account.isActive,
                          })
                        }
                      >
                        {account.isActive ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Activate
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-slate">
            Page {page} of {totalPages} ({totalCount} accounts)
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

      {dialogTarget && (
        <AdminActionDialog
          open={Boolean(dialogTarget)}
          title={
            dialogTarget.nextIsActive
              ? `Reinstate ${dialogTarget.user.name}`
              : `Suspend ${dialogTarget.user.name}`
          }
          description={
            dialogTarget.nextIsActive
              ? 'This restores login and portal access for the account.'
              : 'Suspending immediately locks login and active API sessions for this user.'
          }
          mode="user-status"
          confirmLabel={dialogTarget.nextIsActive ? 'Reinstate Account' : 'Confirm Suspension'}
          confirmVariant={dialogTarget.nextIsActive ? 'primary' : 'danger'}
          requireReason={!dialogTarget.nextIsActive}
          onClose={() => setDialogTarget(null)}
          onSubmit={handleStatusConfirm}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Lock,
  Search,
} from 'lucide-react';
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
import type { AdminAuditLogItem, AdminAuditLogsQuery } from '@/types/admin.types';
import { formatAdminTimestamp, getRoleBadge } from '@/utils/admin-validation';

export function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actorRole, setActorRole] =
    useState<NonNullable<AdminAuditLogsQuery['actorRole']>>('all');
  const [resourceFilter, setResourceFilter] = useState('all');
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
    const loadLogs = async () => {
      try {
        const res = await adminService.getAuditLogs({
          q: debouncedSearch || undefined,
          actorRole,
          resource: resourceFilter,
          page,
          limit: 20,
        });
        if (active) {
          setLogs(res.logs);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.logs.length);
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
    void loadLogs();
    return () => {
      active = false;
    };
  }, [debouncedSearch, actorRole, resourceFilter, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">Activity & Audit Logs</h1>
          <p className="text-xs text-muted-slate mt-1">
            Immutable operational audit log ({totalCount} recorded platform events).
          </p>
        </div>
        <Badge variant="purple" className="gap-1.5 py-1 px-2.5 self-start">
          <Lock className="w-3 h-3" />
          Append-Only Read-Only Trail
        </Badge>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Search Action or Actor"
            placeholder="Action name, resource, actor name/email..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Actor Role"
            value={actorRole}
            onChange={(e) => {
              setActorRole(e.target.value as NonNullable<AdminAuditLogsQuery['actorRole']>);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Actors' },
              { value: 'admin', label: 'Admin' },
              { value: 'employer', label: 'Employer' },
              { value: 'provider', label: 'Training Provider' },
              { value: 'seeker', label: 'Job Seeker' },
              { value: 'system', label: 'System' },
            ]}
          />
          <Select
            label="Resource"
            value={resourceFilter}
            onChange={(e) => {
              setResourceFilter(e.target.value);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Resources' },
              { value: 'User', label: 'User' },
              { value: 'Organization', label: 'Organization' },
              { value: 'Job', label: 'Job' },
              { value: 'Course', label: 'Course' },
              { value: 'Application', label: 'Application' },
            ]}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-20 w-full rounded-card" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Activity className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">No audit entries matched</p>
            <p className="text-xs text-muted-slate">
              Adjust your search keyword or role/resource filters to view other events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => {
            const actorBadge = getRoleBadge(log.actorRole);
            return (
              <Card key={log._id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-surface-white">
                        {log.title}
                      </span>
                      <Badge variant="default">{log.action}</Badge>
                      <Badge variant={actorBadge.variant}>{actorBadge.label}</Badge>
                      <Badge variant="info">{log.resource}</Badge>
                    </div>
                    <span className="text-[11px] text-muted-slate shrink-0">
                      {formatAdminTimestamp(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-slate">{log.description}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-slate">
                    <span>
                      Actor: {log.actor ? `${log.actor.name} (${log.actor.email})` : 'System'}
                    </span>
                    {log.resourceId && <span>Target ID: {log.resourceId}</span>}
                  </div>
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <pre className="rounded-md bg-midnight-navy border border-navy-surface p-2.5 text-[11px] text-muted-slate overflow-x-auto">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-slate">
            Page {page} of {totalPages} ({totalCount} entries)
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

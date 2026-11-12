import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  GraduationCap,
  MapPin,
  MessageSquare,
  Search,
  Users,
} from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Select, Skeleton } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { providerService } from '@/services/provider.service';
import type { PaginationMeta } from '@/types/api.types';
import type {
  EngagementStatus,
  EngagementType,
  ProviderEngagement,
  ProviderEngagementCourseOption,
  ProviderEngagementStats,
  ProviderEngagementsQuery,
} from '@/types/provider.types';
import { formatDate } from '@/utils/job-helpers';
import { getEngagementStatusBadge } from '@/utils/provider-validation';

export function ProviderEngagementsPage() {
  const { id: routeCourseId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = routeCourseId ?? searchParams.get('courseId') ?? '';

  const [engagements, setEngagements] = useState<ProviderEngagement[]>([]);
  const [courseOptions, setCourseOptions] = useState<ProviderEngagementCourseOption[]>([]);
  const [stats, setStats] = useState<ProviderEngagementStats>({
    total: 0,
    pending: 0,
    enrolled: 0,
    active: 0,
    completed: 0,
    declined: 0,
    enquiries: 0,
  });
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, pages: 1 });

  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState<'all' | EngagementStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | EngagementType>('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const loadEngagements = useCallback(
    async (query: ProviderEngagementsQuery) => {
      try {
        const res = routeCourseId
          ? await providerService.getCourseLearners(routeCourseId, query)
          : await providerService.getEngagements(query);
        setEngagements(res.engagements);
        setStats(res.stats);
        setCourseOptions(res.courses);
        setMeta(res.meta);
      } catch (err) {
        setFeedback({ type: 'error', message: normalizeApiError(err).message });
      } finally {
        setIsLoading(false);
      }
    },
    [routeCourseId]
  );

  useEffect(() => {
    let active = true;
    const activeCourseId = routeCourseId ?? selectedCourseId;
    const init = async () => {
      try {
        const query: ProviderEngagementsQuery = {
          q: appliedSearch || undefined,
          courseId: activeCourseId || undefined,
          status: statusFilter,
          type: typeFilter,
          page,
          limit: 10,
        };
        const res = routeCourseId
          ? await providerService.getCourseLearners(routeCourseId, query)
          : await providerService.getEngagements(query);
        if (!active) return;
        setEngagements(res.engagements);
        setStats(res.stats);
        setCourseOptions(res.courses);
        setMeta(res.meta);
      } catch (err) {
        if (active) {
          setFeedback({ type: 'error', message: normalizeApiError(err).message });
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
  }, [routeCourseId, selectedCourseId, appliedSearch, statusFilter, typeFilter, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleQuickStatus = async (
    engagement: ProviderEngagement,
    nextStatus: 'enrolled' | 'active' | 'completed' | 'declined'
  ) => {
    setBusyId(engagement._id);
    setFeedback(null);
    try {
      const res = await providerService.updateEngagement(engagement._id, {
        status: nextStatus,
        ...(nextStatus === 'completed' ? { progress: 100 } : {}),
      });
      setFeedback({ type: 'success', message: res.message });
      await loadEngagements({
        q: appliedSearch || undefined,
        courseId: routeCourseId ?? (selectedCourseId || undefined),
        status: statusFilter,
        type: typeFilter,
        page,
        limit: 10,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: normalizeApiError(err).message });
    } finally {
      setBusyId(null);
    }
  };

  const activeCourseObj = routeCourseId
    ? courseOptions.find((c) => c._id === routeCourseId)
    : courseOptions.find((c) => c._id === selectedCourseId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          {routeCourseId && (
            <Link
              to={`/provider/courses/${routeCourseId}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-slate hover:text-brand-cyan"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Offering Details
            </Link>
          )}
          <h1 className="text-2xl font-bold text-surface-white">
            {activeCourseObj ? `Learners: ${activeCourseObj.title}` : 'Learner Enrollments & Enquiries'}
          </h1>
          <p className="text-xs text-muted-slate">
            Review incoming training enquiries, approve enrollments, monitor learner completion progress, and keep private internal notes.
          </p>
        </div>
      </div>

      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'error'}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Records', value: stats.total },
          { label: 'Pending Review', value: stats.pending },
          { label: 'Enrolled', value: stats.enrolled },
          { label: 'In Progress', value: stats.active },
          { label: 'Completed', value: stats.completed },
          { label: 'Enquiries', value: stats.enquiries },
        ].map((item) => (
          <Card key={item.label}>
            <div className="p-3.5 space-y-1">
              <p className="text-[11px] text-muted-slate font-medium">{item.label}</p>
              <p className="text-lg font-bold text-surface-white">{item.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <form onSubmit={handleSearch} className="md:col-span-5 flex gap-2">
            <Input
              placeholder="Search by learner name, skill, headline, or message..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              prefixIcon={<Search className="w-4 h-4 text-muted-slate" />}
            />
            <Button type="submit" variant="outline" size="sm" className="shrink-0 h-[42px]">
              Search
            </Button>
          </form>

          {!routeCourseId && (
            <div className="md:col-span-3">
              <Select
                aria-label="Filter by course"
                value={selectedCourseId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setIsLoading(true);
                  setSelectedCourseId(nextId);
                  setPage(1);
                  if (nextId) {
                    setSearchParams({ courseId: nextId });
                  } else {
                    setSearchParams({});
                  }
                }}
                options={[
                  { value: '', label: 'All Offerings' },
                  ...courseOptions.map((c) => ({ value: c._id, label: c.title })),
                ]}
              />
            </div>
          )}

          <div className={routeCourseId ? 'md:col-span-4' : 'md:col-span-2'}>
            <Select
              aria-label="Filter by type"
              value={typeFilter}
              onChange={(e) => {
                setIsLoading(true);
                setTypeFilter(e.target.value as 'all' | EngagementType);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'enrollment', label: 'Enrollments' },
                { value: 'enquiry', label: 'Enquiries' },
              ]}
            />
          </div>

          <div className={routeCourseId ? 'md:col-span-3' : 'md:col-span-2'}>
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setIsLoading(true);
                setStatusFilter(e.target.value as 'all' | EngagementStatus);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Active Statuses' },
                { value: 'pending', label: 'Pending Review' },
                { value: 'enrolled', label: 'Enrolled' },
                { value: 'active', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'declined', label: 'Declined' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Engagement Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-card" />
          ))}
        </div>
      ) : engagements.length === 0 ? (
        <Card>
          <div className="p-10 text-center space-y-3">
            <Users className="w-9 h-9 text-muted-slate mx-auto opacity-70" />
            <h2 className="text-sm font-semibold text-surface-white">
              No learner engagements match your filters
            </h2>
            <p className="text-xs text-muted-slate max-w-md mx-auto">
              Learners who enroll in your published offerings or submit training enquiries will appear here with full progress and status tracking.
            </p>
            {(appliedSearch || statusFilter !== 'all' || typeFilter !== 'all' || (!routeCourseId && selectedCourseId)) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsLoading(true);
                  setSearchInput('');
                  setAppliedSearch('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  if (!routeCourseId) {
                    setSelectedCourseId('');
                    setSearchParams({});
                  }
                  setPage(1);
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {engagements.map((item) => {
            const statusMeta = getEngagementStatusBadge(item.status);
            const busy = busyId === item._id;
            return (
              <Card key={item._id} className="hover:border-slate-700 transition-colors">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/provider/engagements/${item._id}`}
                        className="text-base font-semibold text-surface-white hover:text-brand-cyan transition-colors"
                      >
                        {item.learner.name}
                      </Link>
                      <Badge variant={item.type === 'enquiry' ? 'purple' : 'info'}>
                        {item.type === 'enquiry' ? 'Enquiry' : 'Enrollment'}
                      </Badge>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-slate">
                      <span className="flex items-center gap-1 text-slate-200 font-medium">
                        <GraduationCap className="w-3.5 h-3.5 text-brand-cyan" />
                        {item.course.title}
                      </span>
                      {item.learner.profile.headline && (
                        <span>· {item.learner.profile.headline}</span>
                      )}
                      {item.learner.profile.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {item.learner.profile.location}
                        </span>
                      )}
                    </div>

                    {item.learnerMessage && (
                      <p className="text-xs text-slate-300 bg-midnight-navy/60 border border-navy-surface rounded-btn px-3 py-2 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-purple shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{item.learnerMessage}</span>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-slate">
                      <span>Progress: {item.progress}%</span>
                      <span>Enrolled {formatDate(item.enrolledAt)}</span>
                      {item.providerNote && (
                        <span className="text-brand-cyan">Has internal note</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {item.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void handleQuickStatus(item, 'enrolled')}
                        className="text-xs gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve / Enroll
                      </Button>
                    )}
                    {(item.status === 'enrolled' || item.status === 'active') && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleQuickStatus(item, 'completed')}
                        className="text-xs gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Completed
                      </Button>
                    )}
                    <Link to={`/provider/engagements/${item._id}`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        Manage & Notes
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-slate">
            Page {meta.page} of {meta.pages} ({meta.total} records)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => {
                setIsLoading(true);
                setPage((prev) => Math.max(1, prev - 1));
              }}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.pages || isLoading}
              onClick={() => {
                setIsLoading(true);
                setPage((prev) => Math.min(meta.pages, prev + 1));
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

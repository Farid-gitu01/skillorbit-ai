import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Award,
  BookOpen,
  CheckCircle2,
  Eye,
  FileEdit,
  Globe,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Select, Skeleton } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { providerService } from '@/services/provider.service';
import type { PaginationMeta } from '@/types/api.types';
import type {
  Course,
  CourseLevel,
  CourseStatus,
  ProviderCourseStatusCounts,
  ProviderCoursesQuery,
} from '@/types/provider.types';
import { formatDate } from '@/utils/job-helpers';
import {
  COURSE_LEVELS,
  formatCoursePrice,
  getCourseStatusBadge,
} from '@/utils/provider-validation';

const STATUS_TABS: Array<{ value: 'all' | CourseStatus; label: string }> = [
  { value: 'all', label: 'All Offerings' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

export function ProviderCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [statusCounts, setStatusCounts] = useState<ProviderCourseStatusCounts>({
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  });
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, pages: 1 });

  const [statusFilter, setStatusFilter] = useState<'all' | CourseStatus>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | CourseLevel>('all');
  const [sortBy, setSortBy] = useState<NonNullable<ProviderCoursesQuery['sort']>>('newest');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState<Course | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const fetchCourses = useCallback(
    async (params: ProviderCoursesQuery) => {
      try {
        const res = await providerService.getCourses(params);
        setCourses(res.courses);
        setStatusCounts(res.statusCounts);
        setMeta(res.meta);
      } catch (err) {
        setFeedback({ type: 'error', message: normalizeApiError(err).message });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await providerService.getCourses({
          q: appliedSearch || undefined,
          status: statusFilter,
          level: levelFilter,
          sort: sortBy,
          page,
          limit: 10,
        });
        if (!active) return;
        setCourses(res.courses);
        setStatusCounts(res.statusCounts);
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
    void load();
    return () => {
      active = false;
    };
  }, [appliedSearch, statusFilter, levelFilter, sortBy, page]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleStatusChange = async (course: Course, nextStatus: CourseStatus) => {
    setBusyCourseId(course._id);
    setFeedback(null);
    try {
      const res = await providerService.updateCourseStatus(course._id, nextStatus);
      setFeedback({ type: 'success', message: res.message });
      await fetchCourses({
        q: appliedSearch || undefined,
        status: statusFilter,
        level: levelFilter,
        sort: sortBy,
        page,
        limit: 10,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: normalizeApiError(err).message });
    } finally {
      setBusyCourseId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteCourse) return;
    const targetId = confirmDeleteCourse._id;
    setBusyCourseId(targetId);
    setFeedback(null);
    try {
      const res = await providerService.deleteCourse(targetId);
      setConfirmDeleteCourse(null);
      setFeedback({ type: 'success', message: res.message });
      await fetchCourses({
        q: appliedSearch || undefined,
        status: statusFilter,
        level: levelFilter,
        sort: sortBy,
        page,
        limit: 10,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: normalizeApiError(err).message });
    } finally {
      setBusyCourseId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">Training Offerings & Courses</h1>
          <p className="text-xs text-muted-slate mt-1">
            Create, organize, publish, and maintain your verified course catalog and skill tracks.
          </p>
        </div>
        <Link to="/provider/courses/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            New Course Offering
          </Button>
        </Link>
      </div>

      {feedback && (
        <Alert
          variant={feedback.type === 'success' ? 'success' : 'error'}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {/* Confirmation Prompt Banner/Modal for Delete */}
      {confirmDeleteCourse && (
        <Card variant="elevated" className="border-red-500/50">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-surface-white">
                Delete &ldquo;{confirmDeleteCourse.title}&rdquo;?
              </h2>
              <p className="text-xs text-muted-slate">
                This will remove the offering from active listings and archive it permanently. Existing audit history remains intact.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteCourse(null)}
                disabled={busyCourseId === confirmDeleteCourse._id}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDeleteConfirm()}
                isLoading={busyCourseId === confirmDeleteCourse._id}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-surface pb-3">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.value];
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setIsLoading(true);
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-btn text-xs font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-brand-blue text-white'
                  : 'text-muted-slate hover:text-surface-white hover:bg-navy-surface'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-navy-surface text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Filter Controls */}
      <Card>
        <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <form onSubmit={handleSearchSubmit} className="md:col-span-6 flex gap-2">
            <Input
              placeholder="Search offerings by title, category, or tags..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              prefixIcon={<Search className="w-4 h-4 text-muted-slate" />}
            />
            <Button type="submit" variant="outline" size="sm" className="shrink-0 h-[42px]">
              Search
            </Button>
          </form>

          <div className="md:col-span-3">
            <Select
              aria-label="Filter by level"
              value={levelFilter}
              onChange={(e) => {
                setIsLoading(true);
                setLevelFilter(e.target.value as 'all' | CourseLevel);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All Levels' },
                ...COURSE_LEVELS,
              ]}
            />
          </div>

          <div className="md:col-span-3">
            <Select
              aria-label="Sort offerings"
              value={sortBy}
              onChange={(e) => {
                setIsLoading(true);
                setSortBy(e.target.value as NonNullable<ProviderCoursesQuery['sort']>);
                setPage(1);
              }}
              options={[
                { value: 'newest', label: 'Sort: Newest First' },
                { value: 'oldest', label: 'Sort: Oldest First' },
                { value: 'enrollments_desc', label: 'Sort: Most Enrolled' },
                { value: 'price_asc', label: 'Sort: Price Low → High' },
                { value: 'price_desc', label: 'Sort: Price High → Low' },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Course Offerings List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-card" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <div className="p-10 text-center space-y-3">
            <BookOpen className="w-9 h-9 text-muted-slate mx-auto opacity-70" />
            <h2 className="text-sm font-semibold text-surface-white">
              No offerings match your current view
            </h2>
            <p className="text-xs text-muted-slate max-w-md mx-auto">
              {appliedSearch || statusFilter !== 'all' || levelFilter !== 'all'
                ? 'Try clearing filters or adjusting your search keywords.'
                : 'Publish your first course offering to help SkillOrbit learners build job-ready skills.'}
            </p>
            <div className="pt-1 flex justify-center gap-2">
              {(appliedSearch || statusFilter !== 'all' || levelFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsLoading(true);
                    setSearchInput('');
                    setAppliedSearch('');
                    setStatusFilter('all');
                    setLevelFilter('all');
                    setPage(1);
                  }}
                >
                  Reset Filters
                </Button>
              )}
              <Link to="/provider/courses/new">
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Create Offering
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const statusMeta = getCourseStatusBadge(course.status);
            const busy = busyCourseId === course._id;
            return (
              <Card key={course._id} className="hover:border-slate-700 transition-colors">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/provider/courses/${course._id}`}
                        className="text-base font-semibold text-surface-white hover:text-brand-cyan transition-colors"
                      >
                        {course.title}
                      </Link>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      {course.certificationOffered && (
                        <Badge variant="purple">
                          <Award className="w-3 h-3" />
                          Certificate
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-slate line-clamp-2">{course.description}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      {course.category && (
                        <span className="text-brand-cyan font-medium">{course.category}</span>
                      )}
                      <span className="capitalize">{course.level ?? 'beginner'}</span>
                      {course.deliveryMode && (
                        <span className="capitalize">{course.deliveryMode.replace('-', ' ')}</span>
                      )}
                      {course.duration !== undefined && <span>{course.duration} hrs</span>}
                      <span className="font-semibold text-surface-white">
                        {formatCoursePrice(course.price, course.currency)}
                      </span>
                      <span className="flex items-center gap-1 text-muted-slate">
                        <Users className="w-3.5 h-3.5" />
                        {course.enrollmentCount} enrolled
                      </span>
                      {(course.pendingEngagementsCount ?? 0) > 0 && (
                        <Badge variant="warning" className="text-[11px]">
                          {course.pendingEngagementsCount} pending review
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-slate">
                        Updated {formatDate(course.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link to={`/provider/courses/${course._id}`}>
                      <Button variant="ghost" size="sm" className="text-xs gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </Link>
                    <Link to={`/provider/courses/${course._id}/learners`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Learners
                      </Button>
                    </Link>
                    <Link to={`/provider/courses/${course._id}/edit`}>
                      <Button variant="outline" size="sm" className="text-xs gap-1">
                        <FileEdit className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </Link>

                    {course.status !== 'published' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void handleStatusChange(course, 'published')}
                        className="text-xs gap-1"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Publish
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void handleStatusChange(course, 'draft')}
                        className="text-xs gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Unpublish
                      </Button>
                    )}

                    {course.status !== 'archived' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void handleStatusChange(course, 'archived')}
                        className="text-xs gap-1 text-muted-slate hover:text-surface-white"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmDeleteCourse(course)}
                      aria-label={`Delete ${course.title}`}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
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
            Page {meta.page} of {meta.pages} ({meta.total} offerings)
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

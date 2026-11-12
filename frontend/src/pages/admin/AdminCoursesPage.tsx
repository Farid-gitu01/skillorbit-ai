import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldAlert,
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
  AdminCourseRecord,
  AdminCoursesQuery,
  ContentModerationStatus,
} from '@/types/admin.types';
import { formatAdminTimestamp, getModerationBadge } from '@/utils/admin-validation';

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<NonNullable<AdminCoursesQuery['status']>>('all');
  const [moderationFilter, setModerationFilter] =
    useState<NonNullable<AdminCoursesQuery['moderationStatus']>>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [moderatingCourse, setModeratingCourse] = useState<AdminCourseRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let active = true;
    const loadCourses = async () => {
      try {
        const res = await adminService.getCourses({
          q: debouncedSearch || undefined,
          status: statusFilter,
          moderationStatus: moderationFilter,
          page,
          limit: 12,
        });
        if (active) {
          setCourses(res.courses);
          setTotalPages(res.meta?.pages ?? 1);
          setTotalCount(res.meta?.total ?? res.courses.length);
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
    void loadCourses();
    return () => {
      active = false;
    };
  }, [debouncedSearch, statusFilter, moderationFilter, page]);

  const handleModerateSubmit = async (payload: {
    reason: string;
    moderationStatus?: ContentModerationStatus;
    contentStatus?: string;
  }) => {
    if (!moderatingCourse || !payload.moderationStatus) return;
    const res = await adminService.moderateCourse(moderatingCourse._id, {
      moderationStatus: payload.moderationStatus,
      status: (payload.contentStatus as 'published' | 'archived' | 'draft') || undefined,
      reason: payload.reason,
    });
    setCourses((prev) => prev.map((item) => (item._id === res.course._id ? res.course : item)));
    setFeedback(res.message);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-white">Training Course Moderation</h1>
          <p className="text-xs text-muted-slate mt-1">
            Review provider offerings ({totalCount}), flag misleading listings, or archive policy violations.
          </p>
        </div>
        <Link to="/admin/jobs">
          <Button size="sm" variant="outline" className="text-xs">
            Moderate Jobs
          </Button>
        </Link>
      </div>

      {feedback && <Alert variant="success">{feedback}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Search Offerings"
            placeholder="Course title, category..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Course Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as NonNullable<AdminCoursesQuery['status']>);
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <Select
            label="Moderation State"
            value={moderationFilter}
            onChange={(e) => {
              setModerationFilter(
                e.target.value as NonNullable<AdminCoursesQuery['moderationStatus']>
              );
              setPage(1);
              setIsLoading(true);
            }}
            options={[
              { value: 'all', label: 'All Moderation States' },
              { value: 'approved', label: 'Approved' },
              { value: 'flagged', label: 'Flagged' },
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
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-muted-slate mx-auto" />
            <p className="text-sm font-semibold text-surface-white">No courses matched filters</p>
            <p className="text-xs text-muted-slate">
              Adjust your search keyword or moderation state filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => {
            const modBadge = getModerationBadge(course.moderationStatus);
            return (
              <Card key={course._id}>
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-surface-white">
                        {course.title}
                      </span>
                      <Badge variant={course.status === 'published' ? 'success' : 'default'}>
                        {course.status}
                      </Badge>
                      <Badge variant={modBadge.variant}>{modBadge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-slate">
                      {course.organization?.name ?? course.provider?.name ?? 'Training Provider'} ·{' '}
                      {course.category || 'General'}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-slate">
                      <span>Enrollments: {course.enrollmentCount}</span>
                      <span>Created: {formatAdminTimestamp(course.createdAt)}</span>
                      {course.moderationReason && (
                        <span className="text-amber-300">Note: {course.moderationReason}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {course.provider?._id && (
                      <Link to={`/admin/providers/${course.provider._id}`}>
                        <Button size="sm" variant="outline" className="text-xs">
                          Provider Profile
                        </Button>
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5 text-xs"
                      onClick={() => setModeratingCourse(course)}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Moderate
                    </Button>
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
            Page {page} of {totalPages} ({totalCount} courses)
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

      {moderatingCourse && (
        <AdminActionDialog
          key={moderatingCourse._id}
          open={Boolean(moderatingCourse)}
          title={`Moderate Course: ${moderatingCourse.title}`}
          description="Set moderation decision, optional publication status, and required audit note."
          mode="course-moderation"
          confirmLabel="Save Moderation Decision"
          confirmVariant="primary"
          requireReason
          initialModerationStatus={moderatingCourse.moderationStatus}
          initialContentStatus={moderatingCourse.status}
          onClose={() => setModeratingCourse(null)}
          onSubmit={handleModerateSubmit}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  Globe,
  Layers,
  Trash2,
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
import { normalizeApiError } from '@/services/api';
import { providerService } from '@/services/provider.service';
import type { Course, CourseStatus } from '@/types/provider.types';
import { formatDate } from '@/utils/job-helpers';
import { formatCoursePrice, getCourseStatusBadge } from '@/utils/provider-validation';

export function ProviderCourseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadCourse = async () => {
      try {
        const fetched = await providerService.getCourseById(id);
        if (active) {
          setCourse(fetched);
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
    void loadCourse();
    return () => {
      active = false;
    };
  }, [id]);

  const handleStatusUpdate = async (nextStatus: CourseStatus) => {
    if (!course) return;
    setIsMutating(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await providerService.updateCourseStatus(course._id, nextStatus);
      setCourse(res.course);
      setFeedback(res.message);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (!course) return;
    setIsMutating(true);
    setError(null);
    try {
      await providerService.deleteCourse(course._id);
      navigate('/provider/courses', { replace: true });
    } catch (err) {
      setError(normalizeApiError(err).message);
      setIsMutating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert variant="error" title="Course offering unavailable">
          {error ?? 'The requested course offering could not be found.'}
        </Alert>
        <Link to="/provider/courses">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Offerings
          </Button>
        </Link>
      </div>
    );
  }

  const statusMeta = getCourseStatusBadge(course.status);

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left">
      <div>
        <Link
          to="/provider/courses"
          className="inline-flex items-center gap-1.5 text-xs text-muted-slate hover:text-brand-cyan"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to All Offerings
        </Link>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {feedback && (
        <Alert variant="success" onDismiss={() => setFeedback(null)}>
          {feedback}
        </Alert>
      )}

      {showDeleteConfirm && (
        <Card variant="elevated" className="border-red-500/50">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-surface-white">
                Confirm Deletion
              </h2>
              <p className="text-xs text-muted-slate">
                Deleting &ldquo;{course.title}&rdquo; archives it and hides it from all listings.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDelete()}
                isLoading={isMutating}
              >
                Delete Offering
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Header Card */}
      <Card variant="elevated">
        <CardContent className="p-6 flex flex-col lg:flex-row justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              {course.category && <Badge variant="info">{course.category}</Badge>}
              {course.certificationOffered && (
                <Badge variant="purple">
                  <Award className="w-3 h-3" />
                  Certificate Included
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-surface-white">{course.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-slate">
              <span className="capitalize font-medium text-slate-200">
                Level: {course.level ?? 'beginner'}
              </span>
              {course.deliveryMode && (
                <span className="capitalize">
                  Mode: {course.deliveryMode.replace('-', ' ')}
                </span>
              )}
              {course.duration !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {course.duration} hours
                </span>
              )}
              <span className="font-semibold text-brand-cyan">
                {formatCoursePrice(course.price, course.currency)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {course.enrollmentCount} enrolled
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-2 shrink-0">
            <Link to={`/provider/courses/${course._id}/learners`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Users className="w-4 h-4" />
                Learners
              </Button>
            </Link>
            <Link to={`/provider/courses/${course._id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileEdit className="w-4 h-4" />
                Edit
              </Button>
            </Link>
            {course.status !== 'published' ? (
              <Button
                size="sm"
                disabled={isMutating}
                isLoading={isMutating}
                onClick={() => void handleStatusUpdate('published')}
                className="gap-1.5"
              >
                <Globe className="w-4 h-4" />
                Publish
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isMutating}
                onClick={() => void handleStatusUpdate('draft')}
                className="gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Move to Draft
              </Button>
            )}
            {course.status !== 'archived' && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isMutating}
                onClick={() => void handleStatusUpdate('archived')}
                className="gap-1.5"
              >
                <Archive className="w-4 h-4" />
                Archive
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={isMutating}
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
              aria-label="Delete offering"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Description + Syllabus */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-cyan" />
                Program Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {course.description}
              </p>

              {course.externalUrl && (
                <a
                  href={course.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
                >
                  Open External LMS / Course Page
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-blue" />
                Curriculum Syllabus ({course.syllabus?.length ?? 0} modules)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!course.syllabus || course.syllabus.length === 0 ? (
                <p className="text-xs text-muted-slate">
                  No syllabus modules configured yet. Edit this course to outline modules and lessons.
                </p>
              ) : (
                <div className="space-y-3">
                  {course.syllabus.map((mod, idx) => (
                    <div
                      key={`${mod.moduleTitle}-${idx}`}
                      className="p-4 rounded-btn border border-navy-surface bg-midnight-navy/60 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-surface-white">
                          Module {idx + 1}: {mod.moduleTitle}
                        </h3>
                        {mod.duration !== undefined && (
                          <span className="text-xs text-muted-slate shrink-0">
                            {mod.duration} hrs
                          </span>
                        )}
                      </div>
                      {mod.lessons && mod.lessons.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                          {mod.lessons.map((lesson, lessonIdx) => (
                            <li key={lessonIdx}>{lesson}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Metadata Sidebar */}
        <div className="space-y-6">
          {course.thumbnailUrl && (
            <Card className="overflow-hidden">
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                className="w-full h-44 object-cover"
              />
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Skills & Taxonomy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-slate font-semibold">
                  Skills Taught
                </p>
                {!course.skills || course.skills.length === 0 ? (
                  <p className="text-xs text-muted-slate">No skills linked yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {course.skills.map((skill, idx) => {
                      const label = typeof skill === 'string' ? skill : skill.name;
                      const key = typeof skill === 'string' ? `${skill}-${idx}` : skill._id;
                      return (
                        <Badge key={key} variant="primary">
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>

              {course.tags && course.tags.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-navy-surface">
                  <p className="text-[11px] uppercase tracking-wide text-muted-slate font-semibold">
                    Search Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {course.tags.map((tag) => (
                      <Badge key={tag} variant="default">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-navy-surface text-xs text-muted-slate space-y-1">
                <p>Created: {formatDate(course.createdAt)}</p>
                <p>Last Updated: {formatDate(course.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  ExternalLink,
  GraduationCap,
  History,
  MapPin,
  MessageSquare,
  Save,
  User as UserIcon,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Skeleton,
} from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { providerService } from '@/services/provider.service';
import type { ProviderEngagement, UpdateEngagementPayload } from '@/types/provider.types';
import { formatDate } from '@/utils/job-helpers';
import {
  engagementUpdateSchema,
  getEngagementStatusBadge,
} from '@/utils/provider-validation';

const EDITABLE_STATUSES: Array<{
  value: NonNullable<UpdateEngagementPayload['status']>;
  label: string;
}> = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'active', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
];

export function ProviderEngagementDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [engagement, setEngagement] = useState<ProviderEngagement | null>(null);
  const [statusInput, setStatusInput] =
    useState<NonNullable<UpdateEngagementPayload['status']>>('enrolled');
  const [progressInput, setProgressInput] = useState('0');
  const [providerNoteInput, setProviderNoteInput] = useState('');
  const [historyNoteInput, setHistoryNoteInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadEngagement = async () => {
      try {
        const record = await providerService.getEngagementById(id);
        if (!active) return;
        setEngagement(record);
        if (record.status !== 'withdrawn') {
          setStatusInput(record.status);
        }
        setProgressInput(String(record.progress ?? 0));
        setProviderNoteInput(record.providerNote ?? '');
        setLoadError(null);
      } catch (err) {
        if (active) {
          setLoadError(normalizeApiError(err).message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void loadEngagement();
    return () => {
      active = false;
    };
  }, [id]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!engagement) return;
    setFeedback(null);

    const parsed = engagementUpdateSchema.safeParse({
      status: statusInput,
      progress: progressInput,
      providerNote: providerNoteInput,
      note: historyNoteInput.trim() || undefined,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Please check the form inputs';
      setFeedback({ type: 'error', message: firstIssue });
      return;
    }

    setIsSaving(true);
    try {
      const res = await providerService.updateEngagement(engagement._id, parsed.data);
      setEngagement(res.engagement);
      setProgressInput(String(res.engagement.progress ?? 0));
      setProviderNoteInput(res.engagement.providerNote ?? '');
      setHistoryNoteInput('');
      setFeedback({ type: 'success', message: res.message });
    } catch (err) {
      setFeedback({ type: 'error', message: normalizeApiError(err).message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert variant="error" title="Unable to load learner record">
          {loadError ?? 'The requested learner engagement record could not be found.'}
        </Alert>
        <Link to="/provider/engagements">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back to Engagements
          </Button>
        </Link>
      </div>
    );
  }

  const statusMeta = getEngagementStatusBadge(engagement.status);
  const { learner } = engagement;
  const isWithdrawn = engagement.status === 'withdrawn';

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left">
      <div>
        <Link
          to="/provider/engagements"
          className="inline-flex items-center gap-1.5 text-xs text-muted-slate hover:text-brand-cyan"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Enrollments & Enquiries
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

      {/* Header Summary */}
      <Card variant="elevated">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={engagement.type === 'enquiry' ? 'purple' : 'info'}>
                {engagement.type === 'enquiry' ? 'Training Enquiry' : 'Course Enrollment'}
              </Badge>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-brand-cyan" />
              {learner.name}
            </h1>
            <p className="text-xs text-muted-slate flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-slate-200 font-medium">
                <GraduationCap className="w-3.5 h-3.5 text-brand-cyan" />
                {engagement.course.title}
              </span>
              {learner.profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {learner.profile.location}
                </span>
              )}
              <span>Enrolled {formatDate(engagement.enrolledAt)}</span>
            </p>
          </div>

          <div className="shrink-0">
            <Link to={`/provider/courses/${engagement.course._id}`}>
              <Button variant="outline" size="sm">
                View Offering
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Learner Safe Career Overview & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {engagement.learnerMessage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-purple" />
                  Learner Message / Goal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                  {engagement.learnerMessage}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-brand-cyan" />
                Learner Profile Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {learner.profile.headline && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-slate font-semibold">
                    Headline
                  </p>
                  <p className="text-sm text-surface-white mt-0.5">{learner.profile.headline}</p>
                </div>
              )}

              {learner.profile.bio && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-slate font-semibold">
                    About
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                    {learner.profile.bio}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-slate font-semibold mb-1.5">
                  Skills
                </p>
                {learner.profile.skills.length === 0 ? (
                  <p className="text-xs text-muted-slate">No public profile skills listed.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {learner.profile.skills.map((skill) => (
                      <Badge key={skill} variant="primary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {(learner.profile.linkedinUrl ||
                learner.profile.githubUrl ||
                learner.profile.portfolioUrl) && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-navy-surface">
                  {learner.profile.linkedinUrl && (
                    <a
                      href={learner.profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
                    >
                      LinkedIn <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {learner.profile.githubUrl && (
                    <a
                      href={learner.profile.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
                    >
                      GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {learner.profile.portfolioUrl && (
                    <a
                      href={learner.profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-cyan hover:underline inline-flex items-center gap-1"
                    >
                      Portfolio <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                Engagement Status History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!engagement.statusHistory || engagement.statusHistory.length === 0 ? (
                <p className="text-xs text-muted-slate">
                  No status changes recorded yet beyond initial submission.
                </p>
              ) : (
                <div className="space-y-3">
                  {engagement.statusHistory.map((item, idx) => {
                    const badge = getEngagementStatusBadge(item.status);
                    return (
                      <div
                        key={`${item.status}-${idx}`}
                        className="p-3 rounded-btn bg-midnight-navy/60 border border-navy-surface space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <span className="text-[11px] text-muted-slate">
                            {formatDate(item.changedAt)}
                          </span>
                        </div>
                        {item.note && <p className="text-xs text-slate-300">{item.note}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status Update & Internal Notes Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Manage Engagement & Internal Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {isWithdrawn ? (
                <Alert variant="warning">
                  This engagement was withdrawn by the learner and cannot be modified.
                </Alert>
              ) : (
                <form onSubmit={handleSave} className="space-y-4">
                  <Select
                    label="Status"
                    value={statusInput}
                    onChange={(e) => {
                      const next = e.target.value as NonNullable<UpdateEngagementPayload['status']>;
                      setStatusInput(next);
                      if (next === 'completed' && Number(progressInput) < 100) {
                        setProgressInput('100');
                      }
                    }}
                    options={EDITABLE_STATUSES}
                  />

                  <div className="space-y-1.5">
                    <Input
                      label="Completion Progress (%)"
                      type="number"
                      min="0"
                      max="100"
                      value={progressInput}
                      onChange={(e) => setProgressInput(e.target.value)}
                    />
                    <div className="h-2 rounded-full bg-midnight-navy overflow-hidden border border-navy-surface">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all"
                        style={{
                          width: `${Math.min(Math.max(Number(progressInput) || 0, 0), 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="provider-internal-note"
                      className="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
                    >
                      Internal Provider Note (Private)
                    </label>
                    <textarea
                      id="provider-internal-note"
                      rows={4}
                      placeholder="Track cohort placement, prerequisite review, or coaching remarks (never shared publicly)..."
                      value={providerNoteInput}
                      onChange={(e) => setProviderNoteInput(e.target.value)}
                      className="w-full rounded-btn bg-midnight-navy/90 text-surface-white placeholder:text-slate-500 text-xs border border-slate-700/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="history-note"
                      className="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
                    >
                      Timeline Update Remark (Optional)
                    </label>
                    <Input
                      id="history-note"
                      placeholder="e.g. Approved seat for November cohort"
                      value={historyNoteInput}
                      onChange={(e) => setHistoryNoteInput(e.target.value)}
                    />
                  </div>

                  <Button type="submit" isLoading={isSaving} disabled={isSaving} className="w-full gap-1.5">
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

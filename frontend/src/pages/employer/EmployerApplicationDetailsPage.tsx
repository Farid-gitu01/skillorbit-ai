import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Save,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
} from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { employerService } from '@/services/employer.service';
import type { Application, ApplicationStatus } from '@/types/application.types';
import {
  applicationNoteSchema,
  isHttpUrl,
} from '@/utils/employer-validation';
import { formatDate, formatFileSize, getApplicationStatusBadge } from '@/utils/job-helpers';

type MutableAppStatus = Exclude<ApplicationStatus, 'withdrawn'>;

export function EmployerApplicationDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [application, setApplication] = useState<Application | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<MutableAppStatus>('reviewed');
  const [noteInput, setNoteInput] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDownloadingResume, setIsDownloadingResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const fetched = await employerService.getApplicationById(id);
        if (!active) return;
        setApplication(fetched);
        if (fetched.status !== 'withdrawn') {
          setSelectedStatus(fetched.status);
        }
        setNoteInput(fetched.employerNote ?? '');
        setError(null);
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
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleStatusChange = async (nextStatus: MutableAppStatus) => {
    if (!application) return;
    setIsUpdatingStatus(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await employerService.updateApplicationStatus(
        application._id,
        nextStatus,
        noteInput.trim() || undefined
      );
      setApplication((prev) =>
        prev
          ? {
              ...res.application,
              candidateProfile: prev.candidateProfile,
            }
          : res.application
      );
      setSelectedStatus(nextStatus);
      setSuccessMsg(res.message);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application) return;
    setNoteError(null);
    setError(null);
    setSuccessMsg(null);

    const parsed = applicationNoteSchema.safeParse({ employerNote: noteInput });
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message ?? 'Invalid note');
      return;
    }

    setIsSavingNote(true);
    try {
      const res = await employerService.updateApplicationNote(
        application._id,
        parsed.data.employerNote
      );
      setApplication((prev) =>
        prev
          ? {
              ...res.application,
              candidateProfile: prev.candidateProfile,
            }
          : res.application
      );
      setSuccessMsg(res.message);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!application?.resume) return;
    setIsDownloadingResume(true);
    setError(null);
    try {
      await employerService.downloadCandidateResume(
        application.resume._id,
        application.resume.fileName
      );
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsDownloadingResume(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Link
          to="/employer/applications"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Applications
        </Link>
        <Alert variant="error" title="Could not load application">
          {error}
        </Alert>
      </div>
    );
  }

  if (!application) return null;

  const seeker =
    typeof application.seeker === 'object' && application.seeker !== null
      ? application.seeker
      : { _id: '', name: 'Candidate', email: '' };
  const profile = application.candidateProfile;
  const statusInfo = getApplicationStatusBadge(application.status);
  const isWithdrawn = application.status === 'withdrawn';
  const history = application.statusHistory ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/employer/applications"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Application Management
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {seeker._id && !isWithdrawn && (
            <Link to={`/employer/candidates/${seeker._id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Full Candidate Profile
              </Button>
            </Link>
          )}
          {application.resume && !isWithdrawn && (
            <Button
              variant="secondary"
              size="sm"
              isLoading={isDownloadingResume}
              onClick={() => void handleDownloadResume()}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download Resume
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}
      {isWithdrawn && (
        <Alert variant="warning" title="Application Withdrawn">
          This candidate has withdrawn their application. Status changes and resume access are disabled.
        </Alert>
      )}

      {/* Header Overview */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-surface-white">{seeker.name}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              {typeof application.aiMatchScore === 'number' && (
                <Badge variant="primary">{application.aiMatchScore}% AI Match</Badge>
              )}
            </div>

            {profile?.headline && (
              <p className="text-sm font-medium text-surface-white/90">{profile.headline}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-slate">
              {seeker.email && !isWithdrawn && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {seeker.email}
                </span>
              )}
              {profile?.phone && !isWithdrawn && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {profile.phone}
                </span>
              )}
              {profile?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.location}
                </span>
              )}
              {profile?.availability && (
                <span className="capitalize">Availability: {profile.availability}</span>
              )}
            </div>

            {application.job && (
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-muted-slate">
                <Briefcase className="w-4 h-4 text-brand-cyan" />
                <span>Applied for</span>
                <Link
                  to={`/employer/jobs/${application.job._id}`}
                  className="font-semibold text-surface-white hover:text-brand-cyan"
                >
                  {application.job.title}
                </Link>
                <span>on {formatDate(application.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Quick Pipeline Actions */}
          {!isWithdrawn && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="sm"
                isLoading={isUpdatingStatus}
                disabled={application.status === 'shortlisted'}
                onClick={() => void handleStatusChange('shortlisted')}
              >
                <UserCheck className="w-4 h-4 mr-1.5" />
                Shortlist Candidate
              </Button>
              <Button
                variant="outline"
                size="sm"
                isLoading={isUpdatingStatus}
                disabled={application.status === 'accepted'}
                onClick={() => void handleStatusChange('accepted')}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Accept
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isUpdatingStatus}
                disabled={application.status === 'rejected'}
                onClick={() => void handleStatusChange('rejected')}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Application Content & Candidate Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Match Breakdown */}
          {(typeof application.aiMatchScore === 'number' || application.aiMatchDetails) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-cyan" />
                  Role Match Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {application.aiMatchDetails?.summary && (
                  <p className="text-sm text-surface-white/90">
                    {application.aiMatchDetails.summary}
                  </p>
                )}
                {application.aiMatchDetails?.matchedSkills &&
                  application.aiMatchDetails.matchedSkills.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-emerald-400">Matched Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {application.aiMatchDetails.matchedSkills.map((s) => (
                          <Badge key={s} variant="success">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                {application.aiMatchDetails?.missingSkills &&
                  application.aiMatchDetails.missingSkills.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-amber-400">Skill Gaps</p>
                      <div className="flex flex-wrap gap-1.5">
                        {application.aiMatchDetails.missingSkills.map((s) => (
                          <Badge key={s} variant="warning">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

          {/* Cover Letter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-cyan" />
                Cover Letter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {application.coverLetter ? (
                <p className="text-sm text-surface-white/90 whitespace-pre-line leading-relaxed">
                  {application.coverLetter}
                </p>
              ) : (
                <p className="text-sm text-muted-slate">
                  No cover letter was submitted with this application.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Candidate Snapshot */}
          {!isWithdrawn && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Candidate Profile Summary</CardTitle>
                {seeker._id && (
                  <Link
                    to={`/employer/candidates/${seeker._id}`}
                    className="text-xs text-brand-cyan hover:underline"
                  >
                    Open full profile
                  </Link>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {profile?.bio && (
                  <p className="text-sm text-surface-white/90 leading-relaxed">{profile.bio}</p>
                )}

                {profile?.skills && profile.skills.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-slate">
                      Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills.map((skill) => (
                        <Badge key={skill} variant="primary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {profile?.experience && profile.experience.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-navy-surface">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-slate">
                      Recent Experience
                    </h3>
                    <div className="space-y-3">
                      {profile.experience.slice(0, 3).map((exp, idx) => (
                        <div key={exp._id ?? idx} className="text-sm">
                          <p className="font-medium text-surface-white">
                            {exp.title} • {exp.company}
                          </p>
                          <p className="text-xs text-muted-slate">
                            {formatDate(exp.startDate)} –{' '}
                            {exp.isCurrent ? 'Present' : formatDate(exp.endDate)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {profile?.education && profile.education.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-navy-surface">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-slate">
                      Education
                    </h3>
                    <div className="space-y-2">
                      {profile.education.slice(0, 2).map((edu, idx) => (
                        <div key={edu._id ?? idx} className="text-sm">
                          <p className="font-medium text-surface-white">
                            {edu.degree}
                            {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}
                          </p>
                          <p className="text-xs text-muted-slate">{edu.institution}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(profile?.linkedinUrl || profile?.githubUrl || profile?.portfolioUrl) && (
                  <div className="flex flex-wrap gap-3 pt-3 border-t border-navy-surface text-xs">
                    {profile.linkedinUrl && isHttpUrl(profile.linkedinUrl) && (
                      <a
                        href={profile.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-cyan hover:underline"
                      >
                        LinkedIn
                      </a>
                    )}
                    {profile.githubUrl && isHttpUrl(profile.githubUrl) && (
                      <a
                        href={profile.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-cyan hover:underline"
                      >
                        GitHub
                      </a>
                    )}
                    {profile.portfolioUrl && isHttpUrl(profile.portfolioUrl) && (
                      <a
                        href={profile.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-cyan hover:underline"
                      >
                        Portfolio
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Status Control, Resume, Internal Notes, Status History */}
        <div className="space-y-6">
          {/* Attached Resume */}
          <Card>
            <CardHeader>
              <CardTitle>Submitted Resume</CardTitle>
            </CardHeader>
            <CardContent>
              {application.resume && !isWithdrawn ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-midnight-navy/60 border border-navy-surface">
                    <p className="text-sm font-medium text-surface-white truncate">
                      {application.resume.fileName}
                    </p>
                    <p className="text-xs text-muted-slate mt-0.5">
                      {application.resume.fileSize
                        ? formatFileSize(application.resume.fileSize)
                        : 'Document'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    isLoading={isDownloadingResume}
                    onClick={() => void handleDownloadResume()}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download Resume
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-slate">
                  {isWithdrawn
                    ? 'Resume access revoked after withdrawal.'
                    : 'No resume file attached to this application.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status Selector */}
          {!isWithdrawn && (
            <Card>
              <CardHeader>
                <CardTitle>Update Hiring Stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  label="Application Status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as MutableAppStatus)}
                  options={[
                    { value: 'pending', label: 'Pending Review' },
                    { value: 'reviewed', label: 'Reviewed' },
                    { value: 'shortlisted', label: 'Shortlisted' },
                    { value: 'accepted', label: 'Accepted' },
                    { value: 'rejected', label: 'Rejected' },
                  ]}
                />
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  isLoading={isUpdatingStatus}
                  onClick={() => void handleStatusChange(selectedStatus)}
                >
                  Save Status Change
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Internal Evaluation Note */}
          <Card>
            <CardHeader>
              <CardTitle>Internal Evaluation Note</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveNote} className="space-y-3">
                <textarea
                  rows={4}
                  maxLength={1000}
                  disabled={isWithdrawn}
                  placeholder="Record private interview feedback or evaluation notes..."
                  value={noteInput}
                  onChange={(e) => {
                    setNoteInput(e.target.value);
                    setNoteError(null);
                  }}
                  className="w-full rounded-btn bg-navy-surface border border-slate-700/80 px-3 py-2 text-sm text-surface-white placeholder:text-muted-slate/60 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan disabled:opacity-50"
                />
                <div className="flex items-center justify-between text-xs">
                  {noteError ? (
                    <span className="text-red-400">{noteError}</span>
                  ) : (
                    <span className="text-muted-slate">Visible only to your organization.</span>
                  )}
                  <span className="text-muted-slate">{noteInput.length}/1000</span>
                </div>
                {!isWithdrawn && (
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    isLoading={isSavingNote}
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    Save Note
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Status History Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-cyan" />
                Application History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-slate">
                  Submitted on {formatDate(application.createdAt)}.
                </p>
              ) : (
                <div className="space-y-3">
                  {history
                    .slice()
                    .reverse()
                    .map((entry, idx) => {
                      const entryBadge = getApplicationStatusBadge(entry.status);
                      const actorName =
                        typeof entry.changedBy === 'object' && entry.changedBy !== null
                          ? entry.changedBy.name
                          : undefined;
                      return (
                        <div
                          key={`${entry.status}-${entry.changedAt}-${idx}`}
                          className="pb-3 border-b border-navy-surface last:border-b-0 last:pb-0 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={entryBadge.variant}>{entryBadge.label}</Badge>
                            <span className="text-[11px] text-muted-slate">
                              {formatDate(entry.changedAt)}
                            </span>
                          </div>
                          {actorName && (
                            <p className="text-xs text-muted-slate">Updated by {actorName}</p>
                          )}
                          {entry.note && (
                            <p className="text-xs text-surface-white/90">{entry.note}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

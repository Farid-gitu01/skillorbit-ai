import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
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
  Skeleton,
} from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import { employerService } from '@/services/employer.service';
import type { ApplicationStatus } from '@/types/application.types';
import type { EmployerCandidateDetail } from '@/types/employer.types';
import { isHttpUrl } from '@/utils/employer-validation';
import { formatDate, formatFileSize, getApplicationStatusBadge } from '@/utils/job-helpers';

export function EmployerCandidateDetailsPage() {
  const { id } = useParams<{ id: string }>();

  const [candidate, setCandidate] = useState<EmployerCandidateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);

  const refreshCandidate = useCallback(async () => {
    if (!id) return;
    try {
      const fetched = await employerService.getCandidateById(id);
      setCandidate(fetched);
      setError(null);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const fetched = await employerService.getCandidateById(id);
        if (active) {
          setCandidate(fetched);
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
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const handleUpdateApplicationStatus = async (
    applicationId: string,
    status: Exclude<ApplicationStatus, 'withdrawn'>
  ) => {
    setBusyAppId(applicationId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await employerService.updateApplicationStatus(applicationId, status);
      setSuccessMsg(res.message);
      await refreshCandidate();
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setBusyAppId(null);
    }
  };

  const handleDownloadResume = async (resumeId: string, fileName: string) => {
    setDownloadingResumeId(resumeId);
    setError(null);
    try {
      await employerService.downloadCandidateResume(resumeId, fileName);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setDownloadingResumeId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-36 w-full rounded-card" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  }

  if (error && !candidate) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Link
          to="/employer/candidates"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Candidate Directory
        </Link>
        <Alert variant="error" title="Candidate access unavailable">
          {error}
        </Alert>
      </div>
    );
  }

  if (!candidate) return null;

  const { profile } = candidate;
  const experience = profile.experience ?? [];
  const education = profile.education ?? [];
  const skills = profile.skills ?? [];
  const languages = profile.languages ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        to="/employer/candidates"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Candidate Directory
      </Link>

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

      {/* Candidate Header */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-surface-white">{candidate.name}</h1>
              {candidate.applications.some((a) => a.status === 'shortlisted') && (
                <Badge variant="purple">Shortlisted</Badge>
              )}
              {profile.availability && (
                <Badge variant="info" className="capitalize">
                  {profile.availability}
                </Badge>
              )}
            </div>
            {profile.headline && (
              <p className="text-base text-surface-white/90">{profile.headline}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-slate">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {candidate.email}
              </span>
              {profile.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {profile.phone}
                </span>
              )}
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.location}
                </span>
              )}
            </div>
          </div>

          {(profile.linkedinUrl || profile.githubUrl || profile.portfolioUrl) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {profile.linkedinUrl && isHttpUrl(profile.linkedinUrl) && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-btn bg-navy-surface text-brand-cyan hover:bg-brand-blue/20 transition-colors"
                >
                  LinkedIn
                </a>
              )}
              {profile.githubUrl && isHttpUrl(profile.githubUrl) && (
                <a
                  href={profile.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-btn bg-navy-surface text-brand-cyan hover:bg-brand-blue/20 transition-colors"
                >
                  GitHub
                </a>
              )}
              {profile.portfolioUrl && isHttpUrl(profile.portfolioUrl) && (
                <a
                  href={profile.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-btn bg-navy-surface text-brand-cyan hover:bg-brand-blue/20 transition-colors"
                >
                  Portfolio
                </a>
              )}
            </div>
          )}
        </div>

        {profile.bio && (
          <p className="text-sm text-surface-white/90 leading-relaxed pt-3 border-t border-navy-surface">
            {profile.bio}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Experience, Education, Skills */}
        <div className="lg:col-span-2 space-y-6">
          {/* Skills & Languages */}
          <Card>
            <CardHeader>
              <CardTitle>Skills Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {skills.length === 0 ? (
                <p className="text-sm text-muted-slate">No skills listed on candidate profile.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="primary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}

              {languages.length > 0 && (
                <div className="pt-3 border-t border-navy-surface space-y-1.5">
                  <p className="text-xs font-medium text-muted-slate">Languages</p>
                  <p className="text-sm text-surface-white">{languages.join(', ')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work Experience */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-brand-cyan" />
                Work Experience
              </CardTitle>
            </CardHeader>
            <CardContent>
              {experience.length === 0 ? (
                <p className="text-sm text-muted-slate">No work experience recorded.</p>
              ) : (
                <div className="space-y-5">
                  {experience.map((exp, idx) => (
                    <div
                      key={exp._id ?? idx}
                      className="pb-4 border-b border-navy-surface last:border-b-0 last:pb-0 space-y-1"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-semibold text-surface-white">
                          {exp.title}
                        </h3>
                        <span className="text-xs text-muted-slate">
                          {formatDate(exp.startDate)} –{' '}
                          {exp.isCurrent ? 'Present' : formatDate(exp.endDate)}
                        </span>
                      </div>
                      <p className="text-sm text-brand-cyan">
                        {exp.company}
                        {exp.location ? ` • ${exp.location}` : ''}
                      </p>
                      {exp.description && (
                        <p className="text-sm text-muted-slate mt-1 whitespace-pre-line">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-brand-cyan" />
                Education
              </CardTitle>
            </CardHeader>
            <CardContent>
              {education.length === 0 ? (
                <p className="text-sm text-muted-slate">No education history listed.</p>
              ) : (
                <div className="space-y-4">
                  {education.map((edu, idx) => (
                    <div
                      key={edu._id ?? idx}
                      className="pb-4 border-b border-navy-surface last:border-b-0 last:pb-0 space-y-1"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-semibold text-surface-white">
                          {edu.degree}
                          {edu.fieldOfStudy ? ` — ${edu.fieldOfStudy}` : ''}
                        </h3>
                        <span className="text-xs text-muted-slate">
                          {formatDate(edu.startDate)} –{' '}
                          {edu.isCurrent ? 'Present' : formatDate(edu.endDate)}
                        </span>
                      </div>
                      <p className="text-sm text-brand-cyan">{edu.institution}</p>
                      {edu.description && (
                        <p className="text-sm text-muted-slate mt-1">{edu.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Authorized Resumes & Applications to Your Jobs */}
        <div className="space-y-6">
          {/* Resumes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-cyan" />
                Authorized Resumes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {candidate.resumes.length === 0 ? (
                <p className="text-xs text-muted-slate">No resume files attached.</p>
              ) : (
                <div className="space-y-3">
                  {candidate.resumes.map((resume) => (
                    <div
                      key={resume._id}
                      className="p-3 rounded-lg bg-midnight-navy/60 border border-navy-surface flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-surface-white truncate">
                          {resume.fileName}
                        </p>
                        <p className="text-xs text-muted-slate">
                          {resume.fileSize ? formatFileSize(resume.fileSize) : 'Document'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        isLoading={downloadingResumeId === resume._id}
                        onClick={() => void handleDownloadResume(resume._id, resume.fileName)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Applications to Your Jobs */}
          <Card>
            <CardHeader>
              <CardTitle>Applications to Your Jobs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {candidate.applications.map((app) => {
                const badge = getApplicationStatusBadge(app.status);
                const isBusy = busyAppId === app._id;
                const isWithdrawn = app.status === 'withdrawn';

                return (
                  <div
                    key={app._id}
                    className="p-3.5 rounded-lg bg-midnight-navy/60 border border-navy-surface space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          to={`/employer/applications/${app._id}`}
                          className="text-sm font-semibold text-surface-white hover:text-brand-cyan"
                        >
                          {app.job.title}
                        </Link>
                        <p className="text-xs text-muted-slate">
                          Applied {formatDate(app.createdAt)}
                        </p>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>

                    {typeof app.aiMatchScore === 'number' && (
                      <Badge variant="primary">{app.aiMatchScore}% Match</Badge>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Link to={`/employer/applications/${app._id}`}>
                        <Button variant="secondary" size="sm">
                          Inspect
                        </Button>
                      </Link>
                      {!isWithdrawn && app.status !== 'shortlisted' && app.status !== 'accepted' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={isBusy}
                          onClick={() =>
                            void handleUpdateApplicationStatus(app._id, 'shortlisted')
                          }
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          Shortlist
                        </Button>
                      )}
                      {!isWithdrawn && app.status !== 'rejected' && app.status !== 'accepted' && (
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={isBusy}
                          onClick={() => void handleUpdateApplicationStatus(app._id, 'rejected')}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

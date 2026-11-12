import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { jobService, resumeService, applicationService } from '@/services';
import type { Job, Resume } from '@/types';
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
import { formatDate, formatSalary } from '@/utils/job-helpers';
import {
  ArrowLeft,
  Bookmark,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  MapPin,
  Send,
  Users,
} from 'lucide-react';

export function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application form state
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      try {
        const [jobData, myResumes, myApplications] = await Promise.all([
          jobService.getJobById(id),
          resumeService.getMyResumes().catch(() => [] as Resume[]),
          applicationService.getMyApplications().catch(() => []),
        ]);

        if (!active) return;

        setJob(jobData);
        setResumes(myResumes);
        setError(null);

        const primary = myResumes.find((r) => r.isPrimary);
        if (primary) {
          setSelectedResumeId(primary._id);
        } else if (myResumes.length > 0) {
          setSelectedResumeId(myResumes[0]._id);
        }

        const applied = myApplications.some(
          (app) => app.job?._id === id && app.status !== 'withdrawn'
        );
        setAlreadyApplied(applied);
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to load job details';
          setError(msg);
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

  const handleToggleSave = async () => {
    if (!job) return;
    try {
      if (job.isSaved) {
        await jobService.unsaveJob(job._id);
      } else {
        await jobService.saveJob(job._id);
      }
      setJob({ ...job, isSaved: !job.isSaved });
    } catch {
      // Handled gracefully
    }
  };

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setIsApplying(true);
    setApplyError(null);
    setApplySuccess(null);

    try {
      await applicationService.applyForJob({
        jobId: job._id,
        resumeId: selectedResumeId || undefined,
        coverLetter: coverLetter.trim() || undefined,
      });
      setAlreadyApplied(true);
      setApplySuccess('Your application has been submitted successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit application';
      setApplyError(msg);
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 rounded-btn" />
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Error">
          {error ?? 'Job not found'}
        </Alert>
        <Button variant="outline" size="sm" onClick={() => navigate('/seeker/jobs')}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <Link
          to="/seeker/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-slate hover:text-surface-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Job Search</span>
        </Link>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-surface-white">{job.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-slate">
                <span className="inline-flex items-center gap-1.5 text-brand-cyan font-medium">
                  <Building2 className="w-4 h-4" />
                  {job.organization?.name ?? 'Verified Employer'}
                </span>
                {job.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {job.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <DollarSign className="w-3.5 h-3.5" />
                  {formatSalary(job.salary)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                {job.locationType && <Badge variant="primary">{job.locationType}</Badge>}
                {job.type && <Badge variant="default">{job.type}</Badge>}
                {job.experienceLevel && <Badge variant="info">{job.experienceLevel} level</Badge>}
                <Badge variant={job.status === 'active' ? 'success' : 'warning'}>
                  {job.status}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleToggleSave}
                className={`gap-2 ${job.isSaved ? 'border-brand-blue text-brand-cyan' : ''}`}
              >
                <Bookmark className="w-4 h-4" fill={job.isSaved ? 'currentColor' : 'none'} />
                <span>{job.isSaved ? 'Saved' : 'Save Job'}</span>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-navy-surface flex flex-wrap gap-6 text-xs text-muted-slate">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Posted: {formatDate(job.createdAt)}
            </span>
            {job.applicationDeadline && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Deadline: {formatDate(job.applicationDeadline)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {job.applicantCount} Applicants
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Description & Skills */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {job.description}
              </div>

              {job.skills && job.skills.length > 0 && (
                <div className="pt-4 border-t border-navy-surface space-y-2">
                  <h4 className="text-xs font-semibold text-surface-white uppercase tracking-wider">
                    Required Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <Badge key={skill._id} variant="purple">
                        {skill.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {job.organization && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-cyan" />
                  <span>About {job.organization.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-slate">
                {job.organization.description && (
                  <p className="leading-relaxed">{job.organization.description}</p>
                )}
                <div className="flex flex-wrap gap-4 pt-1">
                  {job.organization.industry && (
                    <span>Industry: <strong className="text-surface-white">{job.organization.industry}</strong></span>
                  )}
                  {job.organization.size && (
                    <span>Size: <strong className="text-surface-white">{job.organization.size}</strong></span>
                  )}
                  {job.organization.website && (
                    <a
                      href={job.organization.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-cyan hover:underline"
                    >
                      <span>Company Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Apply Panel */}
        <div>
          <Card className="border-brand-blue/30 sticky top-24">
            <CardHeader>
              <CardTitle className="text-base">Apply for this Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {applySuccess && (
                <Alert variant="success" title="Application Sent">
                  {applySuccess}
                </Alert>
              )}
              {applyError && (
                <Alert variant="error" title="Application Error">
                  {applyError}
                </Alert>
              )}

              {alreadyApplied ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-surface-white">Application Active</h4>
                    <p className="text-xs text-muted-slate">
                      You have already submitted an application for this role.
                    </p>
                  </div>
                  <Link to="/seeker/applications" className="block">
                    <Button variant="outline" size="sm" className="w-full">
                      Track Application Status
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <Select
                      label="Attach Resume"
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      options={
                        resumes.length > 0
                          ? resumes.map((r) => ({
                              value: r._id,
                              label: `${r.fileName}${r.isPrimary ? ' (Primary)' : ''}`,
                            }))
                          : [{ value: '', label: 'No resumes uploaded yet' }]
                      }
                    />
                    {resumes.length === 0 && (
                      <Link
                        to="/seeker/resume"
                        className="text-[11px] text-brand-cyan hover:underline inline-block mt-1.5"
                      >
                        Upload a resume first to strengthen your application →
                      </Link>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-white mb-1.5">
                      Cover Letter / Note (Optional)
                    </label>
                    <textarea
                      rows={5}
                      maxLength={5000}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Explain why you are a strong fit for this role..."
                      className="w-full px-3 py-2 text-xs rounded-btn bg-midnight-navy border border-navy-surface text-surface-white placeholder:text-muted-slate focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isApplying}
                    disabled={job.status !== 'active'}
                    className="w-full gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>{job.status === 'active' ? 'Submit Application' : 'Job Closed'}</span>
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

export default JobDetailsPage;

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
} from '@/components/ui';
import { aiService, jobService } from '@/services';
import type { JobMatchResponse, JobRecommendationsResponse } from '@/types';
import { getMatchScoreBadgeClasses } from '@/utils/ai.utils';
import {
  Bookmark,
  Briefcase,
  CheckCircle2,
  MapPin,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';

export function AiJobInsightsPage() {
  const [data, setData] = useState<JobRecommendationsResponse | null>(null);
  const [q, setQ] = useState('');
  const [locationType, setLocationType] = useState('');
  const [jobType, setJobType] = useState('');
  const [sortBy, setSortBy] = useState<'matchScore' | 'newest'>('matchScore');

  const [selectedMatch, setSelectedMatch] = useState<JobMatchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzingJobId, setIsAnalyzingJobId] = useState<string | null>(null);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await aiService.getJobRecommendations({
          q: q.trim() || undefined,
          locationType: locationType || undefined,
          type: jobType || undefined,
          sortBy,
          limit: 25,
        });
        if (!active) return;
        setData(res);
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load job recommendations.');
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
  }, [q, locationType, jobType, sortBy]);

  const handleInspectMatch = async (jobId: string) => {
    setIsAnalyzingJobId(jobId);
    setError(null);
    try {
      const res = await aiService.computeJobMatch(jobId, true);
      setSelectedMatch(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compute detailed job match.');
    } finally {
      setIsAnalyzingJobId(null);
    }
  };

  const handleToggleSave = async (jobId: string, currentlySaved: boolean) => {
    setSavingJobId(jobId);
    try {
      if (currentlySaved) {
        await jobService.unsaveJob(jobId);
      } else {
        await jobService.saveJob(jobId);
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              recommendations: prev.recommendations.map((item) =>
                item.jobId === jobId ? { ...item, isSaved: !currentlySaved } : item
              ),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update saved job state.');
    } finally {
      setSavingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
            <Target className="w-6 h-6 text-brand-cyan" />
            <span>AI Job Matches & Recommendations</span>
          </h1>
          <p className="text-xs text-muted-slate mt-1">
            Active opportunities ranked transparently by skills, experience alignment, qualifications, and location fit.
          </p>
        </div>
        <Link to="/seeker/jobs">
          <Button type="button" variant="outline" size="sm">
            Browse All Jobs
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="error" title="Notice">
          {error}
        </Alert>
      )}

      {data && !data.profileCompleteForMatching && data.profileGuidance && (
        <Alert variant="info" title="Complete Your Profile for Better Matches">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{data.profileGuidance}</span>
            <Link to="/seeker/profile" className="text-brand-cyan font-semibold hover:underline shrink-0">
              Update Profile
            </Link>
          </div>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Input
              placeholder="Search title, skill, city..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by workplace type"
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
            className="rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white"
          >
            <option value="">All Workplaces</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="on-site">On-site</option>
          </select>
          <select
            aria-label="Filter by employment type"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white"
          >
            <option value="">All Job Types</option>
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
            <option value="freelance">Freelance</option>
          </select>
          <select
            aria-label="Sort recommendations"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'matchScore' | 'newest')}
            className="rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white"
          >
            <option value="matchScore">Best Match Score</option>
            <option value="newest">Newest Active Jobs</option>
          </select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-36 rounded-card" />
              <Skeleton className="h-36 rounded-card" />
            </>
          ) : !data || data.recommendations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-2">
                <Search className="w-8 h-8 text-muted-slate mx-auto opacity-50" />
                <p className="text-sm font-semibold text-surface-white">No matching active jobs found</p>
                <p className="text-xs text-muted-slate">
                  Try clearing filters or updating your profile skills to discover relevant active jobs.
                </p>
              </CardContent>
            </Card>
          ) : (
            data.recommendations.map((job) => (
              <Card key={job.jobId}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/seeker/jobs/${job.jobId}`}
                          className="text-base font-bold text-surface-white hover:text-brand-cyan transition"
                        >
                          {job.title}
                        </Link>
                        {job.hasApplied && <Badge variant="success">Applied</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-slate">
                        {job.companyName && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5" />
                            {job.companyName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.location} ({job.locationType})
                        </span>
                        <span className="capitalize">{job.experienceLevel}</span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border shrink-0 ${getMatchScoreBadgeClasses(job.matchScore)}`}
                    >
                      {job.matchScore}% Match
                    </span>
                  </div>

                  <ul className="space-y-1 text-xs text-slate-300">
                    {job.reasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan mt-0.5 shrink-0" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-navy-surface">
                    <div className="flex flex-wrap gap-1">
                      {job.matchedSkills.slice(0, 4).map((s) => (
                        <Badge key={s} variant="success">
                          {s}
                        </Badge>
                      ))}
                      {job.missingSkills.slice(0, 2).map((s) => (
                        <Badge key={s} variant="warning">
                          Missing: {s}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        isLoading={savingJobId === job.jobId}
                        onClick={() => void handleToggleSave(job.jobId, job.isSaved)}
                        className="gap-1"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${job.isSaved ? 'fill-current text-brand-cyan' : ''}`} />
                        <span>{job.isSaved ? 'Saved' : 'Save'}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        isLoading={isAnalyzingJobId === job.jobId}
                        onClick={() => void handleInspectMatch(job.jobId)}
                        className="gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Match Breakdown</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Detailed Breakdown Panel */}
        <Card className="h-fit sticky top-20">
          <CardHeader>
            <CardTitle className="text-base">Transparent Match Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedMatch ? (
              <p className="text-xs text-muted-slate py-6 text-center">
                Select &quot;AI Match Breakdown&quot; on any recommended job to inspect component scores and tailored guidance.
              </p>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-navy border border-navy-surface flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-white">{selectedMatch.jobTitle}</p>
                    <p className="text-xs text-muted-slate">{selectedMatch.companyName ?? 'Employer'}</p>
                  </div>
                  <span className="text-xl font-bold text-brand-cyan">{selectedMatch.matchScore}%</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-slate">Skills Alignment (max 50)</span>
                    <span className="font-semibold text-surface-white">
                      {selectedMatch.breakdown.skillsScore} / 50
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-slate">Experience Fit (max 20)</span>
                    <span className="font-semibold text-surface-white">
                      {selectedMatch.breakdown.experienceScore} / 20
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-slate">Qualifications & Education (max 15)</span>
                    <span className="font-semibold text-surface-white">
                      {selectedMatch.breakdown.educationAndQualificationScore} / 15
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-slate">Role & Location Fit (max 15)</span>
                    <span className="font-semibold text-surface-white">
                      {selectedMatch.breakdown.roleAndLocationFitScore} / 15
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-slate leading-relaxed">
                  {selectedMatch.breakdown.methodology}
                </p>

                {selectedMatch.explanation && (
                  <div className="space-y-2.5 pt-2 border-t border-navy-surface text-xs">
                    <p className="text-slate-200 leading-relaxed">{selectedMatch.explanation.summary}</p>
                    {selectedMatch.explanation.recommendedAction && (
                      <div className="p-2.5 rounded-lg bg-brand-blue/10 border border-brand-blue/30 text-slate-200">
                        <span className="font-semibold text-brand-cyan">Recommended Next Step: </span>
                        {selectedMatch.explanation.recommendedAction}
                      </div>
                    )}
                  </div>
                )}

                <Link to={`/seeker/jobs/${selectedMatch.jobId}`} className="block">
                  <Button type="button" variant="primary" size="sm" className="w-full">
                    Open Full Job Posting
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AiJobInsightsPage;

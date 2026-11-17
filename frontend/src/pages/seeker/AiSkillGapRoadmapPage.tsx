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
import type { Job, LearningRoadmap, SkillGapResponse } from '@/types';
import {
  calculateRoadmapCompletionStats,
  getPriorityBadgeClasses,
  getSafeExternalSearchHref,
} from '@/utils/ai.utils';
import {
  BookOpen,
  CheckCircle2,
  Compass,
  ExternalLink,
  Map,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';

export function AiSkillGapRoadmapPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [targetMode, setTargetMode] = useState<'role' | 'job'>('role');
  const [targetRole, setTargetRole] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'entry' | 'mid' | 'senior' | 'lead'>('mid');
  const [weeklyHours, setWeeklyHours] = useState(8);

  const [gapResult, setGapResult] = useState<SkillGapResponse | null>(null);
  const [roadmaps, setRoadmaps] = useState<LearningRoadmap[]>([]);
  const [activeRoadmap, setActiveRoadmap] = useState<LearningRoadmap | null>(null);

  const [isLoadingInit, setIsLoadingInit] = useState(true);
  const [isAnalyzingGap, setIsAnalyzingGap] = useState(false);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [isUpdatingStep, setIsUpdatingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [jobsRes, roadmapList] = await Promise.all([
          jobService.getJobs({ limit: 30 }),
          aiService.listRoadmaps(),
        ]);
        if (!active) return;
        setJobs(jobsRes.jobs);
        if (jobsRes.jobs[0]) {
          setSelectedJobId(jobsRes.jobs[0]._id);
        }
        setRoadmaps(roadmapList);
        if (roadmapList[0]) {
          setActiveRoadmap(roadmapList[0]);
        }
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load skill gap and roadmap data.');
        }
      } finally {
        if (active) {
          setIsLoadingInit(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleAnalyzeGap = async () => {
    setError(null);
    if (targetMode === 'role' && !targetRole.trim()) {
      setError('Enter a target role title to analyze your skill gaps.');
      return;
    }
    if (targetMode === 'job' && !selectedJobId) {
      setError('Select an active job posting to analyze against.');
      return;
    }

    setIsAnalyzingGap(true);
    try {
      const res = await aiService.analyzeSkillGap({
        jobId: targetMode === 'job' ? selectedJobId : undefined,
        targetRole: targetMode === 'role' ? targetRole.trim() : undefined,
        experienceLevel,
      });
      setGapResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze skill gaps right now.');
    } finally {
      setIsAnalyzingGap(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    setError(null);
    const missingSkills = gapResult?.missingSkills.map((m) => m.skill) ?? [];
    setIsGeneratingRoadmap(true);
    try {
      const created = await aiService.generateRoadmap({
        jobId: targetMode === 'job' ? selectedJobId : undefined,
        targetRole:
          targetMode === 'role'
            ? targetRole.trim() || gapResult?.targetTitle
            : gapResult?.targetTitle,
        experienceLevel,
        missingSkills,
        weeklyHours,
      });
      setRoadmaps((prev) => [created, ...prev]);
      setActiveRoadmap(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate learning roadmap.');
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  const handleToggleStep = async (stepId: string, nextCompleted: boolean) => {
    if (!activeRoadmap) return;
    setIsUpdatingStep(stepId);
    try {
      const updated = await aiService.toggleRoadmapStep(activeRoadmap._id, stepId, nextCompleted);
      setActiveRoadmap(updated);
      setRoadmaps((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update step progress.');
    } finally {
      setIsUpdatingStep(null);
    }
  };

  const handleRegenerateRoadmap = async () => {
    if (!activeRoadmap) return;
    setIsGeneratingRoadmap(true);
    setError(null);
    try {
      const updated = await aiService.regenerateRoadmap(activeRoadmap._id, {
        weeklyHours,
      });
      setActiveRoadmap(updated);
      setRoadmaps((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate roadmap.');
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  const handleDeleteRoadmap = async (id: string) => {
    try {
      await aiService.deleteRoadmap(id);
      const next = roadmaps.filter((r) => r._id !== id);
      setRoadmaps(next);
      if (activeRoadmap?._id === id) {
        setActiveRoadmap(next[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete roadmap.');
    }
  };

  if (isLoadingInit) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  const activeStats = activeRoadmap
    ? calculateRoadmapCompletionStats(activeRoadmap.steps)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
          <Compass className="w-6 h-6 text-brand-cyan" />
          <span>AI Skill Gap Analyzer & Learning Roadmaps</span>
        </h1>
        <p className="text-xs text-muted-slate mt-1">
          Benchmark your skills against real job postings or target roles and follow a persistent step-by-step roadmap.
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Notice">
          {error}
        </Alert>
      )}

      {/* Target Configurator */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-brand-blue" />
            <span>Choose Target Career Goal</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={targetMode === 'role' ? 'primary' : 'outline'}
              onClick={() => setTargetMode('role')}
            >
              Target Role Title
            </Button>
            <Button
              type="button"
              size="sm"
              variant={targetMode === 'job' ? 'primary' : 'outline'}
              onClick={() => setTargetMode('job')}
              disabled={jobs.length === 0}
            >
              Active Platform Job ({jobs.length})
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {targetMode === 'role' ? (
              <Input
                label="Target Role"
                placeholder="e.g., Full Stack TypeScript Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            ) : (
              <div>
                <label htmlFor="gap-job-select" className="block text-xs font-medium text-muted-slate mb-1.5">
                  Select Active Job Posting
                </label>
                <select
                  id="gap-job-select"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white"
                >
                  {jobs.map((job) => (
                    <option key={job._id} value={job._id}>
                      {job.title} ({job.experienceLevel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="gap-level-select" className="block text-xs font-medium text-muted-slate mb-1.5">
                Target Level
              </label>
              <select
                id="gap-level-select"
                value={experienceLevel}
                onChange={(e) =>
                  setExperienceLevel(e.target.value as 'entry' | 'mid' | 'senior' | 'lead')
                }
                className="w-full rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white"
              >
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>

            <Input
              label="Study Hours / Week (Roadmap)"
              type="number"
              min={1}
              max={60}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Math.max(1, Math.min(60, Number(e.target.value) || 8)))}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isAnalyzingGap}
              onClick={handleAnalyzeGap}
              className="gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze Skill Gap</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isGeneratingRoadmap}
              onClick={handleGenerateRoadmap}
              className="gap-1.5"
            >
              <Map className="w-4 h-4" />
              <span>Generate Learning Roadmap</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Skill Gap Results */}
      {gapResult && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base">
                Skill Gap Analysis: {gapResult.targetTitle}
              </CardTitle>
              <Badge variant="info">
                Readiness Coverage: {gapResult.readinessEstimate.coverageRatio}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-slate-200 leading-relaxed">{gapResult.summary}</p>
            <p className="text-[11px] text-muted-slate">{gapResult.readinessEstimate.methodology}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-emerald-300 mb-2">
                  Matched Skills ({gapResult.matchedSkills.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {gapResult.matchedSkills.length > 0 ? (
                    gapResult.matchedSkills.map((skill) => (
                      <Badge key={skill} variant="success">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-slate">No direct matches detected yet.</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-amber-300 mb-2">
                  Partially Matched ({gapResult.partiallyMatchedSkills.length})
                </h4>
                <div className="space-y-2">
                  {gapResult.partiallyMatchedSkills.map((p) => (
                    <div key={p.skill} className="p-2.5 rounded-lg bg-navy border border-navy-surface text-xs">
                      <p className="font-semibold text-surface-white">{p.skill}</p>
                      <p className="text-muted-slate mt-0.5">{p.gapDescription}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-surface-white mb-2">
                Prioritized Missing Skills ({gapResult.missingSkills.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gapResult.missingSkills.map((m) => (
                  <div
                    key={m.skill}
                    className="p-3 rounded-lg bg-navy/70 border border-navy-surface space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-surface-white">{m.skill}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border capitalize ${getPriorityBadgeClasses(m.priority)}`}
                      >
                        {m.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{m.whyItMatters}</p>
                    <p className="text-xs text-brand-cyan">How to learn: {m.howToDevelop}</p>
                  </div>
                ))}
              </div>
            </div>

            {gapResult.relatedCourses.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-surface-white mb-2">
                  Matching Courses in SkillOrbit Catalog
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {gapResult.relatedCourses.map((course) => (
                    <div
                      key={course.courseId}
                      className="p-3 rounded-lg border border-navy-surface bg-navy flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-surface-white">{course.title}</p>
                        <p className="text-xs text-muted-slate capitalize">
                          {course.level} • {course.deliveryMode}
                        </p>
                      </div>
                      <BookOpen className="w-4 h-4 text-brand-cyan shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roadmaps Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Learning Roadmaps ({roadmaps.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roadmaps.length === 0 ? (
              <p className="text-xs text-muted-slate py-4">
                No roadmaps yet. Generate one above based on your target role or job.
              </p>
            ) : (
              roadmaps.map((rm) => (
                <div
                  key={rm._id}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    activeRoadmap?._id === rm._id
                      ? 'border-brand-cyan bg-brand-cyan/10'
                      : 'border-navy-surface bg-navy hover:border-brand-blue/40'
                  }`}
                  onClick={() => setActiveRoadmap(rm)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-white truncate">{rm.title}</p>
                      <p className="text-xs text-muted-slate mt-0.5">
                        Progress: {rm.progress}% • {rm.steps.length} steps
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete roadmap ${rm.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteRoadmap(rm._id);
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {activeRoadmap ? activeRoadmap.title : 'Roadmap Details'}
                </CardTitle>
                {activeStats && (
                  <p className="text-xs text-muted-slate mt-0.5">
                    {activeStats.completedCount} of {activeStats.totalCount} steps completed ({activeStats.progressPercent}%) • Est. {activeStats.remainingHours} hrs remaining
                  </p>
                )}
              </div>
              {activeRoadmap && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  isLoading={isGeneratingRoadmap}
                  onClick={handleRegenerateRoadmap}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate (Keep Progress)</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeRoadmap ? (
              <p className="text-xs text-muted-slate py-6 text-center">
                Select or generate a learning roadmap to view milestones and track step progress.
              </p>
            ) : (
              <>
                <div className="w-full h-2.5 rounded-full bg-navy overflow-hidden">
                  <div
                    className="h-full bg-brand-cyan transition-all duration-300"
                    style={{ width: `${activeRoadmap.progress}%` }}
                  />
                </div>

                {activeRoadmap.steps.map((step) => (
                  <div
                    key={step._id}
                    className={`p-4 rounded-lg border ${
                      step.isCompleted
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-navy-surface bg-navy/70'
                    } space-y-2`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-3 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          className="mt-1 accent-emerald-400"
                          checked={step.isCompleted}
                          disabled={isUpdatingStep === step._id}
                          onChange={(e) => void handleToggleStep(step._id, e.target.checked)}
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-muted-slate">
                              Step {step.order}
                            </span>
                            <h4
                              className={`text-sm font-semibold ${
                                step.isCompleted ? 'line-through text-muted-slate' : 'text-surface-white'
                              }`}
                            >
                              {step.title}
                            </h4>
                            <Badge variant="default" className="capitalize">
                              {step.type}
                            </Badge>
                            {step.estimatedHours && (
                              <Badge variant="info">{step.estimatedHours} hrs</Badge>
                            )}
                          </div>
                          {step.description && (
                            <p className="text-xs text-slate-300 leading-relaxed">{step.description}</p>
                          )}
                          {step.projectIdea && (
                            <p className="text-xs text-brand-cyan">
                              Practice Project: {step.projectIdea}
                            </p>
                          )}
                        </div>
                      </label>
                      {step.isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pl-7 text-xs">
                      {step.resourceId && (
                        <Link
                          to="/seeker/dashboard"
                          className="text-emerald-300 hover:underline flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Verified Internal Course Match</span>
                        </Link>
                      )}
                      {step.resourceSearchQuery && (
                        <a
                          href={getSafeExternalSearchHref(step.resourceSearchQuery)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-cyan hover:underline flex items-center gap-1"
                        >
                          <span>Search Resources: &quot;{step.resourceSearchQuery}&quot;</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AiSkillGapRoadmapPage;

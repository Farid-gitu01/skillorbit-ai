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
  Skeleton,
} from '@/components/ui';
import { aiService, resumeService } from '@/services';
import type {
  ApplyExtractedSkillsResponse,
  NormalizedExtractedSkill,
  ProficiencyLevel,
  Resume,
  ResumeAnalysisData,
} from '@/types';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FileSearch,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

export function AiResumeAnalysisPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [analysis, setAnalysis] = useState<ResumeAnalysisData | null>(null);
  const [analysisCached, setAnalysisCached] = useState(false);

  const [extractedSkills, setExtractedSkills] = useState<NormalizedExtractedSkill[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Record<string, boolean>>({});
  const [skillLevels, setSkillLevels] = useState<Record<string, ProficiencyLevel>>({});
  const [applyResult, setApplyResult] = useState<ApplyExtractedSkillsResponse | null>(null);

  const [isLoadingResumes, setIsLoadingResumes] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const list = await resumeService.getMyResumes();
        if (!active) return;
        setResumes(list);
        const primary = list.find((r) => r.isPrimary) ?? list[0];
        if (primary) {
          setSelectedResumeId(primary._id);
          setAnalysis(primary.parsedData?.analysis ?? null);
        }
        setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load your resumes.');
        }
      } finally {
        if (active) {
          setIsLoadingResumes(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleSelectResume = (resumeId: string) => {
    setSelectedResumeId(resumeId);
    const found = resumes.find((r) => r._id === resumeId);
    setAnalysis(found?.parsedData?.analysis ?? null);
    setExtractedSkills([]);
    setApplyResult(null);
    setError(null);
  };

  const handleAnalyze = async (forceRefresh = false) => {
    if (!selectedResumeId) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await aiService.analyzeResume(selectedResumeId, forceRefresh);
      setAnalysis(res.analysis);
      setAnalysisCached(res.cached);
      setResumes((prev) =>
        prev.map((r) =>
          r._id === selectedResumeId
            ? { ...r, parsedData: { ...(r.parsedData ?? {}), analysis: res.analysis } }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI resume analysis is currently unavailable.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExtractSkills = async () => {
    if (!selectedResumeId) return;
    setIsExtracting(true);
    setError(null);
    setApplyResult(null);
    try {
      const res = await aiService.extractSkills({
        resumeId: selectedResumeId,
        includeProfile: true,
      });
      setExtractedSkills(res.extractedSkills);
      const defaults: Record<string, boolean> = {};
      const levels: Record<string, ProficiencyLevel> = {};
      for (const skill of res.extractedSkills) {
        defaults[skill.slug] = !skill.alreadyInProfile;
        levels[skill.slug] = skill.suggestedLevel;
      }
      setSelectedSlugs(defaults);
      setSkillLevels(levels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to extract skills right now.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplySkills = async () => {
    const picked = extractedSkills.filter((s) => selectedSlugs[s.slug] && !s.alreadyInProfile);
    if (picked.length === 0) return;

    setIsApplying(true);
    setError(null);
    try {
      const res = await aiService.applyExtractedSkills(
        picked.map((item) => ({
          name: item.canonicalName,
          category: item.category,
          level: skillLevels[item.slug] ?? item.suggestedLevel,
        }))
      );
      setApplyResult(res);
      setExtractedSkills((prev) =>
        prev.map((item) =>
          res.addedSkills.includes(item.canonicalName)
            ? { ...item, alreadyInProfile: true }
            : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save selected skills.');
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoadingResumes) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-cyan" />
            <span>AI Resume Analysis & Skill Extraction</span>
          </h1>
          <p className="text-xs text-muted-slate mt-1">
            Inspect structured feedback, transparent ATS completeness metrics, and review AI-extracted skills before saving them to your profile.
          </p>
        </div>
        <Link to="/seeker/resume">
          <Button type="button" variant="outline" size="sm">
            Manage Uploaded Resumes
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="error" title="AI Notice">
          {error}
        </Alert>
      )}

      {resumes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <FileSearch className="w-10 h-10 text-muted-slate mx-auto opacity-60" />
            <h3 className="text-sm font-semibold text-surface-white">No Resumes Found</h3>
            <p className="text-xs text-muted-slate max-w-md mx-auto">
              Upload a text-based PDF or DOCX resume first so SkillOrbit AI can analyze its structure and extract verified skill evidence.
            </p>
            <Link to="/seeker/resume" className="inline-block">
              <Button type="button" variant="primary" size="sm">
                Upload Resume
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label htmlFor="ai-resume-select" className="block text-xs font-medium text-muted-slate">
                  Select Uploaded Resume
                </label>
                <select
                  id="ai-resume-select"
                  value={selectedResumeId}
                  onChange={(e) => handleSelectResume(e.target.value)}
                  className="w-full max-w-md rounded-input bg-navy border border-navy-surface px-3 py-2 text-sm text-surface-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  {resumes.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.fileName} {r.isPrimary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isAnalyzing}
                  onClick={() => handleAnalyze(false)}
                  className="gap-1.5"
                >
                  <FileSearch className="w-4 h-4" />
                  <span>{analysis ? 'View / Refresh Analysis' : 'Analyze Resume'}</span>
                </Button>
                {analysis && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isAnalyzing}
                    onClick={() => handleAnalyze(true)}
                    className="gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-analyze</span>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isLoading={isExtracting}
                  onClick={handleExtractSkills}
                  className="gap-1.5"
                >
                  <Layers className="w-4 h-4" />
                  <span>Extract Skills</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {analysis && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Structured Resume Insights</CardTitle>
                    <Badge variant="info">
                      {analysisCached ? 'Cached Result' : `${analysis.provider} • ${analysis.model}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 text-sm">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-slate mb-1">
                      Overview
                    </h4>
                    <p className="text-slate-200 leading-relaxed">{analysis.overview}</p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-slate mb-1">
                      Professional Summary Assessment
                    </h4>
                    <p className="text-slate-300 leading-relaxed">{analysis.professionalSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <h4 className="text-xs font-semibold text-emerald-300 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Strengths</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {analysis.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <h4 className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Gaps & Missing Details</span>
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {[...analysis.weaknesses, ...analysis.missingInformation].map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-slate mb-2">
                      Actionable Improvements
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-200 list-disc pl-4">
                      {analysis.improvementSuggestions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-navy-surface">
                    <div>
                      <h4 className="text-xs font-semibold text-muted-slate mb-2">
                        Detected Technical & Framework Skills
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ...analysis.technicalSkills,
                          ...analysis.frameworksAndLanguages,
                          ...analysis.toolsAndTechnologies,
                        ].map((skill) => (
                          <Badge key={skill} variant="default">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-muted-slate mb-2">
                        Work Experience & Education Signals
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {[...analysis.workExperience.slice(0, 3), ...analysis.education.slice(0, 2)].map(
                          (item) => (
                            <li key={item}>{item}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-cyan" />
                    <span>ATS Completeness Feedback</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-navy border border-navy-surface text-center">
                    <p className="text-xs text-muted-slate">Completeness Estimate</p>
                    <p className="text-3xl font-bold text-brand-cyan mt-1">
                      {analysis.atsFeedback.estimatedCompletenessScore}%
                    </p>
                    <p className="text-[11px] text-muted-slate mt-2 leading-relaxed">
                      {analysis.atsFeedback.methodology}
                    </p>
                  </div>

                  {analysis.atsFeedback.formattingFindings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-surface-white mb-1.5">
                        Structure & Parsing Findings
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {analysis.atsFeedback.formattingFindings.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysis.atsFeedback.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-surface-white mb-1.5">
                        Optimization Tips
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {analysis.atsFeedback.recommendations.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {extractedSkills.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-brand-purple" />
                      <span>Extracted Skills Review ({extractedSkills.length})</span>
                    </CardTitle>
                    <p className="text-xs text-muted-slate mt-0.5">
                      Select new skills to add to your SkillOrbit profile. Existing verified/manual profile skills are never overwritten.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={isApplying}
                    onClick={handleApplySkills}
                    disabled={
                      extractedSkills.filter((s) => selectedSlugs[s.slug] && !s.alreadyInProfile)
                        .length === 0
                    }
                  >
                    Apply Selected New Skills
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {applyResult && (
                  <Alert variant="success" title="Profile Updated">
                    Added {applyResult.addedCount} new skill(s) ({applyResult.addedSkills.join(', ') || 'none'}).{' '}
                    {applyResult.skippedExistingCount > 0 &&
                      `${applyResult.skippedExistingCount} existing profile skill(s) preserved unchanged.`}
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {extractedSkills.map((skill) => {
                    const checked = Boolean(selectedSlugs[skill.slug]);
                    return (
                      <div
                        key={skill.slug}
                        className="p-3 rounded-lg border border-navy-surface bg-navy/60 flex items-start justify-between gap-3"
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            className="mt-1 accent-brand-cyan"
                            disabled={skill.alreadyInProfile}
                            checked={skill.alreadyInProfile ? true : checked}
                            onChange={(e) =>
                              setSelectedSlugs((prev) => ({
                                ...prev,
                                [skill.slug]: e.target.checked,
                              }))
                            }
                          />
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-surface-white">
                                {skill.canonicalName}
                              </span>
                              <Badge variant="default" className="capitalize">
                                {skill.category}
                              </Badge>
                              {skill.alreadyInProfile && (
                                <Badge variant="success">
                                  <Award className="w-3 h-3" />
                                  <span>In Profile</span>
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-slate">{skill.evidence}</p>
                          </div>
                        </label>

                        {!skill.alreadyInProfile && (
                          <select
                            aria-label={`Proficiency for ${skill.canonicalName}`}
                            value={skillLevels[skill.slug] ?? skill.suggestedLevel}
                            onChange={(e) =>
                              setSkillLevels((prev) => ({
                                ...prev,
                                [skill.slug]: e.target.value as ProficiencyLevel,
                              }))
                            }
                            className="rounded-input bg-navy-light border border-navy-surface px-2 py-1 text-xs text-surface-white"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                            <option value="expert">Expert</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default AiResumeAnalysisPage;

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Send, X } from 'lucide-react';
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
import { employerService } from '@/services/employer.service';
import type { SkillOption } from '@/types/employer.types';
import type { ExperienceLevel, JobLocationType, JobType } from '@/types/job.types';
import {
  CURRENCY_OPTIONS,
  EXPERIENCE_LEVELS,
  extractZodFieldErrors,
  JOB_LOCATION_TYPES,
  JOB_TYPES,
  jobFormSchema,
  jobValuesToPayload,
  type JobFormInputState,
} from '@/utils/employer-validation';

const EMPTY_JOB_FORM: JobFormInputState = {
  title: '',
  description: '',
  responsibilities: [],
  qualifications: [],
  skills: [],
  location: '',
  locationType: 'remote',
  type: 'full-time',
  experienceLevel: 'mid',
  openings: '1',
  includeSalary: false,
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'USD',
  salaryIsPublic: true,
  applicationDeadline: '',
  status: 'draft',
};

function toDateInputValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function JobFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [values, setValues] = useState<JobFormInputState>(EMPTY_JOB_FORM);
  const [responsibilityDraft, setResponsibilityDraft] = useState('');
  const [qualificationDraft, setQualificationDraft] = useState('');
  const [skillDraft, setSkillDraft] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<SkillOption[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadJob = async () => {
      try {
        const job = await employerService.getJobById(id);
        if (!active) return;
        const normalizedStatus =
          job.status === 'active' || job.status === 'closed' || job.status === 'draft'
            ? job.status
            : 'draft';

        setValues({
          title: job.title ?? '',
          description: job.description ?? '',
          responsibilities: job.responsibilities ?? [],
          qualifications: job.qualifications ?? [],
          skills: (job.skills ?? []).map((s) => s.name),
          location: job.location ?? '',
          locationType: job.locationType ?? 'remote',
          type: job.type ?? 'full-time',
          experienceLevel: job.experienceLevel ?? 'mid',
          openings: String(job.openings ?? 1),
          includeSalary: Boolean(
            job.salary && (job.salary.min !== undefined || job.salary.max !== undefined)
          ),
          salaryMin: job.salary?.min !== undefined ? String(job.salary.min) : '',
          salaryMax: job.salary?.max !== undefined ? String(job.salary.max) : '',
          salaryCurrency: job.salary?.currency ?? 'USD',
          salaryIsPublic: job.salary?.isPublic ?? true,
          applicationDeadline: toDateInputValue(job.applicationDeadline),
          status: normalizedStatus,
        });
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
    void loadJob();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const query = skillDraft.trim();
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const results = await employerService.searchSkills(query);
        if (active) {
          setSkillSuggestions(results);
        }
      } catch {
        // Non-fatal suggestion lookup failure; users can still enter custom skills directly.
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [skillDraft]);

  const updateField = <K extends keyof JobFormInputState>(
    key: K,
    val: JobFormInputState[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addListItem = (
    listKey: 'responsibilities' | 'qualifications' | 'skills',
    rawValue: string,
    clearDraft: () => void
  ) => {
    const cleaned = rawValue.trim();
    if (!cleaned) return;
    if (values[listKey].length >= 30) {
      setFieldErrors((prev) => ({
        ...prev,
        [listKey]: 'Maximum 30 items allowed.',
      }));
      return;
    }
    const exists = values[listKey].some(
      (item) => item.toLowerCase() === cleaned.toLowerCase()
    );
    if (!exists) {
      updateField(listKey, [...values[listKey], cleaned]);
    }
    clearDraft();
  };

  const removeListItem = (
    listKey: 'responsibilities' | 'qualifications' | 'skills',
    index: number
  ) => {
    updateField(
      listKey,
      values[listKey].filter((_, idx) => idx !== index)
    );
  };

  const handleEnterAdd = (
    e: KeyboardEvent<HTMLInputElement>,
    action: () => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  const handleSave = async (targetStatus: 'draft' | 'active' | 'closed') => {
    setError(null);
    const nextValues: JobFormInputState = { ...values, status: targetStatus };

    const parsed = jobFormSchema.safeParse(nextValues);
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      setError('Please correct the highlighted job posting fields.');
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const payload = jobValuesToPayload(parsed.data, targetStatus);
      const result = isEditMode && id
        ? await employerService.updateJob(id, payload)
        : await employerService.createJob(payload);
      navigate(`/employer/jobs/${result.job._id}`, {
        replace: true,
        state: { flashMessage: result.message },
      });
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-16 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  const unusedSuggestions = skillSuggestions
    .filter((s) => !values.skills.some((existing) => existing.toLowerCase() === s.name.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/employer/jobs"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-cyan hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Job Management
          </Link>
          <h1 className="text-2xl font-bold text-surface-white">
            {isEditMode ? 'Edit Job Posting' : 'Create New Job Posting'}
          </h1>
        </div>
        {isEditMode && (
          <Badge variant={values.status === 'active' ? 'success' : 'warning'} className="capitalize">
            Current status: {values.status}
          </Badge>
        )}
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Core Information */}
      <Card>
        <CardHeader>
          <CardTitle>Role & Logistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Job Title *"
            placeholder="e.g., Senior Full-Stack Engineer"
            value={values.title}
            onChange={(e) => updateField('title', e.target.value)}
            error={fieldErrors.title}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Work Mode *"
              value={values.locationType}
              onChange={(e) => updateField('locationType', e.target.value as JobLocationType)}
              options={JOB_LOCATION_TYPES}
              error={fieldErrors.locationType}
            />
            <Select
              label="Employment Type *"
              value={values.type}
              onChange={(e) => updateField('type', e.target.value as JobType)}
              options={JOB_TYPES}
              error={fieldErrors.type}
            />
            <Select
              label="Experience Level *"
              value={values.experienceLevel}
              onChange={(e) => updateField('experienceLevel', e.target.value as ExperienceLevel)}
              options={EXPERIENCE_LEVELS}
              error={fieldErrors.experienceLevel}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Location"
              placeholder="e.g., New York, NY or Worldwide"
              value={values.location}
              onChange={(e) => updateField('location', e.target.value)}
              error={fieldErrors.location}
            />
            <Input
              label="Number of Openings *"
              type="number"
              min={1}
              max={1000}
              value={values.openings}
              onChange={(e) => updateField('openings', e.target.value)}
              error={fieldErrors.openings}
            />
            <Input
              label="Application Deadline"
              type="date"
              value={values.applicationDeadline}
              onChange={(e) => updateField('applicationDeadline', e.target.value)}
              error={fieldErrors.applicationDeadline}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="job-description" className="block text-sm font-medium text-surface-white">
              Job Description *
            </label>
            <textarea
              id="job-description"
              rows={6}
              maxLength={10000}
              placeholder="Describe the role overview, team mission, tech stack, and impact..."
              value={values.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full rounded-btn bg-navy-surface border border-slate-700/80 px-3.5 py-2.5 text-sm text-surface-white placeholder:text-muted-slate/60 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan transition-colors"
            />
            <div className="flex items-center justify-between text-xs">
              {fieldErrors.description ? (
                <span className="text-red-400">{fieldErrors.description}</span>
              ) : (
                <span className="text-muted-slate">Minimum 20 characters required.</span>
              )}
              <span className="text-muted-slate">{values.description.length}/10000</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsibilities & Qualifications */}
      <Card>
        <CardHeader>
          <CardTitle>Responsibilities & Qualifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Responsibilities */}
          <div className="space-y-3">
            <label htmlFor="resp-input" className="block text-sm font-medium text-surface-white">
              Key Responsibilities ({values.responsibilities.length}/30)
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="resp-input"
                  placeholder="Add a responsibility and press Enter..."
                  value={responsibilityDraft}
                  onChange={(e) => setResponsibilityDraft(e.target.value)}
                  onKeyDown={(e) =>
                    handleEnterAdd(e, () =>
                      addListItem('responsibilities', responsibilityDraft, () =>
                        setResponsibilityDraft('')
                      )
                    )
                  }
                  error={fieldErrors.responsibilities}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  addListItem('responsibilities', responsibilityDraft, () =>
                    setResponsibilityDraft('')
                  )
                }
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            {values.responsibilities.length > 0 && (
              <ul className="space-y-2">
                {values.responsibilities.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-midnight-navy/60 border border-navy-surface text-sm text-surface-white"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeListItem('responsibilities', idx)}
                      aria-label={`Remove responsibility ${idx + 1}`}
                      className="text-muted-slate hover:text-red-400 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Qualifications */}
          <div className="space-y-3 pt-4 border-t border-navy-surface">
            <label htmlFor="qual-input" className="block text-sm font-medium text-surface-white">
              Required Qualifications ({values.qualifications.length}/30)
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="qual-input"
                  placeholder="Add a required qualification and press Enter..."
                  value={qualificationDraft}
                  onChange={(e) => setQualificationDraft(e.target.value)}
                  onKeyDown={(e) =>
                    handleEnterAdd(e, () =>
                      addListItem('qualifications', qualificationDraft, () =>
                        setQualificationDraft('')
                      )
                    )
                  }
                  error={fieldErrors.qualifications}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  addListItem('qualifications', qualificationDraft, () =>
                    setQualificationDraft('')
                  )
                }
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            {values.qualifications.length > 0 && (
              <ul className="space-y-2">
                {values.qualifications.map((item, idx) => (
                  <li
                    key={`${item}-${idx}`}
                    className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-midnight-navy/60 border border-navy-surface text-sm text-surface-white"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeListItem('qualifications', idx)}
                      aria-label={`Remove qualification ${idx + 1}`}
                      className="text-muted-slate hover:text-red-400 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Skills */}
          <div className="space-y-3 pt-4 border-t border-navy-surface">
            <label htmlFor="skills-input" className="block text-sm font-medium text-surface-white">
              Required Skills ({values.skills.length}/30)
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="skills-input"
                  placeholder="Type a skill (e.g., TypeScript, React, Kubernetes)..."
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) =>
                    handleEnterAdd(e, () =>
                      addListItem('skills', skillDraft, () => setSkillDraft(''))
                    )
                  }
                  error={fieldErrors.skills}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => addListItem('skills', skillDraft, () => setSkillDraft(''))}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>

            {unusedSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-slate mr-1">Suggested:</span>
                {unusedSuggestions.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => addListItem('skills', s.name, () => setSkillDraft(''))}
                    className="text-xs px-2.5 py-1 rounded-full bg-navy-surface hover:bg-brand-blue/20 text-muted-slate hover:text-brand-cyan border border-slate-700 transition-colors"
                  >
                    + {s.name}
                  </button>
                ))}
              </div>
            )}

            {values.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {values.skills.map((skill, idx) => (
                  <Badge key={`${skill}-${idx}`} variant="primary" className="flex items-center gap-1.5 py-1 px-3">
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeListItem('skills', idx)}
                      aria-label={`Remove skill ${skill}`}
                      className="hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle>Compensation Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-surface-white">
            <input
              type="checkbox"
              checked={values.includeSalary}
              onChange={(e) => updateField('includeSalary', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-navy-surface text-brand-cyan focus:ring-brand-cyan"
            />
            Specify salary range for this position
          </label>

          {values.includeSalary && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Minimum Salary"
                  type="number"
                  min={0}
                  placeholder="e.g., 90000"
                  value={values.salaryMin}
                  onChange={(e) => updateField('salaryMin', e.target.value)}
                  error={fieldErrors.salaryMin}
                />
                <Input
                  label="Maximum Salary"
                  type="number"
                  min={0}
                  placeholder="e.g., 140000"
                  value={values.salaryMax}
                  onChange={(e) => updateField('salaryMax', e.target.value)}
                  error={fieldErrors.salaryMax}
                />
                <Select
                  label="Currency"
                  value={values.salaryCurrency}
                  onChange={(e) => updateField('salaryCurrency', e.target.value)}
                  options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))}
                  error={fieldErrors.salaryCurrency}
                />
              </div>

              <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-muted-slate">
                <input
                  type="checkbox"
                  checked={values.salaryIsPublic}
                  onChange={(e) => updateField('salaryIsPublic', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-navy-surface text-brand-cyan focus:ring-brand-cyan"
                />
                Display salary range publicly on job listing
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pb-4">
        <Link to="/employer/jobs">
          <Button type="button" variant="ghost" disabled={isSubmitting}>
            Cancel
          </Button>
        </Link>
        {isEditMode && values.status === 'closed' && (
          <Button
            type="button"
            variant="outline"
            isLoading={isSubmitting}
            onClick={() => void handleSave('closed')}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes (Keep Closed)
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          isLoading={isSubmitting}
          onClick={() => void handleSave('draft')}
        >
          <Save className="w-4 h-4 mr-2" />
          Save as Draft
        </Button>
        <Button
          type="button"
          variant="primary"
          isLoading={isSubmitting}
          onClick={() => void handleSave('active')}
        >
          <Send className="w-4 h-4 mr-2" />
          {isEditMode && values.status === 'active' ? 'Update & Keep Published' : 'Publish Job'}
        </Button>
      </div>
    </div>
  );
}

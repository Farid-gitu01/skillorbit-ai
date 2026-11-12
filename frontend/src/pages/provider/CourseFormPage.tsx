import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Globe,
  Plus,
  Save,
  Trash2,
  X,
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
import type { SkillOption } from '@/types/employer.types';
import type { CourseLevel, CourseStatus } from '@/types/provider.types';
import {
  COURSE_DELIVERY_MODES,
  COURSE_LEVELS,
  CURRENCY_OPTIONS,
  courseFormSchema,
  courseFormToPayload,
  courseToFormState,
  extractZodFieldErrors,
  type CourseFormInputState,
  type SyllabusModuleFormRow,
} from '@/utils/provider-validation';

const INITIAL_FORM_STATE: CourseFormInputState = {
  title: '',
  description: '',
  category: '',
  level: 'beginner',
  deliveryMode: 'self-paced',
  duration: '',
  price: '0',
  currency: 'USD',
  certificationOffered: false,
  skills: [],
  tags: [],
  thumbnailUrl: '',
  externalUrl: '',
  syllabus: [{ moduleTitle: '', lessonsText: '', duration: '' }],
  status: 'draft',
};

export function CourseFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();

  const [formState, setFormState] = useState<CourseFormInputState>(INITIAL_FORM_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<SkillOption[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    const loadCourse = async () => {
      try {
        const course = await providerService.getCourseById(id);
        if (!active) return;
        const converted = courseToFormState(course);
        setFormState({
          ...converted,
          syllabus:
            converted.syllabus.length > 0
              ? converted.syllabus
              : [{ moduleTitle: '', lessonsText: '', duration: '' }],
        });
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
    void loadCourse();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const trimmed = skillInput.trim();
    let active = true;
    const timer = window.setTimeout(async () => {
      if (trimmed.length === 0) {
        if (active) setSkillSuggestions([]);
        return;
      }
      try {
        const results = await providerService.searchSkills(trimmed);
        if (active) setSkillSuggestions(results);
      } catch {
        if (active) setSkillSuggestions([]);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [skillInput]);

  const addSkill = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setFormState((prev) => {
      const exists = prev.skills.some((s) => s.toLowerCase() === clean.toLowerCase());
      if (exists || prev.skills.length >= 25) return prev;
      return { ...prev, skills: [...prev.skills, clean] };
    });
    setSkillInput('');
    setSkillSuggestions([]);
  };

  const removeSkill = (target: string) => {
    setFormState((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== target),
    }));
  };

  const addTag = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setFormState((prev) => {
      const exists = prev.tags.some((t) => t.toLowerCase() === clean.toLowerCase());
      if (exists || prev.tags.length >= 20) return prev;
      return { ...prev, tags: [...prev.tags, clean] };
    });
    setTagInput('');
  };

  const removeTag = (target: string) => {
    setFormState((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== target),
    }));
  };

  const updateSyllabusRow = (idx: number, patch: Partial<SyllabusModuleFormRow>) => {
    setFormState((prev) => ({
      ...prev,
      syllabus: prev.syllabus.map((row, index) => (index === idx ? { ...row, ...patch } : row)),
    }));
  };

  const addSyllabusRow = () => {
    setFormState((prev) => {
      if (prev.syllabus.length >= 30) return prev;
      return {
        ...prev,
        syllabus: [...prev.syllabus, { moduleTitle: '', lessonsText: '', duration: '' }],
      };
    });
  };

  const removeSyllabusRow = (idx: number) => {
    setFormState((prev) => ({
      ...prev,
      syllabus: prev.syllabus.filter((_, index) => index !== idx),
    }));
  };

  const submitForm = async (targetStatus: CourseStatus) => {
    setFieldErrors({});
    setSubmitError(null);

    const cleanedSyllabus = formState.syllabus.filter(
      (mod) =>
        mod.moduleTitle.trim().length > 0 ||
        mod.lessonsText.trim().length > 0 ||
        mod.duration.trim().length > 0
    );

    const candidate: CourseFormInputState = {
      ...formState,
      syllabus: cleanedSyllabus,
      status: targetStatus,
    };

    const parsed = courseFormSchema.safeParse(candidate);
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      setSubmitError('Please fix the highlighted course validation errors before continuing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = courseFormToPayload(candidate, targetStatus);
      if (isEditMode && id) {
        const res = await providerService.updateCourse(id, payload);
        navigate(`/provider/courses/${res.course._id}`);
      } else {
        const res = await providerService.createCourse(payload);
        navigate(`/provider/courses/${res.course._id}`);
      }
    } catch (err) {
      setSubmitError(normalizeApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitForm(formState.status);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64 rounded-card" />
        <Skeleton className="h-[540px] w-full rounded-card" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Alert variant="error" title="Unable to load course offering">
          {loadError}
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/provider/courses"
            className="inline-flex items-center gap-1.5 text-xs text-muted-slate hover:text-brand-cyan"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Offerings
          </Link>
          <h1 className="text-2xl font-bold text-surface-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-cyan" />
            {isEditMode ? 'Edit Training Offering' : 'Create Training Offering'}
          </h1>
        </div>
      </div>

      {submitError && (
        <Alert variant="error" onDismiss={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
        {/* Basic Details */}
        <Card>
          <CardHeader>
            <CardTitle>Course Overview & Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Course / Program Title *"
              placeholder="e.g. Cloud-Native Kubernetes & GitOps Engineering"
              value={formState.title}
              onChange={(e) => setFormState((prev) => ({ ...prev, title: e.target.value }))}
              error={fieldErrors.title}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Category"
                placeholder="e.g. Cloud & DevOps"
                value={formState.category}
                onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value }))}
                error={fieldErrors.category}
              />
              <Select
                label="Difficulty Level *"
                value={formState.level}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, level: e.target.value as CourseLevel }))
                }
                error={fieldErrors.level}
                options={COURSE_LEVELS}
              />
              <Select
                label="Delivery Mode"
                value={formState.deliveryMode}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    deliveryMode: e.target.value as CourseFormInputState['deliveryMode'],
                  }))
                }
                error={fieldErrors.deliveryMode}
                options={[
                  { value: '', label: 'Select delivery mode' },
                  ...COURSE_DELIVERY_MODES,
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="course-description"
                className="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
              >
                Course Description *
              </label>
              <textarea
                id="course-description"
                rows={5}
                placeholder="Explain learning objectives, prerequisites, hands-on projects, and career outcomes..."
                value={formState.description}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, description: e.target.value }))
                }
                className="w-full rounded-btn bg-midnight-navy/90 text-surface-white placeholder:text-slate-500 text-sm border border-slate-700/80 hover:border-slate-600 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
              />
              {fieldErrors.description && (
                <p role="alert" className="text-xs text-red-400 font-medium">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Duration (Hours)"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 32"
                value={formState.duration}
                onChange={(e) => setFormState((prev) => ({ ...prev, duration: e.target.value }))}
                error={fieldErrors.duration}
              />
              <Input
                label="Price (0 for Free)"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formState.price}
                onChange={(e) => setFormState((prev) => ({ ...prev, price: e.target.value }))}
                error={fieldErrors.price}
              />
              <Select
                label="Currency"
                value={formState.currency}
                onChange={(e) => setFormState((prev) => ({ ...prev, currency: e.target.value }))}
                error={fieldErrors.currency}
                options={CURRENCY_OPTIONS.map((code) => ({ value: code, label: code }))}
              />
            </div>

            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formState.certificationOffered}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    certificationOffered: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-600 bg-midnight-navy text-brand-blue focus:ring-brand-blue"
              />
              <span className="text-xs font-medium text-surface-white">
                Includes verifiable completion certificate upon finishing the program
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Skills & Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Skills Taught & Search Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Skills */}
            <div className="space-y-2 relative">
              <label className="block text-xs font-semibold tracking-wide text-slate-300 uppercase">
                Skills Covered ({formState.skills.length}/25)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a skill (e.g. Kubernetes, React, Python) and click Add"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSkill(skillInput)}
                  className="shrink-0 h-[42px]"
                >
                  Add Skill
                </Button>
              </div>

              {skillSuggestions.length > 0 && (
                <div className="rounded-btn border border-slate-700 bg-midnight-navy p-2 flex flex-wrap gap-1.5">
                  {skillSuggestions.map((skill) => (
                    <button
                      key={skill._id}
                      type="button"
                      onClick={() => addSkill(skill.name)}
                      className="text-xs px-2.5 py-1 rounded-full bg-navy-surface hover:bg-brand-blue hover:text-white text-slate-200 transition-colors"
                    >
                      + {skill.name}
                    </button>
                  ))}
                </div>
              )}

              {formState.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formState.skills.map((skill) => (
                    <Badge key={skill} variant="primary" className="pr-1.5">
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        aria-label={`Remove skill ${skill}`}
                        className="hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {fieldErrors.skills && (
                <p role="alert" className="text-xs text-red-400">
                  {fieldErrors.skills}
                </p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wide text-slate-300 uppercase">
                Catalog Tags ({formState.tags.length}/20)
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword tags (e.g. bootcamp, hands-on, exam-prep)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTag(tagInput)}
                  className="shrink-0 h-[42px]"
                >
                  Add Tag
                </Button>
              </div>
              {formState.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formState.tags.map((tag) => (
                    <Badge key={tag} variant="default" className="pr-1.5">
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Remove tag ${tag}`}
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

        {/* Links & Media */}
        <Card>
          <CardHeader>
            <CardTitle>Course Links & Cover Media</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Thumbnail Cover Image URL"
              placeholder="https://cdn.example.com/courses/cover.png"
              value={formState.thumbnailUrl}
              onChange={(e) => setFormState((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
              error={fieldErrors.thumbnailUrl}
            />
            <Input
              label="External Enrollment / LMS URL"
              placeholder="https://learn.example.com/course-slug"
              value={formState.externalUrl}
              onChange={(e) => setFormState((prev) => ({ ...prev, externalUrl: e.target.value }))}
              error={fieldErrors.externalUrl}
            />
          </CardContent>
        </Card>

        {/* Curriculum Syllabus Builder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Curriculum Syllabus Modules</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSyllabusRow}
              disabled={formState.syllabus.length >= 30}
              className="text-xs gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Module
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {formState.syllabus.length === 0 ? (
              <p className="text-xs text-muted-slate">
                No syllabus modules added yet. Click &ldquo;Add Module&rdquo; to outline the modules and lessons learners will study.
              </p>
            ) : (
              formState.syllabus.map((mod, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-btn border border-navy-surface bg-midnight-navy/60 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-brand-cyan">
                      Module #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSyllabusRow(idx)}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        label="Module Title *"
                        placeholder="e.g. Container Networking & Ingress"
                        value={mod.moduleTitle}
                        onChange={(e) =>
                          updateSyllabusRow(idx, { moduleTitle: e.target.value })
                        }
                        error={fieldErrors[`syllabus.${idx}.moduleTitle`]}
                      />
                    </div>
                    <Input
                      label="Duration (Hours)"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="e.g. 4"
                      value={mod.duration}
                      onChange={(e) => updateSyllabusRow(idx, { duration: e.target.value })}
                      error={fieldErrors[`syllabus.${idx}.duration`]}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold tracking-wide text-slate-300 uppercase">
                      Lessons (one per line or comma-separated)
                    </label>
                    <textarea
                      rows={3}
                      placeholder={'Cluster Services\nIngress Controllers\nNetworkPolicies Workshop'}
                      value={mod.lessonsText}
                      onChange={(e) =>
                        updateSyllabusRow(idx, { lessonsText: e.target.value })
                      }
                      className="w-full rounded-btn bg-midnight-navy/90 text-surface-white placeholder:text-slate-500 text-xs border border-slate-700/80 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link to="/provider/courses">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              onClick={() => void submitForm('draft')}
              className="gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save as Draft
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              isLoading={isSubmitting}
              onClick={() => void submitForm('published')}
              className="gap-1.5"
            >
              <Globe className="w-4 h-4" />
              Publish Offering
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

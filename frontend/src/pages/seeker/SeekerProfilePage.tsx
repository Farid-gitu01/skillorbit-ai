import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { profileService } from '@/services';
import type {
  AvailabilityStatus,
  EducationItem,
  ExperienceItem,
  SeekerProfile,
} from '@/types';
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
import { formatDate } from '@/utils/job-helpers';
import {
  Briefcase,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Plus,
  Save,
  Trash2,
  User as UserIcon,
} from 'lucide-react';

export function SeekerProfilePage() {
  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Basic Info form state
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [availability, setAvailability] = useState<AvailabilityStatus>('immediate');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');

  // Skills & Languages state
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [newLanguage, setNewLanguage] = useState('');

  // Experience & Education lists
  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);

  // New Experience form state
  const [showExpForm, setShowExpForm] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expLocation, setExpLocation] = useState('');
  const [expStart, setExpStart] = useState('');
  const [expEnd, setExpEnd] = useState('');
  const [expDesc, setExpDesc] = useState('');

  // New Education form state
  const [showEduForm, setShowEduForm] = useState(false);
  const [eduInstitution, setEduInstitution] = useState('');
  const [eduDegree, setEduDegree] = useState('');
  const [eduField, setEduField] = useState('');
  const [eduStart, setEduStart] = useState('');
  const [eduEnd, setEduEnd] = useState('');
  const [eduGrade, setEduGrade] = useState('');

  const hydrateState = useCallback((p: SeekerProfile) => {
    setProfile(p);
    setHeadline(p.headline ?? '');
    setBio(p.bio ?? '');
    setLocation(p.location ?? '');
    setPhone(p.phone ?? '');
    setAvatarUrl(p.avatarUrl ?? '');
    setAvailability(p.availability ?? 'immediate');
    setLinkedinUrl(p.linkedinUrl ?? '');
    setGithubUrl(p.githubUrl ?? '');
    setPortfolioUrl(p.portfolioUrl ?? '');
    setSkills(p.skills ?? []);
    setLanguages(p.languages ?? []);
    setExperience(p.experience ?? []);
    setEducation(p.education ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await profileService.getMyProfile();
        if (active) {
          hydrateState(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Unable to load profile';
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
  }, [hydrateState]);

  const handleSaveAll = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updated = await profileService.updateMyProfile({
        headline,
        bio,
        location,
        phone,
        avatarUrl,
        availability,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        skills,
        languages,
        experience,
        education,
      });
      hydrateState(updated);
      setSuccessMsg('Profile saved successfully.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed) return;
    if (!skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills([...skills, trimmed]);
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleAddLanguage = () => {
    const trimmed = newLanguage.trim();
    if (!trimmed) return;
    if (!languages.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      setLanguages([...languages, trimmed]);
    }
    setNewLanguage('');
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    setLanguages(languages.filter((l) => l !== langToRemove));
  };

  const handleAddExperience = () => {
    if (!expTitle.trim() || !expCompany.trim() || !expStart) return;
    const newItem: ExperienceItem = {
      title: expTitle.trim(),
      company: expCompany.trim(),
      location: expLocation.trim() || undefined,
      startDate: expStart,
      endDate: expEnd || undefined,
      description: expDesc.trim() || undefined,
    };
    setExperience([newItem, ...experience]);
    setExpTitle('');
    setExpCompany('');
    setExpLocation('');
    setExpStart('');
    setExpEnd('');
    setExpDesc('');
    setShowExpForm(false);
  };

  const handleRemoveExperience = (index: number) => {
    setExperience(experience.filter((_, i) => i !== index));
  };

  const handleAddEducation = () => {
    if (!eduInstitution.trim()) return;
    const newItem: EducationItem = {
      institution: eduInstitution.trim(),
      degree: eduDegree.trim() || undefined,
      field: eduField.trim() || undefined,
      startDate: eduStart || undefined,
      endDate: eduEnd || undefined,
      grade: eduGrade.trim() || undefined,
    };
    setEducation([newItem, ...education]);
    setEduInstitution('');
    setEduDegree('');
    setEduField('');
    setEduStart('');
    setEduEnd('');
    setEduGrade('');
    setShowEduForm(false);
  };

  const handleRemoveEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  const userObj = typeof profile?.user === 'object' && profile.user !== null ? profile.user : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Completion Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">My Career Profile</h1>
          <p className="text-xs text-muted-slate">
            Manage your professional persona, experience, skills, and links
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => handleSaveAll()}
          isLoading={isSaving}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Profile Changes</span>
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Save Failed">
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" title="Saved">
          {successMsg}
        </Alert>
      )}

      {/* Completion Status Card */}
      {profile && (
        <Card className="border-brand-blue/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-surface-white">
                <CheckCircle2 className="w-4 h-4 text-brand-cyan" />
                Profile Strength: {profile.completionPercentage}%
              </span>
              <span className="text-muted-slate">
                {profile.completionPercentage === 100
                  ? 'All key sections complete!'
                  : `Add: ${profile.missingFields.join(', ')}`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-navy-surface overflow-hidden">
              <div
                className="h-full bg-brand-blue transition-all duration-300"
                style={{ width: `${profile.completionPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Section 1: Basic Info & Avatar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-brand-cyan" />
              <span>Personal & Professional Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-navy-surface">
              <div className="w-16 h-16 rounded-full bg-brand-blue/20 text-brand-cyan flex items-center justify-center font-bold text-xl overflow-hidden border border-brand-blue/30 shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile Avatar" className="w-full h-full object-cover" />
                ) : (
                  userObj?.name?.charAt(0).toUpperCase() ?? 'S'
                )}
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-slate block mb-1">Full Name (Account)</label>
                  <p className="text-sm font-medium text-surface-white">{userObj?.name ?? 'User'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-slate block mb-1">Email Address</label>
                  <p className="text-sm font-medium text-surface-white">{userObj?.email ?? ''}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Professional Headline"
                placeholder="e.g., Full Stack React & Node.js Engineer"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={200}
              />

              <Input
                label="Location"
                placeholder="e.g., San Francisco, CA or Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
              />

              <Input
                label="Phone Number"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
              />

              <Select
                label="Availability Status"
                value={availability}
                onChange={(e) => setAvailability(e.target.value as AvailabilityStatus)}
                options={[
                  { value: 'immediate', label: 'Available Immediately' },
                  { value: '2-weeks', label: '2 Weeks Notice' },
                  { value: '1-month', label: '1 Month Notice' },
                  { value: 'not-looking', label: 'Not Actively Looking' },
                ]}
              />

              <div className="md:col-span-2">
                <Input
                  label="Profile Photo URL (Optional)"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-surface-white mb-1.5">
                Career Summary & Objective
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={2000}
                placeholder="Summarize your technical background, achievements, and target roles..."
                className="w-full px-3 py-2 text-xs rounded-btn bg-midnight-navy border border-navy-surface text-surface-white placeholder:text-muted-slate focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Technical Skills & Languages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills & Languages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-surface-white mb-2">
                Technical & Professional Skills
              </label>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add a skill (e.g., TypeScript, Python, Project Management)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={handleAddSkill}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.length === 0 ? (
                  <p className="text-xs text-muted-slate">No skills added yet.</p>
                ) : (
                  skills.map((skill) => (
                    <Badge key={skill} variant="primary" className="pr-1.5">
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1 text-muted-slate hover:text-red-400"
                        aria-label={`Remove ${skill}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-navy-surface">
              <label className="block text-xs font-medium text-surface-white mb-2">
                Languages Spoken
              </label>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add a language (e.g., English, Spanish)"
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLanguage();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={handleAddLanguage}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {languages.length === 0 ? (
                  <p className="text-xs text-muted-slate">No languages listed.</p>
                ) : (
                  languages.map((lang) => (
                    <Badge key={lang} variant="default" className="pr-1.5">
                      <span>{lang}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLanguage(lang)}
                        className="ml-1 text-muted-slate hover:text-red-400"
                        aria-label={`Remove ${lang}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Work Experience */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-cyan" />
              <span>Work Experience</span>
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowExpForm(!showExpForm)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Experience</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showExpForm && (
              <div className="p-4 rounded-lg bg-midnight-navy/80 border border-brand-blue/40 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Job Title *"
                    placeholder="e.g., Senior Frontend Engineer"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                  />
                  <Input
                    label="Company Name *"
                    placeholder="e.g., Acme Tech Inc."
                    value={expCompany}
                    onChange={(e) => setExpCompany(e.target.value)}
                  />
                  <Input
                    label="Location"
                    placeholder="e.g., Remote"
                    value={expLocation}
                    onChange={(e) => setExpLocation(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      label="Start Date *"
                      value={expStart}
                      onChange={(e) => setExpStart(e.target.value)}
                    />
                    <Input
                      type="date"
                      label="End Date (Optional)"
                      value={expEnd}
                      onChange={(e) => setExpEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-white mb-1">
                    Key Responsibilities & Impact
                  </label>
                  <textarea
                    rows={3}
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-btn bg-navy border border-navy-surface text-surface-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowExpForm(false)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={handleAddExperience}>
                    Add to List
                  </Button>
                </div>
              </div>
            )}

            {experience.length === 0 ? (
              <p className="text-xs text-muted-slate text-center py-4">
                No work experience entries added yet. Click &quot;Add Experience&quot; above.
              </p>
            ) : (
              <div className="space-y-3">
                {experience.map((exp, idx) => (
                  <div
                    key={exp._id ?? `${exp.company}-${idx}`}
                    className="p-4 rounded-lg bg-midnight-navy/50 border border-navy-surface flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-surface-white">{exp.title}</h4>
                      <p className="text-xs text-brand-cyan">
                        {exp.company} {exp.location ? `• ${exp.location}` : ''}
                      </p>
                      <p className="text-[11px] text-muted-slate">
                        {formatDate(exp.startDate)} — {exp.endDate ? formatDate(exp.endDate) : 'Present'}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-muted-slate pt-1">{exp.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExperience(idx)}
                      className="text-muted-slate hover:text-red-400 p-1"
                      aria-label="Remove experience"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Education */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-cyan" />
              <span>Education & Certifications</span>
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEduForm(!showEduForm)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Education</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {showEduForm && (
              <div className="p-4 rounded-lg bg-midnight-navy/80 border border-brand-blue/40 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Institution / Organization *"
                    placeholder="e.g., Stanford University or AWS"
                    value={eduInstitution}
                    onChange={(e) => setEduInstitution(e.target.value)}
                  />
                  <Input
                    label="Degree / Certification"
                    placeholder="e.g., B.S. Computer Science"
                    value={eduDegree}
                    onChange={(e) => setEduDegree(e.target.value)}
                  />
                  <Input
                    label="Field of Study"
                    placeholder="e.g., Software Engineering"
                    value={eduField}
                    onChange={(e) => setEduField(e.target.value)}
                  />
                  <Input
                    label="Grade / GPA"
                    placeholder="e.g., 3.9 / 4.0"
                    value={eduGrade}
                    onChange={(e) => setEduGrade(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="Start Date"
                    value={eduStart}
                    onChange={(e) => setEduStart(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="Graduation Date"
                    value={eduEnd}
                    onChange={(e) => setEduEnd(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowEduForm(false)}>
                    Cancel
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={handleAddEducation}>
                    Add Education
                  </Button>
                </div>
              </div>
            )}

            {education.length === 0 ? (
              <p className="text-xs text-muted-slate text-center py-4">
                No education entries added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {education.map((edu, idx) => (
                  <div
                    key={edu._id ?? `${edu.institution}-${idx}`}
                    className="p-4 rounded-lg bg-midnight-navy/50 border border-navy-surface flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-surface-white">{edu.institution}</h4>
                      <p className="text-xs text-brand-cyan">
                        {edu.degree ?? 'Certificate'} {edu.field ? `in ${edu.field}` : ''}
                      </p>
                      {(edu.startDate || edu.endDate) && (
                        <p className="text-[11px] text-muted-slate">
                          {edu.startDate ? formatDate(edu.startDate) : ''} — {edu.endDate ? formatDate(edu.endDate) : 'Present'}
                        </p>
                      )}
                      {edu.grade && <p className="text-[11px] text-muted-slate">Grade: {edu.grade}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEducation(idx)}
                      className="text-muted-slate hover:text-red-400 p-1"
                      aria-label="Remove education"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Social & Portfolio Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-brand-cyan" />
              <span>Portfolio & Professional Links</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="LinkedIn URL"
              placeholder="https://linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            <Input
              label="GitHub URL"
              placeholder="https://github.com/username"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <Input
              label="Portfolio / Website URL"
              placeholder="https://yourportfolio.com"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" isLoading={isSaving} className="gap-2">
            <Save className="w-4 h-4" />
            <span>Save All Changes</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

export default SeekerProfilePage;

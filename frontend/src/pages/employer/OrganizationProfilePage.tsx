import { useEffect, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2, Globe, Mail, MapPin, Phone, Save } from 'lucide-react';
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
import type { Organization, OrganizationSize } from '@/types/employer.types';
import {
  extractZodFieldErrors,
  isHttpUrl,
  ORGANIZATION_SIZES,
  organizationFormSchema,
  organizationValuesToPayload,
  type OrganizationFormValues,
} from '@/utils/employer-validation';

const INITIAL_VALUES: OrganizationFormValues = {
  name: '',
  industry: '',
  size: '',
  founded: '',
  location: '',
  description: '',
  logoUrl: '',
  websiteUrl: '',
  contactEmail: '',
  contactPhone: '',
  socialLinks: {
    linkedin: '',
    twitter: '',
    facebook: '',
    github: '',
  },
};

function mapOrgToForm(org: Organization | null): OrganizationFormValues {
  if (!org) return INITIAL_VALUES;
  return {
    name: org.name ?? '',
    industry: org.industry ?? '',
    size: (org.size ?? '') as OrganizationSize | '',
    founded: org.founded ? String(org.founded) : '',
    location: org.location ?? '',
    description: org.description ?? '',
    logoUrl: org.logoUrl ?? '',
    websiteUrl: org.websiteUrl ?? '',
    contactEmail: org.contactEmail ?? '',
    contactPhone: org.contactPhone ?? '',
    socialLinks: {
      linkedin: org.socialLinks?.linkedin ?? '',
      twitter: org.socialLinks?.twitter ?? '',
      facebook: org.socialLinks?.facebook ?? '',
      github: org.socialLinks?.github ?? '',
    },
  };
}

export function OrganizationProfilePage() {
  const [values, setValues] = useState<OrganizationFormValues>(INITIAL_VALUES);
  const [completionPct, setCompletionPct] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await employerService.getOrganization();
        if (active) {
          setValues(mapOrgToForm(res.organization));
          setCompletionPct(res.completionPercentage);
          setMissingFields(res.missingFields);
          setLoadError(null);
        }
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
    void load();
    return () => {
      active = false;
    };
  }, []);

  const updateField = <K extends keyof Omit<OrganizationFormValues, 'socialLinks'>>(
    key: K,
    value: OrganizationFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateSocial = (
    key: keyof OrganizationFormValues['socialLinks'],
    value: string
  ) => {
    setValues((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [key]: value },
    }));
    const errKey = `socialLinks.${key}`;
    setFieldErrors((prev) => {
      if (!prev[errKey]) return prev;
      const next = { ...prev };
      delete next[errKey];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSuccessMsg(null);

    const parsed = organizationFormSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(extractZodFieldErrors(parsed.error));
      setSaveError('Please fix the highlighted organization profile fields before saving.');
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    try {
      const payload = organizationValuesToPayload(parsed.data);
      const res = await employerService.saveOrganization(payload);
      setValues(mapOrgToForm(res.organization));
      setCompletionPct(res.completionPercentage);
      setMissingFields(res.missingFields);
      setSuccessMsg(res.message);
    } catch (err) {
      setSaveError(normalizeApiError(err).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
      </div>
    );
  }

  const sizeOptions = [
    { value: '', label: 'Select company size' },
    ...ORGANIZATION_SIZES.map((s) => ({ value: s, label: `${s} employees` })),
  ];

  const hasValidLogo = Boolean(values.logoUrl.trim() && isHttpUrl(values.logoUrl.trim()));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-white">Organization Profile</h1>
          <p className="text-sm text-muted-slate mt-1">
            Keep your company details accurate so candidates can learn about your organization on every job posting.
          </p>
        </div>
        <Badge variant={completionPct >= 80 ? 'success' : 'warning'} className="self-start">
          {completionPct}% Complete
        </Badge>
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load saved organization profile">
          {loadError}
        </Alert>
      )}
      {saveError && (
        <Alert variant="error" onDismiss={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}
      {successMsg && (
        <Alert variant="success" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </Alert>
      )}

      {/* Completion Bar */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-surface-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand-cyan" />
            Profile Strength
          </span>
          <span className="text-brand-cyan font-semibold">{completionPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-navy-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all duration-500"
            style={{ width: `${completionPct}%` }}
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Organization profile completion percentage"
          />
        </div>
        {missingFields.length > 0 && (
          <p className="text-xs text-muted-slate">
            Recommended next fields: <span className="text-surface-white">{missingFields.join(', ')}</span>
          </p>
        )}
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Brand & Core Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-cyan" />
              Company Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg bg-midnight-navy/60 border border-navy-surface">
              <div className="w-16 h-16 rounded-xl bg-navy-surface border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                {hasValidLogo ? (
                  <img
                    src={values.logoUrl.trim()}
                    alt={values.name || 'Company logo'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-7 h-7 text-muted-slate" />
                )}
              </div>
              <div className="flex-1">
                <Input
                  label="Company Logo URL"
                  placeholder="https://example.com/logo.png"
                  value={values.logoUrl}
                  onChange={(e) => updateField('logoUrl', e.target.value)}
                  error={fieldErrors.logoUrl}
                  helperText="Provide a direct https:// image URL for your company logo."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Organization Name *"
                placeholder="e.g., Acme Robotics Inc."
                value={values.name}
                onChange={(e) => updateField('name', e.target.value)}
                error={fieldErrors.name}
                required
              />
              <Input
                label="Industry"
                placeholder="e.g., Artificial Intelligence, FinTech"
                value={values.industry}
                onChange={(e) => updateField('industry', e.target.value)}
                error={fieldErrors.industry}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Company Size"
                value={values.size}
                onChange={(e) => updateField('size', e.target.value as OrganizationSize | '')}
                options={sizeOptions}
                error={fieldErrors.size}
              />
              <Input
                label="Founded Year"
                type="number"
                placeholder="e.g., 2021"
                value={values.founded}
                onChange={(e) => updateField('founded', e.target.value)}
                error={fieldErrors.founded}
              />
              <Input
                label="Headquarters Location"
                placeholder="e.g., Austin, TX / Remote"
                prefixIcon={<MapPin className="w-4 h-4" />}
                value={values.location}
                onChange={(e) => updateField('location', e.target.value)}
                error={fieldErrors.location}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="org-description"
                className="block text-sm font-medium text-surface-white"
              >
                Company Description
              </label>
              <textarea
                id="org-description"
                rows={4}
                maxLength={3000}
                placeholder="Describe your mission, engineering culture, products, and what makes your team unique..."
                value={values.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full rounded-btn bg-navy-surface border border-slate-700/80 px-3.5 py-2.5 text-sm text-surface-white placeholder:text-muted-slate/60 focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 focus:border-brand-cyan transition-colors"
              />
              <div className="flex items-center justify-between text-xs">
                {fieldErrors.description ? (
                  <span className="text-red-400">{fieldErrors.description}</span>
                ) : (
                  <span className="text-muted-slate">Visible on public job detail pages.</span>
                )}
                <span className="text-muted-slate">{values.description.length}/3000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-cyan" />
              Contact & Professional Links
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Website URL"
                placeholder="https://company.com"
                prefixIcon={<Globe className="w-4 h-4" />}
                value={values.websiteUrl}
                onChange={(e) => updateField('websiteUrl', e.target.value)}
                error={fieldErrors.websiteUrl}
              />
              <Input
                label="Hiring Contact Email"
                type="email"
                placeholder="careers@company.com"
                prefixIcon={<Mail className="w-4 h-4" />}
                value={values.contactEmail}
                onChange={(e) => updateField('contactEmail', e.target.value)}
                error={fieldErrors.contactEmail}
              />
              <Input
                label="Contact Phone"
                placeholder="+1 415 555 0199"
                prefixIcon={<Phone className="w-4 h-4" />}
                value={values.contactPhone}
                onChange={(e) => updateField('contactPhone', e.target.value)}
                error={fieldErrors.contactPhone}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-navy-surface">
              <Input
                label="LinkedIn URL"
                placeholder="https://linkedin.com/company/your-company"
                value={values.socialLinks.linkedin}
                onChange={(e) => updateSocial('linkedin', e.target.value)}
                error={fieldErrors['socialLinks.linkedin']}
              />
              <Input
                label="GitHub URL"
                placeholder="https://github.com/your-org"
                value={values.socialLinks.github}
                onChange={(e) => updateSocial('github', e.target.value)}
                error={fieldErrors['socialLinks.github']}
              />
              <Input
                label="Twitter / X URL"
                placeholder="https://x.com/your-company"
                value={values.socialLinks.twitter}
                onChange={(e) => updateSocial('twitter', e.target.value)}
                error={fieldErrors['socialLinks.twitter']}
              />
              <Input
                label="Facebook URL"
                placeholder="https://facebook.com/your-company"
                value={values.socialLinks.facebook}
                onChange={(e) => updateSocial('facebook', e.target.value)}
                error={fieldErrors['socialLinks.facebook']}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" isLoading={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            Save Organization Profile
          </Button>
        </div>
      </form>
    </div>
  );
}

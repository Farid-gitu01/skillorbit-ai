import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckCircle2,
  Globe,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
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
import type { ProviderOrganization } from '@/types/provider.types';
import {
  ORGANIZATION_SIZES,
  providerOrganizationFormSchema,
  providerOrganizationValuesToPayload,
  type ProviderOrganizationFormValues,
} from '@/utils/provider-validation';

const DEFAULT_VALUES: ProviderOrganizationFormValues = {
  name: '',
  specialization: '',
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

function orgToFormValues(org: ProviderOrganization | null): ProviderOrganizationFormValues {
  if (!org) return DEFAULT_VALUES;
  return {
    name: org.name ?? '',
    specialization: org.specialization ?? '',
    industry: org.industry ?? '',
    size: org.size ?? '',
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

export function ProviderProfilePage() {
  const [organization, setOrganization] = useState<ProviderOrganization | null>(null);
  const [completionPct, setCompletionPct] = useState(0);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [logoError, setLogoError] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProviderOrganizationFormValues>({
    resolver: zodResolver(providerOrganizationFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const watchedName = useWatch({ control, name: 'name' });
  const watchedLogoUrl = useWatch({ control, name: 'logoUrl' });

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const res = await providerService.getProfile();
        if (!active) return;
        setOrganization(res.organization);
        setCompletionPct(res.completionPercentage);
        setMissingFields(res.missingFields);
        reset(orgToFormValues(res.organization));
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
    void loadProfile();
    return () => {
      active = false;
    };
  }, [reset]);

  const onSubmit = async (values: ProviderOrganizationFormValues) => {
    setSaveMessage(null);
    setSaveError(null);
    setLogoError(false);
    try {
      const payload = providerOrganizationValuesToPayload(values);
      const res = await providerService.saveProfile(payload);
      setOrganization(res.organization);
      setCompletionPct(res.completionPercentage);
      setMissingFields(res.missingFields);
      reset(orgToFormValues(res.organization));
      setSaveMessage(res.message);
    } catch (err) {
      setSaveError(normalizeApiError(err).message);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-[520px] w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left">
      <div>
        <h1 className="text-2xl font-bold text-surface-white">Provider Organization Profile</h1>
        <p className="text-xs text-muted-slate mt-1">
          Showcase your training institute, specialization, contact details, and official links to learners.
        </p>
      </div>

      {loadError && (
        <Alert variant="error" title="Could not load provider profile">
          {loadError}
        </Alert>
      )}
      {saveMessage && (
        <Alert variant="success" onDismiss={() => setSaveMessage(null)}>
          {saveMessage}
        </Alert>
      )}
      {saveError && (
        <Alert variant="error" onDismiss={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {/* Profile Completion & Verification Overview */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              {watchedLogoUrl && !logoError ? (
                <img
                  src={watchedLogoUrl}
                  alt={watchedName || 'Provider logo'}
                  onError={() => setLogoError(true)}
                  className="w-14 h-14 rounded-xl object-cover border border-navy-surface bg-midnight-navy shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-brand-blue/15 border border-brand-blue/30 text-brand-cyan flex items-center justify-center shrink-0">
                  <GraduationCap className="w-7 h-7" />
                </div>
              )}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-surface-white">
                    {watchedName || 'Your Training Organization'}
                  </h2>
                  <Badge variant={organization?.isVerified ? 'success' : 'warning'}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {organization?.isVerified ? 'Verified Provider' : 'Unverified / Pending Review'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-slate">
                  Profile Strength: <span className="text-brand-cyan font-semibold">{completionPct}%</span>
                </p>
              </div>
            </div>

            {completionPct === 100 && (
              <Badge variant="success" className="self-start sm:self-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Profile Complete
              </Badge>
            )}
          </div>

          <div className="h-2 rounded-full bg-midnight-navy overflow-hidden border border-navy-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-cyan transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          {missingFields.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-slate">
              <span className="font-medium text-slate-300">Missing:</span>
              {missingFields.map((field) => (
                <Badge key={field} variant="default" className="text-[11px]">
                  {field}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Core Organization Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Provider / Business Name *"
                placeholder="e.g. CloudCraft Technical Academy"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Primary Specialization"
                placeholder="e.g. Cloud Architecture, Applied AI & MLOps"
                error={errors.specialization?.message}
                {...register('specialization')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Industry / Category"
                placeholder="e.g. EdTech & Software Training"
                error={errors.industry?.message}
                {...register('industry')}
              />
              <Select
                label="Organization Size"
                error={errors.size?.message}
                options={[
                  { value: '', label: 'Select size' },
                  ...ORGANIZATION_SIZES.map((s) => ({ value: s, label: `${s} team members` })),
                ]}
                {...register('size')}
              />
              <Input
                label="Founded Year"
                placeholder="e.g. 2019"
                error={errors.founded?.message}
                {...register('founded')}
              />
            </div>

            <Input
              label="Headquarters / Location"
              placeholder="e.g. Austin, TX (Remote & Hybrid)"
              prefixIcon={<MapPin className="w-4 h-4 text-muted-slate" />}
              error={errors.location?.message}
              {...register('location')}
            />

            <div className="space-y-1.5">
              <label
                htmlFor="provider-description"
                className="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
              >
                About & Learning Methodology
              </label>
              <textarea
                id="provider-description"
                rows={4}
                placeholder="Describe your training programs, accreditation, teaching style, and learner outcomes..."
                className="w-full rounded-btn bg-midnight-navy/90 text-surface-white placeholder:text-slate-500 text-sm border border-slate-700/80 hover:border-slate-600 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                {...register('description')}
              />
              {errors.description && (
                <p role="alert" className="text-xs text-red-400 font-medium">
                  {errors.description.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Media, Contact & Web Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Official Website URL"
                placeholder="https://academy.example.com"
                prefixIcon={<Globe className="w-4 h-4 text-muted-slate" />}
                error={errors.websiteUrl?.message}
                {...register('websiteUrl')}
              />
              <Input
                label="Logo / Profile Image URL"
                placeholder="https://cdn.example.com/logo.png"
                error={errors.logoUrl?.message}
                {...register('logoUrl', {
                  onChange: () => setLogoError(false),
                })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Admissions / Support Email"
                type="email"
                placeholder="admissions@academy.example.com"
                prefixIcon={<Mail className="w-4 h-4 text-muted-slate" />}
                error={errors.contactEmail?.message}
                {...register('contactEmail')}
              />
              <Input
                label="Contact Phone"
                placeholder="+1 (555) 123-4567"
                prefixIcon={<Phone className="w-4 h-4 text-muted-slate" />}
                error={errors.contactPhone?.message}
                {...register('contactPhone')}
              />
            </div>

            <div className="pt-2 border-t border-navy-surface/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-3">
                Social & Community Profiles
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="LinkedIn URL"
                  placeholder="https://linkedin.com/school/..."
                  error={errors.socialLinks?.linkedin?.message}
                  {...register('socialLinks.linkedin')}
                />
                <Input
                  label="GitHub URL"
                  placeholder="https://github.com/..."
                  error={errors.socialLinks?.github?.message}
                  {...register('socialLinks.github')}
                />
                <Input
                  label="X / Twitter URL"
                  placeholder="https://twitter.com/..."
                  error={errors.socialLinks?.twitter?.message}
                  {...register('socialLinks.twitter')}
                />
                <Input
                  label="Facebook URL"
                  placeholder="https://facebook.com/..."
                  error={errors.socialLinks?.facebook?.message}
                  {...register('socialLinks.facebook')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting} className="gap-2">
            <Save className="w-4 h-4" />
            Save Provider Profile
          </Button>
        </div>
      </form>
    </div>
  );
}

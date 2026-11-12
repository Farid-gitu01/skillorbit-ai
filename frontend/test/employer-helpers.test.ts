import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applicationNoteSchema,
  applicationStatusUpdateSchema,
  extractZodFieldErrors,
  isHttpUrl,
  jobFormSchema,
  jobValuesToPayload,
  organizationFormSchema,
  organizationValuesToPayload,
  type JobFormInputState,
} from '../src/utils/employer-validation.ts';
import { getJobStatusBadge } from '../src/utils/job-helpers.ts';

test('organizationFormSchema validates URLs, emails, founded year, and transforms payload', () => {
  const valid = organizationFormSchema.safeParse({
    name: 'SkillOrbit AI',
    industry: 'Software & Recruiting',
    size: '51-200',
    founded: '2021',
    location: 'Austin, TX',
    description: 'Intelligent hiring & skill-intelligence workspace.',
    logoUrl: 'https://cdn.example.com/logo.png',
    websiteUrl: 'https://skillorbit.example.com',
    contactEmail: 'Careers@SkillOrbit.Example.COM',
    contactPhone: '+1 555 222 1000',
    socialLinks: {
      linkedin: 'https://linkedin.com/company/skillorbit',
      twitter: '',
      facebook: '',
      github: 'https://github.com/skillorbit',
    },
  });

  assert.equal(valid.success, true);
  if (valid.success) {
    const payload = organizationValuesToPayload(valid.data);
    assert.equal(payload.founded, 2021);
    assert.equal(payload.contactEmail, 'careers@skillorbit.example.com');
    assert.equal(payload.socialLinks?.github, 'https://github.com/skillorbit');
  }

  const invalid = organizationFormSchema.safeParse({
    name: 'A',
    industry: '',
    size: '',
    founded: '1700',
    location: '',
    description: '',
    logoUrl: 'javascript:alert(1)',
    websiteUrl: 'ftp://example.com',
    contactEmail: 'not-an-email',
    contactPhone: '',
    socialLinks: {
      linkedin: '',
      twitter: '',
      facebook: '',
      github: '',
    },
  });

  assert.equal(invalid.success, false);
  if (!invalid.success) {
    const errors = extractZodFieldErrors(invalid.error);
    assert.ok(errors.name);
    assert.ok(errors.founded);
    assert.ok(errors.logoUrl);
    assert.ok(errors.websiteUrl);
    assert.ok(errors.contactEmail);
  }
});

test('isHttpUrl strictly accepts only http:// and https:// URLs', () => {
  assert.equal(isHttpUrl('https://skillorbit.ai/jobs'), true);
  assert.equal(isHttpUrl('http://localhost:5173'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('data:text/html,<script>'), false);
});

test('jobFormSchema enforces description length, salary bounds, and converts payload', () => {
  const validForm: JobFormInputState = {
    title: 'Senior Full-Stack Engineer',
    description: 'Architect scalable React and Node.js applications for enterprise teams.',
    responsibilities: ['Design REST endpoints', 'Lead code reviews'],
    qualifications: ['5+ years TypeScript', 'Experience with MongoDB'],
    skills: ['TypeScript', 'React', 'Node.js'],
    location: 'Remote (US)',
    locationType: 'remote',
    type: 'full-time',
    experienceLevel: 'senior',
    openings: '3',
    includeSalary: true,
    salaryMin: '120000',
    salaryMax: '160000',
    salaryCurrency: 'usd',
    salaryIsPublic: true,
    applicationDeadline: '',
    status: 'draft',
  };

  const parsed = jobFormSchema.safeParse(validForm);
  assert.equal(parsed.success, true);
  const payload = jobValuesToPayload(validForm, 'active');
  assert.equal(payload.status, 'active');
  assert.equal(payload.openings, 3);
  assert.equal(payload.salary?.currency, 'USD');
  assert.equal(payload.salary?.min, 120000);
  assert.equal(payload.salary?.max, 160000);

  const invertedSalary = jobFormSchema.safeParse({
    ...validForm,
    salaryMin: '200000',
    salaryMax: '150000',
  });
  assert.equal(invertedSalary.success, false);
  if (!invertedSalary.success) {
    const errors = extractZodFieldErrors(invertedSalary.error);
    assert.ok(errors['salaryMax']);
  }

  const pastActiveDeadline = jobFormSchema.safeParse({
    ...validForm,
    status: 'active',
    applicationDeadline: '2020-01-01',
  });
  assert.equal(pastActiveDeadline.success, false);
});

test('application validation schemas and job status badge mapping behave predictably', () => {
  assert.equal(
    applicationStatusUpdateSchema.safeParse({ status: 'shortlisted', employerNote: 'Strong match' })
      .success,
    true
  );
  assert.equal(applicationNoteSchema.safeParse({ employerNote: 'Schedule tech screen.' }).success, true);

  assert.deepEqual(getJobStatusBadge('active'), { label: 'Published', variant: 'success' });
  assert.deepEqual(getJobStatusBadge('draft'), { label: 'Draft', variant: 'warning' });
  assert.deepEqual(getJobStatusBadge('closed'), { label: 'Closed', variant: 'default' });
  assert.deepEqual(getJobStatusBadge('expired'), { label: 'Expired', variant: 'danger' });
});

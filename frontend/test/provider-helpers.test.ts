import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  courseFormSchema,
  courseFormToPayload,
  courseToFormState,
  engagementUpdateSchema,
  formatCoursePrice,
  getCourseStatusBadge,
  getEngagementStatusBadge,
  providerOrganizationFormSchema,
  providerOrganizationValuesToPayload,
  type CourseFormInputState,
} from '../src/utils/provider-validation.ts';

test('providerOrganizationFormSchema validates profile inputs, URLs, and converts payload', () => {
  const valid = providerOrganizationFormSchema.safeParse({
    name: 'CloudCraft Technical Academy',
    specialization: 'Kubernetes & DevOps',
    industry: 'Cloud Education',
    size: '11-50',
    founded: '2018',
    location: 'Seattle, WA',
    description: 'Cohort training for cloud-native practitioners.',
    logoUrl: 'https://cdn.example.com/logo.png',
    websiteUrl: 'https://cloudcraft.example.com',
    contactEmail: 'Admissions@CloudCraft.Example.COM',
    contactPhone: '+1 206 555 0199',
    socialLinks: {
      linkedin: 'https://linkedin.com/school/cloudcraft',
      twitter: '',
      facebook: '',
      github: 'https://github.com/cloudcraft-labs',
    },
  });
  assert.equal(valid.success, true);

  if (valid.success) {
    const payload = providerOrganizationValuesToPayload(valid.data);
    assert.equal(payload.founded, 2018);
    assert.equal(payload.contactEmail, 'admissions@cloudcraft.example.com');
    assert.equal(payload.specialization, 'Kubernetes & DevOps');
  }

  const invalidUrl = providerOrganizationFormSchema.safeParse({
    name: 'CloudCraft Technical Academy',
    specialization: '',
    industry: '',
    size: '',
    founded: '',
    location: '',
    description: '',
    logoUrl: 'javascript:alert(1)',
    websiteUrl: '',
    contactEmail: '',
    contactPhone: '',
    socialLinks: { linkedin: '', twitter: '', facebook: '', github: '' },
  });
  assert.equal(invalidUrl.success, false);
});

test('courseFormSchema validates syllabus, price, duration, and maps to API payload cleanly', () => {
  const input: CourseFormInputState = {
    title: 'Applied TypeScript & Distributed APIs',
    description: 'Build production-grade microservices and strongly-typed client applications.',
    category: 'Backend Engineering',
    level: 'intermediate',
    deliveryMode: 'live-cohort',
    duration: '24',
    price: '149.5',
    currency: 'usd',
    certificationOffered: true,
    skills: ['TypeScript', 'Node.js'],
    tags: ['apis', 'architecture'],
    thumbnailUrl: 'https://cdn.example.com/ts-cover.png',
    externalUrl: 'https://learn.example.com/ts-apis',
    syllabus: [
      {
        moduleTitle: 'Type System Patterns',
        lessonsText: 'Generics in Practice\nDiscriminated Unions',
        duration: '6',
      },
    ],
    status: 'published',
  };

  const parsed = courseFormSchema.safeParse(input);
  assert.equal(parsed.success, true);

  const payload = courseFormToPayload(input);
  assert.equal(payload.currency, 'USD');
  assert.equal(payload.duration, 24);
  assert.equal(payload.price, 149.5);
  assert.equal(payload.syllabus.length, 1);
  assert.deepEqual(payload.syllabus[0].lessons, [
    'Generics in Practice',
    'Discriminated Unions',
  ]);
  assert.equal(payload.syllabus[0].duration, 6);

  const shortTitle = courseFormSchema.safeParse({ ...input, title: 'TS' });
  assert.equal(shortTitle.success, false);
});

test('courseToFormState hydrates Course object back into form state smoothly', () => {
  const formState = courseToFormState({
    _id: 'course-1',
    provider: 'prov-1',
    title: 'Kubernetes Fundamentals',
    description: 'Comprehensive hands-on workshop on container orchestration.',
    category: 'DevOps',
    skills: [{ _id: 'sk1', name: 'Kubernetes', category: 'DevOps' }],
    level: 'beginner',
    deliveryMode: 'hybrid',
    duration: 16,
    price: 0,
    currency: 'USD',
    certificationOffered: false,
    syllabus: [{ moduleTitle: 'Pods & Deployments', lessons: ['Pod Lifecycle', 'Rollouts'], duration: 4 }],
    tags: ['k8s'],
    enrollmentCount: 12,
    ratingCount: 0,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.deepEqual(formState.skills, ['Kubernetes']);
  assert.equal(formState.duration, '16');
  assert.equal(formState.syllabus[0].lessonsText, 'Pod Lifecycle\nRollouts');
});

test('engagementUpdateSchema, price formatting, and status badges behave accurately', () => {
  assert.equal(
    engagementUpdateSchema.safeParse({ status: 'completed', progress: 100, providerNote: 'Verified capstone.' })
      .success,
    true
  );
  assert.equal(
    engagementUpdateSchema.safeParse({ status: 'active', progress: 150, providerNote: '' }).success,
    false
  );

  assert.equal(formatCoursePrice(0, 'USD'), 'Free');
  assert.match(formatCoursePrice(199, 'USD'), /199/);
  assert.equal(getCourseStatusBadge('published').variant, 'success');
  assert.equal(getEngagementStatusBadge('pending').variant, 'warning');
  assert.equal(getEngagementStatusBadge('completed').variant, 'success');
});

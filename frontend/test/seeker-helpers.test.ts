import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatSalary,
  formatFileSize,
  formatDate,
  getApplicationStatusBadge,
} from '../src/utils/job-helpers.ts';

test('formatSalary: Formats public salary range correctly', () => {
  assert.equal(
    formatSalary({ min: 80000, max: 120000, currency: 'USD', isPublic: true }),
    '$80,000 - $120,000'
  );
  assert.equal(
    formatSalary({ min: 60000, currency: 'USD', isPublic: true }),
    'From $60,000'
  );
  assert.equal(
    formatSalary({ max: 150000, currency: 'USD', isPublic: true }),
    'Up to $150,000'
  );
  assert.equal(
    formatSalary({ min: 80000, max: 120000, isPublic: false }),
    'Competitive Salary'
  );
  assert.equal(formatSalary(undefined), 'Competitive Salary');
});

test('formatFileSize: Formats bytes into human-readable units', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(1024), '1 KB');
  assert.equal(formatFileSize(1048576), '1 MB');
  assert.equal(formatFileSize(2621440), '2.5 MB');
});

test('formatDate: Formats valid ISO date and safely falls back on undefined', () => {
  assert.equal(formatDate(undefined), 'N/A');
  const formatted = formatDate('2026-11-11T12:00:00Z');
  assert.ok(formatted.includes('Nov'));
  assert.ok(formatted.includes('2026'));
});

test('getApplicationStatusBadge: Maps all statuses to labels and variants', () => {
  assert.deepEqual(getApplicationStatusBadge('pending'), {
    label: 'Pending Review',
    variant: 'warning',
  });
  assert.deepEqual(getApplicationStatusBadge('reviewed'), {
    label: 'Reviewed',
    variant: 'info',
  });
  assert.deepEqual(getApplicationStatusBadge('shortlisted'), {
    label: 'Shortlisted',
    variant: 'purple',
  });
  assert.deepEqual(getApplicationStatusBadge('accepted'), {
    label: 'Accepted',
    variant: 'success',
  });
  assert.deepEqual(getApplicationStatusBadge('rejected'), {
    label: 'Not Selected',
    variant: 'danger',
  });
  assert.deepEqual(getApplicationStatusBadge('withdrawn'), {
    label: 'Withdrawn',
    variant: 'default',
  });
});

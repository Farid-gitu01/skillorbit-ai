import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminCourseModerationSchema,
  adminJobModerationSchema,
  adminStatusDecisionSchema,
  adminVerificationDecisionSchema,
  formatAdminTimestamp,
  getAccountStatusBadge,
  getModerationBadge,
  getRoleBadge,
  getVerificationBadge,
  validateModerationPayload,
  validateUserStatusReason,
} from '../src/utils/admin-validation.ts';

test('admin status reason and moderation payload validation enforce required explanations', () => {
  assert.ok(validateUserStatusReason(false, ''));
  assert.ok(validateUserStatusReason(false, 'ab'));
  assert.equal(validateUserStatusReason(false, 'Violation of job posting rules'), null);
  assert.equal(validateUserStatusReason(true, ''), null);
  assert.ok(validateUserStatusReason(true, 'ok'));
  assert.equal(validateUserStatusReason(true, 'Appeal reviewed'), null);

  assert.ok(validateModerationPayload('no'));
  assert.equal(validateModerationPayload('Verified official entity filings'), null);
});

test('admin Zod decision schemas validate allowed states and reject arbitrary fields', () => {
  assert.equal(
    adminStatusDecisionSchema.safeParse({ reason: 'Cleared appeal', role: 'admin' }).success,
    false
  );
  assert.equal(
    adminVerificationDecisionSchema.safeParse({
      status: 'verified',
      reason: 'Confirmed registration document',
    }).success,
    true
  );
  assert.equal(
    adminVerificationDecisionSchema.safeParse({
      status: 'pending',
      reason: 'Cannot set back to pending',
    }).success,
    false
  );
  assert.equal(
    adminJobModerationSchema.safeParse({
      moderationStatus: 'rejected',
      status: 'closed',
      reason: 'Fraudulent job advertisement',
    }).success,
    true
  );
  assert.equal(
    adminCourseModerationSchema.safeParse({
      moderationStatus: 'flagged',
      reason: 'Syllabus broken links',
    }).success,
    true
  );
});

test('admin badge and timestamp helpers map every state accurately', () => {
  assert.deepEqual(getAccountStatusBadge(true), { label: 'Active', variant: 'success' });
  assert.deepEqual(getAccountStatusBadge(false), { label: 'Suspended', variant: 'danger' });

  assert.deepEqual(getVerificationBadge('verified'), { label: 'Verified', variant: 'success' });
  assert.deepEqual(getVerificationBadge('rejected'), { label: 'Rejected', variant: 'danger' });
  assert.deepEqual(getVerificationBadge('pending'), {
    label: 'Pending Review',
    variant: 'warning',
  });

  assert.deepEqual(getModerationBadge('approved'), { label: 'Approved', variant: 'success' });
  assert.deepEqual(getModerationBadge('flagged'), { label: 'Flagged', variant: 'warning' });
  assert.deepEqual(getModerationBadge('rejected'), { label: 'Rejected', variant: 'danger' });

  assert.deepEqual(getRoleBadge('admin'), { label: 'Admin', variant: 'purple' });
  assert.deepEqual(getRoleBadge('employer'), { label: 'Employer', variant: 'primary' });
  assert.deepEqual(getRoleBadge('provider'), { label: 'Provider', variant: 'info' });
  assert.deepEqual(getRoleBadge('seeker'), { label: 'Job Seeker', variant: 'default' });

  assert.equal(formatAdminTimestamp(undefined), 'N/A');
  assert.equal(formatAdminTimestamp('not-a-date'), 'N/A');
  assert.notEqual(formatAdminTimestamp('2026-01-15T10:30:00.000Z'), 'N/A');
});

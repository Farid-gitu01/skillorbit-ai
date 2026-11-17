import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateRoadmapCompletionStats,
  getMatchScoreBadgeClasses,
  getPriorityBadgeClasses,
  getSafeExternalSearchHref,
  MAX_RESUME_FILE_SIZE_BYTES,
  validateResumeFile,
} from '../src/utils/ai.utils.ts';

test('validateResumeFile: accepts valid PDF and DOCX within 5MB and rejects unsupported or unsafe inputs', () => {
  assert.deepEqual(
    validateResumeFile({
      name: 'resume.pdf',
      size: 1024 * 200,
      type: 'application/pdf',
    }),
    { valid: true }
  );

  assert.deepEqual(
    validateResumeFile({
      name: 'cv.docx',
      size: 1024 * 350,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    { valid: true }
  );

  const emptyResult = validateResumeFile({
    name: 'empty.pdf',
    size: 0,
    type: 'application/pdf',
  });
  assert.equal(emptyResult.valid, false);

  const oversizeResult = validateResumeFile({
    name: 'huge.pdf',
    size: MAX_RESUME_FILE_SIZE_BYTES + 1,
    type: 'application/pdf',
  });
  assert.equal(oversizeResult.valid, false);

  const legacyDocResult = validateResumeFile({
    name: 'legacy.doc',
    size: 1024,
    type: 'application/msword',
  });
  assert.equal(legacyDocResult.valid, false);

  const mismatchMime = validateResumeFile({
    name: 'spoof.pdf',
    size: 1024,
    type: 'text/plain',
  });
  assert.equal(mismatchMime.valid, false);
});

test('calculateRoadmapCompletionStats: computes completed count, percentage, and remaining study hours', () => {
  assert.deepEqual(calculateRoadmapCompletionStats([]), {
    completedCount: 0,
    totalCount: 0,
    progressPercent: 0,
    remainingHours: 0,
  });

  assert.deepEqual(
    calculateRoadmapCompletionStats([
      { isCompleted: true, estimatedHours: 8 },
      { isCompleted: false, estimatedHours: 10 },
      { isCompleted: true, estimatedHours: 6 },
      { isCompleted: false, estimatedHours: 12 },
    ]),
    {
      completedCount: 2,
      totalCount: 4,
      progressPercent: 50,
      remainingHours: 22,
    }
  );
});

test('AI UI helpers: match score classes, priority classes, and encoded external search hrefs', () => {
  assert.match(getMatchScoreBadgeClasses(85), /emerald/);
  assert.match(getMatchScoreBadgeClasses(60), /cyan/);
  assert.match(getMatchScoreBadgeClasses(30), /amber/);

  assert.match(getPriorityBadgeClasses('critical'), /red/);
  assert.match(getPriorityBadgeClasses('high'), /amber/);

  assert.equal(
    getSafeExternalSearchHref('TypeScript generics & Zod'),
    'https://www.google.com/search?q=TypeScript%20generics%20%26%20Zod'
  );
});

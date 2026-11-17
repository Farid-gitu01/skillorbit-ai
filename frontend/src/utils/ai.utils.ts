export const MAX_RESUME_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export interface ResumeFileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a selected resume file is non-empty, within 5MB, and is strictly PDF or DOCX.
 */
export function validateResumeFile(file: {
  name: string;
  size: number;
  type: string;
}): ResumeFileValidationResult {
  if (file.size <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File exceeds the 5MB maximum size limit.' };
  }

  const lowerName = file.name.toLowerCase();
  const isPdfExt = lowerName.endsWith('.pdf');
  const isDocxExt = lowerName.endsWith('.docx');

  if (!isPdfExt && !isDocxExt) {
    return { valid: false, error: 'Only PDF (.pdf) and DOCX (.docx) resume files are supported.' };
  }

  if (file.type) {
    if (isPdfExt && file.type !== 'application/pdf') {
      return { valid: false, error: 'Invalid MIME type for PDF resume.' };
    }
    if (
      isDocxExt &&
      file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return { valid: false, error: 'Invalid MIME type for DOCX resume.' };
    }
  }

  return { valid: true };
}

export function getMatchScoreBadgeClasses(score: number): string {
  if (score >= 75) {
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  }
  if (score >= 50) {
    return 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30';
  }
  return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
}

export function getPriorityBadgeClasses(
  priority: 'critical' | 'high' | 'medium' | 'low'
): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'medium':
      return 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30';
    case 'low':
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

export function calculateRoadmapCompletionStats(
  steps: Array<{ isCompleted: boolean; estimatedHours?: number }>
): {
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  remainingHours: number;
} {
  const totalCount = steps.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, progressPercent: 0, remainingHours: 0 };
  }

  let completedCount = 0;
  let remainingHours = 0;
  for (const step of steps) {
    if (step.isCompleted) {
      completedCount += 1;
    } else {
      remainingHours += step.estimatedHours ?? 0;
    }
  }

  return {
    completedCount,
    totalCount,
    progressPercent: Math.round((completedCount / totalCount) * 100),
    remainingHours,
  };
}

export function getSafeExternalSearchHref(searchQuery: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim())}`;
}

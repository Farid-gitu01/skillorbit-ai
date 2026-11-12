import { useState, type FormEvent } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { Alert, Button, Select } from '@/components/ui';
import { normalizeApiError } from '@/services/api';
import {
  validateModerationPayload,
  validateUserStatusReason,
} from '@/utils/admin-validation';
import type { ContentModerationStatus } from '@/types/admin.types';

export interface AdminActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  mode: 'user-status' | 'verification' | 'job-moderation' | 'course-moderation';
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'secondary' | 'outline';
  requireReason: boolean;
  initialModerationStatus?: ContentModerationStatus;
  initialContentStatus?: string;
  onClose: () => void;
  onSubmit: (payload: {
    reason: string;
    moderationStatus?: ContentModerationStatus;
    contentStatus?: string;
  }) => Promise<void>;
}

export function AdminActionDialog({
  open,
  title,
  description,
  mode,
  confirmLabel,
  confirmVariant = 'primary',
  requireReason,
  initialModerationStatus = 'approved',
  initialContentStatus,
  onClose,
  onSubmit,
}: AdminActionDialogProps) {
  const [reason, setReason] = useState('');
  const [moderationStatus, setModerationStatus] =
    useState<ContentModerationStatus>(initialModerationStatus);
  const [contentStatus, setContentStatus] = useState<string>(initialContentStatus ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const isModerationMode = mode === 'job-moderation' || mode === 'course-moderation';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validationError =
      mode === 'user-status'
        ? validateUserStatusReason(!requireReason, reason)
        : validateModerationPayload(reason);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        reason: reason.trim(),
        moderationStatus: isModerationMode ? moderationStatus : undefined,
        contentStatus: isModerationMode && contentStatus ? contentStatus : undefined,
      });
      setReason('');
      onClose();
    } catch (err) {
      setFormError(normalizeApiError(err).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-dialog-title"
    >
      <div className="w-full max-w-lg rounded-card border border-navy-surface bg-navy p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-blue/15 text-brand-cyan flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 id="admin-dialog-title" className="text-sm font-semibold text-surface-white">
                {title}
              </h2>
              <p className="text-xs text-muted-slate mt-0.5">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-muted-slate hover:text-surface-white rounded-md"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError && <Alert variant="error">{formError}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isModerationMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Moderation Decision"
                value={moderationStatus}
                onChange={(e) =>
                  setModerationStatus(e.target.value as ContentModerationStatus)
                }
                options={[
                  { value: 'approved', label: 'Approved (Clear)' },
                  { value: 'flagged', label: 'Flagged for Review' },
                  { value: 'rejected', label: 'Rejected & Unpublish' },
                ]}
              />
              <Select
                label="Publication Status Override"
                value={contentStatus}
                onChange={(e) => setContentStatus(e.target.value)}
                options={
                  mode === 'job-moderation'
                    ? [
                        { value: '', label: 'Keep Current (or Auto Close on Reject)' },
                        { value: 'active', label: 'Active' },
                        { value: 'closed', label: 'Closed' },
                        { value: 'draft', label: 'Draft' },
                      ]
                    : [
                        { value: '', label: 'Keep Current (or Auto Archive on Reject)' },
                        { value: 'published', label: 'Published' },
                        { value: 'archived', label: 'Archived' },
                        { value: 'draft', label: 'Draft' },
                      ]
                }
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-surface-white mb-1.5">
              {requireReason
                ? 'Decision Reason / Audit Note (Required)'
                : 'Audit Note (Optional)'}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                requireReason
                  ? 'Provide a clear, policy-based explanation recorded in the audit log...'
                  : 'Optional note for audit trail and user notification...'
              }
              className="w-full rounded-input border border-navy-surface bg-midnight-navy px-3 py-2 text-xs text-surface-white placeholder:text-muted-slate focus:border-brand-blue focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-navy-surface">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={confirmVariant}
              size="sm"
              isLoading={isSubmitting}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button, Input, Alert } from '@/components/ui';
import { resetPasswordFormSchema, type ResetPasswordFormData } from '@/utils/auth-validation';
import { ApiClientError } from '@/services/api';
import { CheckCircle2, AlertOctagon, ArrowLeft } from 'lucide-react';

export function ResetPasswordPage() {
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Extract token from either route param (:token) or query string (?token=...)
  const token = useMemo(() => {
    return params.token || searchParams.get('token') || '';
  }, [params.token, searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      token,
      newPassword: '',
      confirmPassword: '',
    },
    values: {
      token,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setServerError(null);
    try {
      await authService.resetPassword({
        token: data.token,
        newPassword: data.newPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Invalid or expired reset token. Please request a new password reset link.');
      }
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
          <AlertOctagon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F2]">Missing Reset Token</h2>
          <p className="text-xs text-[#A3ADA0] mt-2 leading-relaxed max-w-sm mx-auto">
            This password reset link is incomplete or invalid. Please request a new password reset link.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/forgot-password">
            <Button variant="primary" className="w-full">
              Request New Reset Link
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-12 h-12 rounded-full bg-[#C6F500]/10 text-[#C6F500] border border-[#C6F500]/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F2]">Password Reset Complete</h2>
          <p className="text-xs text-[#A3ADA0] mt-2 leading-relaxed max-w-sm mx-auto">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/login">
            <Button variant="primary" className="w-full">
              Proceed to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-xl font-bold text-[#F5F7F2] tracking-tight">Set new password</h2>
        <p className="text-xs text-[#A3ADA0] mt-1">
          Create a strong password for your SkillOrbit AI account
        </p>
      </div>

      {serverError && (
        <div className="space-y-3">
          <Alert variant="error" onDismiss={() => setServerError(null)}>
            {serverError}
          </Alert>
          <div className="text-left text-xs">
            <Link to="/forgot-password" className="text-[#C6F500] hover:underline font-semibold">
              &rarr; Request a new reset link
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Hidden token field tracked by form */}
        <input type="hidden" {...register('token')} />

        <Input
          label="New Password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          showPasswordToggle
          disabled={isSubmitting}
          helperText="At least 8 characters"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          showPasswordToggle
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isSubmitting}>
          Update Password
        </Button>
      </form>

      <div className="text-center pt-2 border-t border-[#303A2B]">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-[#A3ADA0] hover:text-[#F5F7F2] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default ResetPasswordPage;

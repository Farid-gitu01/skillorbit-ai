import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button, Input, Alert } from '@/components/ui';
import { forgotPasswordFormSchema, type ForgotPasswordFormData } from '@/utils/auth-validation';
import { ApiClientError } from '@/services/api';
import { MailCheck, ArrowLeft } from 'lucide-react';

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; resetToken?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setServerError(null);
    try {
      const result = await authService.forgotPassword({ email: data.email });
      setSuccessInfo(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Unable to process password reset request. Please try again later.');
      }
    }
  };

  if (successInfo) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-12 h-12 rounded-full bg-[#C6F500]/10 text-[#C6F500] border border-[#C6F500]/30 flex items-center justify-center mx-auto">
          <MailCheck className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F2]">Check your email</h2>
          <p className="text-xs text-[#A3ADA0] mt-2 leading-relaxed max-w-sm mx-auto">
            {successInfo.message}
          </p>
        </div>

        {/* Development mode delivery aid if returned by backend */}
        {successInfo.resetToken && (
          <div className="p-3 bg-[#111611] border border-[#303A2B] rounded-btn text-left space-y-1 text-xs">
            <span className="text-[#C6F500] font-semibold block">Dev Test Helper:</span>
            <span className="text-[#A3ADA0] break-all font-mono text-[11px]">
              {successInfo.resetToken}
            </span>
            <div className="pt-1">
              <Link
                to={`/reset-password?token=${encodeURIComponent(successInfo.resetToken)}`}
                className="text-[#C6F500] hover:underline font-semibold inline-block"
              >
                Proceed to Reset Form &rarr;
              </Link>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-[#C6F500] hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-xl font-bold text-[#F5F7F2] tracking-tight">Reset password</h2>
        <p className="text-xs text-[#A3ADA0] mt-1">
          Enter your account email to receive a password recovery link
        </p>
      </div>

      {serverError && (
        <Alert variant="error" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Account Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isSubmitting}>
          Send Reset Link
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

export default ForgotPasswordPage;

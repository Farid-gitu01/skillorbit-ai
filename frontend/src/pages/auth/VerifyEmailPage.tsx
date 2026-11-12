import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { authService } from '@/services/auth.service';
import { Button, Input, Alert } from '@/components/ui';
import { resendVerificationFormSchema, type ResendVerificationFormData } from '@/utils/auth-validation';
import { ApiClientError } from '@/services/api';
import { CheckCircle2, AlertCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';

export function VerifyEmailPage() {
  const params = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();

  const token = useMemo(() => {
    return params.token || searchParams.get('token') || '';
  }, [params.token, searchParams]);

  const [isVerifying, setIsVerifying] = useState<boolean>(Boolean(token));
  const [verificationSuccess, setVerificationSuccess] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const [resendSuccess, setResendSuccess] = useState<{ message: string; verificationToken?: string } | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors: resendFormErrors, isSubmitting: isResending },
  } = useForm<ResendVerificationFormData>({
    resolver: zodResolver(resendVerificationFormSchema),
    defaultValues: { email: '' },
  });

  // Attempt verification on mount if token is present
  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    async function executeVerification() {
      setIsVerifying(true);
      setVerificationError(null);
      try {
        await authService.verifyEmail({ token });
        if (isMounted) {
          setVerificationSuccess(true);
        }
      } catch (err) {
        if (isMounted) {
          if (err instanceof ApiClientError) {
            setVerificationError(err.message);
          } else {
            setVerificationError('Invalid or expired verification link. Please request a new verification link below.');
          }
        }
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    void executeVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const onResendSubmit = async (data: ResendVerificationFormData) => {
    setResendError(null);
    setResendSuccess(null);
    try {
      const result = await authService.resendVerificationEmail({ email: data.email });
      setResendSuccess(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setResendError(err.message);
      } else {
        setResendError('Unable to resend verification email. Please try again later.');
      }
    }
  };

  // State 1: Verifying active token
  if (isVerifying) {
    return (
      <div className="text-center space-y-4 py-6">
        <Loader2 className="w-8 h-8 text-brand-blue animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-surface-white">Verifying email...</h2>
        <p className="text-xs text-muted-slate">
          Please wait while we confirm your email verification token with the server.
        </p>
      </div>
    );
  }

  // State 2: Verification Successful
  if (verificationSuccess) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-surface-white">Email Verified!</h2>
          <p className="text-xs text-muted-slate mt-2 leading-relaxed max-w-sm mx-auto">
            Your email address has been successfully verified. Your account is fully active.
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

  // State 3: Missing Token or Verification Error -> Offer Resend
  return (
    <div className="space-y-6">
      <div className="text-left">
        <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-surface-white tracking-tight">
          {verificationError ? 'Verification Failed' : 'Verify Your Email'}
        </h2>
        <p className="text-xs text-muted-slate mt-1">
          {verificationError ?? 'Enter your email address to receive a new account verification link.'}
        </p>
      </div>

      {resendError && (
        <Alert variant="error" onDismiss={() => setResendError(null)}>
          {resendError}
        </Alert>
      )}

      {resendSuccess ? (
        <div className="space-y-4 pt-2">
          <Alert variant="success">
            {resendSuccess.message}
          </Alert>

          {resendSuccess.verificationToken && (
            <div className="p-3 bg-navy-surface border border-slate-700 rounded-btn text-left space-y-1 text-xs">
              <span className="text-amber-400 font-semibold block">Dev Test Helper:</span>
              <span className="text-muted-slate break-all font-mono text-[11px]">
                {resendSuccess.verificationToken}
              </span>
              <div className="pt-1">
                <Link
                  to={`/verify-email?token=${encodeURIComponent(resendSuccess.verificationToken)}`}
                  className="text-brand-cyan hover:underline font-medium inline-block"
                >
                  Verify With Token &rarr;
                </Link>
              </div>
            </div>
          )}

          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs text-brand-cyan hover:underline font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onResendSubmit)} className="space-y-4" noValidate>
          <Input
            label="Account Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isResending}
            prefixIcon={<Mail className="w-4 h-4" />}
            error={resendFormErrors.email?.message}
            {...register('email')}
          />

          <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isResending}>
            Resend Verification Email
          </Button>
        </form>
      )}

      <div className="text-center pt-2 border-t border-navy-surface">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-slate hover:text-surface-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default VerifyEmailPage;

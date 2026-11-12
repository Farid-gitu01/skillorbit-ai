import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Alert } from '@/components/ui';
import { loginFormSchema, type LoginFormData } from '@/utils/auth-validation';
import { ApiClientError } from '@/services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  // If already logged in, redirect immediately to intended page or role dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const target = from && from !== '/login' ? from : `/${user.role}/dashboard`;
      navigate(target, { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate, location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const authenticatedUser = await login({
        email: data.email,
        password: data.password,
      });

      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const target = from && from !== '/login' ? from : `/${authenticatedUser.role}/dashboard`;
      navigate(target, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('Invalid email or password. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-xl font-bold text-surface-white tracking-tight">Welcome back</h2>
        <p className="text-xs text-muted-slate mt-1">
          Sign in to access your SkillOrbit AI dashboard
        </p>
      </div>

      {serverError && (
        <Alert variant="error" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            showPasswordToggle
            disabled={isSubmitting}
            error={errors.password?.message}
            {...register('password')}
          />
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-xs text-brand-cyan hover:underline select-none"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isSubmitting}>
          Sign In
        </Button>
      </form>

      <div className="text-center text-xs text-muted-slate pt-2 border-t border-navy-surface">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-brand-cyan hover:underline">
          Create Account
        </Link>
      </div>
    </div>
  );
}

export default LoginPage;

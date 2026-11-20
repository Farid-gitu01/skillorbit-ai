import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button, Input, Select, Alert } from '@/components/ui';
import { registerFormSchema, type RegisterFormData } from '@/utils/auth-validation';
import { ApiClientError } from '@/services/api';
import { CheckCircle2 } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; role: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'seeker',
      acceptTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const result = await registerUser({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        role: data.role,
      });

      setSuccessInfo({
        message: result.message,
        role: result.user.role,
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred during registration. Please try again.');
      }
    }
  };

  if (successInfo) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="w-12 h-12 rounded-full bg-[#C6F500]/10 text-[#C6F500] border border-[#C6F500]/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#F5F7F2]">Account Created!</h2>
          <p className="text-xs text-[#A3ADA0] mt-2 leading-relaxed max-w-sm mx-auto">
            {successInfo.message}
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => navigate(`/${successInfo.role}/dashboard`)}
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h2 className="text-xl font-bold text-[#F5F7F2] tracking-tight">Create your account</h2>
        <p className="text-xs text-[#A3ADA0] mt-1">
          Join SkillOrbit AI to accelerate your career and development
        </p>
      </div>

      {serverError && (
        <Alert variant="error" onDismiss={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Full Name"
          placeholder="Jane Doe"
          autoComplete="name"
          disabled={isSubmitting}
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          {...register('email')}
        />

        <Select
          label="I am joining as"
          disabled={isSubmitting}
          error={errors.role?.message}
          options={[
            { value: 'seeker', label: 'Job Seeker (Explore careers, jobs & training)' },
            { value: 'employer', label: 'Employer (Hire talent & post opportunities)' },
            { value: 'provider', label: 'Training Provider (Deliver courses & certifications)' },
          ]}
          {...register('role')}
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          showPasswordToggle
          disabled={isSubmitting}
          helperText="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          showPasswordToggle
          disabled={isSubmitting}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="flex items-start gap-2.5 pt-1 text-left">
          <input
            id="acceptTerms"
            type="checkbox"
            disabled={isSubmitting}
            className="mt-0.5 rounded border-[#303A2B] bg-[#111611] text-[#C6F500] focus:ring-[#C6F500]"
            {...register('acceptTerms')}
          />
          <label htmlFor="acceptTerms" className="text-xs text-[#A3ADA0] select-none leading-relaxed">
            I agree to the{' '}
            <span className="text-[#C6F500] hover:underline cursor-pointer font-medium">Terms of Service</span> and{' '}
            <span className="text-[#C6F500] hover:underline cursor-pointer font-medium">Privacy Policy</span>.
          </label>
        </div>
        {errors.acceptTerms && (
          <p className="text-xs text-red-400 text-left font-medium">{errors.acceptTerms.message}</p>
        )}

        <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isSubmitting}>
          Create Account
        </Button>
      </form>

      <div className="text-center text-xs text-[#A3ADA0] pt-2 border-t border-[#303A2B]">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-[#C6F500] hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}

export default RegisterPage;

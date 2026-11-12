import { api } from './api';
import type { ApiResponse } from '@/types/api.types';
import type { User } from '@/types/user.types';
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  ResendVerificationPayload,
  VerifyEmailPayload,
} from '@/types/auth.types';

/**
 * SkillOrbit AI Authentication API Service
 *
 * Direct integration with backend /api/auth and /api/users endpoints.
 * Relies strictly on HttpOnly cookie session management (skillorbit_access).
 */
export const authService = {
  /**
   * Register a new user account (seeker, employer, or provider).
   * Backend endpoint: POST /api/auth/register
   */
  async register(payload: RegisterPayload): Promise<{ user: User; message: string; verificationToken?: string }> {
    const response = await api.post<ApiResponse<{ user: User; verificationToken?: string }>>('/auth/register', payload);
    return {
      user: response.data.data.user,
      message: response.data.message ?? 'Registration successful',
      verificationToken: response.data.data.verificationToken,
    };
  },

  /**
   * Authenticate with email and password.
   * Backend endpoint: POST /api/auth/login
   */
  async login(payload: LoginPayload): Promise<User> {
    const response = await api.post<ApiResponse<{ user: User }>>('/auth/login', payload);
    return response.data.data.user;
  },

  /**
   * Fetch current authenticated user session using HttpOnly cookie.
   * Backend endpoint: GET /api/users/me
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<ApiResponse<{ user: User }>>('/users/me');
    return response.data.data.user;
  },

  /**
   * Terminate session and instruct backend to clear HttpOnly cookie.
   * Backend endpoint: POST /api/auth/logout
   */
  async logout(): Promise<void> {
    await api.post<ApiResponse<void>>('/auth/logout');
  },

  /**
   * Request password reset email.
   * Backend endpoint: POST /api/auth/forgot-password
   */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string; resetToken?: string }> {
    const response = await api.post<ApiResponse<{ resetToken?: string }>>('/auth/forgot-password', payload);
    return {
      message: response.data.message ?? 'If an account exists, reset instructions can be sent.',
      resetToken: response.data.data?.resetToken,
    };
  },

  /**
   * Confirm password reset with 64-char hex token.
   * Backend endpoint: POST /api/auth/reset-password
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
    const response = await api.post<ApiResponse<void>>('/auth/reset-password', payload);
    return {
      message: response.data.message ?? 'Password has been reset successfully',
    };
  },

  /**
   * Verify email address with 64-char hex token.
   * Backend endpoint: POST /api/auth/verify-email
   */
  async verifyEmail(payload: VerifyEmailPayload): Promise<{ message: string }> {
    const response = await api.post<ApiResponse<void>>('/auth/verify-email', payload);
    return {
      message: response.data.message ?? 'Email verified successfully',
    };
  },

  /**
   * Request resending account verification email.
   * Backend endpoint: POST /api/auth/resend-verification
   */
  async resendVerificationEmail(payload: ResendVerificationPayload): Promise<{ message: string; verificationToken?: string }> {
    const response = await api.post<ApiResponse<{ verificationToken?: string }>>('/auth/resend-verification', payload);
    return {
      message: response.data.message ?? 'If the account requires verification, instructions can be sent.',
      verificationToken: response.data.data?.verificationToken,
    };
  },
};

export default authService;

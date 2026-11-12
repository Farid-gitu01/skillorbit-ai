import type { User, UserRole } from './user.types';

/**
 * Payload sent to POST /api/auth/register (strict)
 */
export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'admin'>;
}

/**
 * Payload sent to POST /api/auth/login (strict)
 */
export interface LoginPayload {
  email: string;
  password: string;
}

/**
 * Payload sent to POST /api/auth/forgot-password (strict)
 */
export interface ForgotPasswordPayload {
  email: string;
}

/**
 * Payload sent to POST /api/auth/reset-password (strict)
 */
export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

/**
 * Payload sent to POST /api/auth/verify-email (strict)
 */
export interface VerifyEmailPayload {
  token: string;
}

/**
 * Payload sent to POST /api/auth/resend-verification (strict)
 */
export interface ResendVerificationPayload {
  email: string;
}

/**
 * Context value exposed by AuthContext
 */
export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<{ user: User; message: string; verificationToken?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  clearError: () => void;
}

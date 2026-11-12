/**
 * User roles supported by SkillOrbit AI
 */
export type UserRole = 'seeker' | 'employer' | 'provider' | 'admin';

/**
 * Platform user profile returned by the backend authentication endpoints
 */
export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
  isEmailVerified?: boolean;
  avatar?: string;
}

/**
 * Frontend authentication state representation
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

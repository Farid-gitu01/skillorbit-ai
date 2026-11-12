import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AuthContext } from './auth-context.base';
import { authService } from '@/services/auth.service';
import { normalizeApiError } from '@/services/api';
import type { User } from '@/types/user.types';
import type { AuthContextValue, LoginPayload, RegisterPayload } from '@/types/auth.types';

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — Manages application-wide authentication state and HttpOnly cookie sessions.
 *
 * Automatically restores active session from backend GET /api/users/me on initial mount.
 * Never stores JWT tokens in localStorage or sessionStorage.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // Initial session restoration on application startup
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const currentUser = await authService.getCurrentUser();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<User> => {
    setError(null);
    try {
      const authenticatedUser = await authService.login(payload);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      throw normalized;
    }
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload): Promise<{ user: User; message: string; verificationToken?: string }> => {
      setError(null);
      try {
        const result = await authService.register(payload);
        setUser(result.user);
        return result;
      } catch (err) {
        const normalized = normalizeApiError(err);
        setError(normalized.message);
        throw normalized;
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      await authService.logout();
    } catch {
      // Swallowed safely to guarantee frontend state termination even if offline
    } finally {
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

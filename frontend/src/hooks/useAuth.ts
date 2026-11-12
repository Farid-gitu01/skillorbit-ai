import { useContext } from 'react';
import { AuthContext } from '@/context/auth-context.base';
import type { AuthContextValue } from '@/types/auth.types';

/**
 * useAuth — Custom hook to access authentication state and operations.
 * Must be used within an <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;

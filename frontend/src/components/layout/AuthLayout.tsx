import { Outlet } from 'react-router-dom';

/**
 * AuthLayout — Minimal centered layout for login, register, and password reset screens.
 */
export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-midnight-navy text-surface-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-brand-blue">SkillOrbit AI</h1>
          <p className="text-sm text-muted-slate mt-1">
            AI-Powered Career Development & Opportunity Platform
          </p>
        </div>
        <div className="bg-navy border border-navy-surface rounded-card p-6 md:p-8 shadow-card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;

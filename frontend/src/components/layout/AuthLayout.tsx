import { Outlet, Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common';

/**
 * AuthLayout — Internal authentication layout using Theme B (Black + Lime).
 * Renders the official SkillOrbit AI logo with high-contrast dark palette.
 */
export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#090B09] text-[#F5F7F2] selection:bg-[#C6F500]/20 selection:text-[#C6F500]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
            <BrandLogo variant="dark" size="lg" subtitle="Career Development Platform" />
          </Link>
        </div>
        <div className="bg-[#171D17] border border-[#303A2B] rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;

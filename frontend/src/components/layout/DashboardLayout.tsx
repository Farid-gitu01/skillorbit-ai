import { Outlet } from 'react-router-dom';
import type { UserRole } from '@/types/user.types';

export interface DashboardLayoutProps {
  role?: UserRole;
}

/**
 * DashboardLayout — Minimal role-aware authenticated dashboard shell.
 * Organizes sidebar slot, top bar slot, and main content area.
 */
export function DashboardLayout({ role }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex bg-midnight-navy text-surface-white">
      {/* Sidebar shell slot */}
      <aside className="w-64 border-r border-navy-surface bg-navy hidden md:flex flex-col p-4">
        <div className="font-bold text-lg text-brand-blue mb-8 tracking-wide">
          SkillOrbit AI
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-slate mb-4 font-semibold">
          {role ? `${role} Portal` : 'Portal'}
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar slot */}
        <header className="h-16 border-b border-navy-surface bg-navy/60 px-6 flex items-center justify-between">
          <div className="text-sm font-medium text-muted-slate">
            {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard` : 'Dashboard'}
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;

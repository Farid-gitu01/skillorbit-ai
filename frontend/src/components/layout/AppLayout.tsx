import { Outlet } from 'react-router-dom';

/**
 * AppLayout — Minimal public/general application layout shell.
 * Provides header, main content slot, and footer container.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-midnight-navy text-surface-white">
      <header className="border-b border-navy-surface py-4 px-6 bg-navy/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="font-bold text-lg tracking-wide text-brand-blue">SkillOrbit AI</span>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        <Outlet />
      </main>
      <footer className="border-t border-navy-surface py-4 px-6 text-center text-sm text-muted-slate bg-navy/30">
        <p>&copy; {new Date().getFullYear()} SkillOrbit AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default AppLayout;

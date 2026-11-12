import { useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/user.types';
import {
  Activity,
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui';

export interface DashboardLayoutProps {
  role?: UserRole;
}

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
}

const SEEKER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/seeker/dashboard', icon: LayoutDashboard },
  { label: 'Profile', to: '/seeker/profile', icon: UserIcon },
  { label: 'Resumes', to: '/seeker/resume', icon: FileText },
  { label: 'Find Jobs', to: '/seeker/jobs', icon: Search },
  { label: 'Applications', to: '/seeker/applications', icon: Briefcase },
  { label: 'Saved Jobs', to: '/seeker/saved-jobs', icon: Bookmark },
  { label: 'Notifications', to: '/seeker/notifications', icon: Bell },
];

const EMPLOYER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/employer/dashboard', icon: LayoutDashboard },
  { label: 'Organization', to: '/employer/organization', icon: Building2 },
  { label: 'Manage Jobs', to: '/employer/jobs', icon: Briefcase },
  { label: 'Applications', to: '/employer/applications', icon: FileText },
  { label: 'Candidates', to: '/employer/candidates', icon: Users },
  { label: 'Notifications', to: '/employer/notifications', icon: Bell },
];

const PROVIDER_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/provider/dashboard', icon: LayoutDashboard },
  { label: 'Provider Profile', to: '/provider/profile', icon: GraduationCap },
  { label: 'Offerings', to: '/provider/courses', icon: BookOpen },
  { label: 'Enrollments', to: '/provider/engagements', icon: Users },
  { label: 'Notifications', to: '/provider/notifications', icon: Bell },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Employers', to: '/admin/employers', icon: Building2 },
  { label: 'Providers', to: '/admin/providers', icon: GraduationCap },
  { label: 'Verifications', to: '/admin/verifications', icon: ShieldCheck },
  { label: 'Jobs', to: '/admin/jobs', icon: Briefcase },
  { label: 'Courses', to: '/admin/courses', icon: BookOpen },
  { label: 'Audit Logs', to: '/admin/audit-logs', icon: Activity },
  { label: 'Notifications', to: '/admin/notifications', icon: Bell },
];

/**
 * DashboardLayout — Role-aware authenticated dashboard shell.
 * Connects directly to AuthContext to display navigation, user identity, and handle logout.
 */
export function DashboardLayout({ role }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeRole = role ?? user?.role;
  const navItems =
    activeRole === 'seeker'
      ? SEEKER_NAV_ITEMS
      : activeRole === 'employer'
        ? EMPLOYER_NAV_ITEMS
        : activeRole === 'provider'
          ? PROVIDER_NAV_ITEMS
          : activeRole === 'admin'
            ? ADMIN_NAV_ITEMS
            : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-midnight-navy text-surface-white">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-navy-surface bg-navy hidden md:flex flex-col p-4 justify-between shrink-0">
        <div>
          <Link to="/" className="block font-bold text-lg text-brand-blue mb-6 tracking-wide">
            SkillOrbit AI
          </Link>
          <div className="text-[11px] uppercase tracking-wider text-muted-slate mb-3 px-2 font-semibold">
            {activeRole ? `${activeRole} Portal` : 'Portal'}
          </div>

          {navItems.length > 0 && (
            <nav className="space-y-1" aria-label="Portal Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-btn text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-blue text-white shadow-sm'
                          : 'text-muted-slate hover:text-surface-white hover:bg-navy-surface/70'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          )}
        </div>

        {/* User Card in Sidebar */}
        <div className="pt-4 border-t border-navy-surface space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-blue/20 text-brand-cyan flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
            <div className="overflow-hidden text-left">
              <p className="text-xs font-semibold text-surface-white truncate">{user?.name ?? 'User'}</p>
              <p className="text-[11px] text-muted-slate truncate">{user?.email ?? ''}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full text-xs justify-start gap-2 border-slate-700 hover:border-red-500/50 hover:text-red-400"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="h-16 border-b border-navy-surface bg-navy/60 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-3">
            {navItems.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden p-1.5 rounded-md text-muted-slate hover:text-surface-white hover:bg-navy-surface"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
            <div className="text-sm font-medium text-surface-white capitalize">
              {activeRole ? `${activeRole} Workspace` : 'Dashboard'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(activeRole === 'seeker' ||
              activeRole === 'employer' ||
              activeRole === 'provider' ||
              activeRole === 'admin') && (
              <Link
                to={
                  activeRole === 'employer'
                    ? '/employer/notifications'
                    : activeRole === 'provider'
                      ? '/provider/notifications'
                      : activeRole === 'admin'
                        ? '/admin/notifications'
                        : '/seeker/notifications'
                }
                className="p-2 rounded-full text-muted-slate hover:text-surface-white hover:bg-navy-surface transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </Link>
            )}
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-xs text-muted-slate truncate max-w-[100px]">{user?.name}</span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign Out"
                className="p-1.5 text-muted-slate hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && navItems.length > 0 && (
          <div className="md:hidden border-b border-navy-surface bg-navy px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-btn text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-blue text-white'
                        : 'text-muted-slate hover:text-surface-white hover:bg-navy-surface'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Content area */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;

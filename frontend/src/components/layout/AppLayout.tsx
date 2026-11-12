import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';

/**
 * AppLayout — Public application layout shell.
 * Includes header with auth-aware navigation, main slot, and footer.
 */
export function AppLayout() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-midnight-navy text-surface-white">
      <header className="border-b border-navy-surface py-3.5 px-4 md:px-6 bg-navy/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-bold text-lg tracking-wide text-brand-blue flex items-center gap-2">
            <span>SkillOrbit AI</span>
          </Link>

          <nav className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                <Link
                  to={`/${user.role}/dashboard`}
                  className="text-xs md:text-sm font-medium text-surface-white hover:text-brand-cyan transition-colors"
                >
                  Dashboard
                </Link>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        <Outlet />
      </main>
      <footer className="border-t border-navy-surface py-4 px-6 text-center text-xs text-muted-slate bg-navy/30">
        <p>&copy; {new Date().getFullYear()} SkillOrbit AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default AppLayout;

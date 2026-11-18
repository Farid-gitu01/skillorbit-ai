import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import { Menu, X, Sparkles, ArrowRight, UserCheck } from 'lucide-react';

interface NavItem {
  label: string;
  id: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', id: 'home' },
  { label: 'About Us', id: 'about' },
  { label: 'Services', id: 'services' },
  { label: 'Testimonials', id: 'testimonials' },
  { label: 'Contact Us', id: 'contact' },
];

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeSection, setActiveSection] = useState<string>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll listener to update sticky header visual depth
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Active section spy using IntersectionObserver
  useEffect(() => {
    if (location.pathname !== '/') return;

    const sectionIds = NAV_ITEMS.map((item) => item.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-30% 0px -60% 0px',
        threshold: 0,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [location.pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      setIsMobileMenuOpen(false);

      if (location.pathname !== '/') {
        navigate(`/#${sectionId}`);
        return;
      }

      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', `#${sectionId}`);
        setActiveSection(sectionId);
      }
    },
    [location.pathname, navigate]
  );

  const handleSignOut = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-midnight-navy/95 backdrop-blur-md border-b border-navy-surface shadow-card'
          : 'bg-midnight-navy/80 backdrop-blur-sm border-b border-navy-surface/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo & Branding */}
          <button
            onClick={() => scrollToSection('home')}
            className="flex items-center gap-2.5 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-md p-1"
            aria-label="SkillOrbit AI Home"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-blue via-brand-purple to-brand-cyan flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg md:text-xl tracking-tight text-surface-white">
                Skill<span className="text-brand-cyan">Orbit</span>{' '}
                <span className="text-brand-blue font-bold">AI</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-slate font-semibold hidden sm:inline-block">
                Career Intelligence Platform
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-3.5 py-2 text-sm font-medium rounded-md transition-all duration-200 relative ${
                    isActive
                      ? 'text-brand-cyan font-semibold bg-brand-cyan/10'
                      : 'text-slate-300 hover:text-surface-white hover:bg-navy-surface/50'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-brand-cyan rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop Auth CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link to={`/${user.role}/dashboard`}>
                  <Button variant="outline" size="sm" className="gap-2 border-brand-blue/40 text-brand-cyan hover:border-brand-blue">
                    <UserCheck className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm" className="gap-1.5 shadow-sm">
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
              aria-expanded={isMobileMenuOpen}
              className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-navy-surface focus:outline-none focus:ring-2 focus:ring-brand-blue"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-navy-surface bg-midnight-navy/98 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 pt-3 pb-6 space-y-2">
            <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-blue/15 text-brand-cyan font-semibold border-l-4 border-brand-cyan'
                        : 'text-slate-300 hover:text-white hover:bg-navy-surface/60'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-navy-surface/80 flex flex-col gap-2.5">
              {isAuthenticated && user ? (
                <>
                  <Link
                    to={`/${user.role}/dashboard`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full"
                  >
                    <Button variant="primary" size="md" className="w-full gap-2">
                      <UserCheck className="w-4 h-4" />
                      <span>Go to Dashboard</span>
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleSignOut}
                    className="w-full"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full"
                  >
                    <Button variant="outline" size="md" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full"
                  >
                    <Button variant="primary" size="md" className="w-full gap-2">
                      <span>Get Started Free</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;

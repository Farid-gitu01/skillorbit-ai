import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BrandLogo } from '@/components/common';
import { Mail, Shield, ArrowUp } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const scrollToSection = (sectionId: string) => {
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', `#${sectionId}`);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className="bg-[#070707] border-t border-neutral-800/90 pt-16 pb-12 text-neutral-400 relative"
      aria-label="SkillOrbit AI Footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-neutral-800/80">
          {/* Column 1: Brand & Overview (4 cols) */}
          <div className="lg:col-span-4 space-y-4 text-left">
            <button
              onClick={scrollToTop}
              className="flex items-center group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded-lg p-1"
              aria-label="SkillOrbit AI - Scroll to top"
            >
              <BrandLogo variant="yellow" size="md" />
            </button>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              AI-powered Career Development & Opportunity Platform. Empowering candidates,
              employers, and training providers with intelligent resume audits, precision skill gap
              diagnostics, and automated learning roadmaps.
            </p>
            <div className="flex items-center gap-2 text-xs text-yellow-400 font-semibold pt-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span>Platform Core Status: Operational</span>
            </div>
          </div>

          {/* Column 2: Navigation Links (2 cols) */}
          <div className="lg:col-span-2 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => scrollToSection('home')}
                  className="hover:text-yellow-400 transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('about')}
                  className="hover:text-yellow-400 transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-yellow-400 transition-colors"
                >
                  Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('testimonials')}
                  className="hover:text-yellow-400 transition-colors"
                >
                  Testimonials
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="hover:text-yellow-400 transition-colors"
                >
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Services (3 cols) */}
          <div className="lg:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Core Capabilities
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                {isAuthenticated ? (
                  <Link to="/seeker/ai/resume" className="hover:text-yellow-400 transition-colors text-left block">
                    AI Resume Analysis
                  </Link>
                ) : (
                  <button
                    onClick={() => scrollToSection('services')}
                    className="hover:text-yellow-400 transition-colors text-left"
                  >
                    AI Resume Analysis
                  </button>
                )}
              </li>
              <li>
                {isAuthenticated ? (
                  <Link to="/seeker/ai/skill-gap" className="hover:text-yellow-400 transition-colors text-left block">
                    Skill Gap Diagnostics
                  </Link>
                ) : (
                  <button
                    onClick={() => scrollToSection('services')}
                    className="hover:text-yellow-400 transition-colors text-left"
                  >
                    Skill Gap Diagnostics
                  </button>
                )}
              </li>
              <li>
                {isAuthenticated ? (
                  <Link to="/seeker/ai/skill-gap" className="hover:text-yellow-400 transition-colors text-left block">
                    Personalized Roadmaps
                  </Link>
                ) : (
                  <button
                    onClick={() => scrollToSection('services')}
                    className="hover:text-yellow-400 transition-colors text-left"
                  >
                    Personalized Roadmaps
                  </button>
                )}
              </li>
              <li>
                {isAuthenticated ? (
                  <Link to="/seeker/ai/job-matches" className="hover:text-yellow-400 transition-colors text-left block">
                    Semantic Job Matching
                  </Link>
                ) : (
                  <button
                    onClick={() => scrollToSection('services')}
                    className="hover:text-yellow-400 transition-colors text-left"
                  >
                    Semantic Job Matching
                  </button>
                )}
              </li>
              <li>
                {isAuthenticated ? (
                  <Link to="/seeker/ai/assistant" className="hover:text-yellow-400 transition-colors text-left block">
                    AI Career Assistant
                  </Link>
                ) : (
                  <button
                    onClick={() => scrollToSection('services')}
                    className="hover:text-yellow-400 transition-colors text-left"
                  >
                    AI Career Assistant
                  </button>
                )}
              </li>
            </ul>
          </div>

          {/* Column 4: Account Portals & Contact (3 cols) */}
          <div className="lg:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Role Access & Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/login" className="hover:text-yellow-400 transition-colors">
                  Job Seeker Portal
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-yellow-400 transition-colors">
                  Employer Recruitment
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-yellow-400 transition-colors">
                  Training Provider Portal
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-yellow-400 font-semibold hover:underline">
                  Create Free Account →
                </Link>
              </li>
              <li className="pt-2 flex items-center gap-1.5 text-neutral-400">
                <Mail className="w-3.5 h-3.5 text-yellow-400" />
                <a
                  href="mailto:support@skillorbit.ai"
                  className="hover:text-yellow-300 transition-colors"
                >
                  support@skillorbit.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>&copy; {currentYear} SkillOrbit AI. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1 text-neutral-400">
              <Shield className="w-3.5 h-3.5 text-yellow-400" />
              <span>Standard Session Security & Data Protection</span>
            </span>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-lg bg-[#111111] hover:bg-[#1A1A1A] border border-neutral-800 text-neutral-300 hover:text-white transition-colors flex items-center gap-1 shadow-sm"
              aria-label="Back to top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span className="text-[11px]">Top</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

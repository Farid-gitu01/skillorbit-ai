import { Link } from 'react-router-dom';
import { Sparkles, Mail, Shield, ArrowUp } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const scrollToSection = (sectionId: string) => {
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
      className="bg-midnight-navy border-t border-navy-surface pt-16 pb-12 text-slate-300 relative"
      aria-label="SkillOrbit AI Footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-navy-surface/80">
          {/* Column 1: Brand & Overview (4 cols) */}
          <div className="lg:col-span-4 space-y-4 text-left">
            <button
              onClick={scrollToTop}
              className="flex items-center gap-2.5 group text-left focus:outline-none"
              aria-label="SkillOrbit AI - Scroll to top"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-blue to-brand-cyan flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-surface-white">
                Skill<span className="text-brand-cyan">Orbit</span>{' '}
                <span className="text-brand-blue">AI</span>
              </span>
            </button>
            <p className="text-xs sm:text-sm text-muted-slate leading-relaxed">
              AI-powered Career Development & Opportunity Platform. Empowering candidates,
              employers, and training providers with intelligent resume audits, precision skill gap
              diagnostics, and automated learning roadmaps.
            </p>
            <div className="flex items-center gap-2 text-xs text-brand-cyan font-medium pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Platform Core Status: Operational</span>
            </div>
          </div>

          {/* Column 2: Navigation Links (2 cols) */}
          <div className="lg:col-span-2 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-white">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => scrollToSection('home')}
                  className="hover:text-brand-cyan transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('about')}
                  className="hover:text-brand-cyan transition-colors"
                >
                  About Us
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-brand-cyan transition-colors"
                >
                  Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('testimonials')}
                  className="hover:text-brand-cyan transition-colors"
                >
                  Testimonials
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('contact')}
                  className="hover:text-brand-cyan transition-colors"
                >
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Services (3 cols) */}
          <div className="lg:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-white">
              Core Capabilities
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-brand-cyan transition-colors text-left"
                >
                  AI Resume Analysis
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-brand-cyan transition-colors text-left"
                >
                  Skill Gap Diagnostics
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-brand-cyan transition-colors text-left"
                >
                  Personalized Roadmaps
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-brand-cyan transition-colors text-left"
                >
                  Semantic Job Matching
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('services')}
                  className="hover:text-brand-cyan transition-colors text-left"
                >
                  AI Career Assistant
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Account Portals & Contact (3 cols) */}
          <div className="lg:col-span-3 space-y-3 text-left">
            <h4 className="text-xs font-bold uppercase tracking-wider text-surface-white">
              Role Access & Support
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/login" className="hover:text-brand-cyan transition-colors">
                  Job Seeker Portal
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-brand-cyan transition-colors">
                  Employer Recruitment
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-brand-cyan transition-colors">
                  Training Provider Portal
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-brand-cyan font-medium hover:underline">
                  Create Free Account →
                </Link>
              </li>
              <li className="pt-2 flex items-center gap-1.5 text-muted-slate">
                <Mail className="w-3.5 h-3.5 text-brand-blue" />
                <a
                  href="mailto:support@skillorbit.ai"
                  className="hover:text-surface-white transition-colors"
                >
                  support@skillorbit.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-slate">
          <p>&copy; {currentYear} SkillOrbit AI. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Standard Session Security & Data Protection</span>
            </span>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-lg bg-navy/60 hover:bg-navy-surface text-slate-300 hover:text-white transition-colors flex items-center gap-1"
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

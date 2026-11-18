import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  FileSearch,
  Compass,
  Cpu,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export function HeroSection() {
  const { isAuthenticated, user } = useAuth();

  const handleExploreServices = (e: React.MouseEvent) => {
    e.preventDefault();
    const servicesEl = document.getElementById('services');
    if (servicesEl) {
      servicesEl.scrollIntoView({ behavior: 'smooth' });
      window.history.pushState(null, '', '#services');
    }
  };

  const getStartedTarget = isAuthenticated && user ? `/${user.role}/dashboard` : '/register';

  return (
    <section
      id="home"
      className="relative pt-8 pb-16 md:pt-16 md:pb-24 overflow-hidden"
      aria-label="SkillOrbit AI Introduction"
    >
      {/* Background Decorative Ambient Glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[900px] h-[350px] md:h-[450px] bg-gradient-to-tr from-brand-blue/15 via-brand-purple/10 to-brand-cyan/15 blur-3xl pointer-events-none -z-10 rounded-full"
        aria-hidden="true"
      />
      <div
        className="absolute top-10 right-10 w-72 h-72 bg-brand-cyan/10 blur-2xl pointer-events-none -z-10 rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Mission, Heading & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-blue/10 border border-brand-blue/30 text-xs font-semibold text-brand-cyan tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-brand-cyan animate-pulse" />
              <span>Next-Generation Career Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-surface-white tracking-tight leading-[1.12]">
              Your Career.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-brand-cyan to-brand-purple">
                Your Opportunities.
              </span>{' '}
              One Intelligent Platform.
            </h1>

            {/* Supporting Description */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              SkillOrbit AI unifies career growth with actionable intelligence. Diagnostic
              resume auditing, precision skill gap identification, automated learning roadmaps,
              and high-affinity opportunity matching designed for the modern technology economy.
            </p>

            {/* Primary & Secondary Call to Actions */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
              <Link to={getStartedTarget}>
                <Button variant="primary" size="lg" className="gap-2 shadow-lg shadow-brand-blue/20">
                  <span>{isAuthenticated ? 'Enter Dashboard' : 'Get Started Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={handleExploreServices}
                className="gap-2 border-slate-700 hover:border-slate-500 text-surface-white bg-navy/40"
              >
                <Compass className="w-4 h-4 text-brand-cyan" />
                <span>Explore Services</span>
              </Button>
            </div>

            {/* Value Highlights */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-navy/40 border border-navy-surface/60">
                <FileSearch className="w-4 h-4 text-brand-cyan shrink-0" />
                <span className="text-xs font-medium text-slate-300">
                  AI ATS Resume Audit
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-navy/40 border border-navy-surface/60">
                <Cpu className="w-4 h-4 text-brand-blue shrink-0" />
                <span className="text-xs font-medium text-slate-300">
                  Dynamic Gap Roadmap
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-navy/40 border border-navy-surface/60">
                <ShieldCheck className="w-4 h-4 text-brand-purple shrink-0" />
                <span className="text-xs font-medium text-slate-300">
                  Semantic Job Matching
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Impact Visual Mockup */}
          <div className="lg:col-span-5 relative w-full flex justify-center">
            {/* Visual Glassmorphism Dashboard Preview Card */}
            <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-navy/90 to-midnight-navy/95 border border-navy-surface/90 shadow-2xl p-5 md:p-6 space-y-5 backdrop-blur-xl">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-navy-surface/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center font-bold text-brand-cyan">
                    SO
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-white">
                      AI Career Intelligence
                    </h3>
                    <p className="text-[11px] text-muted-slate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                      Live Analysis Engine
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  96% Fit Score
                </span>
              </div>

              {/* Match Diagnostics Metric */}
              <div className="bg-navy-surface/40 rounded-xl p-3.5 border border-navy-surface/60 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">ATS Resume Optimization</span>
                  <span className="text-brand-cyan font-bold">94 / 100</span>
                </div>
                <div className="w-full bg-midnight-navy h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-brand-blue to-brand-cyan h-full rounded-full w-[94%]" />
                </div>
                <div className="flex justify-between text-[10px] text-muted-slate pt-0.5">
                  <span>Impact Verbs: High</span>
                  <span>Keyword Sync: 92%</span>
                </div>
              </div>

              {/* Extracted Skills Visualization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Extracted Competencies
                  </span>
                  <span className="text-[10px] text-brand-cyan font-medium">5 Verified</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md text-xs bg-brand-blue/15 text-brand-blue border border-brand-blue/30 font-medium">
                    React 19 & TypeScript
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 font-medium">
                    Node.js & Express
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-brand-purple/15 text-brand-purple border border-brand-purple/30 font-medium">
                    MongoDB & Vector Search
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    System Architecture
                  </span>
                </div>
              </div>

              {/* Milestone Roadmap Snippet */}
              <div className="p-3 rounded-xl bg-navy/80 border border-brand-blue/20 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-blue/20 text-brand-cyan shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 text-left">
                  <h4 className="text-xs font-semibold text-surface-white">
                    Target Opportunity Roadmap
                  </h4>
                  <p className="text-[11px] text-muted-slate">
                    Step 3: Distributed Microservices & Event Streams
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium pt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Recommended Courses Mapped
                  </span>
                </div>
              </div>

              {/* Floating Bottom Card */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-slate border-t border-navy-surface/60">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-cyan" />
                  Opportunity Feed: Active
                </span>
                <span className="text-brand-blue font-medium hover:underline cursor-pointer">
                  View Insights →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

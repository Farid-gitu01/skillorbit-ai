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
      className="relative pt-8 pb-16 md:pt-16 md:pb-24 overflow-hidden bg-gradient-to-b from-[#0B0B0B] via-[#080808] to-[#080808]"
      aria-label="SkillOrbit AI Introduction"
    >
      {/* Background Decorative Ambient Glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[900px] h-[350px] md:h-[450px] bg-gradient-to-tr from-yellow-500/10 via-amber-500/10 to-yellow-400/10 blur-3xl pointer-events-none -z-10 rounded-full"
        aria-hidden="true"
      />
      <div
        className="absolute top-10 right-10 w-72 h-72 bg-yellow-400/5 blur-2xl pointer-events-none -z-10 rounded-full"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Mission, Heading & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-xs font-semibold text-yellow-400 tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
              <span>Next-Generation Career Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]">
              Your Career.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500">
                Your Opportunities.
              </span>{' '}
              One Intelligent Platform.
            </h1>

            {/* Supporting Description */}
            <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              SkillOrbit AI unifies career growth with actionable intelligence. Diagnostic
              resume auditing, precision skill gap identification, automated learning roadmaps,
              and high-affinity opportunity matching designed for the modern technology economy.
            </p>

            {/* Primary & Secondary Call to Actions */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 pt-2">
              <Link to={getStartedTarget}>
                <Button variant="yellow" size="lg" className="gap-2 shadow-lg shadow-yellow-500/25">
                  <span>{isAuthenticated ? 'Enter Dashboard' : 'Get Started Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="yellow-outline"
                size="lg"
                onClick={handleExploreServices}
                className="gap-2"
              >
                <Compass className="w-4 h-4 text-yellow-400" />
                <span>Explore Services</span>
              </Button>
            </div>

            {/* Value Highlights */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#111111] border border-neutral-800 shadow-sm hover:border-yellow-400/30 transition-colors">
                <FileSearch className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-xs font-semibold text-neutral-200">
                  AI ATS Resume Audit
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#111111] border border-neutral-800 shadow-sm hover:border-yellow-400/30 transition-colors">
                <Cpu className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-xs font-semibold text-neutral-200">
                  Dynamic Gap Roadmap
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#111111] border border-neutral-800 shadow-sm hover:border-yellow-400/30 transition-colors">
                <ShieldCheck className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-xs font-semibold text-neutral-200">
                  Semantic Job Matching
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: High-Impact Visual Mockup */}
          <div className="lg:col-span-5 relative w-full flex justify-center">
            {/* Visual Dashboard Preview Card */}
            <div className="relative w-full max-w-md rounded-2xl bg-[#111111] border border-neutral-800 shadow-2xl p-5 md:p-6 space-y-5">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#181818] border border-yellow-400/30 flex items-center justify-center p-1.5 shadow-sm">
                    <img src="/web-logo.png" alt="SkillOrbit AI" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      AI Career Intelligence
                    </h3>
                    <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block animate-ping" />
                      Live Analysis Engine
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-yellow-400/15 text-yellow-300 border border-yellow-400/30">
                  96% Fit Score
                </span>
              </div>

              {/* Match Diagnostics Metric */}
              <div className="bg-[#161616] rounded-xl p-3.5 border border-neutral-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-300 font-semibold">ATS Resume Optimization</span>
                  <span className="text-yellow-400 font-bold">94 / 100</span>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-yellow-400 to-amber-500 h-full rounded-full w-[94%]" />
                </div>
                <div className="flex justify-between text-[10px] text-neutral-400 pt-0.5">
                  <span>Impact Verbs: High</span>
                  <span>Keyword Sync: 92%</span>
                </div>
              </div>

              {/* Extracted Skills Visualization */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Extracted Competencies
                  </span>
                  <span className="text-[10px] text-yellow-400 font-medium">5 Verified</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-md text-xs bg-yellow-400/10 text-yellow-300 border border-yellow-400/25 font-medium">
                    React 19 & TypeScript
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-amber-400/10 text-amber-300 border border-amber-400/25 font-medium">
                    Node.js & Express
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 font-medium">
                    MongoDB & Vector Search
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs bg-neutral-800/80 text-neutral-300 border border-neutral-700 font-medium">
                    System Architecture
                  </span>
                </div>
              </div>

              {/* Milestone Roadmap Snippet */}
              <div className="p-3 rounded-xl bg-[#151515] border border-yellow-400/20 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-yellow-400/15 text-yellow-400 shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 text-left">
                  <h4 className="text-xs font-bold text-white">
                    Target Opportunity Roadmap
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Step 3: Distributed Microservices & Event Streams
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400 font-medium pt-1">
                    <CheckCircle2 className="w-3 h-3 text-yellow-400" />
                    Recommended Courses Mapped
                  </span>
                </div>
              </div>

              {/* Floating Bottom Card */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-400 border-t border-neutral-800">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-yellow-400" />
                  Opportunity Feed: Active
                </span>
                <span className="text-yellow-400 font-semibold hover:underline cursor-pointer">
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

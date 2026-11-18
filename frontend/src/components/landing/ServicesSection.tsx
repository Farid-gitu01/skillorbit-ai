import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  FileText,
  Layers,
  Cpu,
  Target,
  Compass,
  Briefcase,
  Sparkles,
  Bot,
  GraduationCap,
  ArrowUpRight,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ServiceItem {
  id: string;
  icon: typeof FileText;
  title: string;
  tagline: string;
  description: string;
  tag: string;
  path: string;
}

const SERVICES_DATA: ServiceItem[] = [
  {
    id: 'resume-analysis',
    icon: FileText,
    title: 'AI Resume Analysis',
    tagline: 'Deep ATS & Semantic Quality Audit',
    description:
      'Extracts key metrics, parses formatting syntax, audits keyword impact, and generates itemized ATS optimization recommendations.',
    tag: 'Resume AI',
    path: '/seeker/ai/resume',
  },
  {
    id: 'resume-management',
    icon: Layers,
    title: 'Resume Management',
    tagline: 'Multi-Version Profile Repository',
    description:
      'Maintain, organize, and version control tailored resumes for distinct roles and industries with instantaneous updates.',
    tag: 'Portfolio Core',
    path: '/seeker/resume',
  },
  {
    id: 'skill-extraction',
    icon: Cpu,
    title: 'Skill Extraction',
    tagline: 'Automated Competency Mining',
    description:
      'Intelligently detects hard, soft, and domain-specific skills from raw project descriptions and synchronizes them to your profile.',
    tag: 'Extraction Engine',
    path: '/seeker/profile',
  },
  {
    id: 'skill-gap',
    icon: Target,
    title: 'Skill Gap Analysis',
    tagline: 'Target Role Disparity Diagnostic',
    description:
      'Compares your extracted skill profile against target job postings, exposing missing prerequisites and high-yield study topics.',
    tag: 'Gap Diagnostics',
    path: '/seeker/ai/skill-gap',
  },
  {
    id: 'learning-roadmap',
    icon: Compass,
    title: 'Personalized Learning Roadmap',
    tagline: 'Structured Sequential Milestones',
    description:
      'Synthesizes weekly progressive action plans mapped to accredited coursework to systematically eliminate identified skill deficits.',
    tag: 'Adaptive Pathways',
    path: '/seeker/ai/skill-gap',
  },
  {
    id: 'job-matching',
    icon: Briefcase,
    title: 'AI Job Matching',
    tagline: 'Contextual Semantic Affinity Scoring',
    description:
      'Evaluates listings using multi-dimensional matching algorithms across experience level, verified skills, and role expectations.',
    tag: 'Affinity Matching',
    path: '/seeker/ai/job-matches',
  },
  {
    id: 'job-recommendations',
    icon: Sparkles,
    title: 'Job Recommendations',
    tagline: 'Personalized Opportunity Stream',
    description:
      'Real-time automated recommendation feed delivering pre-vetted positions calibrated specifically for your career velocity.',
    tag: 'Curated Feeds',
    path: '/seeker/jobs',
  },
  {
    id: 'career-assistant',
    icon: Bot,
    title: 'AI Career Assistant',
    tagline: '24/7 Contextual Career Advisory',
    description:
      'Interactive conversational agent providing tailored interview prep, technical drill simulation, and strategic career negotiation.',
    tag: 'Interactive Advisor',
    path: '/seeker/ai/assistant',
  },
  {
    id: 'career-development',
    icon: GraduationCap,
    title: 'Career Development Support',
    tagline: 'Accredited Upskilling & Verification',
    description:
      'Integrated training provider courses and verifiable credentials that prove competency directly to active hiring managers.',
    tag: 'Training Network',
    path: '/seeker/dashboard',
  },
];

export function ServicesSection() {
  const { isAuthenticated } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Duplicating the list ensures a continuous, seamless loop
  const duplicatedServices = [...SERVICES_DATA, ...SERVICES_DATA];

  const handleManualScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section
      id="services"
      className="py-16 md:py-24 relative overflow-hidden bg-midnight-navy"
      aria-label="SkillOrbit AI Services"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/15 border border-brand-blue/30 text-xs font-semibold text-brand-cyan">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Implemented Platform Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-surface-white tracking-tight">
              Intelligent Services Engineered for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-brand-cyan to-brand-purple">
                Career Acceleration
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Explore our native suite of nine production-ready career tools. Every service is
              actively integrated and accessible from your personalized dashboard.
            </p>
          </div>

          {/* Interactive Controls: Pause/Play & Manual Navigation */}
          <div className="flex items-center gap-2 self-start md:self-end shrink-0">
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? 'Resume automatic sliding' : 'Pause automatic sliding'}
              className="p-2.5 rounded-lg bg-navy/80 hover:bg-navy-surface border border-navy-surface text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-brand-cyan" />}
              <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={() => handleManualScroll('left')}
              aria-label="Scroll services left"
              className="p-2.5 rounded-lg bg-navy/80 hover:bg-navy-surface border border-navy-surface text-slate-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleManualScroll('right')}
              aria-label="Scroll services right"
              className="p-2.5 rounded-lg bg-navy/80 hover:bg-navy-surface border border-navy-surface text-slate-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Infinite Horizontal Carousel Container */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-hidden overflow-y-visible py-4 relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Horizontal Gradient Vignettes for smooth edge fades */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-midnight-navy to-transparent z-10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-midnight-navy to-transparent z-10"
          aria-hidden="true"
        />

        {/* Moving Ticker Track */}
        <div
          className={`flex gap-6 items-stretch will-change-transform ${
            isPaused ? 'paused' : 'animate-marquee'
          }`}
        >
          {duplicatedServices.map((service, index) => {
            const Icon = service.icon;
            const targetLink = isAuthenticated ? service.path : '/login';

            return (
              <div
                key={`${service.id}-${index}`}
                className="w-[280px] sm:w-[340px] shrink-0 rounded-2xl bg-gradient-to-b from-navy/90 to-midnight-navy/95 border border-navy-surface/80 hover:border-brand-cyan/60 p-6 flex flex-col justify-between transition-all duration-300 shadow-card hover:shadow-xl hover:-translate-y-1 group/card"
              >
                <div className="space-y-4">
                  {/* Top Bar with Icon and Feature Tag */}
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-brand-blue/15 border border-brand-blue/30 text-brand-cyan flex items-center justify-center group-hover/card:bg-brand-cyan/20 group-hover/card:scale-105 transition-all">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold text-brand-cyan/90 bg-brand-cyan/10 border border-brand-cyan/20 px-2.5 py-1 rounded-full">
                      {service.tag}
                    </span>
                  </div>

                  {/* Title and Tagline */}
                  <div>
                    <h3 className="text-lg font-bold text-surface-white group-hover/card:text-brand-cyan transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-xs text-muted-slate font-medium pt-0.5">
                      {service.tagline}
                    </p>
                  </div>

                  {/* Service Description */}
                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    {service.description}
                  </p>
                </div>

                {/* Card Action Link */}
                <div className="pt-6 border-t border-navy-surface/60 mt-4">
                  <Link
                    to={targetLink}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-cyan group-hover/card:text-white transition-colors"
                  >
                    <span>{isAuthenticated ? 'Launch Tool' : 'Get Access'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Screen-reader descriptive note */}
      <div className="sr-only">
        Horizontal carousel displaying all 9 core services of SkillOrbit AI. Use pause button or
        manual left and right controls to browse.
      </div>
    </section>
  );
}

export default ServicesSection;

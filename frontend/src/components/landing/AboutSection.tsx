import { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Cpu,
  Target,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingUp,
  Workflow,
  CheckCircle2,
} from 'lucide-react';

interface ValuePillar {
  icon: typeof Compass;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
}

const VALUE_PILLARS: ValuePillar[] = [
  {
    icon: Cpu,
    title: 'Explainable AI Diagnostics',
    subtitle: 'Transparent Resume & Skill Assessment',
    description:
      'Replaces opaque applicant tracking systems with transparent multi-dimensional resume audits, keyword density analysis, and concrete bullet point feedback.',
    badge: 'Precision Analytics',
  },
  {
    icon: Target,
    title: 'Objective Skill Gap Remediation',
    subtitle: 'Targeted Benchmark Comparison',
    description:
      'Directly correlates your current profile with real-time employer job specifications, pinpointing exact technological gaps and highest-ROI learning requirements.',
    badge: 'Benchmarking',
  },
  {
    icon: Workflow,
    title: 'Autonomous Learning Roadmaps',
    subtitle: 'Personalized Step-by-Step Trajectories',
    description:
      'Synthesizes customized learning milestones mapped to verified training courses, helping candidates systematically acquire verified competencies.',
    badge: 'Dynamic Planning',
  },
  {
    icon: ShieldCheck,
    title: 'Unified Tripartite Ecosystem',
    subtitle: 'Harmonizing Candidates, Employers & Educators',
    description:
      'Creates a synchronized talent pipeline where employers post verified requirements, candidates build validated skillsets, and training providers upskill active learners.',
    badge: 'Ecosystem Sync',
  },
];

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.15,
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="about"
      ref={sectionRef}
      className="py-16 md:py-24 relative overflow-hidden bg-navy/20 border-t border-b border-navy-surface/40"
      aria-label="About SkillOrbit AI"
    >
      {/* Background accents */}
      <div
        className="absolute top-1/2 left-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 right-0 w-80 h-80 bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Block */}
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-xs font-semibold text-brand-cyan">
            <Sparkles className="w-3.5 h-3.5" />
            <span>About SkillOrbit AI</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-surface-white tracking-tight">
            Bridging Potential and Opportunity with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-blue">
              Intelligent Career Science
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            SkillOrbit AI is built to solve one of modern technology's greatest challenges:
            the disconnect between raw talent, evolving employer requirements, and structured upskilling.
          </p>
        </div>

        {/* Narrative Grid: The Problem vs The SkillOrbit Solution */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* The Problem */}
          <div className="p-6 md:p-8 rounded-2xl bg-midnight-navy/90 border border-red-500/20 shadow-lg space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-surface-white">The Friction in Modern Hiring</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Job seekers send hundreds of resumes into black-box algorithms without receiving
              actionable feedback. When rejected, they are left guessing which skills they lacked.
              Simultaneously, engineering leaders spend weeks filtering non-qualified applicants, and
              educational institutions struggle to adapt curriculum to real-time tech demands.
            </p>
            <ul className="space-y-2 pt-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Opaque applicant tracking filters that discard non-templated profiles
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Uncertainty regarding which tech stacks maximize career mobility
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Disconnected learning credentials with no direct path to interviews
              </li>
            </ul>
          </div>

          {/* The Mission & Solution */}
          <div className="p-6 md:p-8 rounded-2xl bg-midnight-navy/90 border border-brand-cyan/20 shadow-lg space-y-4 relative">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-surface-white">Our Mission & AI Architecture</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              SkillOrbit AI transforms career advancement into a deterministic, data-backed discipline.
              By parsing actual resume accomplishments, analyzing technological gaps against live role
              requirements, and orchestrating personalized learning milestones, we empower candidates
              to make confident, evidence-based career moves.
            </p>
            <ul className="space-y-2 pt-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                Objective diagnostic scoring with itemized ATS feedback
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                Targeted roadmaps mapping every skill gap directly to verified courses
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
                High-confidence semantic matching linking talent with verified roles
              </li>
            </ul>
          </div>
        </div>

        {/* 4 Value Propositions / Pillars */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {VALUE_PILLARS.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="group p-6 rounded-2xl bg-navy/50 hover:bg-navy/80 border border-navy-surface hover:border-brand-blue/50 transition-all duration-300 flex flex-col justify-between shadow-card hover:shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/15 border border-brand-blue/30 text-brand-cyan flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-slate bg-navy-surface/80 px-2 py-0.5 rounded-full">
                      {pillar.badge}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-surface-white group-hover:text-brand-cyan transition-colors">
                    {pillar.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">{pillar.subtitle}</p>
                  <p className="text-xs text-slate-300 leading-relaxed font-normal">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default AboutSection;

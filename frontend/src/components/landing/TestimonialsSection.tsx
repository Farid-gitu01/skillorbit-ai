import { useState, useRef } from 'react';
import {
  Star,
  Quote,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Briefcase,
  Building,
} from 'lucide-react';

interface TestimonialProfile {
  id: string;
  roleCategory: 'CEO' | 'CTO' | 'CFO' | 'Manager' | 'Digital Marketer';
  name: string;
  designation: string;
  company: string;
  rating: number;
  testimonial: string;
  avatarColor: string;
  initials: string;
}

const FIVE_PROFILES: TestimonialProfile[] = [
  {
    id: 'profile-ceo',
    roleCategory: 'CEO',
    name: 'Marcus Vance',
    designation: 'Chief Executive Officer',
    company: 'CloudScale Systems',
    rating: 5,
    testimonial:
      'SkillOrbit AI transformed how we evaluate executive technology leadership. The precision in AI skill mapping cut our strategic talent acquisition cycles in half while ensuring deep cultural and engineering alignment.',
    avatarColor: 'from-blue-600 to-indigo-700',
    initials: 'MV',
  },
  {
    id: 'profile-cto',
    roleCategory: 'CTO',
    name: 'Dr. Elena Rostova',
    designation: 'Chief Technology Officer',
    company: 'NexaSphere AI',
    rating: 5,
    testimonial:
      "The mathematical rigor behind SkillOrbit's skill extraction and gap analysis is unprecedented. Candidates arrive with genuine, verifiable capability blueprints that match our actual cloud microservices architectures.",
    avatarColor: 'from-cyan-500 to-blue-600',
    initials: 'ER',
  },
  {
    id: 'profile-cfo',
    roleCategory: 'CFO',
    name: 'David Sterling',
    designation: 'Chief Financial Officer',
    company: 'Apex Global Capital',
    rating: 5,
    testimonial:
      'Reskilling and talent acquisition historically represented unpredictable expenditures. SkillOrbit AI provides quantifiable metrics that directly optimized our organizational upskilling budgets and hiring ROI.',
    avatarColor: 'from-purple-600 to-indigo-800',
    initials: 'DS',
  },
  {
    id: 'profile-manager',
    roleCategory: 'Manager',
    name: 'Priya Sharma',
    designation: 'Senior Engineering Manager',
    company: 'QuantumEdge Labs',
    rating: 5,
    testimonial:
      "Guiding cross-functional engineers through high-velocity sprints requires continuous skill alignment. The platform's automated learning roadmaps allowed my team to upskill on modern AI workflows in record time.",
    avatarColor: 'from-emerald-500 to-teal-700',
    initials: 'PS',
  },
  {
    id: 'profile-marketer',
    roleCategory: 'Digital Marketer',
    name: 'Jordan Blake',
    designation: 'Growth & Digital Marketing Director',
    company: 'HyperGrowth Media',
    rating: 5,
    testimonial:
      "As generative AI transformed modern marketing, SkillOrbit's AI assistant pinpointed the exact prompt engineering and predictive analytics skills I needed to accelerate my executive career.",
    avatarColor: 'from-amber-500 to-rose-600',
    initials: 'JB',
  },
];

export function TestimonialsSection() {
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Duplicate for seamless right-to-left infinite loop
  const duplicatedProfiles = [...FIVE_PROFILES, ...FIVE_PROFILES];

  const handleManualScroll = (direction: 'left' | 'right') => {
    setIsPaused(true);
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section
      id="testimonials"
      className="py-16 md:py-24 relative overflow-hidden bg-[#0B0B0B] border-t border-neutral-800/80"
      aria-label="Platform Testimonials"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-xs font-semibold text-yellow-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Leadership & Professional Perspectives</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Trusted by Decision Makers Across{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500">
                Every Stage of Growth
              </span>
            </h2>
            <p className="text-sm sm:text-base text-neutral-300">
              Discover how leaders and professionals across executive, technical, operational, and
              marketing domains utilize SkillOrbit AI to align skills with strategic velocity.
            </p>
            {/* Content accuracy demo notice badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#131313] border border-neutral-800 text-[11px] text-neutral-400 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span>Platform Showcase • Demonstration Profiles & Peer Reviews</span>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-2 self-start md:self-end shrink-0">
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              aria-label={isPaused ? 'Resume testimonial sliding' : 'Pause testimonial sliding'}
              className="p-2.5 rounded-lg bg-[#141414] hover:bg-[#1A1A1A] border border-neutral-800 text-neutral-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            >
              {isPaused ? <Play className="w-4 h-4 text-yellow-400" /> : <Pause className="w-4 h-4 text-yellow-400" />}
              <span className="hidden sm:inline">{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={() => handleManualScroll('left')}
              aria-label="Scroll testimonials left"
              className="p-2.5 rounded-lg bg-[#141414] hover:bg-[#1A1A1A] border border-neutral-800 text-neutral-300 hover:text-yellow-400 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleManualScroll('right')}
              aria-label="Scroll testimonials right"
              className="p-2.5 rounded-lg bg-[#141414] hover:bg-[#1A1A1A] border border-neutral-800 text-neutral-300 hover:text-yellow-400 transition-colors shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Infinite Horizontal Testimonials Track */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-hidden overflow-y-visible py-4 relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Edge Vignette Overlays */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-[#0B0B0B] to-transparent z-10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-[#0B0B0B] to-transparent z-10"
          aria-hidden="true"
        />

        {/* Continuous sliding loop (Right to Left: animate-marquee) */}
        <div
          className={`flex gap-6 items-stretch will-change-transform ${
            isPaused ? 'paused' : 'animate-marquee-slow'
          }`}
        >
          {duplicatedProfiles.map((profile, index) => (
            <div
              key={`${profile.id}-${index}`}
              className="w-[300px] sm:w-[380px] shrink-0 rounded-2xl bg-[#111111] border border-neutral-800 hover:border-yellow-400/50 p-6 md:p-7 flex flex-col justify-between transition-all duration-300 shadow-lg hover:shadow-yellow-400/5 hover:-translate-y-1 group/card"
            >
              <div className="space-y-4">
                {/* Header: Role Category Badge & Star Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-400 bg-yellow-400/10 border border-yellow-400/25 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3" />
                    {profile.roleCategory}
                  </span>
                  <div className="flex items-center gap-1 text-yellow-400">
                    {Array.from({ length: profile.rating }).map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>

                {/* Quote Icon & Testimonial Text */}
                <div className="relative pt-2">
                  <Quote className="w-8 h-8 text-neutral-800 absolute -top-1 -left-2 pointer-events-none" />
                  <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed relative z-10 pl-2 italic">
                    "{profile.testimonial}"
                  </p>
                </div>
              </div>

              {/* Author Metadata Footer */}
              <div className="pt-6 border-t border-neutral-800/80 mt-6 flex items-center gap-3.5">
                {/* Professional Avatar */}
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-tr ${profile.avatarColor} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md ring-2 ring-neutral-800`}
                  aria-hidden="true"
                >
                  {profile.initials}
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-sm font-bold text-white truncate">
                    {profile.name}
                  </h4>
                  <p className="text-xs text-yellow-400 font-medium truncate">
                    {profile.designation}
                  </p>
                  <p className="text-[11px] text-neutral-400 flex items-center gap-1 truncate">
                    <Building className="w-3 h-3 shrink-0" />
                    {profile.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;

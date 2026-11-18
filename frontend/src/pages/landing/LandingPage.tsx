import {
  HeroSection,
  AboutSection,
  ServicesSection,
  TestimonialsSection,
  ContactSection,
} from '@/components/landing';

/**
 * LandingPage — Modern, high-conversion SaaS presentation for SkillOrbit AI.
 * Implements Sections B through F with smooth scrolling integration,
 * while Navbar (Section A) and Footer (Section G) are managed by AppLayout.
 */
export function LandingPage() {
  return (
    <div className="w-full flex flex-col space-y-0 text-surface-white selection:bg-brand-blue/30 selection:text-brand-cyan">
      {/* Section B: Hero Section */}
      <HeroSection />

      {/* Section C: About Us Section */}
      <AboutSection />

      {/* Section D: Services Section — Infinite Horizontal Sliding Animation */}
      <ServicesSection />

      {/* Section E: Testimonials Section — Five Profile Infinite Carousel */}
      <TestimonialsSection />

      {/* Section F: Contact Us Section */}
      <ContactSection />
    </div>
  );
}

export default LandingPage;

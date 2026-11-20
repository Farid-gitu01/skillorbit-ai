import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();

  // Scroll to hash target on initial load or navigation from other routes
  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const targetElement = document.getElementById(sectionId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [location.hash]);

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

import { Outlet } from 'react-router-dom';
import { Navbar, Footer } from '@/components/landing';

/**
 * AppLayout — Public application layout shell.
 * Renders Section A (Navbar), the central outlet with full-width responsiveness,
 * and Section G (Footer).
 */
export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#080808] text-neutral-100 selection:bg-yellow-400/30 selection:text-yellow-300">
      {/* Section A: Navigation Bar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        <Outlet />
      </main>

      {/* Section G: Footer */}
      <Footer />
    </div>
  );
}

export default AppLayout;

import { useEffect } from "react";
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Strategy from './components/Strategy';
import RiskManagement from './components/RiskManagement';
import Performance from './components/Performance';
import Architecture from './components/Architecture';
import Footer from './components/Footer';

export default function App() {
  useEffect(() => {
    const scrollToHashTarget = () => {
      const hash = window.location.hash;
      if (!hash) {
        return;
      }

      // Support both "#dashboard" and "#/dashboard" formats.
      const sectionId = decodeURIComponent(hash.replace(/^#\/?/, ""));
      if (!sectionId) {
        return;
      }

      const target = document.getElementById(sectionId);
      if (!target) {
        return;
      }

      const navOffset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top, behavior: "smooth" });
    };

    const timeoutId = window.setTimeout(scrollToHashTarget, 0);
    window.addEventListener("hashchange", scrollToHashTarget);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("hashchange", scrollToHashTarget);
    };
  }, []);

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main>
        <Hero />
        <Dashboard />
        <Strategy />
        <RiskManagement />
        <Performance />
        <Architecture />
      </main>
      <Footer />
    </div>
  );
}

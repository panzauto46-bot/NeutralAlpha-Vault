import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import Strategy from './components/Strategy';
import RiskManagement from './components/RiskManagement';
import Performance from './components/Performance';
import Architecture from './components/Architecture';
import Footer from './components/Footer';

export default function App() {
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

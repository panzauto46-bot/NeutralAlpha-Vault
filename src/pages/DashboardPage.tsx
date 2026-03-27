import Dashboard from "@/components/Dashboard";
import Navbar from "@/components/Navbar";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { useWallet } from "@/context/WalletContext";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { walletAddress, walletSessionAuthorized, walletBusy, setShowWalletModal } = useWallet();

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="pt-16">
        {walletAddress && walletSessionAuthorized ? (
          <AppErrorBoundary fallbackTitle="Dashboard crash detected">
            <Dashboard />
          </AppErrorBoundary>
        ) : (
          <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
            <div className="max-w-xl w-full glass rounded-3xl p-8 text-center border border-white/10">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-2">Private App Area</p>
              <h1 className="text-3xl font-bold text-white mb-3">Dashboard Locked</h1>
              <p className="text-slate-400 mb-6 leading-relaxed">
                Connect your Solana wallet to continue. After connected, you can access deposit flow,
                live dashboard telemetry, and risk status in one place.
              </p>
              <button
                onClick={() => setShowWalletModal(true)}
                disabled={walletBusy}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-400 hover:to-green-500 transition-all disabled:opacity-60"
              >
                {walletBusy ? "Connecting..." : "Connect Wallet"}
              </button>
              <div className="mt-5 text-sm">
                <Link to="/" className="text-slate-400 hover:text-white transition-colors">
                  Back to Landing
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

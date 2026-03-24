import Dashboard from "@/components/Dashboard";
import Navbar from "@/components/Navbar";
import { useWallet } from "@/context/WalletContext";

export default function DashboardPage() {
  const { walletAddress, walletReady, walletBusy, connect } = useWallet();

  async function handleConnectClick() {
    if (!walletReady) {
      const downloadUrl = "https://phantom.app/download";
      const popup = window.open(downloadUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = downloadUrl;
      }
      return;
    }

    try {
      await connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown wallet error.";
      window.alert(`Wallet action failed: ${message}`);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main className="pt-16">
        {walletAddress ? (
          <Dashboard />
        ) : (
          <section className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
            <div className="max-w-xl w-full glass rounded-2xl p-8 text-center">
              <h1 className="text-3xl font-bold text-white mb-3">Dashboard Locked</h1>
              <p className="text-slate-400 mb-6">
                Connect Phantom wallet dulu untuk membuka halaman dashboard.
              </p>
              <button
                onClick={() => void handleConnectClick()}
                disabled={walletBusy}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-400 hover:to-green-500 transition-all disabled:opacity-60"
              >
                {walletBusy
                  ? "Connecting..."
                  : walletReady
                    ? "Connect Wallet"
                    : "Install Phantom"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

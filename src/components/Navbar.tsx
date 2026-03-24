import { useMemo, useState } from "react";
import { Menu, X, Wallet, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { walletAddress, walletReady, walletBusy, connect, disconnect } = useWallet();

  const navLinks = [
    { label: "Dashboard", href: "#dashboard" },
    { label: "Strategy", href: "#strategy" },
    { label: "Risks", href: "#risks" },
    { label: "Performance", href: "#performance" },
    { label: "Docs", href: "#docs" },
  ];

  async function handleWalletClick() {
    try {
      if (!walletReady) {
        const downloadUrl = "https://phantom.app/download";
        const popup = window.open(downloadUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          window.location.href = downloadUrl;
        }
        return;
      }
      if (walletAddress) {
        await disconnect();
        return;
      }
      await connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown wallet error.";
      window.alert(`Wallet action failed: ${message}`);
    }
  }

  const walletLabel = useMemo(() => {
    if (walletBusy) {
      return walletAddress ? "Disconnecting..." : "Connecting...";
    }
    if (!walletReady) {
      return "Install Phantom";
    }
    if (!walletAddress) {
      return "Connect Wallet";
    }
    return shortAddress(walletAddress);
  }, [walletAddress, walletBusy, walletReady]);

  const walletConnected = Boolean(walletAddress);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">N</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">NeutralAlpha</h1>
              <p className="text-[10px] text-slate-400 -mt-1">VAULT</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleWalletClick()}
              disabled={walletBusy}
              className={`
                hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60
                ${
                  walletConnected
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : walletReady
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500"
                      : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30"
                }
              `}
            >
              <Wallet className="w-4 h-4" />
              {walletConnected ? (
                <span className="flex items-center gap-1">
                  {walletLabel} <ChevronDown className="w-3 h-3" />
                </span>
              ) : (
                walletLabel
              )}
            </button>

            <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-slate-400 hover:text-white">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-white/5"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => void handleWalletClick()}
                disabled={walletBusy}
                className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
                  walletReady
                    ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                    : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                }`}
              >
                <Wallet className="w-4 h-4" />
                {walletLabel}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

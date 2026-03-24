import { useEffect, useMemo, useState } from "react";
import { Menu, X, Wallet, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";
import { Link, useLocation } from "react-router-dom";
import { NETWORK_BADGE_LABEL, NETWORK_PILL_CLASS } from "@/config/network";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}



export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { walletAddress, walletReady, walletBusy, walletName, setShowWalletModal, disconnect } = useWallet();
  const location = useLocation();
  const isDashboardRoute = location.pathname === "/dashboard";

  const navLinks = isDashboardRoute
    ? [
        { label: "Overview", href: "#overview", route: false },
        { label: "Actions", href: "#actions", route: false },
        { label: "Analytics", href: "#analytics", route: false },
        { label: "Activity", href: "#activity", route: false },
      ]
    : [
        { label: "Strategy", href: "#strategy", route: false },
        { label: "Risks", href: "#risks", route: false },
        { label: "Performance", href: "#performance", route: false },
        { label: "Docs", href: "#docs", route: false },
      ];

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  async function handleWalletClick() {
    try {
      if (walletAddress) {
        await disconnect();
        return;
      }
      // Open wallet selection modal
      setShowWalletModal(true);
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
      return "Connect Wallet";
    }
    if (!walletAddress) {
      return "Connect Wallet";
    }
    const prefix = walletName ? `${walletName} · ` : "";
    return `${prefix}${shortAddress(walletAddress)}`;
  }, [walletAddress, walletBusy, walletReady, walletName]);

  const walletConnected = Boolean(walletAddress);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">N</span>
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            </Link>
            <Link to="/" className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">NeutralAlpha</h1>
              <p className="text-[10px] text-slate-400 -mt-1">VAULT</p>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) =>
              link.route ? (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`px-4 py-2 text-sm rounded-lg transition-all ${
                    location.pathname === link.href
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs border ${NETWORK_PILL_CLASS}`}>
              {NETWORK_BADGE_LABEL}
            </div>
            <button
              onClick={() => void handleWalletClick()}
              disabled={walletBusy}
              className={`
                hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60
                ${
                  walletConnected
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500"
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
              {navLinks.map((link) =>
                link.route ? (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block px-4 py-3 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </a>
                ),
              )}
              <button
                onClick={() => void handleWalletClick()}
                disabled={walletBusy}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-green-500 to-green-600 text-white"
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

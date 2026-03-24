import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet, Download, ExternalLink } from "lucide-react";
import { useWallet, type DetectedWallet } from "@/context/WalletContext";
import { useLocation, useNavigate } from "react-router-dom";

const INSTALLABLE_WALLETS = [
  {
    name: "Phantom",
    url: "https://phantom.app/download",
    icon: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/phantom.svg",
  },
  {
    name: "Bitget Wallet",
    url: "https://web3.bitget.com/en/wallet-download",
    icon: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/bitget.svg",
  },
  {
    name: "Solflare",
    url: "https://solflare.com/",
    icon: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/solflare.svg",
  },
  {
    name: "Backpack",
    url: "https://backpack.app/",
    icon: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/backpack.svg",
  },
];

export default function WalletModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showWalletModal, setShowWalletModal, availableWallets, connectWallet, walletBusy } = useWallet();

  async function handleSelect(wallet: DetectedWallet) {
    try {
      await connectWallet(wallet);
      if (location.pathname !== "/dashboard") {
        navigate("/dashboard");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed.";
      window.alert(msg);
    }
  }

  function handleInstall(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const detectedNames = new Set(availableWallets.map((w) => w.name));
  const notInstalled = INSTALLABLE_WALLETS.filter((w) => !detectedNames.has(w.name));

  return (
    <AnimatePresence>
      {showWalletModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWalletModal(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1421] shadow-2xl shadow-black/50">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg">Connect Wallet</h2>
                    <p className="text-slate-400 text-xs">Choose your Solana wallet</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Wallet List */}
              <div className="px-6 py-4 space-y-2">
                {/* Detected Wallets */}
                {availableWallets.length > 0 && (
                  <>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mb-3">Detected</p>
                    {availableWallets.map((wallet) => (
                      <button
                        key={wallet.name}
                        onClick={() => void handleSelect(wallet)}
                        disabled={walletBusy}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-green-500/30 transition-all group disabled:opacity-50"
                      >
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          className="w-10 h-10 rounded-xl"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="flex-1 text-left">
                          <p className="text-white font-medium text-sm">{wallet.name}</p>
                          <p className="text-slate-500 text-xs">Detected</p>
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                      </button>
                    ))}
                  </>
                )}

                {/* Not Installed */}
                {notInstalled.length > 0 && (
                  <>
                    <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 mt-5 mb-3">
                      {availableWallets.length > 0 ? "More Wallets" : "Install a Wallet"}
                    </p>
                    {notInstalled.map((wallet) => (
                      <button
                        key={wallet.name}
                        onClick={() => handleInstall(wallet.url)}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-slate-500/30 transition-all group"
                      >
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          className="w-10 h-10 rounded-xl opacity-50 group-hover:opacity-80 transition-opacity"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="flex-1 text-left">
                          <p className="text-slate-300 font-medium text-sm">{wallet.name}</p>
                          <p className="text-slate-600 text-xs">Not installed</p>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500 group-hover:text-slate-300 transition-colors">
                          <Download className="w-4 h-4" />
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {availableWallets.length === 0 && notInstalled.length === 0 && (
                  <div className="text-center py-8">
                    <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No Solana wallets detected</p>
                    <p className="text-slate-600 text-xs mt-1">Install a wallet extension to get started</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-white/5">
                <p className="text-slate-600 text-[11px] text-center">
                  By connecting, you agree to the terms of service
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

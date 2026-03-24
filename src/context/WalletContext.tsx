import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface DetectedWallet {
  name: string;
  icon: string;
  provider: SolanaWalletProvider;
}

interface SolanaWalletProvider {
  isPhantom?: boolean;
  isBitKeep?: boolean;
  isBitget?: boolean;
  isSolflare?: boolean;
  isBackpack?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signAndSendTransaction?: (...args: unknown[]) => Promise<unknown>;
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  off?: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface WalletContextValue {
  walletAddress: string | null;
  walletReady: boolean;
  walletBusy: boolean;
  walletName: string | null;
  availableWallets: DetectedWallet[];
  showWalletModal: boolean;
  setShowWalletModal: (show: boolean) => void;
  connectWallet: (wallet: DetectedWallet) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const WALLET_ICONS: Record<string, string> = {
  Phantom: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/phantom.svg",
  "Bitget Wallet": "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/bitget.svg",
  Solflare: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/solflare.svg",
  Backpack: "https://raw.githubusercontent.com/nicnocquee/crypto-icons/refs/heads/main/wallets/backpack.svg",
};

function detectWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];

  const wallets: DetectedWallet[] = [];
  const win = window as unknown as Record<string, unknown>;

  // Phantom
  const phantom = (win.phantom as Record<string, unknown>)?.solana as SolanaWalletProvider | undefined;
  if (phantom?.isPhantom && typeof phantom.connect === "function") {
    wallets.push({
      name: "Phantom",
      icon: WALLET_ICONS.Phantom,
      provider: phantom,
    });
  }

  // Bitget Wallet (formerly BitKeep)
  const bitget = (win.bitkeep as Record<string, unknown>)?.solana as SolanaWalletProvider | undefined;
  const bitgetAlt = (win.bitget as Record<string, unknown>)?.solana as SolanaWalletProvider | undefined;
  const bitgetProvider = bitgetAlt ?? bitget;
  if (bitgetProvider && typeof bitgetProvider.connect === "function") {
    wallets.push({
      name: "Bitget Wallet",
      icon: WALLET_ICONS["Bitget Wallet"],
      provider: bitgetProvider,
    });
  }

  // Solflare
  const solflare = win.solflare as SolanaWalletProvider | undefined;
  if (solflare?.isSolflare && typeof solflare.connect === "function") {
    wallets.push({
      name: "Solflare",
      icon: WALLET_ICONS.Solflare,
      provider: solflare,
    });
  }

  // Backpack
  const backpack = (win.backpack as Record<string, unknown>)?.solana as SolanaWalletProvider | undefined;
  const xnft = win.xnft as Record<string, unknown> | undefined;
  const backpackProvider = backpack ?? (xnft?.solana as SolanaWalletProvider | undefined);
  if (backpackProvider?.isBackpack && typeof backpackProvider.connect === "function") {
    wallets.push({
      name: "Backpack",
      icon: WALLET_ICONS.Backpack,
      provider: backpackProvider,
    });
  }

  return wallets;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<DetectedWallet[]>([]);
  const [activeProvider, setActiveProvider] = useState<SolanaWalletProvider | null>(null);

  // Detect wallets on mount
  useEffect(() => {
    const detect = () => {
      const wallets = detectWallets();
      setAvailableWallets(wallets);
      setWalletReady(wallets.length > 0);
    };

    // Wallets inject after page load, so check with delay
    detect();
    const timer = setTimeout(detect, 500);
    const timer2 = setTimeout(detect, 1500);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []);

  // Listen for disconnect events on active provider
  useEffect(() => {
    if (!activeProvider) return;

    const onDisconnect = () => {
      setWalletAddress(null);
      setWalletName(null);
      setActiveProvider(null);
    };

    const onAccountChanged = (publicKey?: { toString(): string } | null) => {
      if (!publicKey) {
        onDisconnect();
        return;
      }
      setWalletAddress(publicKey.toString());
    };

    activeProvider.on?.("disconnect", onDisconnect);
    activeProvider.on?.("accountChanged", onAccountChanged as (...args: unknown[]) => void);

    return () => {
      activeProvider.off?.("disconnect", onDisconnect);
      activeProvider.off?.("accountChanged", onAccountChanged as (...args: unknown[]) => void);
    };
  }, [activeProvider]);

  const connectWallet = useCallback(async (wallet: DetectedWallet) => {
    setWalletBusy(true);
    setShowWalletModal(false);
    try {
      const result = await wallet.provider.connect();
      setWalletAddress(result.publicKey.toString());
      setWalletName(wallet.name);
      setActiveProvider(wallet.provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection rejected.";
      throw new Error(message);
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!activeProvider) {
      setWalletAddress(null);
      setWalletName(null);
      return;
    }
    setWalletBusy(true);
    try {
      await activeProvider.disconnect();
      setWalletAddress(null);
      setWalletName(null);
      setActiveProvider(null);
    } finally {
      setWalletBusy(false);
    }
  }, [activeProvider]);

  const value = useMemo(
    () => ({
      walletAddress,
      walletReady,
      walletBusy,
      walletName,
      availableWallets,
      showWalletModal,
      setShowWalletModal,
      connectWallet,
      disconnect,
    }),
    [walletAddress, walletReady, walletBusy, walletName, availableWallets, showWalletModal, connectWallet, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

// Re-export the context name to avoid conflicts with the component name
export { WalletContext };

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }
  return context;
}

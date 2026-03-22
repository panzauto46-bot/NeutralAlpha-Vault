import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface WalletContextValue {
  walletAddress: string | null;
  walletReady: boolean;
  walletBusy: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

function getPhantomProvider() {
  if (typeof window === "undefined") {
    return null;
  }
  const provider = window.solana;
  if (!provider || !provider.isPhantom) {
    return null;
  }
  return provider;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);

  useEffect(() => {
    const provider = getPhantomProvider();
    if (!provider) {
      setWalletReady(false);
      return;
    }
    setWalletReady(true);

    const onConnect = (publicKey?: { toString(): string } | null) => {
      if (publicKey) {
        setWalletAddress(publicKey.toString());
      } else if (provider.publicKey) {
        setWalletAddress(provider.publicKey.toString());
      }
    };
    const onDisconnect = () => setWalletAddress(null);
    const onAccountChanged = (publicKey?: { toString(): string } | null) => {
      if (!publicKey) {
        setWalletAddress(null);
        return;
      }
      setWalletAddress(publicKey.toString());
    };

    provider.on?.("connect", onConnect);
    provider.on?.("disconnect", onDisconnect);
    provider.on?.("accountChanged", onAccountChanged);

    void provider
      .connect({ onlyIfTrusted: true })
      .then((result) => {
        setWalletAddress(result.publicKey.toString());
      })
      .catch(() => {
        setWalletAddress(null);
      });

    return () => {
      provider.off?.("connect", onConnect);
      provider.off?.("disconnect", onDisconnect);
      provider.off?.("accountChanged", onAccountChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getPhantomProvider();
    if (!provider) {
      throw new Error("Phantom wallet not detected.");
    }
    setWalletBusy(true);
    try {
      const result = await provider.connect();
      setWalletAddress(result.publicKey.toString());
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getPhantomProvider();
    if (!provider) {
      setWalletAddress(null);
      return;
    }
    setWalletBusy(true);
    try {
      await provider.disconnect();
      setWalletAddress(null);
    } finally {
      setWalletBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      walletAddress,
      walletReady,
      walletBusy,
      connect,
      disconnect,
    }),
    [connect, disconnect, walletAddress, walletBusy, walletReady],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider.");
  }
  return context;
}

interface PhantomConnectResult {
  publicKey: {
    toString(): string;
  };
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: {
    toString(): string;
  };
  signAndSendTransaction(
    transaction: unknown,
    options?: {
      skipPreflight?: boolean;
      preflightCommitment?: "processed" | "confirmed" | "finalized";
      maxRetries?: number;
    },
  ): Promise<{ signature: string }>;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<PhantomConnectResult>;
  disconnect(): Promise<void>;
  on?(
    event: "connect" | "disconnect" | "accountChanged",
    handler: (publicKey?: { toString(): string } | null) => void,
  ): void;
  off?(
    event: "connect" | "disconnect" | "accountChanged",
    handler: (publicKey?: { toString(): string } | null) => void,
  ): void;
}

interface Window {
  solana?: PhantomProvider;
  phantom?: {
    solana?: PhantomProvider;
  };
}

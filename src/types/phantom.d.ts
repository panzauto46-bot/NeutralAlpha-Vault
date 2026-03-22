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
}

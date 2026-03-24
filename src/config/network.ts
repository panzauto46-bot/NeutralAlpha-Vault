type SolanaNetwork = "devnet" | "mainnet-beta";

function normalizeNetwork(value: string | undefined): SolanaNetwork {
  const lowered = (value ?? "devnet").trim().toLowerCase();
  if (lowered === "mainnet" || lowered === "mainnet-beta") {
    return "mainnet-beta";
  }
  return "devnet";
}

export const SOLANA_NETWORK: SolanaNetwork = normalizeNetwork(import.meta.env.VITE_SOLANA_NETWORK);
export const VAULT_PROGRAM_ID: string | null = import.meta.env.VITE_VAULT_PROGRAM_ID ?? null;

export const NETWORK_LABEL = SOLANA_NETWORK === "mainnet-beta" ? "Mainnet" : "Devnet";
export const NETWORK_PILL_CLASS =
  SOLANA_NETWORK === "mainnet-beta"
    ? "border-emerald-500/35 text-emerald-300"
    : "border-amber-500/35 text-amber-200";

export function buildSolscanAccountUrl(address: string) {
  const cluster = SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet";
  return `https://solscan.io/account/${address}${cluster}`;
}

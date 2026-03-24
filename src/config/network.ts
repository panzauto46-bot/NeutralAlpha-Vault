type SolanaNetwork = "devnet" | "mainnet-beta";

function normalizeNetwork(value: string | undefined): SolanaNetwork {
  const lowered = (value ?? "devnet").trim().toLowerCase();
  if (lowered === "mainnet" || lowered === "mainnet-beta") {
    return "mainnet-beta";
  }
  return "devnet";
}

function cleanValue(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const SOLANA_NETWORK: SolanaNetwork = normalizeNetwork(import.meta.env.VITE_SOLANA_NETWORK);
export const VAULT_PROGRAM_ID: string | null = cleanValue(import.meta.env.VITE_VAULT_PROGRAM_ID);
export const USDC_MINT: string | null = cleanValue(import.meta.env.VITE_USDC_MINT);

const DEFAULT_RPC_URL =
  SOLANA_NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

export const SOLANA_RPC_URL = cleanValue(import.meta.env.VITE_SOLANA_RPC_URL) ?? DEFAULT_RPC_URL;

export const NETWORK_LABEL = SOLANA_NETWORK === "mainnet-beta" ? "Mainnet" : "Devnet";
export const NETWORK_BADGE_LABEL = SOLANA_NETWORK === "mainnet-beta" ? "🟢 Mainnet" : "🟡 Devnet";
export const NETWORK_PILL_CLASS =
  SOLANA_NETWORK === "mainnet-beta"
    ? "border-emerald-500/35 text-emerald-300"
    : "border-amber-500/35 text-amber-200";

function buildClusterQuery() {
  return SOLANA_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet";
}

export function buildSolscanAccountUrl(address: string) {
  return `https://solscan.io/account/${address}${buildClusterQuery()}`;
}

export function buildSolscanTxUrl(signature: string) {
  return `https://solscan.io/tx/${signature}${buildClusterQuery()}`;
}

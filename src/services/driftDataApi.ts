import type { AssetSymbol, FundingPoint } from "@/types/dashboard";

const DRIFT_API_BASE = "https://data.api.drift.trade";
const TRACKED_SYMBOLS = ["SOL-PERP", "BTC-PERP", "ETH-PERP"] as const;

export interface DriftTelemetrySnapshot {
  generatedAt: string;
  liveFunding: Record<AssetSymbol, number>;
  fundingSeries: FundingPoint[];
}

interface DriftMarketsResponse {
  success?: boolean;
  markets?: Array<{
    symbol?: string;
    marketType?: string;
    fundingRate?: {
      long?: string | number;
      short?: string | number;
    };
    fundingRate24h?: string | number;
  }>;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Drift API failed (${response.status})`);
  }
  return (await response.json()) as T;
}

function symbolToAsset(symbol: string): AssetSymbol | null {
  if (symbol.startsWith("SOL-")) return "SOL";
  if (symbol.startsWith("BTC-")) return "BTC";
  if (symbol.startsWith("ETH-")) return "ETH";
  return null;
}

function parseFundingValue(value: string | number | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function hourLabelNow() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export async function fetchDriftTelemetry(): Promise<DriftTelemetrySnapshot> {
  const response = await fetchJson<DriftMarketsResponse>(`${DRIFT_API_BASE}/stats/markets`);
  const rows = response.markets ?? [];

  const fundingByAsset: Record<AssetSymbol, number> = {
    SOL: 0,
    BTC: 0,
    ETH: 0,
  };

  for (const row of rows) {
    const symbol = row.symbol ?? "";
    if (!TRACKED_SYMBOLS.includes(symbol as (typeof TRACKED_SYMBOLS)[number])) continue;
    if (row.marketType !== "perp") continue;

    const asset = symbolToAsset(symbol);
    if (!asset) continue;

    const liveFunding =
      parseFundingValue(row.fundingRate?.long) ??
      parseFundingValue(row.fundingRate24h) ??
      0;
    fundingByAsset[asset] = liveFunding;
  }

  return {
    generatedAt: new Date().toISOString(),
    liveFunding: fundingByAsset,
    fundingSeries: [
      {
        time: hourLabelNow(),
        SOL: fundingByAsset.SOL,
        BTC: fundingByAsset.BTC,
        ETH: fundingByAsset.ETH,
      },
    ],
  };
}

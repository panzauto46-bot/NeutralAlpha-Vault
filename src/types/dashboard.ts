export type AiAction = "HOLD" | "REBALANCE" | "ROTATE_ASSET";
export type AssetSymbol = "SOL" | "BTC" | "ETH";

export interface NavPoint {
  date: string;
  nav: number;
}

export interface FundingPoint {
  time: string;
  SOL: number;
  BTC: number;
  ETH: number;
}

export interface AllocationPoint {
  name: string;
  value: number;
  color: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  source: string;
  overview: {
    tvlUsd: number;
    tvlChangePct: number;
    currentApyPct: number;
    apyChangePct: number;
    healthRatio: number;
    deltaExposurePct: number;
  };
  navSeries: NavPoint[];
  fundingSeries: FundingPoint[];
  allocation: AllocationPoint[];
  signal: {
    action: AiAction;
    reason: string;
    activeAsset: AssetSymbol;
  };
  liveFunding: Record<AssetSymbol, number>;
  risk: {
    limits: {
      maxDeltaDriftPct: number;
      fundingRotateThresholdPctPer8h: number;
      fundingFlipThresholdPctPer8h: number;
      minHealthRatioTarget: number;
      emergencyHealthRatio: number;
      maxSlippagePct: number;
      maxSingleAssetExposurePct: number;
      maxLeverage: number;
      softDrawdownPct7d: number;
      hardDrawdownPctFromPeak: number;
    };
    drawdownFromPeakPct: number;
    drawdown7dPct: number;
    usdcPrice: number;
    depositPaused: boolean;
    emergencyState: boolean;
    alerts: string[];
  };
}

export interface VaultMutationResponse {
  ok: boolean;
  message: string;
  tvlUsd: number;
}

export interface VaultActivityItem {
  id: string;
  action: "DEPOSIT" | "WITHDRAW" | "REBALANCE";
  amountUsd: number;
  wallet: string;
  at: string;
  signature?: string;
  explorerUrl?: string;
  source?: "api" | "onchain" | "fallback";
}

import type { DashboardSnapshot } from "@/types/dashboard";

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function generateFundingSeries() {
  const data = [];
  for (let i = 0; i < 24; i += 1) {
    data.push({
      time: `${String(i).padStart(2, "0")}:00`,
      SOL: randomFloat(0.006, 0.016),
      BTC: randomFloat(0.005, 0.013),
      ETH: randomFloat(0.0055, 0.014),
    });
  }
  return data;
}

function generateNavSeries() {
  const data = [];
  let nav = 1_000_000;
  for (let i = 30; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    nav *= 1 + randomFloat(-0.001, 0.006);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      nav: Math.round(nav),
    });
  }
  return data;
}

export function getFallbackSnapshot(): DashboardSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    source: "frontend-fallback",
    overview: {
      tvlUsd: 2_847_392,
      tvlChangePct: 0.8,
      currentApyPct: 24.8,
      apyChangePct: 0.4,
      healthRatio: 1.72,
      deltaExposurePct: -0.8,
    },
    navSeries: generateNavSeries(),
    fundingSeries: generateFundingSeries(),
    allocation: [
      { name: "Spot SOL", value: 48, color: "#22c55e" },
      { name: "Short SOL-PERP", value: 48, color: "#8b5cf6" },
      { name: "USDC Reserve", value: 4, color: "#64748b" },
    ],
    signal: {
      action: "HOLD",
      reason: "Fallback mode active. API unavailable.",
      activeAsset: "SOL",
    },
    liveFunding: {
      SOL: 0.0112,
      BTC: 0.0089,
      ETH: 0.0095,
    },
    risk: {
      limits: {
        maxDeltaDriftPct: 2,
        fundingRotateThresholdPctPer8h: 0.005,
        fundingFlipThresholdPctPer8h: 0.003,
        minHealthRatioTarget: 1.5,
        emergencyHealthRatio: 1.15,
        maxSlippagePct: 0.3,
        maxSingleAssetExposurePct: 60,
        maxLeverage: 2,
        softDrawdownPct7d: 5,
        hardDrawdownPctFromPeak: 10,
      },
      drawdownFromPeakPct: 1.9,
      drawdown7dPct: 0.9,
      usdcPrice: 1,
      depositPaused: false,
      emergencyState: false,
      alerts: [],
    },
  };
}

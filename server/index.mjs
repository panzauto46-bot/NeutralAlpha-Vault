import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const POLL_TICK_MS = 5000;

const RISK_LIMITS = {
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
};

const state = createInitialState();
setInterval(() => tickState(state), POLL_TICK_MS).unref();

function createInitialState() {
  const initialNav = 2_847_392;
  const now = new Date();
  const navSeries = [];
  let rolling = initialNav * 0.88;
  for (let i = 30; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    rolling *= 1 + randomFloat(-0.0012, 0.0044);
    navSeries.push({
      date: formatDate(date),
      nav: Math.round(rolling),
    });
  }

  const fundingSeries = [];
  for (let i = 23; i >= 0; i -= 1) {
    const time = new Date(now);
    time.setHours(now.getHours() - i);
    fundingSeries.push({
      time: formatHour(time),
      SOL: clamp(0.011 + randomFloat(-0.003, 0.003), 0.003, 0.025),
      BTC: clamp(0.009 + randomFloat(-0.0025, 0.0025), 0.003, 0.022),
      ETH: clamp(0.010 + randomFloat(-0.003, 0.003), 0.003, 0.024),
    });
  }

  return {
    tvlUsd: initialNav,
    navUsd: initialNav,
    navPeakUsd: Math.max(...navSeries.map((point) => point.nav)),
    healthRatio: 1.72,
    deltaExposurePct: -0.8,
    currentApyPct: 24.8,
    liveFunding: {
      SOL: 0.0112,
      BTC: 0.0089,
      ETH: 0.0095,
    },
    activeAsset: "SOL",
    signal: {
      action: "HOLD",
      reason: "Delta and funding are inside target band.",
    },
    navSeries,
    fundingSeries,
    allocation: [
      { name: "Spot SOL", value: 48, color: "#22c55e" },
      { name: "Short SOL-PERP", value: 48, color: "#8b5cf6" },
      { name: "USDC Reserve", value: 4, color: "#64748b" },
    ],
    fundingFlipStreak: 0,
    drawdown7dPct: 0,
    drawdownFromPeakPct: 0,
    usdcPrice: 1,
    depositPaused: false,
    emergencyState: false,
    riskAlerts: [],
    lastUpdate: new Date().toISOString(),
    activity: [],
  };
}

function tickState(vault) {
  vault.liveFunding.SOL = driftRate(vault.liveFunding.SOL, 0.0102, 0.0014, 0.002, 0.022);
  vault.liveFunding.BTC = driftRate(vault.liveFunding.BTC, 0.0082, 0.0010, 0.0015, 0.020);
  vault.liveFunding.ETH = driftRate(vault.liveFunding.ETH, 0.0092, 0.0012, 0.0016, 0.021);
  vault.usdcPrice = clamp(driftRate(vault.usdcPrice, 1, 0.0007, 0.965, 1.01), 0.965, 1.01);

  vault.deltaExposurePct = clamp(vault.deltaExposurePct + randomFloat(-0.35, 0.35), -3.5, 3.5);

  const currentFunding = vault.liveFunding[vault.activeAsset];
  if (currentFunding < RISK_LIMITS.fundingFlipThresholdPctPer8h) {
    vault.fundingFlipStreak += 1;
  } else {
    vault.fundingFlipStreak = 0;
  }

  let action = "HOLD";
  let reason = "Delta and funding are inside target band.";

  if (Math.abs(vault.deltaExposurePct) > RISK_LIMITS.maxDeltaDriftPct) {
    action = "REBALANCE";
    reason = `Delta drift ${vault.deltaExposurePct.toFixed(2)}% breached ±${RISK_LIMITS.maxDeltaDriftPct}% threshold.`;
    vault.deltaExposurePct *= 0.45;
  } else if (
    currentFunding < RISK_LIMITS.fundingRotateThresholdPctPer8h ||
    vault.fundingFlipStreak >= 2
  ) {
    const bestAsset = getBestFundingAsset(vault.liveFunding);
    if (bestAsset !== vault.activeAsset) {
      vault.activeAsset = bestAsset;
    }
    action = "ROTATE_ASSET";
    reason = `Funding on ${vault.activeAsset}-PERP is prioritized at ${(vault.liveFunding[vault.activeAsset] * 100).toFixed(3)}%.`;
  }

  vault.signal = { action, reason };

  const activeFunding = vault.liveFunding[vault.activeAsset];
  const fundingEdge = (activeFunding - 0.0045) * 0.0018;
  const rebalanceCost = action === "REBALANCE" ? 0.00045 : 0.00008;
  const randomNoise = randomFloat(-0.00006, 0.00014);
  const pnlTick = clamp(fundingEdge + randomNoise - rebalanceCost, -0.0005, 0.0007);
  vault.navUsd = Math.max(250_000, Math.round(vault.navUsd * (1 + pnlTick)));
  vault.tvlUsd = Math.round(vault.navUsd * (1 + randomFloat(-0.0004, 0.0005)));
  vault.navPeakUsd = Math.max(vault.navPeakUsd, vault.navUsd);

  vault.healthRatio = clamp(
    1.74 - Math.abs(vault.deltaExposurePct) * 0.12 + randomFloat(-0.015, 0.015),
    1.1,
    2.1,
  );

  const drawdownFromPeak = ((vault.navPeakUsd - vault.navUsd) / vault.navPeakUsd) * 100;
  const navSevenDaysAgo = vault.navSeries[Math.max(0, vault.navSeries.length - 8)].nav;
  const drawdown7d = Math.max(0, ((navSevenDaysAgo - vault.navUsd) / navSevenDaysAgo) * 100);
  vault.drawdownFromPeakPct = Number(drawdownFromPeak.toFixed(3));
  vault.drawdown7dPct = Number(drawdown7d.toFixed(3));
  vault.depositPaused = drawdown7d > RISK_LIMITS.softDrawdownPct7d;
  vault.emergencyState =
    vault.healthRatio < RISK_LIMITS.emergencyHealthRatio ||
    drawdownFromPeak > RISK_LIMITS.hardDrawdownPctFromPeak ||
    vault.usdcPrice < 0.98;

  if (vault.emergencyState) {
    vault.signal = {
      action: "REBALANCE",
      reason: "Emergency mode active. Execute full unwind safeguards.",
    };
    vault.allocation = [{ name: "USDC Reserve", value: 100, color: "#64748b" }];
  } else {
    vault.allocation = buildAllocation(vault.activeAsset, vault.healthRatio);
  }
  vault.riskAlerts = buildRiskAlerts(vault);

  const riskPenalty = drawdownFromPeak > 6 ? 0.7 : 0;
  vault.currentApyPct = clamp(
    vault.currentApyPct * 0.96 + activeFunding * 920 + randomFloat(-0.3, 0.3) - riskPenalty,
    10,
    42,
  );

  pushFundingHistory(vault.fundingSeries, vault.liveFunding);
  updateNavToday(vault.navSeries, vault.navUsd);
  vault.lastUpdate = new Date().toISOString();
}

function buildAllocation(activeAsset, healthRatio) {
  const reserveBoost = healthRatio < 1.45 ? 7 : 4;
  const riskCut = healthRatio < 1.45 ? 5 : 0;
  const spotValue = 48 - riskCut;
  const shortValue = 48 - riskCut;
  return [
    { name: `Spot ${activeAsset}`, value: spotValue, color: "#22c55e" },
    { name: `Short ${activeAsset}-PERP`, value: shortValue, color: "#8b5cf6" },
    { name: "USDC Reserve", value: reserveBoost, color: "#64748b" },
  ];
}

function pushFundingHistory(series, liveFunding) {
  series.push({
    time: formatHour(new Date()),
    SOL: liveFunding.SOL,
    BTC: liveFunding.BTC,
    ETH: liveFunding.ETH,
  });
  if (series.length > 24) {
    series.shift();
  }
}

function updateNavToday(series, navUsd) {
  if (series.length === 0) return;
  series[series.length - 1].nav = navUsd;
}

function getBestFundingAsset(funding) {
  const pairs = Object.entries(funding);
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs[0][0];
}

function driftRate(current, target, volatility, min, max) {
  const pull = (target - current) * 0.24;
  const next = current + pull + randomFloat(-volatility, volatility);
  return clamp(next, min, max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatHour(date) {
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function buildRiskAlerts(vault) {
  const alerts = [];
  if (Math.abs(vault.deltaExposurePct) > RISK_LIMITS.maxDeltaDriftPct) {
    alerts.push(`Delta drift breached threshold: ${vault.deltaExposurePct.toFixed(2)}%`);
  }
  if (vault.healthRatio < RISK_LIMITS.minHealthRatioTarget) {
    alerts.push(`Health ratio below target: ${vault.healthRatio.toFixed(2)}`);
  }
  if (vault.depositPaused) {
    alerts.push(`Soft drawdown triggered (${vault.drawdown7dPct.toFixed(2)}% / 7d). Deposits paused.`);
  }
  if (vault.usdcPrice < 0.98) {
    alerts.push(`USDC depeg trigger: $${vault.usdcPrice.toFixed(4)} < $0.98`);
  }
  if (vault.emergencyState) {
    alerts.push("Emergency protection mode is active.");
  }
  return alerts;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });
    req.on("error", reject);
  });
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function getDashboardSnapshot() {
  return {
    generatedAt: state.lastUpdate,
    source: "simulated-live",
    overview: {
      tvlUsd: state.tvlUsd,
      tvlChangePct: randomFloat(0.2, 1.8),
      currentApyPct: state.currentApyPct,
      apyChangePct: randomFloat(-0.7, 1.5),
      healthRatio: state.healthRatio,
      deltaExposurePct: state.deltaExposurePct,
    },
    navSeries: state.navSeries,
    fundingSeries: state.fundingSeries,
    allocation: state.allocation,
    signal: {
      action: state.signal.action,
      reason: state.signal.reason,
      activeAsset: state.activeAsset,
    },
    liveFunding: state.liveFunding,
    risk: {
      limits: RISK_LIMITS,
      drawdownFromPeakPct: state.drawdownFromPeakPct,
      drawdown7dPct: state.drawdown7dPct,
      usdcPrice: state.usdcPrice,
      depositPaused: state.depositPaused,
      emergencyState: state.emergencyState,
      alerts: state.riskAlerts,
    },
  };
}

function recordActivity(action, amount, wallet) {
  state.activity.unshift({
    id: randomUUID(),
    action,
    amountUsd: amount,
    wallet,
    at: new Date().toISOString(),
  });
  if (state.activity.length > 25) {
    state.activity.pop();
  }
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    json(res, 400, { error: "Invalid request." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;

  try {
    if (req.method === "GET" && pathname === "/api/v1/health") {
      json(res, 200, {
        status: "ok",
        service: "neutralalpha-telemetry",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/contracts") {
      json(res, 200, {
        riskLimits: RISK_LIMITS,
        actions: ["HOLD", "REBALANCE", "ROTATE_ASSET"],
        baseAsset: "USDC",
        lockTenor: "3-month rolling",
      });
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/dashboard") {
      json(res, 200, getDashboardSnapshot());
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/vault/activity") {
      json(res, 200, { items: state.activity });
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/risk/simulate") {
      const body = await parseBody(req);
      if (Number.isFinite(Number(body.usdcPrice))) {
        state.usdcPrice = clamp(Number(body.usdcPrice), 0.9, 1.05);
      }
      if (Number.isFinite(Number(body.healthRatio))) {
        state.healthRatio = clamp(Number(body.healthRatio), 0.9, 2.5);
      }
      if (Number.isFinite(Number(body.deltaExposurePct))) {
        state.deltaExposurePct = clamp(Number(body.deltaExposurePct), -8, 8);
      }
      state.lastUpdate = new Date().toISOString();
      tickState(state);
      json(res, 200, { ok: true, risk: getDashboardSnapshot().risk, signal: state.signal });
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/vault/deposit") {
      const body = await parseBody(req);
      const amount = Number(body.amountUsd);
      const slippagePct = Number(body.slippagePct ?? 0);
      const wallet = typeof body.wallet === "string" ? body.wallet : "guest";
      if (!Number.isFinite(amount) || amount <= 0) {
        json(res, 400, { error: "amountUsd must be a positive number." });
        return;
      }
      if (slippagePct > RISK_LIMITS.maxSlippagePct) {
        json(res, 400, { error: `Slippage ${slippagePct}% exceeds cap ${RISK_LIMITS.maxSlippagePct}%.` });
        return;
      }
      if (state.depositPaused || state.emergencyState) {
        json(res, 423, { error: "Deposits are temporarily paused by risk controls." });
        return;
      }
      state.tvlUsd += amount;
      state.navUsd += amount;
      updateNavToday(state.navSeries, state.navUsd);
      recordActivity("DEPOSIT", Math.round(amount), wallet);
      state.lastUpdate = new Date().toISOString();
      json(res, 200, {
        ok: true,
        message: "Deposit simulated successfully.",
        tvlUsd: state.tvlUsd,
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/vault/withdraw") {
      const body = await parseBody(req);
      const amount = Number(body.amountUsd);
      const slippagePct = Number(body.slippagePct ?? 0);
      const wallet = typeof body.wallet === "string" ? body.wallet : "guest";
      if (!Number.isFinite(amount) || amount <= 0) {
        json(res, 400, { error: "amountUsd must be a positive number." });
        return;
      }
      if (slippagePct > RISK_LIMITS.maxSlippagePct) {
        json(res, 400, { error: `Slippage ${slippagePct}% exceeds cap ${RISK_LIMITS.maxSlippagePct}%.` });
        return;
      }
      if (amount > state.tvlUsd) {
        json(res, 400, { error: "Insufficient TVL for simulated withdrawal." });
        return;
      }
      state.tvlUsd -= amount;
      state.navUsd -= amount;
      updateNavToday(state.navSeries, state.navUsd);
      recordActivity("WITHDRAW", Math.round(amount), wallet);
      state.lastUpdate = new Date().toISOString();
      json(res, 200, {
        ok: true,
        message: "Withdrawal simulated successfully.",
        tvlUsd: state.tvlUsd,
      });
      return;
    }

    json(res, 404, { error: "Endpoint not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    json(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[neutralalpha-api] listening on http://localhost:${PORT}`);
});

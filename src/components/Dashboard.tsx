import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Activity,
  Shield,
  Zap,
  DollarSign,
  RefreshCw,
  Clock,
} from "lucide-react";
import { fetchDashboardSnapshot, postDeposit } from "@/services/dashboardApi";
import { getFallbackSnapshot } from "@/services/dashboardFallback";
import type { AiAction, DashboardSnapshot } from "@/types/dashboard";
import { useWallet } from "@/context/WalletContext";

type DataMode = "live" | "fallback";

const POLL_INTERVAL_MS = 15_000;

const SIGNAL_STYLES: Record<AiAction, { panel: string; text: string }> = {
  HOLD: {
    panel: "bg-green-500/10 border border-green-500/20",
    text: "text-green-400",
  },
  REBALANCE: {
    panel: "bg-yellow-500/10 border border-yellow-500/20",
    text: "text-yellow-400",
  },
  ROTATE_ASSET: {
    panel: "bg-purple-500/10 border border-purple-500/20",
    text: "text-purple-400",
  },
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatSignedPercent(value: number, digits = 1) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatPercent(value: number, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

function toLastUpdateLabel(isoDate: string) {
  return new Date(isoDate).toLocaleTimeString();
}

export default function Dashboard() {
  const { walletAddress, walletReady } = useWallet();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(() => getFallbackSnapshot());
  const [dataMode, setDataMode] = useState<DataMode>("fallback");
  const [statusLabel, setStatusLabel] = useState("Connecting to telemetry API...");
  const [isLoading, setIsLoading] = useState(true);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPending, setDepositPending] = useState(false);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await fetchDashboardSnapshot();
      setSnapshot(nextSnapshot);
      setDataMode("live");
      setStatusLabel("Live data stream active.");
    } catch {
      setSnapshot(getFallbackSnapshot());
      setDataMode("fallback");
      setStatusLabel("API unavailable. Showing fallback data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    const interval = window.setInterval(() => {
      void loadSnapshot();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadSnapshot]);

  const metrics = useMemo(
    () => [
      {
        label: "Total Value Locked",
        value: formatUsd(snapshot.overview.tvlUsd),
        change: formatSignedPercent(snapshot.overview.tvlChangePct),
        positive: snapshot.overview.tvlChangePct >= 0,
        icon: DollarSign,
      },
      {
        label: "Current APY",
        value: formatPercent(snapshot.overview.currentApyPct, 1),
        change: formatSignedPercent(snapshot.overview.apyChangePct),
        positive: snapshot.overview.apyChangePct >= 0,
        icon: TrendingUp,
      },
      {
        label: "Health Ratio",
        value: snapshot.overview.healthRatio.toFixed(2),
        change:
          snapshot.overview.healthRatio >= snapshot.risk.limits.minHealthRatioTarget
            ? "Safe"
            : "Watch",
        positive: snapshot.overview.healthRatio >= snapshot.risk.limits.minHealthRatioTarget,
        icon: Shield,
      },
      {
        label: "Delta Exposure",
        value: formatSignedPercent(snapshot.overview.deltaExposurePct, 2),
        change:
          Math.abs(snapshot.overview.deltaExposurePct) <= snapshot.risk.limits.maxDeltaDriftPct
            ? "Neutral"
            : "Rebalance",
        positive:
          Math.abs(snapshot.overview.deltaExposurePct) <= snapshot.risk.limits.maxDeltaDriftPct,
        icon: Activity,
      },
    ],
    [snapshot],
  );

  const signalStyle = SIGNAL_STYLES[snapshot.signal.action];
  const liveFundingEntries = Object.entries(snapshot.liveFunding);

  async function handleDepositClick() {
    if (snapshot.risk.depositPaused || snapshot.risk.emergencyState) {
      setDepositMessage("Deposits are paused by risk controls.");
      return;
    }
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setDepositMessage("Enter a valid amount.");
      return;
    }
    setDepositPending(true);
    setDepositMessage(null);

    try {
      const result = await postDeposit(amount, walletAddress ?? "guest");
      setDepositMessage(result.message);
      setDepositAmount("");
      await loadSnapshot();
    } catch {
      setDepositMessage("Deposit failed. API may be offline.");
    } finally {
      setDepositPending(false);
    }
  }

  return (
    <section id="dashboard" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Live Vault Dashboard</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-4">
            Real-time metrics and AI monitoring for complete transparency
          </p>
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5">
            <span
              className={`w-2 h-2 rounded-full ${
                dataMode === "live" ? "bg-green-400" : "bg-yellow-400"
              }`}
            />
            <span className="text-slate-300">
              {dataMode === "live" ? "Live API" : "Fallback Mode"} | {statusLabel}
            </span>
            {isLoading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-2xl p-6 card-hover"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <metric.icon className="w-5 h-5 text-green-400" />
                </div>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    metric.positive
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {metric.change}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{metric.value}</div>
              <div className="text-sm text-slate-500">{metric.label}</div>
            </motion.div>
          ))}
        </div>

        {snapshot.risk.alerts.length > 0 && (
          <div className="mb-8 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
            <div className="text-sm text-yellow-300 font-medium mb-2">Risk Alerts</div>
            <div className="space-y-1">
              {snapshot.risk.alerts.map((alert, index) => (
                <p key={`${alert}-${index}`} className="text-xs text-yellow-100/90">
                  {alert}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 glass rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Vault NAV</h3>
                <p className="text-sm text-slate-500">30-day performance</p>
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">{formatPercent(snapshot.overview.currentApyPct, 1)}</span>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshot.navSeries}>
                  <defs>
                    <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#32324a" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(v) => `$${(v / 1_000_000).toFixed(2)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                    }}
                    formatter={(value) => [formatUsd(Number(value)), "NAV"]}
                  />
                  <Area type="monotone" dataKey="nav" stroke="#22c55e" strokeWidth={2} fill="url(#navGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Position Allocation</h3>
            <p className="text-sm text-slate-500 mb-4">Current exposure</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={snapshot.allocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {snapshot.allocation.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {snapshot.allocation.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-400">{item.name}</span>
                  </div>
                  <span className="text-white font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 glass rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Funding Rates (8hr)</h3>
                <p className="text-sm text-slate-500">Last 24 hours</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-slate-400">SOL</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-400" />
                  <span className="text-slate-400">BTC</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-slate-400">ETH</span>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.fundingSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#32324a" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(2)}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                    }}
                    formatter={(value) => [`${(Number(value) * 100).toFixed(3)}%`, ""]}
                  />
                  <Line type="monotone" dataKey="SOL" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="BTC" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ETH" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">AI Signal Engine</h3>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${signalStyle.panel}`}>
              <div className="text-sm text-slate-400 mb-1">Current Signal</div>
              <div className={`text-2xl font-bold ${signalStyle.text}`}>{snapshot.signal.action}</div>
              <div className="text-xs text-slate-400 mt-2">{snapshot.signal.reason}</div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="text-sm text-slate-400 mb-2">
                Live Funding (8hr) | Active: {snapshot.signal.activeAsset}-PERP
              </div>
              {liveFundingEntries.map(([asset, rate]) => (
                <div key={asset} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-white font-medium">{asset}-PERP</span>
                  <span className={`font-mono ${rate > 0.01 ? "text-green-400" : "text-yellow-400"}`}>
                    {(rate * 100).toFixed(3)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Last update</span>
              </div>
              <span>{toLastUpdateLabel(snapshot.generatedAt)}</span>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 glass rounded-2xl p-8"
        >
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-white mb-3">Start Earning Today</h3>
              <p className="text-slate-400 mb-6">
                Deposit USDC to start earning delta-neutral yield. Risk limits are enforced with
                health ratio guardrails and automated signal-driven actions.
              </p>
              <div className="mb-5 text-xs text-slate-500 space-y-1">
                <p>7d drawdown: {formatPercent(snapshot.risk.drawdown7dPct, 2)}</p>
                <p>Peak drawdown: {formatPercent(snapshot.risk.drawdownFromPeakPct, 2)}</p>
                <p className={snapshot.risk.usdcPrice < 0.99 ? "text-yellow-300" : ""}>
                  USDC price: ${snapshot.risk.usdcPrice.toFixed(4)}
                </p>
                <p>
                  Wallet:{" "}
                  {walletAddress
                    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
                    : walletReady
                      ? "not connected"
                      : "Phantom not detected"}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span>Delta Protected</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <RefreshCw className="w-4 h-4 text-purple-400" />
                  <span>AI Rebalancing</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span>3-Month Lock</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full p-4 pr-24 rounded-xl bg-white/5 border border-white/10 text-white text-xl font-medium placeholder:text-slate-600 focus:outline-none focus:border-green-500/50"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white">
                    $
                  </div>
                  <span className="text-white font-medium">USDC</span>
                </div>
              </div>
              <button
                onClick={() => void handleDepositClick()}
                disabled={depositPending || snapshot.risk.depositPaused || snapshot.risk.emergencyState}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {snapshot.risk.emergencyState
                  ? "Emergency Mode"
                  : snapshot.risk.depositPaused
                    ? "Deposits Paused"
                    : depositPending
                      ? "Processing..."
                      : "Deposit USDC"}
              </button>
              {depositMessage && <p className="text-xs text-slate-400 text-center">{depositMessage}</p>}
              <p className="text-xs text-slate-500 text-center">
                By depositing, you agree to the 3-month rolling lock period
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

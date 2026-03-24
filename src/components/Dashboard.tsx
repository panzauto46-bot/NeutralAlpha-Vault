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
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import {
  fetchDashboardSnapshot,
  fetchVaultActivity,
  postDeposit,
  postWithdraw,
} from "@/services/dashboardApi";
import { getFallbackSnapshot } from "@/services/dashboardFallback";
import type { AiAction, DashboardSnapshot, VaultActivityItem } from "@/types/dashboard";
import { useWallet } from "@/context/WalletContext";
import {
  fetchOnChainActivity,
  fetchOnChainSnapshot,
  isOnChainConfigured,
  sendOnChainDeposit,
  sendOnChainWithdraw,
  type OnChainSnapshot,
} from "@/services/vaultProgram";
import { cn } from "@/utils/cn";

type DataMode = "live" | "fallback";

const POLL_INTERVAL_MS = 15_000;
const QUICK_AMOUNTS_USD = [25, 100, 250];
const FALLBACK_LOCK_PERIOD_MS = 90 * 24 * 60 * 60 * 1_000;

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
    panel: "bg-blue-500/10 border border-blue-500/20",
    text: "text-blue-300",
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

function shortWallet(value: string) {
  if (!value) return "guest";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatActivityDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms: number) {
  if (ms <= 0) {
    return "Unlocked";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
}

function getFallbackActivity(walletAddress: string | null): VaultActivityItem[] {
  const now = Date.now();
  const wallet = walletAddress ?? "guest";
  return [
    {
      id: "fallback-1",
      action: "DEPOSIT",
      amountUsd: 100,
      wallet,
      at: new Date(now - 36 * 60 * 1000).toISOString(),
      source: "fallback",
    },
    {
      id: "fallback-2",
      action: "WITHDRAW",
      amountUsd: 40,
      wallet,
      at: new Date(now - 12 * 60 * 1000).toISOString(),
      source: "fallback",
    },
  ];
}

function getWalletProvider() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.phantom?.solana ?? window.solana ?? null;
}

export default function Dashboard() {
  const { walletAddress, walletReady } = useWallet();

  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(() => getFallbackSnapshot());
  const [dataMode, setDataMode] = useState<DataMode>("fallback");
  const [statusLabel, setStatusLabel] = useState("Connecting to telemetry API...");
  const [isLoading, setIsLoading] = useState(true);

  const [onChainSnapshot, setOnChainSnapshot] = useState<OnChainSnapshot | null>(null);
  const [onChainStatus, setOnChainStatus] = useState("On-chain sync idle.");

  const [depositAmount, setDepositAmount] = useState("");
  const [depositPending, setDepositPending] = useState(false);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

  const [latestTx, setLatestTx] = useState<{
    action: "DEPOSIT" | "WITHDRAW";
    signature: string;
    explorerUrl: string;
  } | null>(null);

  const [activityItems, setActivityItems] = useState<VaultActivityItem[]>([]);
  const [nowTs, setNowTs] = useState(() => Date.now());

  const onChainReady = walletReady && Boolean(walletAddress) && isOnChainConfigured();

  const loadSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await fetchDashboardSnapshot();
      setSnapshot(nextSnapshot);
      setDataMode("live");
      setStatusLabel("Live telemetry stream active.");
    } catch {
      setSnapshot(getFallbackSnapshot());
      setDataMode("fallback");
      setStatusLabel("API unavailable. Showing fallback dataset.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOnChain = useCallback(async () => {
    if (!walletAddress || !isOnChainConfigured()) {
      setOnChainSnapshot(null);
      setOnChainStatus(
        isOnChainConfigured()
          ? "Connect wallet to sync on-chain vault data."
          : "Set VITE_VAULT_PROGRAM_ID and VITE_USDC_MINT to enable on-chain mode.",
      );
      return;
    }

    try {
      const next = await fetchOnChainSnapshot(walletAddress);
      setOnChainSnapshot(next);
      setOnChainStatus("On-chain vault state synced.");
    } catch {
      setOnChainSnapshot(null);
      setOnChainStatus("On-chain RPC unavailable. Using fallback data.");
    }
  }, [walletAddress]);

  const loadActivity = useCallback(async () => {
    if (isOnChainConfigured()) {
      try {
        const chainItems = await fetchOnChainActivity(25);
        setActivityItems(chainItems);
        return;
      } catch {
        // Continue to API/fallback.
      }
    }

    try {
      const payload = await fetchVaultActivity();
      setActivityItems(payload.items.map((item) => ({ ...item, source: "api" })));
    } catch {
      setActivityItems(getFallbackActivity(walletAddress));
    }
  }, [walletAddress]);

  useEffect(() => {
    void Promise.all([loadSnapshot(), loadActivity(), loadOnChain()]);
    const interval = window.setInterval(() => {
      void Promise.all([loadSnapshot(), loadActivity(), loadOnChain()]);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadActivity, loadOnChain, loadSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const walletKey = walletAddress ?? "guest";

  const walletActivity = useMemo(
    () => activityItems.filter((item) => item.wallet === walletKey),
    [activityItems, walletKey],
  );

  const simulatedShares = useMemo(() => {
    const netAmount = walletActivity.reduce((acc, item) => {
      if (item.action === "DEPOSIT") {
        return acc + item.amountUsd;
      }
      if (item.action === "WITHDRAW") {
        return acc - item.amountUsd;
      }
      return acc;
    }, 0);
    return Math.max(0, netAmount);
  }, [walletActivity]);

  const estimatedShares = onChainSnapshot ? onChainSnapshot.userShares : simulatedShares;

  const fallbackLastDepositAt = useMemo(() => {
    const deposits = walletActivity.filter((item) => item.action === "DEPOSIT");
    if (deposits.length === 0) {
      return null;
    }
    return deposits.reduce((latest, item) => (item.at > latest ? item.at : latest), deposits[0].at);
  }, [walletActivity]);

  const unlockTsMs = useMemo(() => {
    if (onChainSnapshot?.userUnlockTs && onChainSnapshot.userUnlockTs > 0) {
      return onChainSnapshot.userUnlockTs * 1000;
    }
    if (!fallbackLastDepositAt) {
      return null;
    }
    return new Date(fallbackLastDepositAt).getTime() + FALLBACK_LOCK_PERIOD_MS;
  }, [fallbackLastDepositAt, onChainSnapshot]);

  const lockRemainingMs = unlockTsMs ? unlockTsMs - nowTs : 0;
  const isLocked = Boolean(unlockTsMs && lockRemainingMs > 0 && !onChainSnapshot?.emergencyMode);

  const quickWithdrawOptions = useMemo(() => {
    if (estimatedShares <= 0) {
      return [];
    }
    const values = [0.25, 0.5, 1].map((factor) => Number((estimatedShares * factor).toFixed(2)));
    return [...new Set(values)].filter((value) => value > 0);
  }, [estimatedShares]);

  const tvlForDisplay = onChainSnapshot ? onChainSnapshot.totalUsdc : snapshot.overview.tvlUsd;

  const metrics = useMemo(
    () => [
      {
        label: "Total Value Locked",
        value: formatUsd(tvlForDisplay),
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
    [snapshot, tvlForDisplay],
  );

  const signalStyle = SIGNAL_STYLES[snapshot.signal.action];
  const liveFundingEntries = Object.entries(snapshot.liveFunding);
  const recentActivity = useMemo(() => activityItems.slice(0, 6), [activityItems]);

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
      if (onChainReady && walletAddress) {
        const provider = getWalletProvider();
        if (!provider) {
          throw new Error("Wallet provider not found in browser.");
        }
        const result = await sendOnChainDeposit(provider, walletAddress, amount);
        setLatestTx({ action: "DEPOSIT", signature: result.signature, explorerUrl: result.explorerUrl });
        setDepositMessage(`Deposit confirmed on-chain: ${result.signature.slice(0, 8)}...`);
      } else {
        const result = await postDeposit(amount, walletKey);
        setLatestTx(null);
        setDepositMessage(result.message);
      }

      setDepositAmount("");
      await Promise.all([loadSnapshot(), loadActivity(), loadOnChain()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setDepositMessage(`Deposit failed: ${message}`);
    } finally {
      setDepositPending(false);
    }
  }

  async function handleWithdrawClick() {
    if (isLocked) {
      setWithdrawMessage("Position is still in lock period.");
      return;
    }

    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawMessage("Enter a valid withdraw amount.");
      return;
    }
    if (amount > estimatedShares) {
      setWithdrawMessage("Withdraw amount exceeds your available shares.");
      return;
    }

    setWithdrawPending(true);
    setWithdrawMessage(null);

    try {
      if (onChainReady && walletAddress) {
        const provider = getWalletProvider();
        if (!provider) {
          throw new Error("Wallet provider not found in browser.");
        }
        const result = await sendOnChainWithdraw(provider, walletAddress, amount);
        setLatestTx({ action: "WITHDRAW", signature: result.signature, explorerUrl: result.explorerUrl });
        setWithdrawMessage(`Withdraw confirmed on-chain: ${result.signature.slice(0, 8)}...`);
      } else {
        const result = await postWithdraw(amount, walletKey);
        setLatestTx(null);
        setWithdrawMessage(result.message);
      }

      setWithdrawAmount("");
      await Promise.all([loadSnapshot(), loadActivity(), loadOnChain()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setWithdrawMessage(`Withdraw failed: ${message}`);
    } finally {
      setWithdrawPending(false);
    }
  }

  return (
    <section id="dashboard" className="relative pt-10 pb-16">
      <div id="overview" className="absolute -top-24" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-2">Application Dashboard</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">Live Vault Dashboard</h2>
              <p className="text-slate-400 max-w-2xl">
                Operational view for vault metrics, user actions, and recent activity.
              </p>
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 h-fit">
                <span
                  className={`w-2 h-2 rounded-full ${dataMode === "live" ? "bg-green-400" : "bg-yellow-400"}`}
                />
                <span className="text-slate-300">
                  {dataMode === "live" ? "Live API" : "Fallback"} | {statusLabel}
                </span>
                {isLoading ? <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" /> : null}
              </div>
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 h-fit">
                <span className={`w-2 h-2 rounded-full ${onChainSnapshot ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span className="text-slate-300">{onChainStatus}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4">
              {metrics.map((metric, i) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
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

            {snapshot.risk.alerts.length > 0 ? (
              <div className="mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
                <div className="text-sm text-yellow-300 font-medium mb-2">Risk Alerts</div>
                <div className="space-y-1">
                  {snapshot.risk.alerts.map((alert, index) => (
                    <p key={`${alert}-${index}`} className="text-xs text-yellow-100/90">
                      {alert}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <motion.div
            id="actions"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Wallet className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Vault Actions</h3>
            </div>
            <div className="mb-4 text-xs text-slate-500 space-y-1">
              <p>Wallet: {walletAddress ? shortWallet(walletAddress) : walletReady ? "not connected" : "Phantom not detected"}</p>
              <p>USDC price: ${snapshot.risk.usdcPrice.toFixed(4)}</p>
              <p>7d drawdown: {formatPercent(snapshot.risk.drawdown7dPct, 2)}</p>
              <p>Mode: {onChainReady ? "On-chain transactions" : "Simulation fallback"}</p>
            </div>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-500 mb-2">Your Position</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Shares Balance</span>
                  <span className="text-white font-semibold">{formatUsd(estimatedShares)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Lock Status</span>
                  <span className={isLocked ? "text-yellow-300" : "text-green-300"}>
                    {isLocked ? `Locked (${formatCountdown(lockRemainingMs)})` : "Unlocked"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Unlock At</span>
                  <span className="text-slate-300">
                    {unlockTsMs ? new Date(unlockTsMs).toLocaleString() : "No active lock"}
                  </span>
                </div>
                {onChainSnapshot ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Share Mint</span>
                    <span className="text-slate-300">{shortWallet(onChainSnapshot.shareMintAddress)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-2">Deposit</p>
            <div className="relative mb-3">
              <input
                type="number"
                min="0"
                step="0.01"
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
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {QUICK_AMOUNTS_USD.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setDepositAmount(String(amount))}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 hover:text-white hover:border-green-500/40 hover:bg-green-500/10 transition-colors"
                >
                  ${amount}
                </button>
              ))}
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
                    : onChainReady
                      ? "Deposit USDC On-Chain"
                      : "Deposit (Simulated)"}
            </button>
            {depositMessage ? <p className="text-xs text-slate-400 text-center mt-3">{depositMessage}</p> : null}

            <div className="my-4 border-t border-white/10" />

            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 mb-2">Withdraw</p>
            <div className="relative mb-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="0.00"
                className="w-full p-4 pr-24 rounded-xl bg-white/5 border border-white/10 text-white text-xl font-medium placeholder:text-slate-600 focus:outline-none focus:border-blue-300/50"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-white font-medium">USDC</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {quickWithdrawOptions.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setWithdrawAmount(String(amount))}
                  className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-300 hover:text-white hover:border-blue-300/40 hover:bg-blue-500/10 transition-colors"
                >
                  {formatUsd(amount)}
                </button>
              ))}
            </div>
            <button
              onClick={() => void handleWithdrawClick()}
              disabled={withdrawPending || isLocked || estimatedShares <= 0}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLocked
                ? "Locked"
                : withdrawPending
                  ? "Processing..."
                  : onChainReady
                    ? "Withdraw On-Chain"
                    : "Withdraw (Simulated)"}
            </button>
            {withdrawMessage ? <p className="text-xs text-slate-400 text-center mt-3">{withdrawMessage}</p> : null}

            {latestTx ? (
              <a
                href={latestTx.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-xs text-green-300 hover:text-green-200 inline-flex items-center gap-1"
              >
                View {latestTx.action.toLowerCase()} tx on Solscan
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}

            <p className="text-xs text-slate-500 text-center mt-3">
              3-month rolling lock is enforced per latest deposit.
            </p>
          </motion.div>
        </div>
        <div id="analytics" className="grid lg:grid-cols-3 gap-6 mb-8">
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
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${(v / 1_000_000).toFixed(2)}M`} />
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
                  <Pie data={snapshot.allocation} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value">
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

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
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
                  <div className="w-3 h-3 rounded-full bg-blue-300" />
                  <span className="text-slate-400">BTC</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-300" />
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
                  <Line type="monotone" dataKey="BTC" stroke="#93c5fd" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ETH" stroke="#67e8f9" strokeWidth={2} dot={false} />
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
              <Zap className="w-5 h-5 text-blue-300" />
              <h3 className="text-lg font-semibold text-white">AI Signal Engine</h3>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${signalStyle.panel}`}>
              <div className="text-sm text-slate-400 mb-1">Current Signal</div>
              <div className={`text-2xl font-bold ${signalStyle.text}`}>{snapshot.signal.action}</div>
              <div className="text-xs text-slate-400 mt-2">{snapshot.signal.reason}</div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="text-sm text-slate-400 mb-2">Live Funding (8hr) | Active: {snapshot.signal.activeAsset}-PERP</div>
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
          id="activity"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            <span className="text-xs text-slate-500">Last {recentActivity.length} records</span>
          </div>

          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((item) => {
                const isDeposit = item.action === "DEPOSIT";
                const isWithdraw = item.action === "WITHDRAW";
                const iconClasses = isDeposit
                  ? "bg-green-500/15 text-green-400"
                  : isWithdraw
                    ? "bg-blue-500/15 text-blue-300"
                    : "bg-yellow-500/15 text-yellow-300";
                const valueClasses = isDeposit
                  ? "text-green-400"
                  : isWithdraw
                    ? "text-blue-300"
                    : "text-yellow-300";
                const label = isDeposit ? "Deposit" : isWithdraw ? "Withdraw" : "Rebalance";
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg grid place-items-center",
                          iconClasses,
                        )}
                      >
                        {isDeposit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : isWithdraw ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{label}</p>
                        <p className="text-xs text-slate-500">
                          {shortWallet(item.wallet)} | {formatActivityDate(item.at)}
                        </p>
                        {item.explorerUrl ? (
                          <a
                            href={item.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1 mt-1"
                          >
                            View on Solscan
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold ${valueClasses}`}>
                      {isDeposit ? "+" : isWithdraw ? "-" : ""}{formatUsd(item.amountUsd)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No activity yet.</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@/services/dashboardApi";
import {
  fetchAiSignal,
  type AiSignalResponse,
} from "@/services/aiSignalApi";
import { fetchDriftTelemetry, type DriftTelemetrySnapshot } from "@/services/driftDataApi";
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
import {
  VAULT_PROGRAM_ID,
  USDC_MINT,
  buildSolscanAccountUrl,
  buildSolscanTxUrl,
} from "@/config/network";

type DataMode = "live" | "unavailable";
type ActivityFilter = "ALL" | "DEPOSIT" | "WITHDRAW";

const POLL_INTERVAL_MS = 15_000;
const QUICK_AMOUNTS_USD = [25, 100, 250];
const LOCAL_ACTIVITY_LIMIT = 25;
const ONCHAIN_ACTIVITY_FETCH_LIMIT = 18;
const ACTIVITY_CACHE_KEY_PREFIX = "neutralalpha:activity-cache:v2";
const ACTIVITY_FILTER_OPTIONS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAW", label: "Withdraw" },
];

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

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const asRecord = error as Record<string, unknown>;
    const message = asRecord.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
    const nestedError = asRecord.error;
    if (nestedError) {
      const nested: string = extractErrorMessage(nestedError);
      if (nested !== "Unexpected error") {
        return nested;
      }
    }
    const reason = asRecord.reason;
    if (typeof reason === "string" && reason.trim().length > 0) {
      return reason.trim();
    }
    const code = asRecord.code;
    if (typeof code === "number" || typeof code === "string") {
      return `Wallet error code: ${String(code)}`;
    }
    const logs = asRecord.logs;
    if (Array.isArray(logs)) {
      const firstLog = logs.find((item) => typeof item === "string" && item.trim().length > 0);
      if (typeof firstLog === "string") {
        return firstLog.trim();
      }
    }
    try {
      const compact = JSON.stringify(asRecord);
      if (compact && compact !== "{}") {
        return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
      }
    } catch {
      // Ignore JSON stringify failures and use fallback below.
    }
  }
  return "Unexpected error";
}

function activityIdentity(item: VaultActivityItem) {
  return item.signature?.trim() || item.id;
}

function activityTimestamp(item: VaultActivityItem) {
  const parsed = Date.parse(item.at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function activitySourceRank(source: VaultActivityItem["source"]) {
  if (source === "onchain") return 3;
  if (source === "api") return 2;
  return 1;
}

function mergeActivityLists(primary: VaultActivityItem[], secondary: VaultActivityItem[]) {
  const byKey = new Map<string, VaultActivityItem>();
  for (const item of [...secondary, ...primary]) {
    const key = activityIdentity(item);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const nextRank = activitySourceRank(item.source);
    const currentRank = activitySourceRank(existing.source);
    if (nextRank > currentRank) {
      byKey.set(key, item);
      continue;
    }
    if (nextRank === currentRank && activityTimestamp(item) > activityTimestamp(existing)) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort((a, b) => activityTimestamp(b) - activityTimestamp(a));
}

function activitySourceMeta(source: VaultActivityItem["source"] | undefined) {
  if (source === "onchain") {
    return {
      label: "On-chain",
      classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (source === "api") {
    return {
      label: "Telemetry",
      classes: "border-blue-400/30 bg-blue-500/10 text-blue-300",
    };
  }
  if (source === "fallback") {
    return {
      label: "Pending Sync",
      classes: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    };
  }
  return {
    label: "Unknown",
    classes: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  };
}

function resolveActivityCacheKey(walletAddress: string | null) {
  const walletKey = walletAddress ?? "guest";
  const programKey = VAULT_PROGRAM_ID ?? "unknown-program";
  const mintKey = USDC_MINT ?? "unknown-mint";
  return `${ACTIVITY_CACHE_KEY_PREFIX}:${programKey}:${mintKey}:${walletKey}`;
}

function normalizeCachedActivity(raw: unknown): VaultActivityItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const normalized: VaultActivityItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const item = entry as Record<string, unknown>;
    const action = item.action;
    if (action !== "DEPOSIT" && action !== "WITHDRAW" && action !== "REBALANCE") {
      continue;
    }
    const id = typeof item.id === "string" && item.id.trim().length > 0
      ? item.id
      : typeof item.signature === "string" && item.signature.trim().length > 0
        ? item.signature
        : "";
    const wallet = typeof item.wallet === "string" && item.wallet.trim().length > 0 ? item.wallet : "unknown";
    const at = typeof item.at === "string" && item.at.trim().length > 0 ? item.at : new Date().toISOString();
    const amountUsd = Number(item.amountUsd);
    if (!id || !Number.isFinite(amountUsd)) {
      continue;
    }
    const source = item.source === "api" || item.source === "onchain" || item.source === "fallback"
      ? item.source
      : "fallback";
    normalized.push({
      id,
      action,
      amountUsd,
      wallet,
      at,
      signature: typeof item.signature === "string" ? item.signature : undefined,
      explorerUrl: typeof item.explorerUrl === "string" ? item.explorerUrl : undefined,
      source,
    });
  }
  return normalized
    .sort((a, b) => activityTimestamp(b) - activityTimestamp(a))
    .slice(0, LOCAL_ACTIVITY_LIMIT);
}

function readCachedActivity(cacheKey: string): VaultActivityItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) {
      return [];
    }
    return normalizeCachedActivity(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeCachedActivity(cacheKey: string, items: VaultActivityItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const normalized = normalizeCachedActivity(items);
    window.localStorage.setItem(cacheKey, JSON.stringify(normalized));
  } catch {
    // Ignore localStorage write failures.
  }
}

export default function Dashboard() {
  const { walletAddress, walletReady, walletProvider } = useWallet();

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>("unavailable");
  const [statusLabel, setStatusLabel] = useState("Waiting for telemetry API...");
  const [isLoading, setIsLoading] = useState(true);

  const [onChainSnapshot, setOnChainSnapshot] = useState<OnChainSnapshot | null>(null);
  const [onChainStatus, setOnChainStatus] = useState("On-chain sync idle.");
  const [activityStatus, setActivityStatus] = useState("Activity sync idle.");
  const [driftTelemetry, setDriftTelemetry] = useState<DriftTelemetrySnapshot | null>(null);
  const [driftStatus, setDriftStatus] = useState("Funding feed idle.");
  const [aiSignal, setAiSignal] = useState<AiSignalResponse | null>(null);
  const [aiSignalStatus, setAiSignalStatus] = useState("AI signal idle.");

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
  const [localActivityItems, setLocalActivityItems] = useState<VaultActivityItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("ALL");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const activityItemsRef = useRef<VaultActivityItem[]>([]);
  const activityCacheKey = useMemo(() => resolveActivityCacheKey(walletAddress ?? null), [walletAddress]);

  const onChainReady = walletReady &&
    Boolean(walletAddress) &&
    Boolean(walletProvider && typeof walletProvider.signAndSendTransaction === "function") &&
    isOnChainConfigured();
  const driftBestAsset = useMemo(() => {
    if (!driftTelemetry) {
      return null;
    }
    const entries = Object.entries(driftTelemetry.liveFunding);
    entries.sort((a, b) => b[1] - a[1]);
    const best = entries[0]?.[0];
    if (best === "SOL" || best === "BTC" || best === "ETH") {
      return best;
    }
    return null;
  }, [driftTelemetry]);

  const aiSignalInput = useMemo(
    () => ({
      healthRatio: snapshot?.overview.healthRatio ?? null,
      deltaExposurePct: snapshot?.overview.deltaExposurePct ?? null,
      drawdown7dPct: snapshot?.risk.drawdown7dPct ?? null,
      usdcPrice: snapshot?.risk.usdcPrice ?? null,
      emergencyMode: onChainSnapshot ? onChainSnapshot.emergencyMode : Boolean(snapshot?.risk.emergencyState),
      depositPaused: onChainSnapshot ? onChainSnapshot.paused : Boolean(snapshot?.risk.depositPaused),
      activeAsset: snapshot?.signal.activeAsset ?? driftBestAsset ?? "SOL",
      liveFunding: snapshot?.liveFunding ?? driftTelemetry?.liveFunding ?? null,
    }),
    [driftBestAsset, driftTelemetry?.liveFunding, onChainSnapshot?.emergencyMode, onChainSnapshot?.paused, snapshot],
  );

  const loadSnapshot = useCallback(async () => {
    try {
      const nextSnapshot = await fetchDashboardSnapshot();
      setSnapshot(nextSnapshot);
      setDataMode("live");
      setStatusLabel("Live telemetry stream active.");
    } catch {
      setSnapshot(null);
      setDataMode("unavailable");
      setStatusLabel("Telemetry API unavailable.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOnChain = useCallback(async () => {
    if (!isOnChainConfigured()) {
      setOnChainSnapshot(null);
      setOnChainStatus("Set VITE_VAULT_PROGRAM_ID and VITE_USDC_MINT to enable on-chain mode.");
      return;
    }

    try {
      const next = await fetchOnChainSnapshot(walletAddress);
      setOnChainSnapshot(next);
      setOnChainStatus(
        walletAddress
          ? "On-chain vault + wallet state synced."
          : "On-chain vault state synced (read-only mode).",
      );
    } catch {
      setOnChainSnapshot(null);
      setOnChainStatus("On-chain RPC unavailable.");
    }
  }, [walletAddress]);

  const loadActivity = useCallback(async () => {
    let onChainAttempted = false;

    if (isOnChainConfigured()) {
      onChainAttempted = true;
      try {
        const chainItems = await fetchOnChainActivity(ONCHAIN_ACTIVITY_FETCH_LIMIT, walletAddress ?? undefined);
        if (chainItems.length > 0) {
          setActivityItems(chainItems);
          setLocalActivityItems((previous) => previous.filter((localItem) => {
            const localKey = activityIdentity(localItem);
            return !chainItems.some((chainItem) => activityIdentity(chainItem) === localKey);
          }));
          setActivityStatus("On-chain activity synced.");
          return;
        }
      } catch {
        // Continue to telemetry fallback before declaring error.
      }
    }

    try {
      const payload = await fetchVaultActivity();
      const apiItems = payload.items.map((item) => ({ ...item, source: "api" as const }));
      if (apiItems.length > 0) {
        setActivityItems(apiItems);
        setActivityStatus("Telemetry API activity synced.");
        return;
      }
    } catch {
      // Continue to cache fallback below.
    }

    const cachedItems = readCachedActivity(activityCacheKey);
    const fallbackItems = activityItemsRef.current.length > 0 ? activityItemsRef.current : cachedItems;
    if (fallbackItems.length > 0) {
      setActivityItems(fallbackItems);
      setActivityStatus(
        onChainAttempted
          ? "Live RPC busy. Showing cached activity history."
          : "Showing cached activity history.",
      );
    } else {
      setActivityItems([]);
      setActivityStatus("No verifiable activity data.");
    }
  }, [activityCacheKey, walletAddress]);

  const loadDriftTelemetry = useCallback(async () => {
    try {
      const next = await fetchDriftTelemetry();
      setDriftTelemetry((previous) => {
        if (!previous) {
          return next;
        }
        const mergedSeries = [...previous.fundingSeries];
        const point = next.fundingSeries[0];
        if (point) {
          if (mergedSeries.length > 0 && mergedSeries[mergedSeries.length - 1].time === point.time) {
            mergedSeries[mergedSeries.length - 1] = point;
          } else {
            mergedSeries.push(point);
          }
        }
        while (mergedSeries.length > 24) {
          mergedSeries.shift();
        }

        return {
          generatedAt: next.generatedAt,
          liveFunding: next.liveFunding,
          fundingSeries: mergedSeries,
        };
      });
      setDriftStatus("Drift funding feed synced.");
    } catch {
      setDriftTelemetry(null);
      setDriftStatus("Drift funding feed unavailable.");
    }
  }, []);

  const loadAiSignal = useCallback(async () => {
    if (!snapshot && !onChainSnapshot) {
      setAiSignal(null);
      setAiSignalStatus("Awaiting telemetry input.");
      return;
    }

    try {
      const next = await fetchAiSignal(aiSignalInput);
      setAiSignal(next);
      setAiSignalStatus(
        next.source === "qwen"
          ? `Qwen live${next.model ? ` (${next.model})` : ""}`
          : "Rule engine fallback",
      );
    } catch {
      setAiSignal(null);
      setAiSignalStatus("AI endpoint unavailable.");
    }
  }, [aiSignalInput, onChainSnapshot, snapshot]);

  useEffect(() => {
    void Promise.all([loadSnapshot(), loadActivity(), loadOnChain(), loadDriftTelemetry()]);
    const interval = window.setInterval(() => {
      void Promise.all([loadSnapshot(), loadActivity(), loadOnChain(), loadDriftTelemetry()]);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadActivity, loadDriftTelemetry, loadOnChain, loadSnapshot]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    void loadAiSignal();
  }, [loadAiSignal]);

  const effectiveActivityItems = useMemo(
    () => mergeActivityLists(activityItems, localActivityItems),
    [activityItems, localActivityItems],
  );

  useEffect(() => {
    activityItemsRef.current = activityItems;
  }, [activityItems]);

  useEffect(() => {
    const cached = readCachedActivity(activityCacheKey);
    if (cached.length > 0) {
      setActivityItems(cached);
      setActivityStatus("Showing cached activity history while syncing live data.");
      return;
    }
    setActivityItems([]);
  }, [activityCacheKey]);

  useEffect(() => {
    if (effectiveActivityItems.length === 0) {
      return;
    }
    writeCachedActivity(activityCacheKey, effectiveActivityItems);
  }, [activityCacheKey, effectiveActivityItems]);

  const walletKey = walletAddress ?? "guest";

  const walletActivity = useMemo(
    () => effectiveActivityItems.filter((item) => item.wallet === walletKey),
    [effectiveActivityItems, walletKey],
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

  const userShareBalance = onChainSnapshot ? onChainSnapshot.userShares : simulatedShares;
  const estimatedWithdrawableUsd = onChainSnapshot
    ? onChainSnapshot.userShares * onChainSnapshot.sharePrice
    : simulatedShares;

  const unlockTsMs = useMemo(() => {
    if (onChainSnapshot?.userUnlockTs && onChainSnapshot.userUnlockTs > 0) {
      return onChainSnapshot.userUnlockTs * 1000;
    }
    return null;
  }, [onChainSnapshot]);

  const lockRemainingMs = unlockTsMs ? unlockTsMs - nowTs : 0;
  const isLocked = Boolean(unlockTsMs && lockRemainingMs > 0 && !onChainSnapshot?.emergencyMode);
  const telemetryEmergencyMode = Boolean(snapshot?.risk.emergencyState);
  const telemetryDepositPaused = Boolean(snapshot?.risk.depositPaused);
  const isEmergencyMode = onChainSnapshot ? onChainSnapshot.emergencyMode : telemetryEmergencyMode;
  const isDepositPaused = onChainSnapshot ? onChainSnapshot.paused : telemetryDepositPaused;

  const quickWithdrawOptions = useMemo(() => {
    if (estimatedWithdrawableUsd <= 0) {
      return [];
    }
    const values = [0.25, 0.5, 1].map((factor) => Number((estimatedWithdrawableUsd * factor).toFixed(2)));
    return [...new Set(values)].filter((value) => value > 0);
  }, [estimatedWithdrawableUsd]);

  const onChainNavSeries = useMemo(() => {
    if (!onChainSnapshot) {
      return [];
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const txInWindow = effectiveActivityItems
      .filter((item) =>
        (item.source === "onchain" || item.source === "fallback")
        && (item.action === "DEPOSIT" || item.action === "WITHDRAW"))
      .map((item) => ({ ...item, ts: new Date(item.at).getTime() }))
      .filter((item) => Number.isFinite(item.ts) && item.ts >= start.getTime())
      .sort((a, b) => a.ts - b.ts);

    const applyTx = (value: number, action: "DEPOSIT" | "WITHDRAW", amountUsd: number) => {
      if (action === "DEPOSIT") return value + amountUsd;
      if (action === "WITHDRAW") return value - amountUsd;
      return value;
    };

    const undoTx = (value: number, action: "DEPOSIT" | "WITHDRAW", amountUsd: number) => {
      if (action === "DEPOSIT") return value - amountUsd;
      if (action === "WITHDRAW") return value + amountUsd;
      return value;
    };

    let running = onChainSnapshot.totalUsdc;
    for (let index = txInWindow.length - 1; index >= 0; index -= 1) {
      const item = txInWindow[index];
      running = undoTx(running, item.action as "DEPOSIT" | "WITHDRAW", item.amountUsd);
    }

    const points: Array<{ date: string; nav: number }> = [];
    let cursor = 0;
    let dayValue = running;

    for (let offset = 0; offset < 30; offset += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + offset);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      while (cursor < txInWindow.length && txInWindow[cursor].ts <= dayEnd.getTime()) {
        const item = txInWindow[cursor];
        dayValue = applyTx(dayValue, item.action as "DEPOSIT" | "WITHDRAW", item.amountUsd);
        cursor += 1;
      }

      points.push({
        date: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        nav: Math.max(0, Math.round(dayValue)),
      });
    }

    if (points.length > 0) {
      points[points.length - 1].nav = Math.round(onChainSnapshot.totalUsdc);
    }
    return points;
  }, [effectiveActivityItems, onChainSnapshot]);

  const onChainDrawdown7dPct = useMemo(() => {
    if (onChainSnapshot) {
      if (onChainNavSeries.length < 8) {
        return null;
      }

      const latest = onChainNavSeries[onChainNavSeries.length - 1].nav;
      const sevenDaysAgo = onChainNavSeries[Math.max(0, onChainNavSeries.length - 8)].nav;
      if (sevenDaysAgo <= 0) {
        return null;
      }
      return Math.max(0, ((sevenDaysAgo - latest) / sevenDaysAgo) * 100);
    }
    return snapshot?.risk.drawdown7dPct ?? null;
  }, [onChainNavSeries, onChainSnapshot, snapshot]);

  const driftDerivedApy = useMemo(() => {
    if (!driftTelemetry) {
      return null;
    }
    const rates = Object.values(driftTelemetry.liveFunding);
    const best = Math.max(...rates);
    const annualized = Math.max(0, best * 3 * 365 * 100);
    return annualized;
  }, [driftTelemetry]);

  const metrics = useMemo(
    () => [
      {
        label: "Total Value Locked",
        value: onChainSnapshot
          ? formatUsd(onChainSnapshot.totalUsdc)
          : snapshot
            ? formatUsd(snapshot.overview.tvlUsd)
            : "N/A",
        change: snapshot ? formatSignedPercent(snapshot.overview.tvlChangePct) : "Unavailable",
        tone: snapshot
          ? (snapshot.overview.tvlChangePct >= 0 ? "positive" : "negative")
          : "neutral",
        icon: DollarSign,
      },
      {
        label: "Current APY",
        value: snapshot
          ? formatPercent(snapshot.overview.currentApyPct, 1)
          : driftDerivedApy !== null
            ? formatPercent(driftDerivedApy, 1)
            : onChainSnapshot
              ? "Pending feed"
              : "Unavailable",
        change: snapshot
          ? formatSignedPercent(snapshot.overview.apyChangePct)
          : driftTelemetry
            ? "Drift live"
            : onChainSnapshot
              ? "On-chain only"
              : "Unavailable",
        tone: snapshot
          ? (snapshot.overview.apyChangePct >= 0 ? "positive" : "negative")
          : driftTelemetry
            ? "positive"
          : "neutral",
        icon: TrendingUp,
      },
      {
        label: "Health Ratio",
        value: snapshot
          ? snapshot.overview.healthRatio.toFixed(2)
          : onChainSnapshot
            ? (onChainSnapshot.emergencyMode ? "Alert" : "Normal")
            : "Unavailable",
        change: snapshot
          ? snapshot.overview.healthRatio >= snapshot.risk.limits.minHealthRatioTarget
            ? "Safe"
            : "Watch"
          : onChainSnapshot
            ? (onChainSnapshot.emergencyMode ? "Emergency" : "No Emergency")
            : "Unavailable",
        tone: snapshot
          ? (snapshot.overview.healthRatio >= snapshot.risk.limits.minHealthRatioTarget
            ? "positive"
            : "negative")
          : onChainSnapshot
            ? (onChainSnapshot.emergencyMode ? "negative" : "positive")
          : "neutral",
        icon: Shield,
      },
      {
        label: "Delta Exposure",
        value: snapshot ? formatSignedPercent(snapshot.overview.deltaExposurePct, 2) : onChainSnapshot ? "Pending feed" : "Unavailable",
        change: snapshot
          ? Math.abs(snapshot.overview.deltaExposurePct) <= snapshot.risk.limits.maxDeltaDriftPct
            ? "Neutral"
            : "Rebalance"
          : onChainSnapshot
            ? "Telemetry feed pending"
          : "Unavailable",
        tone: snapshot
          ? (Math.abs(snapshot.overview.deltaExposurePct) <= snapshot.risk.limits.maxDeltaDriftPct
            ? "positive"
            : "negative")
          : "neutral",
        icon: Activity,
      },
    ],
    [driftDerivedApy, driftTelemetry, onChainSnapshot, snapshot],
  );

  const effectiveSignalAction = aiSignal?.action ?? snapshot?.signal.action ?? null;
  const effectiveSignalReason = aiSignal?.reason ?? snapshot?.signal.reason ?? "No verified telemetry feed.";
  const effectiveActiveAsset = aiSignal?.activeAsset ?? snapshot?.signal.activeAsset ?? null;
  const effectiveLiveFunding = aiSignal?.liveFunding ?? snapshot?.liveFunding ?? null;
  const signalUpdatedAt = aiSignal?.generatedAt ?? snapshot?.generatedAt ?? null;

  const signalStyle = effectiveSignalAction
    ? SIGNAL_STYLES[effectiveSignalAction]
    : {
        panel: "bg-slate-500/10 border border-white/10",
        text: "text-slate-300",
      };
  const liveFundingEntries = effectiveLiveFunding ? Object.entries(effectiveLiveFunding) : [];
  const recentActivity = useMemo(() => {
    const filtered = effectiveActivityItems.filter((item) =>
      activityFilter === "ALL" ? true : item.action === activityFilter,
    );
    return filtered.slice(0, 6);
  }, [activityFilter, effectiveActivityItems]);
  const latestExplorerActivity = useMemo(
    () => recentActivity.find((item) => Boolean(item.explorerUrl)),
    [recentActivity],
  );

  const verificationLinks = useMemo(
    () => [
      {
        label: "Program ID",
        value: VAULT_PROGRAM_ID,
      },
      {
        label: "USDC Mint",
        value: USDC_MINT,
      },
      {
        label: "Vault State",
        value: onChainSnapshot?.vaultStateAddress ?? null,
      },
      {
        label: "USDC Vault",
        value: onChainSnapshot?.usdcVaultAddress ?? null,
      },
      {
        label: "Share Mint",
        value: onChainSnapshot?.shareMintAddress ?? null,
      },
      {
        label: "Latest Tx",
        value: latestTx?.signature ?? latestExplorerActivity?.signature ?? null,
      },
    ],
    [latestExplorerActivity?.signature, latestTx?.signature, onChainSnapshot?.shareMintAddress, onChainSnapshot?.usdcVaultAddress, onChainSnapshot?.vaultStateAddress],
  );

  const latestTxUrl = latestTx?.explorerUrl ?? latestExplorerActivity?.explorerUrl ?? null;
  const latestTxSignature = latestTx?.signature ?? latestExplorerActivity?.signature ?? null;
  const onChainProofStatus = latestTxSignature ? "Success tx detected" : "No tx detected yet";
  const strategyLockText = onChainSnapshot?.lockPeriodSecs
    ? `${Math.round(onChainSnapshot.lockPeriodSecs / 86_400)}-day rolling lock`
    : "3-month rolling lock";
  const strategyHealthMin = snapshot?.risk.limits.minHealthRatioTarget ?? 1.5;
  const riskDrawdownText =
    onChainDrawdown7dPct !== null ? formatPercent(onChainDrawdown7dPct, 2) : "Pending history";
  const riskAlerts = useMemo(() => {
    if (onChainSnapshot) {
      const alerts: string[] = [];
      if (onChainDrawdown7dPct !== null && onChainDrawdown7dPct >= 5) {
        alerts.push(`Soft drawdown triggered (${formatPercent(onChainDrawdown7dPct, 2)} /7d).`);
      }
      if (isDepositPaused) {
        alerts.push("Deposits paused by on-chain vault controls.");
      }
      if (isEmergencyMode) {
        alerts.push("Emergency protection mode is active on-chain.");
      }
      return alerts;
    }
    return snapshot?.risk.alerts ?? [];
  }, [isDepositPaused, isEmergencyMode, onChainDrawdown7dPct, onChainSnapshot, snapshot?.risk.alerts]);

  async function handleDepositClick() {
    if (!onChainReady || !walletAddress) {
      setDepositMessage("Connect wallet to submit a real on-chain deposit.");
      return;
    }
    if (isDepositPaused || isEmergencyMode) {
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
      if (!walletProvider) {
        throw new Error("Wallet provider not found in browser.");
      }
      const result = await sendOnChainDeposit(walletProvider, walletAddress, amount);
      setLatestTx({ action: "DEPOSIT", signature: result.signature, explorerUrl: result.explorerUrl });
      setLocalActivityItems((previous) =>
        mergeActivityLists(
          [
            {
              id: `local-${result.signature}-deposit`,
              action: "DEPOSIT",
              amountUsd: amount,
              wallet: walletAddress,
              at: new Date().toISOString(),
              signature: result.signature,
              explorerUrl: result.explorerUrl,
              source: "fallback",
            },
          ],
          previous,
        ).slice(0, LOCAL_ACTIVITY_LIMIT),
      );
      setDepositMessage(`Deposit confirmed on-chain: ${result.signature.slice(0, 8)}...`);

      setDepositAmount("");
      await Promise.all([loadSnapshot(), loadActivity(), loadOnChain()]);
    } catch (error) {
      const message = extractErrorMessage(error);
      setDepositMessage(`Deposit failed: ${message}`);
    } finally {
      setDepositPending(false);
    }
  }

  async function handleWithdrawClick() {
    if (!onChainReady || !walletAddress) {
      setWithdrawMessage("Connect wallet to submit a real on-chain withdraw.");
      return;
    }
    if (isLocked) {
      setWithdrawMessage("Position is still in lock period.");
      return;
    }

    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawMessage("Enter a valid withdraw amount.");
      return;
    }
    if (amount > estimatedWithdrawableUsd) {
      setWithdrawMessage("Withdraw amount exceeds your estimated withdrawable value.");
      return;
    }

    setWithdrawPending(true);
    setWithdrawMessage(null);

    try {
      if (!walletProvider) {
        throw new Error("Wallet provider not found in browser.");
      }
      const result = await sendOnChainWithdraw(walletProvider, walletAddress, amount);
      setLatestTx({ action: "WITHDRAW", signature: result.signature, explorerUrl: result.explorerUrl });
      setLocalActivityItems((previous) =>
        mergeActivityLists(
          [
            {
              id: `local-${result.signature}-withdraw`,
              action: "WITHDRAW",
              amountUsd: amount,
              wallet: walletAddress,
              at: new Date().toISOString(),
              signature: result.signature,
              explorerUrl: result.explorerUrl,
              source: "fallback",
            },
          ],
          previous,
        ).slice(0, LOCAL_ACTIVITY_LIMIT),
      );
      setWithdrawMessage(`Withdraw confirmed on-chain: ${result.signature.slice(0, 8)}...`);

      setWithdrawAmount("");
      await Promise.all([loadSnapshot(), loadActivity(), loadOnChain()]);
    } catch (error) {
      const message = extractErrorMessage(error);
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
                  className={`w-2 h-2 rounded-full ${dataMode === "live" ? "bg-green-400" : "bg-slate-500"}`}
                />
                <span className="text-slate-300">
                  {dataMode === "live" ? "Live API" : "API Unavailable"} | {statusLabel}
                </span>
                {isLoading ? <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" /> : null}
              </div>
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 h-fit">
                <span className={`w-2 h-2 rounded-full ${onChainSnapshot ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span className="text-slate-300">{onChainStatus}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 h-fit">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activityStatus.includes("synced") ? "bg-emerald-400" : "bg-slate-500"
                  }`}
                />
                <span className="text-slate-300">{activityStatus}</span>
              </div>
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 h-fit">
                <span className={`w-2 h-2 rounded-full ${driftTelemetry ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span className="text-slate-300">{driftStatus}</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-5 mb-8 border border-emerald-500/20"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-white font-semibold text-lg">On-Chain Verification</h3>
              <p className="text-sm text-slate-400">
                Direct links for judges to verify vault accounts and latest transactions on Solscan.
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {verificationLinks.map((item) => {
              if (!item.value) {
                return (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-sm text-slate-400">Not available</p>
                  </div>
                );
              }

              const href = buildSolscanAccountUrl(item.value);
              const isLatestTx = item.label === "Latest Tx";
              const txHref = latestTx?.explorerUrl ?? latestExplorerActivity?.explorerUrl;
              const finalHref = isLatestTx ? (txHref ?? buildSolscanTxUrl(item.value)) : href;

              return (
                <a
                  key={item.label}
                  href={finalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white/10 bg-white/5 p-3 hover:border-emerald-500/40 transition-colors"
                >
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="text-sm text-emerald-300 font-mono break-all inline-flex items-center gap-1">
                    {item.value}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </p>
                </a>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 h-full flex flex-col">
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
                        metric.tone === "positive"
                          ? "bg-green-500/10 text-green-400"
                          : metric.tone === "negative"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-slate-500/20 text-slate-300"
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

            {riskAlerts.length > 0 ? (
              <div className="mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
                <div className="text-sm text-yellow-300 font-medium mb-2">Risk Alerts</div>
                <div className="space-y-1">
                  {riskAlerts.map((alert, index) => (
                    <p key={`${alert}-${index}`} className="text-xs text-yellow-100/90">
                      {alert}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid md:grid-cols-3 gap-4 flex-1 auto-rows-fr">
              <div className="glass rounded-2xl p-4 border border-white/10 h-full flex flex-col">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 mb-2">On-Chain Proof</p>
                <p className="text-sm text-white font-medium mb-1">{onChainProofStatus}</p>
                {latestTxUrl && latestTxSignature ? (
                  <a
                    href={latestTxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
                  >
                    {shortWallet(latestTxSignature)} | Solscan
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 mt-auto">Execute 1 tx to generate proof link.</p>
                )}
              </div>

              <div className="glass rounded-2xl p-4 border border-white/10 h-full flex flex-col">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 mb-2">Strategy Compliance</p>
                <p className="text-sm text-white">USDC only: {USDC_MINT ? "Yes" : "Not configured"}</p>
                <p className="text-sm text-white">Lock: {strategyLockText}</p>
                <p className="text-sm text-white">Min health ratio: {strategyHealthMin.toFixed(2)}</p>
              </div>

              <div className="glass rounded-2xl p-4 border border-white/10 h-full flex flex-col">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500 mb-2">Risk Status</p>
                <p className="text-sm text-white">Emergency mode: {isEmergencyMode ? "ON" : "OFF"}</p>
                <p className="text-sm text-white">Deposit paused: {isDepositPaused ? "YES" : "NO"}</p>
                <p className="text-sm text-white">7d drawdown: {riskDrawdownText}</p>
              </div>
            </div>
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
              <p>Wallet: {walletAddress ? shortWallet(walletAddress) : walletReady ? "not connected" : "wallet extension not detected"}</p>
              <p>USDC price: {snapshot ? `$${snapshot.risk.usdcPrice.toFixed(4)}` : "Feed pending"}</p>
              <p>7d drawdown: {onChainDrawdown7dPct !== null ? formatPercent(onChainDrawdown7dPct, 2) : "Feed pending"}</p>
              <p>Mode: {onChainReady ? "On-chain only" : "Read-only (connect wallet)"}</p>
            </div>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs text-slate-500 mb-2">Your Position</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Share Balance</span>
                  <span className="text-white font-semibold">{userShareBalance.toFixed(6)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Claim Value (est.)</span>
                  <span className="text-white font-semibold">{formatUsd(estimatedWithdrawableUsd)}</span>
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
              disabled={depositPending || !onChainReady || isDepositPaused || isEmergencyMode}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold hover:from-green-400 hover:to-green-500 transition-all shadow-lg shadow-green-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEmergencyMode
                ? "Emergency Mode"
                : isDepositPaused
                  ? "Deposits Paused"
                : depositPending
                  ? "Processing..."
                    : onChainReady
                      ? "Deposit USDC On-Chain"
                      : "Connect Wallet to Deposit"}
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
              disabled={withdrawPending || !onChainReady || isLocked || estimatedWithdrawableUsd <= 0}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLocked
                ? "Locked"
                : withdrawPending
                  ? "Processing..."
                  : onChainReady
                    ? "Withdraw On-Chain"
                    : "Connect Wallet to Withdraw"}
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
                <span className="font-medium">
                  {snapshot ? formatPercent(snapshot.overview.currentApyPct, 1) : onChainSnapshot ? "On-chain" : "N/A"}
                </span>
              </div>
            </div>
            {(snapshot || onChainNavSeries.length > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snapshot?.navSeries ?? onChainNavSeries}>
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
                      formatter={(value) => [formatUsd(Number(value)), snapshot ? "NAV" : "TVL (on-chain)"]}
                    />
                    <Area type="monotone" dataKey="nav" stroke="#22c55e" strokeWidth={2} fill="url(#navGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 rounded-xl border border-white/10 bg-white/5 grid place-items-center text-slate-400 text-sm">
                NAV data unavailable (real telemetry API offline).
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass rounded-2xl p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Position Allocation</h3>
            <p className="text-sm text-slate-500 mb-4">Current exposure</p>
            {(snapshot || onChainSnapshot) ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={snapshot?.allocation ?? [{ name: "USDC Reserve", value: 100, color: "#64748b" }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {(snapshot?.allocation ?? [{ name: "USDC Reserve", value: 100, color: "#64748b" }]).map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {(snapshot?.allocation ?? [{ name: "USDC Reserve", value: 100, color: "#64748b" }]).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-400">{item.name}</span>
                      </div>
                      <span className="text-white font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                Allocation data unavailable.
              </div>
            )}
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
              {(snapshot || driftTelemetry?.fundingSeries.length) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={snapshot?.fundingSeries ?? driftTelemetry?.fundingSeries ?? []}>
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
              ) : (
                <div className="h-full rounded-xl border border-white/10 bg-white/5 grid place-items-center text-slate-400 text-sm">
                  Funding data unavailable.
                </div>
              )}
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
            <p className="text-xs text-slate-500 mb-4">{aiSignalStatus}</p>

            <div className={`p-4 rounded-xl mb-6 ${signalStyle.panel}`}>
              <div className="text-sm text-slate-400 mb-1">Current Signal</div>
              <div className={`text-2xl font-bold ${signalStyle.text}`}>
                {effectiveSignalAction ?? "UNAVAILABLE"}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                {effectiveSignalReason}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="text-sm text-slate-400 mb-2">
                Live Funding (8hr) | Active: {effectiveActiveAsset ? `${effectiveActiveAsset}-PERP` : "Unavailable"}
              </div>
              {liveFundingEntries.length > 0 ? (
                liveFundingEntries.map(([asset, rate]) => (
                  <div key={asset} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-white font-medium">{asset}-PERP</span>
                    <span className={`font-mono ${rate > 0.01 ? "text-green-400" : "text-yellow-400"}`}>
                      {(rate * 100).toFixed(3)}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                  Funding telemetry unavailable.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Last update</span>
              </div>
              <span>{signalUpdatedAt ? toLastUpdateLabel(signalUpdatedAt) : "N/A"}</span>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5">
            <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {ACTIVITY_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActivityFilter(option.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                    activityFilter === option.value
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 text-slate-300 hover:text-white hover:border-white/20",
                  )}
                >
                  {option.label}
                </button>
              ))}
              <span className="text-xs text-slate-500 ml-1">Last {recentActivity.length} records</span>
            </div>
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
                const sourceMeta = activitySourceMeta(item.source);
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white font-medium">{label}</p>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", sourceMeta.classes)}>
                            {sourceMeta.label}
                          </span>
                        </div>
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

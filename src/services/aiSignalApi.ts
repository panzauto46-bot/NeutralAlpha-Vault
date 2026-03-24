import type { AiAction, AssetSymbol } from "@/types/dashboard";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export interface AiSignalRequestPayload {
  healthRatio?: number | null;
  deltaExposurePct?: number | null;
  drawdown7dPct?: number | null;
  usdcPrice?: number | null;
  emergencyMode?: boolean;
  depositPaused?: boolean;
  activeAsset?: AssetSymbol;
  liveFunding?: Record<AssetSymbol, number> | null;
}

export interface AiSignalResponse {
  generatedAt: string;
  source: "qwen" | "rule";
  model: string | null;
  action: AiAction;
  reason: string;
  confidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  activeAsset: AssetSymbol;
  liveFunding: Record<AssetSymbol, number> | null;
}

export async function fetchAiSignal(payload: AiSignalRequestPayload): Promise<AiSignalResponse> {
  const response = await fetch(`${API_BASE}/ai/signal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI signal API failed with status ${response.status}`);
  }

  return (await response.json()) as AiSignalResponse;
}

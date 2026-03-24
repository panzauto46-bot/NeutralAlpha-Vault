const DEFAULT_MODEL = process.env.DASHSCOPE_MODEL ?? "qwen-plus";
const DEFAULT_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return number;
}

function sanitizeFunding(raw) {
  const sol = toNumber(raw?.SOL, null);
  const btc = toNumber(raw?.BTC, null);
  const eth = toNumber(raw?.ETH, null);
  if (sol === null || btc === null || eth === null) {
    return null;
  }
  return { SOL: sol, BTC: btc, ETH: eth };
}

function sanitizeInput(payload) {
  return {
    healthRatio: toNumber(payload?.healthRatio, null),
    deltaExposurePct: toNumber(payload?.deltaExposurePct, null),
    drawdown7dPct: toNumber(payload?.drawdown7dPct, null),
    usdcPrice: toNumber(payload?.usdcPrice, null),
    emergencyMode: Boolean(payload?.emergencyMode),
    depositPaused: Boolean(payload?.depositPaused),
    activeAsset:
      payload?.activeAsset === "BTC" || payload?.activeAsset === "ETH" ? payload.activeAsset : "SOL",
    liveFunding: sanitizeFunding(payload?.liveFunding),
  };
}

function pickBestFundingAsset(funding) {
  if (!funding) {
    return "SOL";
  }
  const pairs = Object.entries(funding);
  pairs.sort((a, b) => b[1] - a[1]);
  return pairs[0][0] ?? "SOL";
}

function ruleEngine(input) {
  if (input.emergencyMode) {
    return {
      action: "REBALANCE",
      reason: "Emergency mode active on-chain. Prioritize unwind and risk reduction.",
      confidence: 0.95,
      riskLevel: "HIGH",
      activeAsset: input.activeAsset,
    };
  }

  if (input.healthRatio !== null && input.healthRatio < 1.5) {
    return {
      action: "REBALANCE",
      reason: `Health ratio ${input.healthRatio.toFixed(2)} is below 1.50 target.`,
      confidence: 0.88,
      riskLevel: "HIGH",
      activeAsset: input.activeAsset,
    };
  }

  if (input.deltaExposurePct !== null && Math.abs(input.deltaExposurePct) > 2) {
    return {
      action: "REBALANCE",
      reason: `Delta exposure ${input.deltaExposurePct.toFixed(2)}% is outside +/-2% band.`,
      confidence: 0.85,
      riskLevel: "MEDIUM",
      activeAsset: input.activeAsset,
    };
  }

  if (input.liveFunding) {
    const bestAsset = pickBestFundingAsset(input.liveFunding);
    const bestRate = input.liveFunding[bestAsset];
    const activeRate = input.liveFunding[input.activeAsset] ?? bestRate;
    if (bestAsset !== input.activeAsset && bestRate - activeRate > 0.0015) {
      return {
        action: "ROTATE_ASSET",
        reason: `${bestAsset} funding is materially stronger than ${input.activeAsset}.`,
        confidence: 0.8,
        riskLevel: "MEDIUM",
        activeAsset: bestAsset,
      };
    }
  }

  return {
    action: "HOLD",
    reason: "Risk metrics remain within configured thresholds.",
    confidence: 0.72,
    riskLevel: "LOW",
    activeAsset: input.activeAsset,
  };
}

function extractJsonObject(raw) {
  if (!raw || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const blockMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (blockMatch?.[1]) {
    try {
      return JSON.parse(blockMatch[1].trim());
    } catch {}
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {}
  }
  return null;
}

function normalizeDecision(modelDecision, input) {
  const action =
    modelDecision?.action === "REBALANCE" || modelDecision?.action === "ROTATE_ASSET"
      ? modelDecision.action
      : "HOLD";
  const reason =
    typeof modelDecision?.reason === "string" && modelDecision.reason.trim().length > 0
      ? modelDecision.reason.trim().slice(0, 240)
      : "Model response was empty. Falling back to conservative HOLD.";
  const confidence = clamp(toNumber(modelDecision?.confidence, 0.7) ?? 0.7, 0, 1);
  const riskLevel =
    modelDecision?.riskLevel === "HIGH" || modelDecision?.riskLevel === "MEDIUM"
      ? modelDecision.riskLevel
      : "LOW";
  const activeAsset =
    modelDecision?.activeAsset === "BTC" || modelDecision?.activeAsset === "ETH"
      ? modelDecision.activeAsset
      : input.activeAsset;

  return {
    action,
    reason,
    confidence,
    riskLevel,
    activeAsset,
  };
}

function buildMessages(input) {
  return [
    {
      role: "system",
      content:
        "You are an institutional delta-neutral vault risk engine. Return compact JSON only with fields: action, reason, confidence, riskLevel, activeAsset.",
    },
    {
      role: "user",
      content: JSON.stringify({
        objective: "Choose one action: HOLD | REBALANCE | ROTATE_ASSET",
        constraints: {
          maxDeltaDriftPct: 2,
          minHealthRatioTarget: 1.5,
          emergencyHealthRatio: 1.15,
          baseAsset: "USDC",
          lockPolicy: "3-month rolling",
        },
        telemetry: input,
      }),
    },
  ];
}

export async function generateAiSignal(payload) {
  const input = sanitizeInput(payload);
  const apiKey =
    process.env.DASHSCOPE_API_KEY ??
    process.env.ALIBABA_MODEL_STUDIO_API_KEY ??
    process.env.QWEN_API_KEY ??
    null;

  if (!apiKey) {
    const decision = ruleEngine(input);
    return {
      generatedAt: new Date().toISOString(),
      source: "rule",
      model: null,
      ...decision,
      liveFunding: input.liveFunding,
    };
  }

  try {
    const response = await fetch(DEFAULT_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        messages: buildMessages(input),
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API returned ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = extractJsonObject(content);
    if (!parsed) {
      throw new Error("LLM content is not valid JSON.");
    }

    const decision = normalizeDecision(parsed, input);
    return {
      generatedAt: new Date().toISOString(),
      source: "qwen",
      model: DEFAULT_MODEL,
      ...decision,
      liveFunding: input.liveFunding,
    };
  } catch {
    const decision = ruleEngine(input);
    return {
      generatedAt: new Date().toISOString(),
      source: "rule",
      model: null,
      ...decision,
      liveFunding: input.liveFunding,
    };
  }
}

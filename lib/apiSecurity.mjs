const GLOBAL_RATE_LIMIT_KEY = "__neutralalphaRateLimitState";

export class ApiSecurityError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "ApiSecurityError";
    this.statusCode = statusCode;
  }
}

function readHeader(headers, name) {
  const lowered = name.toLowerCase();
  if (!headers) return null;

  if (typeof headers.get === "function") {
    const value = headers.get(lowered);
    return typeof value === "string" ? value : null;
  }

  const raw = headers[lowered] ?? headers[name];
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  if (typeof raw === "string") {
    return raw;
  }
  return null;
}

function getClientIp(req) {
  const forwarded = readHeader(req?.headers, "x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req?.socket?.remoteAddress ?? "unknown";
}

function getRateStore() {
  const globalScope = globalThis;
  if (!globalScope[GLOBAL_RATE_LIMIT_KEY]) {
    globalScope[GLOBAL_RATE_LIMIT_KEY] = new Map();
  }
  return globalScope[GLOBAL_RATE_LIMIT_KEY];
}

function enforceRateLimit(ip) {
  const windowMs = Math.max(1000, Number(process.env.SIM_RATE_LIMIT_WINDOW_MS ?? 60_000));
  const maxRequests = Math.max(1, Number(process.env.SIM_RATE_LIMIT_MAX ?? 60));
  const now = Date.now();
  const key = ip || "unknown";
  const store = getRateStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > maxRequests) {
    throw new ApiSecurityError(429, "Too many requests.");
  }
  store.set(key, current);
}

function enforceApiKey(headers) {
  const expectedApiKey = (process.env.SIM_API_KEY ?? "").trim();
  if (!expectedApiKey) {
    return;
  }
  const providedApiKey = (readHeader(headers, "x-api-key") ?? "").trim();
  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    throw new ApiSecurityError(401, "Unauthorized.");
  }
}

export function guardMutationRequest(req) {
  const clientIp = getClientIp(req);
  enforceApiKey(req?.headers);
  enforceRateLimit(clientIp);
}

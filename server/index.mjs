import { createServer } from "node:http";
import { generateAiSignal } from "../lib/aiSignalEngine.mjs";
import { guardMutationRequest, ApiSecurityError } from "../lib/apiSecurity.mjs";
import {
  TelemetryHttpError,
  applyDeposit,
  applyRiskSimulation,
  applyWithdraw,
  getActivityPayload,
  getContractsPayload,
  getDashboardSnapshot,
  getHealthPayload,
} from "../lib/telemetryState.mjs";

const PORT = Number(process.env.PORT ?? 8787);

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
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

const server = createServer(async (req, res) => {
  if (!req.url || !req.method) {
    json(res, 400, { error: "Invalid request." });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const { pathname } = url;

  try {
    if (req.method === "GET" && pathname === "/api/v1/health") {
      json(res, 200, getHealthPayload());
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/contracts") {
      json(res, 200, getContractsPayload());
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/dashboard") {
      json(res, 200, await getDashboardSnapshot());
      return;
    }

    if (req.method === "GET" && pathname === "/api/v1/vault/activity") {
      json(res, 200, await getActivityPayload());
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/ai/signal") {
      const body = await parseBody(req);
      const decision = await generateAiSignal(body);
      json(res, 200, decision);
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/risk/simulate") {
      guardMutationRequest(req);
      const body = await parseBody(req);
      json(res, 200, await applyRiskSimulation(body));
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/vault/deposit") {
      guardMutationRequest(req);
      const body = await parseBody(req);
      json(res, 200, await applyDeposit(body));
      return;
    }

    if (req.method === "POST" && pathname === "/api/v1/vault/withdraw") {
      guardMutationRequest(req);
      const body = await parseBody(req);
      json(res, 200, await applyWithdraw(body));
      return;
    }

    json(res, 404, { error: "Endpoint not found." });
  } catch (error) {
    if (error instanceof ApiSecurityError || error instanceof TelemetryHttpError) {
      json(res, error.statusCode, { error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown server error.";
    json(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[neutralalpha-api] listening on http://localhost:${PORT}`);
});

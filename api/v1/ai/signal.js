import { generateAiSignal } from "../../../lib/aiSignalEngine.mjs";

function json(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function parseBody(body) {
  if (!body) {
    return {};
  }
  if (typeof body === "object") {
    return body;
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const payload = parseBody(req.body);
    const decision = await generateAiSignal(payload);
    json(res, 200, decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    json(res, 500, { error: message });
  }
}

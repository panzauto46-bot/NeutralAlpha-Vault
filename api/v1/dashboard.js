import { getDashboardSnapshot } from "../../lib/telemetryState.mjs";
import { handleOptions, sendJson } from "../_utils/common.js";

const METHODS = "GET,OPTIONS";

export default function handler(req, res) {
  if (handleOptions(req, res, METHODS)) {
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." }, METHODS);
    return;
  }

  sendJson(res, 200, getDashboardSnapshot(), METHODS);
}
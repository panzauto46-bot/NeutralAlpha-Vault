import { guardMutationRequest, ApiSecurityError } from "../../../lib/apiSecurity.mjs";
import { TelemetryHttpError, applyWithdraw } from "../../../lib/telemetryState.mjs";
import { handleOptions, parseBody, sendJson } from "../../_utils/common.js";

const METHODS = "POST,OPTIONS";

export default async function handler(req, res) {
  if (handleOptions(req, res, METHODS)) {
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." }, METHODS);
    return;
  }

  try {
    guardMutationRequest(req);
    const payload = parseBody(req.body);
    sendJson(res, 200, await applyWithdraw(payload), METHODS);
  } catch (error) {
    if (error instanceof ApiSecurityError || error instanceof TelemetryHttpError) {
      sendJson(res, error.statusCode, { error: error.message }, METHODS);
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    sendJson(res, 500, { error: message }, METHODS);
  }
}

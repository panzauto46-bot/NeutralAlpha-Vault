export function setCors(res, methods) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-API-Key");
  res.setHeader("Access-Control-Allow-Methods", methods);
}

export function handleOptions(req, res, methods) {
  if (req.method !== "OPTIONS") {
    return false;
  }
  setCors(res, methods);
  res.status(204).end();
  return true;
}

export function sendJson(res, statusCode, payload, methods) {
  setCors(res, methods);
  res.status(statusCode).json(payload);
}

export function parseBody(body) {
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

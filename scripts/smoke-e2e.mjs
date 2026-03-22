const BASE_URL = process.env.NEUTRALALPHA_API_URL ?? "http://localhost:8787/api/v1";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getJson(path, init = {}) {
  const response = await fetch(`${BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${path}`);
  }
  return response.json();
}

async function main() {
  const health = await getJson("/health");
  assert(health.status === "ok", "Health endpoint did not return status=ok");

  const dashboardBefore = await getJson("/dashboard");
  assert(typeof dashboardBefore.overview?.tvlUsd === "number", "dashboard.overview.tvlUsd missing");
  assert(Array.isArray(dashboardBefore.navSeries), "dashboard.navSeries missing");
  assert(Array.isArray(dashboardBefore.risk?.alerts), "dashboard.risk.alerts missing");
  assert(typeof dashboardBefore.risk?.usdcPrice === "number", "dashboard.risk.usdcPrice missing");
  assert(["HOLD", "REBALANCE", "ROTATE_ASSET"].includes(dashboardBefore.signal?.action), "Invalid signal action");

  const depositAmount = 1250;
  const deposit = await getJson("/vault/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd: depositAmount, wallet: "smoke-test", slippagePct: 0.1 }),
  });
  assert(deposit.ok === true, "Deposit simulation failed");

  const dashboardAfter = await getJson("/dashboard");
  assert(
    dashboardAfter.overview.tvlUsd >= dashboardBefore.overview.tvlUsd,
    "TVL did not increase after deposit",
  );

  const withdrawAmount = 250;
  const withdraw = await getJson("/vault/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd: withdrawAmount, wallet: "smoke-test", slippagePct: 0.1 }),
  });
  assert(withdraw.ok === true, "Withdraw simulation failed");

  const activity = await getJson("/vault/activity");
  assert(Array.isArray(activity.items), "Activity items missing");
  assert(activity.items.length > 0, "Activity should contain at least one item");

  console.log("Smoke test passed.");
  console.log(`API: ${BASE_URL}`);
  console.log(`TVL: $${Math.round(dashboardAfter.overview.tvlUsd).toLocaleString("en-US")}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

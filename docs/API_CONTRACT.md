# NeutralAlpha Vault API Contract (Local Integration Baseline)

Last updated: 2026-03-22

## Purpose

Freeze interface boundaries between frontend dashboard, AI/risk logic, and vault actions before on-chain integrations are wired.

## Base URL

- Dev default (via Vite proxy): `/api/v1`
- Direct API server: `http://localhost:8787/api/v1`

## Endpoints

### `GET /health`

Service heartbeat.

Response:

```json
{
  "status": "ok",
  "service": "neutralalpha-telemetry",
  "timestamp": "2026-03-22T00:00:00.000Z"
}
```

### `GET /contracts`

Returns risk limits and fixed strategy constraints.

Response fields:

- `riskLimits.maxDeltaDriftPct`
- `riskLimits.fundingRotateThresholdPctPer8h`
- `riskLimits.fundingFlipThresholdPctPer8h`
- `riskLimits.minHealthRatioTarget`
- `riskLimits.emergencyHealthRatio`
- `riskLimits.maxSlippagePct`
- `riskLimits.maxSingleAssetExposurePct`
- `riskLimits.maxLeverage`
- `riskLimits.softDrawdownPct7d`
- `riskLimits.hardDrawdownPctFromPeak`

### `GET /dashboard`

Primary dashboard snapshot contract.

Response fields:

- `generatedAt`
- `source`
- `overview.tvlUsd`
- `overview.tvlChangePct`
- `overview.currentApyPct`
- `overview.apyChangePct`
- `overview.healthRatio`
- `overview.deltaExposurePct`
- `navSeries[]` with `{ date, nav }`
- `fundingSeries[]` with `{ time, SOL, BTC, ETH }`
- `allocation[]` with `{ name, value, color }`
- `signal.action` in `HOLD | REBALANCE | ROTATE_ASSET`
- `signal.reason`
- `signal.activeAsset`
- `liveFunding.SOL | BTC | ETH`
- `risk.drawdownFromPeakPct`
- `risk.drawdown7dPct`
- `risk.usdcPrice`
- `risk.depositPaused`
- `risk.emergencyState`
- `risk.alerts[]`
- `risk.limits`

### `POST /vault/deposit`

Simulated vault deposit to validate frontend flow.

Request:

```json
{
  "amountUsd": 2500,
  "wallet": "guest",
  "slippagePct": 0.1
}
```

Response:

```json
{
  "ok": true,
  "message": "Deposit simulated successfully.",
  "tvlUsd": 2850000
}
```

### `POST /vault/withdraw`

Simulated withdrawal flow.

Request:

```json
{
  "amountUsd": 1000,
  "wallet": "guest"
}
```

### `GET /vault/activity`

Recent simulated vault actions.

### `POST /risk/simulate`

Force risk variables for scenario testing (local simulation only).

Request example:

```json
{
  "usdcPrice": 0.975,
  "healthRatio": 1.12,
  "deltaExposurePct": 3.4
}
```

## Notes for Next Integration Phase

- Replace simulated engine with real pipeline inputs (Drift funding feed, Helius streams, Pyth oracle).
- Keep response contract backward compatible while swapping data source.
- Add authenticated wallet signature checks once on-chain deposit/withdraw is connected.

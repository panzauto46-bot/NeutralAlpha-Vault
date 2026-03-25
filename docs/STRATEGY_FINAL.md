# NeutralAlpha Vault - Final Strategy Documentation

Date: 2026-03-25  
Network: Solana Devnet (submission build)  
Base asset: USDC  

## 1) Strategy Thesis

NeutralAlpha Vault targets stable, risk-adjusted yield by capturing perpetual funding while neutralizing directional market risk.

Core idea:

- Keep net delta close to zero (spot long + perp short).
- Earn funding from perp market structure.
- Rotate to better funding pair only when justified by data.

## 2) Edge and Differentiation

- Delta-neutral focus, not directional speculation.
- Rule-constrained risk engine with emergency and pause controls.
- On-chain vault accounting with user positions, share minting, and lock window.
- Live wallet UX + Solscan-proof transaction visibility for verification.

## 3) Position Sizing Framework

- Entry asset: USDC only.
- Initial deployment bias: near-balanced notional between spot and perp legs.
- Hard constraints:
  - Max single-asset exposure cap.
  - Slippage cap on execution.
  - Health-ratio target floor.
- Residual kept in USDC reserve for stability and operational buffer.

## 4) Rebalance and Rotation Logic

Rebalance trigger set:

- `abs(delta_exposure_pct) > 2%` -> `REBALANCE`
- `health_ratio < min target` -> defensive rebalance
- Funding advantage switch across SOL/BTC/ETH -> `ROTATE_ASSET` if materially better

Cadence:

- Continuous telemetry polling.
- Decision engine emits one of: `HOLD | REBALANCE | ROTATE_ASSET`.

## 5) Drawdown and Risk Controls

Risk controls implemented:

- Drawdown monitoring (7d and peak-to-current).
- Deposit pause gate if soft drawdown threshold is breached.
- Emergency mode for severe risk events.
- USDC depeg guard.
- Lock-period enforcement for withdrawal policy consistency.

## 6) Vault Terms

- Base asset: USDC
- Lock tenor: 3-month rolling
- Min APY requirement target: >=10% (see `docs/BACKTEST_APY_REPORT.md`)
- Performance fee: yield-based, no principal fee

## 7) Execution and Verification

Execution stack:

- Frontend dashboard (wallet connect, deposit/withdraw flows)
- On-chain Anchor vault program
- Solscan verifiable transactions

Evidence pointers:

- `docs/TODO_ACTION_PLAN.md` (PR-1 to PR-4 and links)
- `docs/BACKTEST_APY_REPORT.md` (APY evidence)
- `docs/COMPLIANCE_NARRATIVE.md` (track-compliance mapping)

## 8) Operational Limits

- Current submission build is devnet proof with real transaction flow.
- Strategy telemetry may run in hybrid mode depending on API feed availability.
- For production seeding stage: continue with audited adaptor wiring and live telemetry hardening.


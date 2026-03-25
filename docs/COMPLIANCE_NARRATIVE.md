# NeutralAlpha Vault - Compliance Narrative (Main Track)

Date: 2026-03-25

## A) Required Criteria Mapping

| Requirement | Implementation | Status |
|---|---|---|
| Minimum APY >= 10% | Backtest scenarios show ~12% to ~42% net APY | Met |
| Vault base asset = USDC | Deposit and accounting are USDC-denominated | Met |
| Tenor = 3-month rolling lock | Lock policy enforced and shown in dashboard | Met |
| On-chain verification | Program/vault/tx proofs available via Solscan | Met |

Supporting docs:

- `docs/BACKTEST_APY_REPORT.md`
- `docs/STRATEGY_FINAL.md`
- `docs/TODO_ACTION_PLAN.md`

## B) Disallowed Yield Sources - Explicitly Not Used

This strategy does **not** rely on:

- Ponzi-like circular yield-bearing stable structures.
- Junior tranche / insurance-pool style products.
- DEX LP principal-risk vaults (impermanent loss driven).
- High-leverage looping below healthy collateral thresholds.

## C) Risk and Control Posture

Implemented controls include:

- Health-ratio threshold monitoring.
- Delta drift limit and rebalance actioning.
- Drawdown checks (soft/hard style gating).
- Deposit pause and emergency mode capabilities.
- USDC peg monitoring.

## D) Verification Artifacts

- Program ID: `QniYjDEAC4upFurkXeYDdyTMYNf8D7q2ijySC447NRD`
- Vault State: `5dnfKz6SYWtuGC1LZrfG77YNSkL8GAu8HqjmEKVxqDwY`
- Share Mint: `EABxbGDdQK6wus66pCveXsRAWrdJ5gwoRvP5JVpbC87n`
- Example tx (deposit): `https://explorer.solana.com/tx/2e1rHwZUnde7Xei4L6BoZzRL6w1fxAW5NvzxMq42PzuthYJCegSEAJ3Q88ZSDwFSnwqnK4zcsYk1ihtUpGUGXZSZ?cluster=devnet`

## E) Declaration

The current submission package is aligned to Main Track constraints and avoids disqualified yield sources by design narrative and implementation scope.


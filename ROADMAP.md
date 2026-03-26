# NeutralAlpha Vault Roadmap

Source: `NeutralAlpha_Vault_PRD.docx` (Version 1.0)  
Last updated: 2026-03-26

## Goal

Build and ship an AI-driven delta-neutral USDC vault on Solana that meets PRD constraints:

- Target APY: 18% to 35% (net target range)
- Base asset: USDC
- Tenor: 3-month rolling lock
- Strategy: funding rate arbitrage with near-zero directional exposure

## Current Baseline (as of 2026-03-22)

- Frontend showcase is available (`React + Vite + Recharts`).
- Dashboard now consumes live local API data with fallback mode.
- Core on-chain vault instructions are implemented on Anchor with testnet/devnet wiring.
- Local simulation API and Vercel API routes are now aligned for dashboard + vault endpoints.

## PRD-Aligned Milestone Plan

Note: PRD Week 1 (Mar 9-16) and Week 2 (Mar 17-23) are in progress/past relative to today (2026-03-22).  
Execution below keeps PRD milestone order and expected outputs.

### Week 1 - Vault Foundation (Mar 9-16, 2026)

Focus: on-chain vault scaffold and basic delta-neutral mechanics.

- [ ] Anchor vault setup for USDC deposits and share minting
- [x] Deposit/withdraw flow with 3-month rolling lock config (Anchor program implementation)
- [ ] Drift CPI integration for short-perp open/close
- [ ] Jupiter integration for spot leg swaps
- [ ] Basic 50/50 allocation logic (collateral vs spot)

Exit criteria:

- [ ] End-to-end test flow: `deposit -> allocate -> hedge -> withdraw` on testnet
- [x] Core vault instructions documented with examples

### Week 2 - AI Signal Engine + Backtesting (Mar 17-23, 2026)

Focus: prediction, rebalance signal generation, and historical validation.

- [ ] Data ingestion pipeline (RPC + market/funding data)
- [ ] Feature engineering for funding-rate and delta signals
- [ ] Train predictive classifier to output `HOLD | REBALANCE | ROTATE_ASSET`
- [ ] Implement rotation policy among `SOL`, `BTC`, `ETH` per PRD thresholds
- [ ] Backtesting module using historical window (Mar 2024 to Mar 2025)

Exit criteria:

- [ ] Backtest report with Bear/Base/Bull scenarios matching PRD format
- [ ] Inference service runs on 15-minute cadence

### Week 3 - Risk Automation + End-to-End Integration (Mar 24-30, 2026)

Focus: production-grade safety controls and system wiring.

- [x] Risk monitor daemon in Node.js (local simulation baseline)
- [x] Enforce delta rebalance trigger at `>|2%| NAV` (local simulation baseline)
- [x] Enforce funding flip trigger and asset rotation (local simulation baseline)
- [x] Health ratio guardrails (`target >1.5`, emergency `<1.15`) (local simulation baseline)
- [x] Slippage cap handling (`0.3%`) with transaction rejection (local simulation baseline)
- [x] Drawdown controls (soft 5%/7d, hard 10% peak-to-trough) (local simulation baseline)
- [x] Emergency full-unwind path including USDC depeg handling (local simulation baseline)

Exit criteria:

- [ ] Full E2E integration test passed
- [ ] Risk trigger simulation test cases passed
- [ ] Testnet deployment operational with monitoring logs

### Week 4 - Dashboard Live Data + Submission Finalization (Mar 31-Apr 6, 2026)

Focus: ship-ready UX, proof artifacts, and hackathon submission readiness.

- [x] Replace mock frontend data with live backend feed + fallback
- [x] Wallet integration and deposit UX hardening (Phantom connect + simulated deposit flow)
- [x] Real-time dashboard metrics: health ratio, delta, funding, NAV
- [x] Final strategy/risk documentation and disclosure pass
- [ ] Record 3-minute demo video
- [x] Publish GitHub repo and assign required reviewer
- [x] On-chain verification and Solscan link inclusion

Exit criteria:

- [x] PRD checklist items marked complete
- [x] Submission package assembled and reviewed

## Workstreams and Ownership

### On-Chain

- Anchor vault contract flow
- Drift CPI hedge management
- Jupiter spot execution
- Pyth-based health and price checks

### Off-Chain

- AI signal service (Qwen LLM via DashScope API + Node.js rule engine fallback)
- Data pipeline and schedulers
- Risk monitor daemon and emergency controls

### Frontend and Product

- Dashboard integration (live metrics, not mock)
- User deposit and lock-period UX
- Risk and performance transparency views

## Risk Gates (Must-Pass Before Mainnet)

- [ ] Delta exposure stays within +/-2% during normal operation
- [ ] Health ratio remains above 1.5 in normal conditions
- [ ] Emergency unwind tested for HR breach and USDC depeg scenario
- [ ] Slippage and failed-execution handling verified
- [ ] No circular yield source and no LP IL exposure

## Submission Deliverables Checklist

- [x] Live/app demo URL or runnable local package
- [x] Code repository with setup guide and architecture notes
- [x] Strategy document (PRD + implementation notes)
- [ ] 3-minute demo video
- [x] Verified on-chain vault address (Solscan)

## Hardening Sprint (2026-03-25)

- [x] Active wallet provider wiring fixed for on-chain tx signing
- [x] On-chain withdraw activity amount parsing fixed to use token-balance deltas
- [x] Share position/token mismatch guardrails added on-chain
- [x] Vercel API routes expanded (`health`, `contracts`, `dashboard`, `vault/*`, `risk/simulate`, `ai/signal`)
- [x] Emergency mode guard added to `deposit` instruction
- [x] `vault-client` now creates missing USDC ATA before deposit/withdraw
- [x] API mutation hardening added (optional API key + in-memory rate limiting)
- [x] Shared simulation state persistence added for serverless consistency (Vercel KV / Upstash fallback)
- [x] Strategy/architecture docs aligned with current implementation (Qwen + rule fallback, Anchor vault)
- [x] JS dependency risk reduced by removing direct `@solana/spl-token` dependency
- [x] Vite single-file inlining switched to opt-in mode (`VITE_SINGLEFILE=1`)

## Production KV Activation (2026-03-26)

- [x] Upstash Redis created and connected via Vercel Storage integration
- [x] `KV_REST_API_URL` and `KV_REST_API_TOKEN` confirmed in project environment variables
- [x] `SIM_STATE_STORE_KEY` added for shared telemetry keyspace
- [x] Project redeployed after env update
- [x] Production API verification passed (`deposit`, `withdraw`, `vault/activity`, `dashboard`)

## Immediate Next 3 Days Plan (2026-03-23 to 2026-03-25)

- [x] Freeze technical interfaces: vault, signal engine, risk daemon APIs
- [x] Replace dashboard mock data with adapter layer (real + fallback)
- [x] Stand up first E2E smoke harness (local simulation)
- [x] Bootstrap testnet harness connectivity checks
- [x] Extend E2E harness to Solana testnet transaction flow (requires funded signer)
- [x] Wire harness transaction steps to real vault instruction accounts (env-driven vault mode)
- [x] Execute successful vault-mode tx sequence with real program accounts
- [x] Produce daily status report against Week 2/Week 3 exit criteria

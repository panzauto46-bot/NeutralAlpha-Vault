# NeutralAlpha Vault

> AI-Driven Delta-Neutral Yield Strategy on Solana

![Solana](https://img.shields.io/badge/Solana-362D59?style=for-the-badge&logo=solana&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Anchor](https://img.shields.io/badge/Anchor-0.30-blue?style=for-the-badge)

**NeutralAlpha Vault** is an AI-driven delta-neutral USDC vault on Solana that captures funding rate arbitrage with near-zero directional exposure. Built for the **Ranger Build-A-Bear Hackathon 2026** (StableHacks).

---

## 🎯 Strategy Overview

| Parameter | Value |
|-----------|-------|
| **Target APY** | 18% – 35% (net) |
| **Base Asset** | USDC |
| **Lock Period** | 3-month rolling |
| **Max Delta Drift** | ±2% NAV |
| **Rebalance Cadence** | Every 15 minutes |
| **Supported Assets** | SOL, BTC, ETH perps |

### How It Works

1. **Deposit USDC** → Vault mints proportional shares
2. **Position Setup** → 50% collateral for Drift short, 50% spot via Jupiter
3. **Delta Neutralization** → Short offsets spot, net exposure ≈ 0
4. **Earn Funding** → Shorts earn funding when rate is positive
5. **AI Monitoring** → XGBoost model evaluates signals every 15 min
6. **Withdraw** → At maturity, positions unwound, USDC + yield returned

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│         React + Vite + TailwindCSS v4            │
│      Recharts · Framer Motion · Phantom          │
└──────────────────┬──────────────────────────────┘
                   │ API (localhost:8787)
┌──────────────────▼──────────────────────────────┐
│              Backend API (Node.js)               │
│    Risk Monitor · AI Signal Engine · Simulator   │
└──────────────────┬──────────────────────────────┘
                   │ CPI / RPC
┌──────────────────▼──────────────────────────────┐
│            On-Chain (Solana / Anchor)             │
│   Vault Contract · Drift Hedge · Jupiter Swap    │
│          Pyth Oracle · Share Mint/Burn           │
└─────────────────────────────────────────────────┘
```

### Protocol Stack

- **Solana** — Base layer
- **Ranger Earn SDK** — Vault framework
- **Drift Protocol** — Perpetual short positions (CPI)
- **Jupiter Aggregator** — Spot swaps (CPI)
- **Pyth Network** — Oracle price feeds
- **Helius** — RPC & WebSocket data streams

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (tested on Node 24)
- npm

### Install

```bash
npm install
```

### Run Full Stack (Web + API)

**Terminal 1** — API Server:

```bash
npm run dev:api
```

**Terminal 2** — Vite Dev Server:

```bash
npm run dev:web
```

Or run both at once:

```bash
npm run dev:stack
```

- **Web**: http://localhost:5173
- **API**: http://localhost:8787/api/v1/health

### Build for Production

```bash
npm run build
```

---

## 📁 Project Structure

```
NeutralAlpha Vault/
├── src/                    # React frontend
│   ├── components/         # UI components (8 sections)
│   ├── context/            # Phantom wallet context
│   ├── services/           # API adapter + fallback
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Utilities
├── server/                 # Backend simulation API
│   └── index.mjs           # Node.js risk engine (468 lines)
├── onchain/                # Solana Anchor program
│   └── programs/neutralalpha_vault/
│       └── src/lib.rs      # Vault smart contract (542 lines)
├── scripts/                # Dev & test tooling
│   ├── dev-stack.mjs       # Run web + API together
│   ├── smoke-e2e.mjs       # E2E smoke tests
│   ├── testnet-harness.mjs # Solana testnet harness
│   └── vault-client.mjs    # Vault CLI client
└── docs/                   # Documentation
    ├── API_CONTRACT.md      # API specification
    ├── RUNBOOK.md           # Setup guide
    ├── ONCHAIN_RUNBOOK.md   # Deploy instructions
    └── TESTNET_HARNESS.md   # Testnet documentation
```

---

## ⛓️ On-Chain Program

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Create vault state, PDA accounts, share mint |
| `deposit` | Transfer USDC, mint shares, set lock period |
| `withdraw` | Burn shares, return USDC (lock enforced) |
| `set_pause` | Admin: pause/unpause vault |
| `set_emergency_mode` | Admin: emergency override (bypass locks) |
| `set_rebalance_bot` | Admin: update bot authority |
| `execute_drift_hedge` | CPI gateway to Drift Protocol |
| `execute_jupiter_swap` | CPI gateway to Jupiter Aggregator |

### Build & Deploy

```bash
cd onchain
anchor build
anchor deploy --provider.cluster testnet
```

---

## 🛡️ Risk Management

- **Delta Drift**: Auto-rebalance when > ±2% NAV
- **Negative Funding**: Asset rotation to best-rate perp
- **Liquidation**: Health ratio maintained > 1.5 (emergency exit at < 1.15)
- **Slippage**: TX rejected if > 0.3%
- **Drawdown**: Soft limit 5%/7d, hard limit 10% peak-to-trough
- **USDC Depeg**: Full unwind trigger at < $0.98

---

## 🧪 Testing

```bash
# API smoke test (requires API running)
npm run test:smoke

# TypeScript type check
npm run typecheck

# Solana testnet harness
npm run testnet:harness
```

---

## 📜 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Service heartbeat |
| GET | `/api/v1/contracts` | Risk limits & constraints |
| GET | `/api/v1/dashboard` | Live dashboard snapshot |
| GET | `/api/v1/vault/activity` | Recent vault actions |
| POST | `/api/v1/vault/deposit` | Simulated deposit |
| POST | `/api/v1/vault/withdraw` | Simulated withdrawal |
| POST | `/api/v1/risk/simulate` | Force risk scenario |

---

## 🏆 Hackathon

**Ranger Build-A-Bear Hackathon 2026** (StableHacks)  
Solo submission

---

## ⚠️ Disclaimer

This is a hackathon project and proof of concept. DeFi investments carry inherent risks including smart contract vulnerabilities, oracle failures, and extreme market conditions. Past performance and backtested results do not guarantee future returns. Only deposit funds you can afford to lose.

---

## 📄 License

MIT

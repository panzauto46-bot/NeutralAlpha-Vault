# NeutralAlpha Vault Runbook

## Prerequisites

- Node.js 20+ (tested on Node 24)
- npm

## Install

```bash
npm install
```

## Run Full Stack (Web + API)

```bash
npm run dev:stack
```

Services:

- Web: `http://localhost:5173`
- API: `http://localhost:8787/api/v1/health`

## Run Separately

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

## Type Check + Build

```bash
npm run typecheck
npm run build
```

## Smoke E2E (Local)

Run with API already up:

```bash
npm run test:smoke
```

## Testnet Harness Bootstrap

```bash
npm run testnet:harness
```

Optional env:

```bash
set SOLANA_KEYPAIR_PATH=C:\path\to\id.json
set HARNESS_FLOW_MODE=vault
set NEUTRALALPHA_VAULT_PROGRAM_ID=<pubkey>
set DRIFT_PROGRAM_ID=<pubkey>
set PYTH_PRICE_FEED=<pubkey>
set NEUTRALALPHA_DEPOSIT_ACCOUNTS_JSON=[{"pubkey":"$PAYER","isSigner":true,"isWritable":true}]
set NEUTRALALPHA_HEDGE_ACCOUNTS_JSON=[{"pubkey":"$PAYER","isSigner":true,"isWritable":true}]
set NEUTRALALPHA_UNWIND_ACCOUNTS_JSON=[{"pubkey":"$PAYER","isSigner":true,"isWritable":true}]
set HARNESS_STRICT=1
```

On-chain program deploy and vault-mode execution details:

- [ONCHAIN_RUNBOOK.md](./ONCHAIN_RUNBOOK.md)

Quick on-chain client commands:

```bash
npm run vault:accounts
npm run vault:init
npm run vault:deposit -- --amount 1000000
npm run vault:withdraw -- --shares 1000000
```

## Quick Smoke Test

Health check:

```bash
curl http://localhost:8787/api/v1/health
```

Dashboard snapshot:

```bash
curl http://localhost:8787/api/v1/dashboard
```

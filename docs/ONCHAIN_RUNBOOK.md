# On-Chain Runbook (Vault)

## Scope Delivered

- Anchor program scaffold for vault lifecycle:
  - `initialize_vault`
  - `deposit`
  - `withdraw`
  - `execute_drift_hedge`
  - `execute_jupiter_swap`
- 3-month rolling lock enforcement in `deposit/withdraw`
- Share mint + burn accounting
- Pause and emergency controls

## Local Build

```bash
cd onchain
anchor build
```

## Testnet Deploy

```bash
cd onchain
anchor deploy --provider.cluster testnet
```

## Testnet Transaction Harness

From repo root:

```bash
set HARNESS_FLOW_MODE=vault
set SOLANA_KEYPAIR_PATH=C:\path\to\id.json
set NEUTRALALPHA_VAULT_PROGRAM_ID=<program_id>
set DRIFT_PROGRAM_ID=<drift_program_id>
set PYTH_PRICE_FEED=<pyth_feed>
set NEUTRALALPHA_DEPOSIT_ACCOUNTS_JSON=[{"pubkey":"$PAYER","isSigner":true,"isWritable":true}]
set NEUTRALALPHA_HEDGE_ACCOUNTS_JSON=[{"pubkey":"$PAYER","isSigner":true,"isWritable":true}]
set NEUTRALALPHA_UNWIND_ACCOUNTS_JSON=[{"pubkey":"$PAYER","isSigner":true,"isWritable":true}]
set HARNESS_STRICT=1
npm run testnet:harness
```

## Vault Client (Program Instructions)

```bash
npm run vault:accounts
npm run vault:init
npm run vault:deposit -- --amount 1000000
npm run vault:withdraw -- --shares 1000000
```

Environment required for vault client:

- `SOLANA_KEYPAIR_PATH`
- `SOLANA_RPC_URL`
- `NEUTRALALPHA_VAULT_PROGRAM_ID`
- `USDC_MINT`
- `DRIFT_PROGRAM_ID`
- `JUPITER_PROGRAM_ID`
- `PYTH_PRICE_FEED`

## Remaining Work for Full Production

- Replace placeholder account metas with real Ranger/Drift/Jupiter account schema.
- Wire exact instruction data encoding expected by those programs.
- Add integration tests against deployed testnet program.

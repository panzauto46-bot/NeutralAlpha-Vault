# Testnet Harness Bootstrap

## Command

```bash
npm run testnet:harness
```

## Environment Variables

- `SOLANA_RPC_URL` (optional, default `https://api.testnet.solana.com`)
- `SOLANA_KEYPAIR_PATH` (optional, JSON keypair file; if empty uses ephemeral keypair)
- `HARNESS_FLOW_MODE` (optional: `generic` or `vault`, default `generic`)
- `HARNESS_MIN_BALANCE_SOL` (optional, default `0.1`)
- `HARNESS_AIRDROP_SOL` (optional, default `1`)
- `HARNESS_TRANSFER_LAMPORTS` (optional, default `10000`)
- `HARNESS_STRICT` (optional, set `1` to fail when balance is insufficient)
- `NEUTRALALPHA_VAULT_PROGRAM_ID`
- `DRIFT_PROGRAM_ID`
- `PYTH_PRICE_FEED`
- `NEUTRALALPHA_DEPOSIT_ACCOUNTS_JSON` (required in `vault` mode)
- `NEUTRALALPHA_HEDGE_ACCOUNTS_JSON` (required in `vault` mode)
- `NEUTRALALPHA_UNWIND_ACCOUNTS_JSON` (required in `vault` mode)
- `NEUTRALALPHA_DEPOSIT_DATA_B64` (optional in `vault` mode, defaults opcode `0`)
- `NEUTRALALPHA_HEDGE_DATA_B64` (optional in `vault` mode, defaults opcode `1`)
- `NEUTRALALPHA_UNWIND_DATA_B64` (optional in `vault` mode, defaults opcode `2`)

## What It Does

- Checks Solana RPC connectivity (`getVersion`, `getHealth`)
- Loads signer keypair (or generates ephemeral signer)
- Ensures payer has balance (auto-airdrop on testnet if needed)
- Sends and confirms 3 signed transactions:
  - Step 1 `DEPOSIT` (memo tx)
  - Step 2 `HEDGE` (small SOL transfer + memo tx)
  - Step 3 `UNWIND` (memo tx)
- In `vault` mode, replaces generic steps with real `TransactionInstruction`s built from env-provided account metas/data.
- Prints explorer URLs for each tx
- Prints missing protocol env vars for next-stage real vault adapter integration
- Gracefully skips tx flow when faucet/funds unavailable (unless `HARNESS_STRICT=1`)

## Current Scope

This harness executes real testnet transactions, but vault-specific instructions are still simulated until program account schema is provided.

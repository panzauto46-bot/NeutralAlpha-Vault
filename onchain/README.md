# NeutralAlpha On-Chain Vault (Anchor)

This folder contains the Solana program for NeutralAlpha Vault with:

- USDC deposit and withdraw flow
- Share minting/burning
- 3-month rolling lock on deposits
- Admin controls (`pause`, `emergency_mode`, `rebalance_bot`)
- CPI gateway instructions for Drift hedge and Jupiter swap

## Program Layout

- Program crate: `programs/neutralalpha_vault`
- Program id: `Fg6PaFpoGXkYsidMpWxTWqkZ6rN1Y2fYgR6K9YqR9Qj3` (placeholder for local/testnet)

## Instructions

- `initialize_vault`
- `set_pause`
- `set_emergency_mode`
- `set_rebalance_bot`
- `deposit`
- `withdraw`
- `execute_drift_hedge` (CPI gateway)
- `execute_jupiter_swap` (CPI gateway)

## Required Tooling

- Rust + Cargo
- Solana CLI
- Anchor CLI

## Build

```bash
cd onchain
anchor build
```

## Deploy to Testnet

```bash
cd onchain
anchor deploy --provider.cluster testnet
```

## Notes for Protocol Wiring

The CPI gateway expects:

- `ExternalCpiParams.program` equal to configured Drift/Jupiter program id
- `account_flags` aligned with `remaining_accounts` (`bit0=writable`, `bit1=signer`)
- serialized CPI ix data in `ExternalCpiParams.data`

This allows the off-chain rebalancer to build protocol-specific instructions and route through vault authority PDA safely.

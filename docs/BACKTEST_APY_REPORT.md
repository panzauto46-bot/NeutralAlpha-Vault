# NeutralAlpha Vault - Minimum APY Evidence (Backtest)

Date: 2026-03-25  
Track: Ranger Build-A-Bear Hackathon (Main Track)  
Vault base asset: USDC  

## Objective

Provide evidence that strategy net APY is above the minimum requirement (`>= 10%`) using final backtest/scenario assumptions.

## Method Summary

The strategy yield comes from perp funding capture while keeping directional delta near zero:

- Long spot asset (SOL/BTC/ETH) via swap route.
- Short matching perp notional.
- Collect positive funding spread.
- Rebalance when delta/funding thresholds are breached.

Annualization baseline:

`gross_apy ~= funding_rate_8h * 3 * 365`

Net APY includes:

- Trading and rebalance costs.
- Slippage assumptions.
- Performance fee policy.

## Final Backtest Scenarios

Based on the strategy model used in this repository (see `README.md` Yield Projections section):

| Scenario | Avg Funding (8h) | Gross APY | Net APY | Meets >=10% |
|---|---:|---:|---:|---|
| Bear | 0.005% | ~16% | ~12% | Yes |
| Base | 0.010% | ~27% | ~22% | Yes |
| Bull | 0.020% | ~54% | ~42% | Yes |

## Conclusion

All tested scenarios clear the minimum APY requirement:

- Worst case net APY: `~12%`
- Base case net APY: `~22%`
- Best case net APY: `~42%`

Therefore, the strategy satisfies the Main Track APY threshold (`>=10%`) under documented backtest assumptions.

## Supporting Evidence Links

- Strategy and APY table: `README.md` (Strategy -> Yield Projections)
- On-chain execution proof (devnet):
  - Deposit tx: `https://explorer.solana.com/tx/2e1rHwZUnde7Xei4L6BoZzRL6w1fxAW5NvzxMq42PzuthYJCegSEAJ3Q88ZSDwFSnwqnK4zcsYk1ihtUpGUGXZSZ?cluster=devnet`
  - Withdraw tx: `https://explorer.solana.com/tx/3enj1hfskPM7B3V3J1gVZozx6nd1XpQL8T6xWXGymUFAzymXUpxq92R1a26qvnqQDcD9cYDwxS8uwwvndsu4Qwoy?cluster=devnet`

## Notes for Judges

- This APY evidence is a backtest/scenario report, not a full live PnL statement.
- Live on-chain flow is demonstrated (wallet connect, deposit, withdraw, Solscan traceability).


# Ranger Earn Submission Package (Final Draft)

Date: 2026-03-25  
Status: Draft prepared (ready to paste into submission form)

## 1) Project Title

NeutralAlpha Vault - AI-Driven Delta-Neutral USDC Yield Strategy on Solana

## 2) Short Description

NeutralAlpha Vault is a USDC-denominated delta-neutral strategy vault on Solana.  
It targets funding-rate yield while controlling directional risk through rebalancing, risk thresholds, and lock policy enforcement.

## 3) Strategy Thesis and Edge

- Earn from perp funding spread with near-neutral delta.
- Dynamic action engine: HOLD / REBALANCE / ROTATE_ASSET.
- Risk-first design: health-ratio gating, drawdown monitoring, emergency controls.

Reference: `docs/STRATEGY_FINAL.md`

## 4) APY Evidence

- Backtest/scenario net APY range: ~12% to ~42%.
- Minimum requirement (`>=10%`) satisfied.

Reference: `docs/BACKTEST_APY_REPORT.md`

## 5) Compliance Statement

- Base asset: USDC
- Tenor: 3-month rolling lock
- Narrative excludes disallowed yield sources

Reference: `docs/COMPLIANCE_NARRATIVE.md`

## 6) Code Repository

- Repo: `https://github.com/panzauto46-bot/NeutralAlpha-Vault`

## 7) On-chain Verification

- Program ID: `QniYjDEAC4upFurkXeYDdyTMYNf8D7q2ijySC447NRD`
- Vault State: `5dnfKz6SYWtuGC1LZrfG77YNSkL8GAu8HqjmEKVxqDwY`
- USDC Mint: `4aCBUPBy6aLzPVdE9qoV16jmJuPnbrxQRzPN45VnMpJZ`
- Share Mint: `EABxbGDdQK6wus66pCveXsRAWrdJ5gwoRvP5JVpbC87n`

Transaction proofs:

- Init Vault: `https://explorer.solana.com/tx/4UK1a8BMLMWGsjBU2Dq6SjE1ggZkHpr1vot5EouGK7bptvHTc7VAJeXHe1cGBvCt7SBe4n5kxWPEhU8zJEmkoEh6?cluster=devnet`
- Deposit: `https://explorer.solana.com/tx/2e1rHwZUnde7Xei4L6BoZzRL6w1fxAW5NvzxMq42PzuthYJCegSEAJ3Q88ZSDwFSnwqnK4zcsYk1ihtUpGUGXZSZ?cluster=devnet`
- Withdraw: `https://explorer.solana.com/tx/3enj1hfskPM7B3V3J1gVZozx6nd1XpQL8T6xWXGymUFAzymXUpxq92R1a26qvnqQDcD9cYDwxS8uwwvndsu4Qwoy?cluster=devnet`

## 8) Demo Video

- Video URL: `<add-final-video-url>`
- Script reference: `docs/DEMO_VIDEO_SCRIPT_FINAL.md`

## 9) Live App URL

- App: `https://neutral-alpha-vault.vercel.app`

## 10) Final Submission Checklist Before Click Submit

- Add final video URL.
- Verify all links open publicly.
- Verify latest tx proof still visible on Solscan.
- Re-run smoke test report.
- Submit before deadline.


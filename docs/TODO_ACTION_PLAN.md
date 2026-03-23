# 🎯 NeutralAlpha Vault — Action Plan

**Tanggal:** 2026-03-24  
**Goal:** Transformasi proyek dari dummy/showcase → real working demo untuk hackathon  
**Deadline:** StableHacks 2026 (Week 4: 31 Mar – 6 Apr 2026)  
**Estimasi Total:** ~20 jam kerja

---

## ✅ Prerequisites (DONE)

- [x] Rust `1.94.0`
- [x] Cargo `1.94.0`
- [x] Solana CLI `2.2.14`
- [x] Anchor CLI `0.30.1`
- [x] VS Build Tools 2022
- [x] Node.js 24
- [x] GitHub repo pushed
- [x] README + .gitignore + banner

---

## 🔴 PHASE 1 — Deploy ke Blockchain (~4 jam)

> Tanpa ini, proyek tetap dummy. Ini fondasi utama.

### PR-1: Setup Wallet + Deploy Anchor Program
- **Effort:** 2 jam
- **Status:** ☐ Belum
- **Steps:**
  1. Set Solana ke devnet: `solana config set --url devnet`
  2. Buat keypair baru: `solana-keygen new`
  3. Airdrop SOL: `solana airdrop 5`
  4. Build program: `cd onchain && anchor build`
  5. Deploy: `anchor deploy --provider.cluster devnet`
  6. Catat **Program ID** baru
  7. Update `declare_id!()` di `lib.rs` dengan ID baru
  8. Update `Anchor.toml` dengan ID baru
  9. Rebuild + redeploy
- **Hasil:** Program vault live di Solana devnet + Solscan link ✅

---

### PR-2: Buat Test USDC Token di Devnet
- **Effort:** 30 menit
- **Status:** ☐ Belum
- **Steps:**
  1. Buat SPL token mint: `spl-token create-token --decimals 6`
  2. Buat token account: `spl-token create-account <MINT_ADDRESS>`
  3. Mint tokens: `spl-token mint <MINT_ADDRESS> 1000000`
  4. Catat **USDC Mint Address**
- **Hasil:** Ada test USDC yang bisa dipakai deposit ✅

---

### PR-3: Initialize Vault On-Chain
- **Effort:** 30 menit
- **Status:** ☐ Belum
- **Steps:**
  1. Set environment variables (program ID, USDC mint, dll)
  2. Jalankan: `npm run vault:init`
  3. Verifikasi vault state account di Solana Explorer
  4. Catat vault state address
- **Hasil:** Vault account live di devnet ✅

---

### PR-4: Test Deposit + Withdraw On-Chain
- **Effort:** 1 jam
- **Status:** ☐ Belum
- **Steps:**
  1. Deposit: `npm run vault:deposit -- --amount 1000000`
  2. Verifikasi shares ter-mint
  3. Cek balance share token
  4. Test withdraw (bypass lock untuk testing)
  5. Verifikasi USDC kembali
  6. Screenshot semua tx di Solscan
- **Hasil:** Full deposit → withdraw cycle terbukti on-chain ✅

---

## 🟡 PHASE 2 — Connect Frontend ke Blockchain (~10 jam)

> Ini yang bikin demo "WOW" — user klik deposit, Phantom popup, tx nyata!

### PR-5: Real Deposit dari Frontend (Phantom → On-Chain)
- **Effort:** 4 jam
- **Status:** ☐ Belum
- **Apa yang dikerjakan:**
  - Tambah `@coral-xyz/anchor` ke dependencies
  - Buat service `src/services/vaultProgram.ts`:
    - Load Anchor IDL
    - Derive PDA accounts (vault_state, user_position, dll)
    - Build deposit instruction
    - Send transaction via Phantom wallet
  - Update `Dashboard.tsx`:
    - Jika wallet connected → kirim real on-chain tx
    - Jika tidak connected → fallback ke simulasi
  - Tampilkan tx signature + link Solscan setelah deposit
- **Hasil:** User klik "Deposit" → Phantom popup → Real tx di Solana ✅

---

### PR-6: Real Withdraw dari Frontend
- **Effort:** 3 jam
- **Status:** ☐ Belum
- **Apa yang dikerjakan:**
  - Tambah withdraw instruction builder di `vaultProgram.ts`
  - Tambah UI "Withdraw" section:
    - Tampilkan user shares balance
    - Tampilkan unlock time countdown
    - Withdraw button
  - Send withdraw tx via Phantom
  - Tampilkan tx result + Solscan link
- **Hasil:** Full redeem flow dari frontend ✅

---

### PR-7: Tampilkan Real On-Chain Data di Dashboard
- **Effort:** 3 jam
- **Status:** ☐ Belum
- **Apa yang dikerjakan:**
  - Fetch vault state account via RPC (`total_usdc`, `total_shares`)
  - Fetch user position (`shares`, `unlock_ts`)
  - Display real TVL dari on-chain data
  - Display user balance + lock status
  - Hybrid mode: on-chain data (TVL, shares) + simulation data (signals, funding)
- **Hasil:** Dashboard campuran real + simulasi yang tampak production-ready ✅

---

## 🟢 PHASE 3 — Polish & Submission (~6 jam)

> Bonus nilai untuk juri + prepare submission.

### PR-8: Transaction History dari On-Chain
- **Effort:** 2 jam
- **Status:** ☐ Belum
- **Apa yang dikerjakan:**
  - Fetch recent transactions untuk vault program dari RPC
  - Parse instruction data (deposit/withdraw/rebalance)
  - Tampilkan di dashboard "Recent Activity"
  - Setiap tx ada link ke Solscan
- **Hasil:** Juri klik dan lihat real tx di explorer ✅

---

### PR-9: Network Badge (Devnet/Mainnet)
- **Effort:** 1 jam
- **Status:** ☐ Belum
- **Apa yang dikerjakan:**
  - Tambah env var `VITE_SOLANA_NETWORK=devnet`
  - Badge di navbar: "🟡 Devnet" atau "🟢 Mainnet"
  - RPC URL switch otomatis berdasarkan network
  - Solscan link otomatis pakai devnet/mainnet URL
- **Hasil:** Jelas bagi juri bahwa ini running di real network ✅

---

### PR-10: Vercel Environment Setup
- **Effort:** 15 menit
- **Status:** ☐ Belum
- **Variables yang perlu di-set:**
  ```
  VITE_SOLANA_NETWORK=devnet
  VITE_VAULT_PROGRAM_ID=<program_id>
  VITE_USDC_MINT=<test_usdc_mint>
  VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
  ```
- **Hasil:** Vercel deployment terhubung ke devnet ✅

---

### PR-11: Rekam Demo Video 3 Menit
- **Effort:** 2 jam
- **Status:** ☐ Belum
- **Script:**
  1. (0:00 - 0:30) Buka website → tunjukkan landing page + dashboard
  2. (0:30 - 0:45) Connect Phantom wallet
  3. (0:45 - 1:30) Deposit USDC → Phantom tx → lihat di Solscan
  4. (1:30 - 2:00) Jelaskan strategy delta-neutral
  5. (2:00 - 2:30) Tunjukkan risk controls + AI signal
  6. (2:30 - 2:45) Show architecture + protocol stack
  7. (2:45 - 3:00) Closing + call to action
- **Tools:** OBS Studio / Loom / ScreenPal
- **Hasil:** Video submission siap ✅

---

### PR-12: Update Footer Links + Placeholders
- **Effort:** 10 menit
- **Status:** ☐ Belum
- **Apa yang dikerjakan:**
  - GitHub link → `https://github.com/panzauto46-bot/NeutralAlpha-Vault`
  - Solscan link → ke deployed program address
  - Hapus/update placeholder Twitter & Discord
  - Tambah Devpost/submission link (jika ada)
- **Hasil:** Semua link berfungsi ✅

---

### PR-13: Fix Bugs dari Audit
- **Effort:** 30 menit
- **Status:** ☐ Belum
- **Bug list:**
  - [ ] Fix hardcoded health ratio `1.72` di `RiskManagement.tsx` (line 222)
  - [ ] Tambah `<meta name="description">` di `index.html`
  - [ ] Hapus unused `cn.ts` atau mulai gunakan
  - [ ] Fix `dev-stack.mjs` untuk Windows (tambah `shell: true`)
  - [ ] Bersihkan log files (`vite-dev.err.log`, `api-dev.err.log`)
  - [ ] Tambah `LICENSE` file (MIT)
- **Hasil:** Clean codebase, zero known bugs ✅

---

## 📊 Summary Table

| Phase | PR | Task | Effort | Status |
|-------|-----|------|--------|--------|
| 🔴 1 | PR-1 | Deploy Anchor ke devnet | 2 jam | ☐ |
| 🔴 1 | PR-2 | Buat test USDC | 30 min | ☐ |
| 🔴 1 | PR-3 | Initialize vault | 30 min | ☐ |
| 🔴 1 | PR-4 | Test deposit/withdraw | 1 jam | ☐ |
| 🟡 2 | PR-5 | Real deposit via Phantom | 4 jam | ☐ |
| 🟡 2 | PR-6 | Real withdraw via Phantom | 3 jam | ☐ |
| 🟡 2 | PR-7 | On-chain data di dashboard | 3 jam | ☐ |
| 🟢 3 | PR-8 | Transaction history | 2 jam | ☐ |
| 🟢 3 | PR-9 | Network badge | 1 jam | ☐ |
| 🟢 3 | PR-10 | Vercel env setup | 15 min | ☐ |
| 🟢 3 | PR-11 | Demo video | 2 jam | ☐ |
| 🟢 3 | PR-12 | Update links | 10 min | ☐ |
| 🟢 3 | PR-13 | Fix bugs | 30 min | ☐ |
| | | **TOTAL** | **~20 jam** | |

---

## ⏰ Timeline Rekomendasi

| Tanggal | Target |
|---------|--------|
| **24-25 Mar** | Phase 1: Deploy ke devnet (PR-1 ~ PR-4) |
| **26-28 Mar** | Phase 2: Frontend → blockchain (PR-5 ~ PR-7) |
| **29-30 Mar** | Phase 3: Polish + video (PR-8 ~ PR-13) |
| **31 Mar** | Final review + submit |

---

> **Note:** Setelah setiap PR selesai, update status ☐ → ☑ dan commit ke GitHub.

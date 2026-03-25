# Final Smoke Test Report

Date: 2026-03-25  
Scope: pre-submission technical sanity checks

## Automated Checks (Completed)

### 1) Type check

Command:

```bash
cmd /c npm run typecheck
```

Result: PASS

### 2) Production build

Command:

```bash
cmd /c npm run build
```

Result: PASS

Notes:

- Vite build completed successfully.
- `dist/index.html` generated.

### 3) API smoke test

Command sequence:

```bash
node server/index.mjs
cmd /c npm run test:smoke
```

Result: PASS

Observed output:

- `Smoke test passed.`
- API endpoint reachable at `http://localhost:8787/api/v1`
- Deposit/withdraw simulation flow passed in smoke script.

## Manual Checks (Still Required by Operator)

- Incognito browser test on production URL.
- Wallet connect from clean browser profile.
- Real deposit tx signature appears in UI.
- Solscan link opens and status is `Success`.
- Recent Activity shows corresponding tx.

## Final Status

- Automated smoke checks: PASS
- Manual operator checks: pending final run right before submission


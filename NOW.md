# Alpaca Trading Bot - Status

**Current control:** Control-168 (Aug 28, 2026 ~13:01 UTC / 15:01 +02)
**Verdict:** HEALTHY (code/deploy 2.6.0), DEGRADED (external)
**Code:** b58e7ea (Control-162 crypto edge producer, unchanged)
**Docs HEAD:** this commit (local only, push blocked github_pat)
**Tests:** 224 pass / 845 assertions, typecheck clean

## Live state
- Equity $98,478.07 (+$3.80 today, +0.004%, first positive day), ACTIVE, not blocked, not PDT
- 25 positions all strategy=swing, MV $11,717 (3.17x $3,700 cap, pre-existing from pre-fix daytrading buys)
- RIVN sell 186.29 (trade 740) + AEP sell 1 (trade 739) status "new", unfilled — pending 13:30 UTC open
- NEW: ~71-min run-log gap (11:50-13:01 UTC), ~8 missing runs, second gap since Workers Paid
- Post-Control-162 clean window was ~4h40m (07:11-11:50) then sudden gap. Reconcile ~2s before gap
- SWING_OWNED_EXCLUDE 0 occurrences (0 daytrading runs today, first test 13:30 UTC open)
- Crypto edge producer deployed but all runs skip at CRYPTO_BARS_STALE (AVAXUSD ~22h) / UNAVAILABLE (MATICUSD)
- 3 null-strategy trades persistent (703 PLD, 648 NOW, 645 DUK)
- 98 filled trades gross/fee/net=null (conservative)
- Caps 5000/3700/2000 USD unchanged (capital-caps.ts:6-8)
- Four schedules verified (wrangler.toml crons: */5 13-21, 0 22, 7-59/30, */10)

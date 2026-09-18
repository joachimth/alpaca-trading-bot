# Control-715 (Sep 18 ~20:01 UTC) — strict read-only control
## HEALTHY 2.7.0 — docs-only, NO deploy (post-close steady state, C-714 resolution held)
- True clock verified 20:01 UTC (C-370 lesson; matches turn_context ~22:00 +02).
- All 8 GET endpoints HTTP 200 real data, no D1_ERROR. /health=2.7.0, /api/account broker-direct.
- Repo HEAD 2769a8e (C-714). Deployed src 2fe9c5a, `git diff 2fe9c5a -- src/` = 0 (ZERO src diff),
  bundle index.js md5 e34318f5, RELEASE_VERSION 2.7.0. Working tree clean (docs-only).
- Docs (README/OPERATIONS/RUNBOOK) all identify PRIOR HEAD e9a8818 (C-713) / current 2769a8e (C-714);
  deployed src commit 2fe9c5a C-688 bundle. Docs HEAD = repo HEAD = C-714 (C-715 entry to follow).
- Validation: 241 tests / 893 PASS (bun test), typecheck exit 0, `git diff --check` clean.
- Caps UNCHANGED: daytrading 5000 / swing 3700 / crypto 2000 (dashboard capitalCaps).
  Risk guards UNCHANGED: daily_loss 150/100/100, equity floor $97k, crypto_disabled, eod_flatten true.
- Broker-authoritative: current_state_source=alpaca, metadata_source=d1, 0 daytrading (EOD-flat),
  11 swing (AAL/AVGO/BA/BAC/C/DAL/F/NEE/SNOW/TXN/WMT), 0 crypto/null.
- Equity (broker-direct) $97,134.69, change_today +$17.82 POSITIVE (~$135 over $97k floor, NEVER touched).
  Snapshot 3123 equity $97,126.29, daily_pl +$9.42. Trend-bend extends through C-715 (C-530..C-715).
- 300-run window (04:37->19:56): 0 id-gaps, 0 time-gaps >600s, 0 lease-held in window.
  1 error run 13878 (17:26 WBD POSITION_QTY_MISMATCH) = documented benign self-limiting (C-711),
  broker-authoritative qty persisted, self-healed. No new suppression.
- Crypto :07/:37 EXACT 30/30 (04:37->19:37, all CRYPTO_DISABLED_BY_CONFIG fail-closed).
- Daytrading freeze (C-712/713, 18:21->19:31) RESOLVED confirmed: 13910@19:31 self-healed,
  13915@19:46 EOD-flatten fired, book FLAT. Post-close runs 13917/13918 clean market-closed skips.
- Trades: 0 pending / 0 leaves / 0 null-strategy, 300/300 filled, conservative filled_lot_exact_unavailable.
- FINDING 1 reconfirmed (ENPH 0.69 / QCOM 0.77 / WBD 0.725 rejected at FALLBACK 0.7 bar).
- Escalate-again predicate STAYS ARMED (lowered threshold): ANY further suppression/slot-miss
  (Mon 22:00 swing fire = 5th post-redeploy cadence test, or any session) = ESCALATE.
- NEXT: Mon 22:00 swing fire cadence test; FINDING-1 + D1 paid-tier + cap fill-drift + docs re-archive pending Joachim.

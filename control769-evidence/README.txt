Control-769 evidence set — Mon Sep 20 22:00 UTC (Sun Sep 20 22:01 +02)
Strict read-only production control of https://alpaca-trading-bot.joachim-763.workers.dev

Collected 2026-09-20 around 22:00:10-22:01 UTC via read-only GET requests only
(NO trigger/submit/cancel/close/replace/retry/migration/broker-mutating endpoint).

Files (all valid JSON unless noted):
  health.json       GET /health                 -> 200, {status:ok, service:alpaca-trading-bot, version:2.8.1}
  account.json      GET /api/account            -> 200, broker-direct equity $97,135.81, change_today +$0.0036 POSITIVE
  config.json       GET /api/config             -> 200, release_version 2.8.1, nested config.version 2.7.0 (D1-seed), min_confidence 0.8, crypto_trading_enabled false, crypto_min_edge_after_costs 8, account_equity_floor_usd 97000
  dashboard.json    GET /api/dashboard          -> 200, capitalCaps daytrading 5000/swing 3700/crypto 2000, freshness current_state_source=alpaca, 11 swing positions (MV 4767.86), equity direction fallback active
  positions.json    GET /api/positions          -> 200, 11 swing positions, cost_basis total $4,992.42 (legacy CAPITAL_CAP held book), MV $4,767.86
  runs.json         GET /api/runs (default 30)  -> 200, sample window
  runs300.json      GET /api/runs?limit=300     -> 200, window 14619(07:01:16)->14918(22:00:27) id-contiguous 300/300, 0 errors, 0 CYCLE_LEASE_HELD, 0 inter-run gap >15min; crypto :07/:37 EXACT 30/30 CRYPTO_DISABLED_BY_CONFIG; reconcile */10 EXACT 90 MAINTENANCE_ONLY ok; daytrading 180 max step 5.03min NO new suppression; swing 0 (Sunday)
  trades.json       GET /api/trades (limit)     -> 200, 50/50 filled daytrading, 0 null-strategy, conservative filled_lot_exact_unavailable accounting, net=gross-fee consistent
  schedules.json    GET CF /schedules           -> 200, success true, all four cron schedules registered (daytrading 1-59/5, swing 0 22 * * 2-6, crypto 7-59/30, reconcile */10)

Validation: bun run typecheck exit 0, git diff --check clean, 263 tests / 969 assertions PASS (0 fail).
Deployed src commit 2ea5e9d re-confirmed: git merge-base --is-ancestor 2ea5e9d HEAD = ancestor,
git log 2ea5e9d..HEAD -- src/ empty = ZERO src diff. Docs identify deployed commit 2ea5e9d (40 mentions each in README/OPERATIONS/RUNBOOK).

RESULT: HEALTHY — no code/config defect, no suppression recurrence, no correction/deploy needed.
Only historical gap remains the already-escalated C-739 isolated daytrading slot-miss.
Docs push remains blocked by origin/main fork-divergence (C-750, Joachim decision).

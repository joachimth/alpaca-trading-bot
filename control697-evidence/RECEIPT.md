# Control-697 evidence receipt (Sep 18 05:00 UTC Fri)

Strict read-only Alpaca production-control sweep, Sep 18 2026 ~05:00-05:03 UTC. All fetches are GET-only; no trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.

## Live payloads captured
- c697_health.json — GET /health → HTTP 200, status ok, version 2.7.0
- c697_api_config.json — GET /api/config → HTTP 200, version 2.7.0, caps/guards keys
- c697_api_dashboard.json — GET /api/dashboard → HTTP 200, broker-authoritative
- c697_api_positions.json — GET /api/positions → HTTP 200, source=alpaca, 11 swing
- c697_account.json — GET /api/account → HTTP 200, broker-direct equity
- c697_api_runs.json — GET /api/runs (limit=30) → HTTP 200
- c697_runs300.json — GET /api/runs?limit=300 → HTTP 200
- c697_api_trades.json — GET /api/trades (limit=50) → HTTP 200

## True clock
`date -u` = 05:00:09 UTC (C-370 lesson applied; injected context clock cross-checked).

## Key live facts
- Equity (broker-direct /api/account): **$97,135.36**, change_today **+$53.61 / +0.055% POSITIVE**, last_equity $97,081.75 (upward delta). ~$135 above the $97,000 floor. snapshot equity $97,132.34, daily_pl +$50.59.
- Capital caps (dashboard capitalCaps): daytrading 5000, swing 3700, crypto 2000 — UNCHANGED.
- Guards (/api/config): daily_loss_limit_usd 150, swing 100, crypto 100, account_equity_floor_usd 97000; crypto_trading_enabled false; min_confidence 0.8 nominal D1 / FALLBACK_CONFIG enforces 0.7 (FINDING 1).
- Positions (source=alpaca): 11 swing (AAL/AVGO/BA/BAC/C/DAL/F/NEE/SNOW/TXN/WMT, cost $4,992.42 CAPITAL_CAP, MV $4,824.62) + 0 daytrading (EOD-flat) + 0 crypto. 0 null-strategy.
- Run log 300-window 13331->13630 id-contiguous 0 id-gaps. Newest run 13630 @05:00:35 (reconcile). Post-redeploy (>=20:07:07Z Sep 17) = 180 runs 13451->13630, 0 errors / 0 lease-held / 0 time-gaps >360s across ALL trigger types. All 4 schedules cadencing (cron 107 + reconcile 54 + crypto_cron 18 + swing_cron 1). Only 2 error-runs in window (13402/13408 POSITION_QTY_MISMATCH QCOM/VZ Sep 17 17:06/17:21) are DOCUMENTED pre-redeploy C-685 recurrences.
- Crypto :07/:37 UTC cadence EXACT post-redeploy 18/18 slots (20:07..04:37) all CRYPTO_DISABLED_BY_CONFIG, 0 missing.
- Reconcile */10 fresh no creep: newest 13630 @05:00:35.
- Swing fire 13489 @22:00:44 CF-DOW=5 25 decisions 0 errors clean (documented C-690, 4th post-redeploy cadence test PASSED).
- Trades 50/50 filled (ids 1524->1573), 0 pending, 0 leaves, 0 null-strategy; conservative filled_lot_exact_unavailable gross/fee/net (uncertain fees unattributed).

## Findings
- FINDING 1 (min_confidence 0.7 fallback): still live, gate risk-manager.ts:170/171 + FALLBACK_CONFIG src/index.ts:117; 0.8-wiring is a risk-parameter change pending Joachim's decision, NOT deployed. Known carried finding, not a new defect. No bleed (0 new daytrading entries this cycle, market closed).
- FINDING 2 async fill-lag: resolving via reconcile, 0 persistent pending.
- Edge-gate wiring config-disabled verified (computeCalibratedEdgeBps technical-analysis.ts:414/604 alive-but-unreached).

## Validation (local, repodir /workspace/alpaca-trading-bot)
- `bun test`: **241 pass / 0 fail / 893 expect() calls**
- `bun run typecheck`: exit 0
- `git diff --check`: clean
- `git diff 2fe9c5a -- src/`: empty (ZERO src diff); deployed src 2fe9c5a confirmed
- Working tree clean except untracked evidence dirs (docs-only, no source change, no deploy)

## Verdict
**HEALTHY 2.7.0 — docs-only, NO deploy, no defect, no correction.** The C-688 EOD reliability redeploy (20:07:07Z Sep 17) HOLDS CLEAN into Day-2/3. 0 suppression recurrence post-redeploy. Escalation predicate stays active (ANY new recurrence Fri 13:30 open/session or swing fire = ESCALATE to Joachim as worsening CF platform instability).

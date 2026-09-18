# Control-708 — Strict read-only control (docs-only, NO deploy)

- UTC: 2026-09-18 15:00-15:03 (cross-checked real clock `date -u` 15:00:29; C-370 lesson)
- Host: https://alpaca-trading-bot.joachim-763.workers.dev
- Verdict: HEALTHY 2.7.0 — C-688 redeploy holds clean through Day-3 incl. first post-redeploy live daytrading session extended past 14:00; 0 suppression recurrence, 0 defects, no deploy

## GET probes (all HTTP 200, no D1_ERROR)
- /health                -> status ok, version 2.7.0
- /api/config            -> 2.7.0, risk keys 150/100/100 + floor 97000 + crypto_trading_enabled false, min_confidence 0.8 nominal
- /api/account           -> equity 97142.04, change_today +25.17 POSITIVE (~142 over floor)
- /api/dashboard         -> current_state_source=alpaca, metadata d1; capitalCaps 5000/3700/2000
- /api/positions         -> source=alpaca (broker-authoritative), 14 positions (11 swing + 3 daytrading)
- /api/runs (limit=300)  -> 13532(00:06)->13831(15:01), 0 id-gaps, 0 errors, 0 lease-held, 0 time-gaps>15min
- /api/trades (limit=300)-> 300/300 filled, 0 pending, 0 leaves, 0 null-strategy

## Positions (broker source)
- Swing: AAL/AVGO/BA/BAC/C/DAL/F/NEE/SNOW/TXN/WMT (11, cost 4992.42 CAPITAL_CAP, MV 4765.24)
- Daytrading LIVE: T 189.3 (4846.08) / HOOD 8 (924.80) / NVDA 0.65 (142.51), MV 5038.29 vs 5000 cap (+38 benign cap-drift)
- Crypto: 0 (CRYPTO_DISABLED_BY_CONFIG)

## Delivery
- Daytrading cron: every 5-min slot 13:30-15:00 present (19 runs) 0 gaps/errors
- Crypto: :07/:37 EXACT 30/30 (00:07->14:37), all CRYPTO_DISABLED
- Reconcile: */10 fresh, 91 ok runs, newest 13830 @15:00:36 ok
- Swing: newest 13489 @22:00:44 CF-DOW=5 (4th post-redeploy test PASSED, C-690); next Mon 22:00

## FINDING 1 (live, unresolved, pending Joachim)
- 0.7 fallback firing: QCOM dec 14743 "Conf 0.68 below min 0.7", DIS 14735/14728, PLUG 14725
- SWING_OWNED_EXCLUDE live: AVGO 14734/14727 skipped
- Gate risk-manager.ts:170/171 + FALLBACK 0.7 src/index.ts:125

## Validation
- 241 tests / 893 assertions PASS (bun test), typecheck exit 0, git diff --check clean
- git diff 2fe9c5a -- src/ = empty (ZERO src diff, deployed bundle md5 e34318f5 unchanged)

## Follow-ups (unchanged)
- FINDING 1 wiring (0.8) = risk-param change, pending Joachim
- D1 paid-tier decision pending Joachim
- daytrading cap fill-drift re-check queued 2.7.x
- Fri session to 20:00 = rest of live predicate test; Mon 22:00 swing fire
- NEW recurrence = ESCALATE to Joachim

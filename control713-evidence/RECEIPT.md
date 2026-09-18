# Control-713 RECEIPT (Sep 18 19:31-19:35 UTC)

STRICT READ-ONLY control - DEGRADED/OPEN (C-712 daytrading dispatch-freeze ONGOING). NO deploy this turn (standing mid-session rule honored).

## Live evidence (all curl, broker-direct, fresh)
- /health: ok, 2.7.0
- /api/account: equity $97,115.08, last_equity $97,116.87, change_today -$1.79 (~$115 over $97k floor, NEVER touched)
- /api/config: 2.7.0, risk guards 150/100/100 + $97k floor + crypto disabled, eod_flatten true, min_confidence 0.8 nominal / FALLBACK 0.7 (FINDING 1)
- /api/dashboard: current_state_source=alpaca, metadata_source=d1, observed 19:31:33; capitalCaps 5000/3700/2000; equity $97,112.83
- /api/positions: source alpaca; 4 daytrading (QCOM/PLUG/NVDA/ENPH) + 11 swing + 0 crypto
- /api/runs limit=300: 13822->13910 0 id-gaps; daytrading cron MISSED 9 slots since 18:21 (C-712 freeze), CYCLE_LEASE_HELD at 18:36/18:51/19:11/19:26, 13910@19:31 ok; reconcile + crypto :07/:37 EXACT 30/30
- /api/trades limit=300: 300/300 filled, 0 pending/0 leaves/0 null-strategy; conservative filled_lot_exact_unavailable

## Engineering validation
- bundle index.js md5 e34318f5 (unchanged C-688), RELEASE_VERSION 2.7.0, zero src diff vs 2fe9c5a
- 241 tests / 893 assertions PASS, typecheck 0, git diff --check clean

## Repo / docs / push
- Repo HEAD prior 6e780e7 (C-711); this control commit 1530c43 (docs + evidence only)
- Docs prepended Control-713; deployed src 2fe9c5a explicit per HEAD-pointer convention
- Pushed sequential via authenticated GitHub OAuth Contents API, remote==local IN SYNC:
  README cccb7caa / OPERATIONS 5aa52631 / RUNBOOK 239176e7 (= local git blob shas)

## Escalation + follow-up
- C-712 escalated urgent 19:06 (signal 1c7a4a4c); this control confirms the freeze is NOT resolved.
- CRITICAL GATE: 20:00 EOD-flatten runs in the suppressed daytrading cron -> 4 daytrading positions at risk of carrying overnight.
- Verified one-shot monitor schedule 4e9892c4 @20:10 UTC: flatten fired = self-resolved + log; failed = redeploy unchanged e34318f5 at closed window + escalate.
- Notification sent (signal 8c9bec30).
- Pending Joachim unchanged: FINDING 1 wiring, D1 paid-tier, daytrading cap fill-drift re-check.

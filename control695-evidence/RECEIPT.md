CONTROL-695 RECEIPT - strict read-only control (Fri Sep 18 03:00 UTC)
Verdict: HEALTHY 2.7.0 - no code change, NO deploy
C-688 EOD reliability redeploy (20:07:07Z Sep 17) HOLDS CLEAN: 0 suppression recurrence post-redeploy
True clock: Fri Sep 18 03:02:56 UTC 2026

Endpoints (all GET-only, 200 real data): health/config/dashboard/positions/runs300/trades/account
Equity(broker): 97126.13 change_today +44.38 (+0.0457%) ~126 over 97000 floor - POSITIVE trend-bend
Positions: source=alpaca (current_state_source=alpaca, metadata_source=d1)
  11 swing (cost 4992.42 CAPITAL_CAP) + 0 daytrading (EOD-flat) + 0 crypto, MV 4815.39

Run-log 300-window 13291->13590 id-contiguous 0 id-gaps, newest 13590 2026-09-18 03:00:30
Post-redeploy (>=20:07:07Z) runs: 140 = 83 cron + 42 reconcile + 14 crypto + 1 swing, 0 err / 0 lease-held / 0 time-gaps>6min
All 13 CYCLE_LEASE_HELD (13381-13443) + 2 PQM (13402/13408) error-runs = DOCUMENTED pre-redeploy C-685/C-686-687 recurrences, cleared by EOD-flatten 13444@19:46
Crypto :07/:37 post-redeploy 14/14 slots exact CRYPTO_DISABLED_BY_CONFIG, 0 missing
Reconcile newest 13590 2026-09-18 03:00:30 dur 2759ms ok
Swing fire 13489 @22:00:44 CF-DOW=5 25 decisions 0 errors (4th post-redeploy cadence test PASSED)
Trades 50/50 filled, 0 pending, 0 leaves, 0 null-strategy; conservative gross/fee/net unattributed

Caps 5000/3700/2000 UNCHANGED; guards 150/100/100 + 97000 floor UNCHANGED
FINDING 1 live (0.7 fallback gate risk-manager.ts:170/171 + src/index.ts:125) - pending Joachim, NOT deployed
Validation: 241 tests/893 PASS (bun test), typecheck 0, git diff --check clean, zero src diff vs 2fe9c5a
Docs C-694 remote==local LIVE sha-verified (README c23dc6ec / OPERATIONS 75edc7b5 / RUNBOOK 8f8f9d48)

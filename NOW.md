# Alpaca Trading Bot - Status

**Current control:** Control-142 (Aug 27, 2026 ~13:00 UTC / 15:00 +02)
**Verdict:** HEALTHY (code/deploy 2.6.0), DEGRADED (external)
**Code:** 22b3dba (unchanged since Control-117)
**Docs HEAD:** this commit (local only, push blocked github_pat)
**Tests:** 223 pass / 841 assertions, typecheck clean

## Live state
- Equity $98,487, ACTIVE, not blocked, not PDT, +$69.29 today
- 28 positions all strategy=swing, MV $9,351.73 (2.53x $3,700 cap, pre-existing)
- 3 pending sells (720-722: AMD/LCID/NXPI) day orders for Aug 27 13:30 UTC open (~30min away)
- 100 runs (3809-3908, Aug 26 23:51 - Aug 27 12:11 UTC): 0 errors, 0 lease holds, 0 gaps
- Crypto fail-closed: SOLUSD stale 79684s, MATICUSD empty, validTA=0, fee telemetry asOf Aug 19
- 3 null-strategy trades persistent (703 PLD, 648 NOW, 645 DUK)
- 97 filled trades all accounting_status=filled_lot_exact_unavailable, gross/fee/net=null (conservative)
- Caps 5000/3700/2000 USD unchanged (capital-caps.ts:6-8)
- Four schedules verified (wrangler.toml crons: */5 13-21, 0 22, 7-59/30, */10)

## Open follow-ups
- Paid-plan upgrade (approved, not executed) - remedy for Free-tier run-log gaps
- rawEdgeBps producer - crypto BUYs always fail-closed without it
- 3 null-strategy trades (703/648/645) - metadata gap, not a trading defect

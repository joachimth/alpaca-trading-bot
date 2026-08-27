# Alpaca Trading Bot - Status

**Current control:** Control-143 (Aug 27, 2026 ~14:00 UTC / 16:00 +02)
**Verdict:** HEALTHY (code/deploy 2.6.0), DEGRADED (external)
**Code:** 22b3dba (unchanged since Control-117)
**Docs HEAD:** this commit (local only, push blocked github_pat)
**Tests:** 223 pass / 841 assertions, typecheck clean

## Live state
- Equity $98,451.23, ACTIVE, not blocked, not PDT, +$33.52 today (+0.034%)
- 25 positions all strategy=swing, MV $8,026.91 (2.17x $3,700 cap, pre-existing; REDUCED from 2.53x)
- 3 sells (720-722: AMD 0.28 @ $481.16, LCID 209 @ $4.958, NXPI 0.53 @ $225.57) FILLED at 13:30 UTC open; AMD/LCID/NXPI exited
- 100 runs (3819-3918, Aug 27 01:08-13:56 UTC): 0 errors, 0 lease holds, 0 gaps. 16+ hours clean since Aug 26 21:21 UTC
- 70 reconcile_cron ok, 24 crypto_cron fail-closed, 6 daytrading cron (13:31-13:56, skipped on stale bars right after open, fail-safe)
- Crypto fail-closed: AVAXUSD stale ~22h, MATICUSD empty, validTA=0, fee telemetry asOf Aug 19, no rawEdgeBps
- 3 null-strategy trades persistent (703 PLD, 648 NOW, 645 DUK)
- 97 filled trades all accounting_status=filled_lot_exact_unavailable, gross/fee/net=null (conservative)
- Caps 5000/3700/2000 USD unchanged (capital-caps.ts:6-8)
- Four schedules verified (wrangler.toml crons: */5 13-21, 0 22, 7-59/30, */10)

## Open follow-ups
- Paid-plan upgrade (approved, not executed) - remedy for Free-tier run-log gaps
- rawEdgeBps producer - crypto BUYs always fail-closed without it
- 3 null-strategy trades (703/648/645) - metadata gap, not a trading defect

# Alpaca Trading Bot - Status

**Current control:** Control-141 (Aug 27, 2026 ~12:00 UTC / 14:00 +02)
**Verdict:** HEALTHY (code/deploy 2.6.0), DEGRADED (external)
**Code:** 22b3dba (unchanged since Control-117)
**Docs HEAD:** this commit (local only, push blocked github_pat)
**Tests:** 223 pass / 841 assertions, typecheck clean

## Live state
- Equity $98,504.19, ACTIVE, not blocked, not PDT
- 28 positions all strategy=swing, MV $9,367.42 (2.53x $3,700 cap, pre-existing)
- 3 pending sells (720-722: AMD/LCID/NXPI) day orders for Aug 27 13:30 UTC open
- 100 runs (3806-3905): 0 errors, 0 lease holds, 0 gaps, 14+ hours clean
- Crypto fail-closed: bars stale 22h+, MATICUSD empty, fee telemetry asOf Aug 19
- 3 null-strategy trades persistent (703 PLD, 648 NOW, 645 DUK)
- Caps 5000/3700/2000 USD unchanged

## Open follow-ups
- Paid-plan upgrade (approved, not executed) — remedy for Free-tier run-log gaps
- rawEdgeBps producer — crypto BUYs always fail-closed without it
- github_pat missing — blocks docs push to origin
- Crypto bar freshness (SOLUSD/LINKUSD/AVAXUSD stale, MATICUSD empty)
- 3 null-strategy trades (703/648/645)
- Stale workspace root /workspace/src/ (3-cron, not deployed)

# Control-225 — intentional holding (no findings)

Continuation of the read-only daytime monitoring pass dated 2026-08-30, after Control-224.

- HEALTHY code/deploy (2.6.0), DEGRADED external, no deploy needed.
- Control-217 reliability redeploy holding ~6.5h: all 4 schedules dispatching.
  - daytrading_cron every 5 min (15:41-17:06 all present, MARKET_CLOSED skips)
  - reconcile_cron every 10 min (9 ok runs, durations 2650-3797ms, avg 3124ms, NO creep)
  - crypto_cron :07/:37 (fail-closed: MATICUSD empty + LINKUSD/ETHUSD stale ~22h age 79635s, edge gate not reached, symbol rotation ongoing)
  - swing_cron (weekend, none)
- Run-log contiguous 4993-5022 (30 runs, 0 gaps, 0 errors).
- Equity $98,219.06, cash $89,963.32 (91.5%), ACTIVE, not PDT, change_today -$0.0026, snapshot 1222 @ 17:07.
- 23 swing positions broker-authoritative MV $8,255.74; 768 trades win 15%, 0 new null-strategy in window.
- Caps 5000/3700/2000 unchanged. Code 79583d8.
- No new findings vs Control-224 → no release claim, tracking only.
- Key next test: Monday Aug 31 13:30 UTC open. Cron dispatch recurrence WATCH (~6.5h into post-Control-217 window).

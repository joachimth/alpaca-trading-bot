# NOW
- Alpaca Control-400 (Sep 6 00:01 UTC Sun): docs-only HEAD correction. Exact current HEAD = fddfee8 (Control-399). Prior docs wrongly recorded 8d3d853. Deployed 0b3b2a3 (no src diff), caps 5000/3700/2000 unchanged, no deploy. All 6 endpoints 200, HEALTHY, strictly read-only (no trigger/submit/cancel/close/migration).
- Equity $97,724.20 POSITIVE, 18 pos (15 swing + 3 daytrading SOFI/TSLA/TSM + 0 crypto), 0 null. Broker-authoritative source=alpaca, D1 metadata only.
- 4 schedules cadence: daytrading 1-59/5 MARKET_CLOSED nextOpen Sep 8 09:30 ET, reconcile */10 ok, crypto 7-59/30 :07/:37 fail-closed (newest 7860 23:37:42), swing 0 22 * * 2-6 NO-FIRE held. Run-log contiguous 0 gaps 0 errors (1 documented LEASE 7630). Trade 1080 INTC sell no_fill pending Mon Sep 8 open.
- KERNEPUNKT: søn Sep 6 22:00 UTC swing DOW=1 MÅ IKKE FIRE = sidste weekend-bevis (~22h). Hourly-health 864e3971 dækker. Så man Sep 8 DOW=2 fire + INTC fill.
- Næste follow-ups: sun swing no-fire, mon DOW=2 fire + INTC fill, D1 paid-tier beslutning (Joachim), fee+crypto bar freshness (edge gate), push to origin/main (480 ahead, Git Data API).
- Gotchas: `bun run test` (aldrig `bun test`); push = Git Data API via `assistant oauth request` (strip '* Account:'-prefix).

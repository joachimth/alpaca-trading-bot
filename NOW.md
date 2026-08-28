# NOW
- Control-176 Aug 28 ~23:00 local (21:00 UTC), market CLOSED (Fri): HEALTHY code/deploy (2.6.0), DEGRADED external. No deploy needed. Code 79583d8, docs HEAD this commit (Control-176, local only, github_pat blocked).
- Heartbeat 23:43 local (21:43 UTC): LIVE-verified. Equity $98,227.96 (-$246.31, -0.25% today), NOT PDT. Long MV $8,264.34 (23 swing positions only; daytrading/crypto MV $0). Broker-authoritative, 0 unattributed. All 6 GET endpoints 200.
- Latest run 4221 (21:41 UTC). Post-Control-176 window runs 4202-4221 (20:51-21:41) clean: 0 errors, no run-log gaps. Reconcile ~11s stable. Recovered from run 4182 subrequest ceiling (25033ms, 19:47).
- Daily strategy update (e52e7690) fired 20:05 UTC (22:05 local) status ok — delivered per-strategy win/loss. Confirmed live-active, next run Mon 2026-08-31 20:00 UTC.
- SWING_OWNED_EXCLUDE exercised (RIVN x4, run 4182) — cap bypass fix proven. Daytrading EOD flatten clean (trades 765-768 filled, MV $0, no overnight exposure).
- Crypto still fail-closed: CRYPTO_BARS_STALE/UNAVAILABLE, edge gate not reached. Fee telemetry stale (Aug 19). Next crypto test at Monday open.
- Caps 5000/3700/2000 unchanged. Push BLOCKED: github_pat. Next heavy check: Monday 10:00 UTC deferred-risk review (56199d0b) + 13:30 open.
- Follow-ups: subrequest ceiling (Workers Paid), cron dispatch stability, crypto bar/fee freshness, D1 read limit (Sep 1), github_pat. Market reopened Monday 13:30 UTC — verify SWING_OWNED_EXCLUDE + daytrading freshness first morning.

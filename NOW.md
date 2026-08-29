# NOW
- Control-186 Aug 29 ~09:00 local (07:00 UTC), weekend CLOSED: HEALTHY code/deploy (2.6.0), DEGRADED external. Cron dispatch fix deployed.
- reconcile_cron + crypto_cron stopped dispatching 05:38-05:41 UTC (daytrading continued). ~89 min gap. Redeploy (same code 79583d8) re-registered crons, both resumed (run 4400 reconcile ok, run 4399 crypto skipped). broker_ledger_synced_until 07:10:42 UTC. No regression.
- Equity $98,219.36 (-0.26%). 23 swing MV $8,255.74, 0 unattributed, broker-authoritative. Daytrading/crypto MV $0. Caps 5000/3700/2000 unchanged.
- Follow-ups: cron dispatch recurrence (Monday open), subrequest ceiling, crypto bar/fee freshness, D1 Sep 1, github_pat.

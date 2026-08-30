# NOW
- Control-217 Aug 30 ~11:00 UTC (13:00 +02): strict GET-only + reliability redeploy. HEALTHY code/deploy (2.6.0), DEGRADED external. Repo HEAD: this commit (Control-217, local only, push BLOCKED github_pat).
- FOURTH cron dispatch failure: reconcile_cron stopped after 4892 @ 10:30 UTC (~12h post-Control-203). Daytrading+crypto continued. Reliability redeploy executed (same code 79583d8, re-registered 4 crons, HTTP 200). Post-deploy: reconcile 4903 @ 11:10 dur 3351ms (fresh reset), all 4 schedules dispatching. Run-log 4600-4903, 0 gaps, 0 errors.
- Reconcile durations: pre-deploy plateau ~7.8-9.4s (max 9390ms), post-deploy reset to 3351ms. WATCH for recurrence ~8-16h.
- 23 swing positions broker-authoritative (metadata_source=d1 all 23), 0 unattributed, MV $8,255.74. Daytrading MV $0, crypto MV $0 fail-closed (edge gate not reached).
- Equity $98,219.06, cash $89,963.32 (91.5%), ACTIVE, not PDT, change_today -$0.003. 768 trades, win 15%. Snapshot 1210 (11:07 UTC).
- Fee telemetry stale (Aug 19). Null-strategy trades 8 (pre-existing, no new since Aug 24). Caps 5000/3700/2000 unchanged. Code 79583d8. 224 tests/845 assertions, typecheck clean.
- Collect: crypto bar freshness, fee telemetry freshness, github_pat docs push (OAuth untested for Alpaca).
- Follow-ups: cron dispatch recurrence (MONITOR — 4 occurrences now), Monday Aug 31 13:30 UTC open (key test tomorrow), crypto bar/fee freshness, D1 read limit (Sep 1), github_pat, Steen RSVP (event tomorrow Sept 1; accept draft still unsent).
- Workspace repo has long history-compaction rebase in progress (302 commits, stuck step 1) - DO NOT TOUCH/interrupt.

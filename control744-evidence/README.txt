Control-744 evidence (Sep 19 2026 22:00 UTC). All data fetched fresh via curl GET-only at 22:00-22:02 UTC Sat.
Files:
- health.txt       /health (HTTP 200, version 2.8.1)
- config.json      /api/config (min_confidence 0.8, caps 5000/3700/2000, crypto disabled, guard keys 150/100/100/97000, release_version 2.8.1, config.version 2.7.0 = D1-seed separation)
- dashboard.json   /api/dashboard (stats/account/latestSnapshot/positions/capitalCaps/freshness)
- positions.json   /api/positions (source=alpaca, current_state_source=alpaca, 11 swing, 0 daytrading, 0 crypto, MV 4767.86, cost 4992.42 CAPITAL_CAP)
- runs.json        /api/runs limit=50 (default page)
- runs300.json     /api/runs limit=300
- runs500.json     /api/runs limit=500 (13939->14438, 0 id-gaps, 0 errors, 0 lease-holds, crypto 50/50 :07/:37 EXPECTED-VS-OBSERVED 0 missing Sep18 21:07->Sep19 21:37, reconcile 151 exact /10, daytrading only gap = C-739 07:41->08:01)
- trades.json      /api/trades limit=50 (50/50 filled, conservative, 0 pending/leaves)
- trades200.json   /api/trades limit=200 (200/200 filled, 0 pending, 0 leaves, 0 null-strategy, conservative filled_lot_exact_unavailable, high-water trade 1616 QCOM EOD sell @19:46 Sep 18)
- account.json     /api/account (broker-direct: equity 97135.81, +0.0036 POSITIVE, ~$136 above floor never touched)
- analytics.json   /api/analytics (HTTP 200, 2.8.0)
- analytics-crypto.json /api/analytics?strategy=crypto (HTTP 200, 2.8.1 crypto third strategy)
- schedules.json   CF GET /schedules live (4 crons registered, modified_on 2026-09-19T07:57:53Z)
- README.txt       this file

Verdict: HEALTHY 2.8.1, no defect, no deploy. Repo commit (this control). ONLY GET calls issued (no trigger/submit/cancel/close/replace/retry/migration/broker-mutating endpoint).

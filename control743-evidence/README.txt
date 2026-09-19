Control-743 evidence (Sep 19 2026 21:00 UTC). All data fetched fresh via curl GET-only at 21:00-21:02 UTC Sat.
Files:
- health.txt       /health (HTTP 200, version 2.8.1)
- config.json      /api/config (min_confidence 0.8, caps 5000/3700/2000, crypto disabled, guard keys 150/100/100/97000, release_version 2.8.1, config.version 2.7.0 = D1-seed separation)
- dashboard.json   /api/dashboard (stats/account/latestSnapshot/positions/capitalCaps/freshness)
- positions.json   /api/positions (source=alpaca, 11 swing, 0 daytrading, 0 crypto, MV 4767.86, cost 4992.42)
- runs.json        /api/runs limit=50 (default page; not used for primary analysis)
- runs300.json     /api/runs limit=300 (14120->14419, id-contiguous)
- runs500.json     /api/runs limit=500 (13919->14418, 0 id-gaps, 0 errors, 0 lease-holds, crypto 50/50 :07/:37, reconcile 151 exact)
- trades.json      /api/trades limit=50
- trades200.json   /api/trades limit=200 (200/200 filled, 0 pending, 0 leaves, 0 null-strategy, conservative)
- account.json     /api/account (broker-direct: equity 97135.81, +0.0036, floor never touched)
- analytics.json   /api/analytics (HTTP 200, 2.8.0)
- analytics-crypto.json /api/analytics?strategy=crypto (HTTP 200, 2.8.1 crypto third strategy)
- README.txt       this file

Verdict: HEALTHY 2.8.1, no defect, no deploy. Repo commit c9e8a50 (prior 7653a61). ONLY GET calls issued.

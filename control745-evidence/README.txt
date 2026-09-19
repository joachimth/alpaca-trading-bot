Control-745 strict read-only evidence (Sep 19 23:00 UTC / 01:00 +02 Sun Sep 20)
Fetched 23:00-23:03 UTC Sat Sep 19 via GET-only calls.

health.json            /health                          200 ok 2.8.1
root.json              /                                200 ok 2.8.1
config.json            /api/config                      200 release_version 2.8.1
dashboard.json         /api/dashboard                   200 fresh 23:00:13Z
positions.json         /api/positions                   200 source=alpaca 11 swing
runs.json              /api/runs?limit=30               200
runs300.json           /api/runs?limit=300              200
runs500.json           /api/runs?limit=500              200 window 13959..14458
trades.json            /api/trades?limit=50             200
trades200.json         /api/trades?limit=200            200 200/200 filled
account.json           /api/account                     200 broker-direct equity 97135.81
analytics.json         /api/analytics                   200 (2.8.0/2.8.1)
analytics_strategy_crypto.json      /api/analytics?strategy=crypto  200
analytics_strategy_daytrading.json /api/analytics?strategy=daytrading 200
analytics_strategy_swing.json       /api/analytics?strategy=swing    200

All endpoints returned real data, no D1_ERROR. ONLY GET calls issued - no
trigger/submit/cancel/close/replace/retry/migration/broker-mutating endpoint.

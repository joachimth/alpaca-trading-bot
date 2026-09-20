Control-748 evidence - Sun Sep 20 2026 02:00 UTC (04:00 +02) strict read-only production control.
All fetched live with curl GET (no trigger/submit/cancel/close/replace/retry/migration/broker-mutating call).
- health.json: /health -> 200 ok 2.8.1
- config.json: /api/config -> 200 (guards 150/100/100 + floor 97000, crypto_trading_enabled false, min_confidence 0.8)
- dashboard.json: /api/dashboard -> 200 (capitalCaps 5000/3700/2000, current_state_source=alpaca, equity 97135.81)
- positions.json: /api/positions -> 200 (11 swing)
- account.json: /api/account -> 200 (equity 97135.81, change_today +0.0036)
- runs.json / runs500.json: /api/runs?limit=500 -> 200 id-contiguous 14019..14518
- trades.json / trades200.json: /api/trades?limit=200 -> 200 (200/200 filled)
- analytics.json + analytics-{crypto,daytrading,swing}.json: all 200
- strategy-comparison.json: /api/strategy-comparison -> 200
- schedules.json: CF GET /schedules -> 200, four crons modified 2026-09-19T07:57:53Z
Verification: 263 tests/969 PASS, tsc exit 0, git diff 2ea5e9d -- src/ empty (ZERO src diff).
Deployed src 2ea5e9d identical to local HEAD's src. HEAD 7062fad (C-747 docs).
FINDINGS: none new - HEALTHY.

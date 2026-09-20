Control-766 (Sun Sep 20 21:03 +02 / 19:00 UTC): strict read-only production control.

True clock: 19:00:24 UTC (`date -u`) — cross-checked; injected turn_context 21:00 +02 = 19:00 UTC, consistent.

Endpoints (all HTTP 200, GET-only):
  /health                  version 2.8.1, status ok
  /api/account             broker-direct; equity 97135.81, cash 92367.95, buying_power 382458.78
  /api/config              release_version 2.8.1; nested config.version 2.7.0 (D1-seed, documented)
  /api/dashboard           capitalCaps 5000/3700/2000; source=alpaca; freshness current_state_source=alpaca
  /api/positions           source=alpaca; 11 swing (MV 4767.86, cost 4992.42 legacy CAPITAL_CAP)
  /api/runs?limit=300      window 14558..14857, 300/300 id-contiguous
  /api/runs?limit=50       (supplementary)
  /api/trades              limit=50 default; 50/50 filled (daytrading)

No trigger/submit/cancel/close/replace/retry/migration/broker-mutating endpoint was called.

Files: health.json, account.json, config.json, dashboard.json, positions.json,
       runs300.json, runs50.json, trades.json (all valid JSON).

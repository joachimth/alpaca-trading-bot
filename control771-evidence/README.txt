Control-771 strict read-only control evidence
Fetched 2026-09-21 ~00:00-00:05 UTC (real clock date -u) via curl against
https://alpaca-trading-bot.joachim-763.workers.dev
Endpoints: /health, /api/config, /api/dashboard, /api/positions, /api/trades, /api/runs(limit=30), /api/runs?limit=300
Plus live Cloudflare /schedules GET (all four).
GET-only - no trigger/submit/cancel/close/replace/retry/migration/broker-mutating endpoint called.
Provenance + aggregate analysis in commit message.

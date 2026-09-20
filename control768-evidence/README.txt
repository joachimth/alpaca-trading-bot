Control-768 evidence (Sun Sep 20 21:00-21:05 UTC)
Strict read-only Alpaca production control - HEALTHY 2.8.1 (docs + evidence only, NO deploy/NO correction)
All files fetched via GET-only curl against https://alpaca-trading-bot.joachim-763.workers.dev (and CF schedules API).
- health.json:       /health -> {status:ok, version:2.8.1}, HTTP 200
- config.json:       /api/config -> min_confidence 0.8, caps 5000/3700/2000, crypto disabled, guards 150/100/100/97000
- dashboard.json:    /api/dashboard -> equity 97135.81 positive, source=alpaca, 11 swing, caps
- positions.json:    /api/positions -> 11 swing longs, MV 4767.86, cost 4992.42 legacy CAPITAL_CAP
- runs.json:         /api/runs?limit=300 -> 14598..14897 id-contiguous 300/300, 0 err, 0 lease, 0 gap>15m
- runs-30.json:      first 30 runs of the 300-window for focused review
- trades.json:       /api/trades?limit=200 -> 200/200 filled, 0 null-strategy, net=gross-fee consistent
- schedules.json:    CF schedules GET -> 4 crons registered (daytrading 1-59/5, swing 0 22 * * 2-6, crypto 7-59/30, reconcile */10)
True clock: 21:00:06 UTC Sun Sep 20 (date -u; injected context consistent)

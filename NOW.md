# NOW
- Control-103 03:00 +02 (01:00 UTC): Fixed 12 pre-existing typecheck errors, deployed, brief 1.0.0 regression (3 min), 2.6.0 restored.
- Version surfaces aligned: /health=2.6.0, release_version=2.6.0, config.version=2.6.0. HEAD 1c0dc00 (code+docs). 220 tests / 822 assertions, typecheck clean (first time genuinely).
- 15 broker-authoritative positions all strategy=swing (MV $7,941, over $3,700 cap). Equity $98,523, ACTIVE, cash $90,582. Reconciliation ok every 10 min.
- LIVE RISK: 12 pending swing BUYs (trades 708-719, day-TIF, accepted, ~$1,362) could fill at Aug 26 09:30 ET → swing ~$9,311 (2.5x cap). Joachim must decide on cancel before market open.
- Control-101 fix (a206690) verified in source and deployed bundle but not yet naturally tested by daytrading sync (next Aug 26 13:00 UTC).
- Crypto :07/:37 fail-closed (LINKUSD stale, MATICUSD empty, no rawEdgeBps). Caps 5000/3700/2000 unchanged.
- DEPLOY LESSON: Always bundle from /workspace/alpaca-trading-bot, not /workspace. Verify bundle size and grep RELEASE_VERSION before PUT.
- Status: HEALTHY (code/deploy), DEGRADED (pending orders + external limits + run-log gaps + 1.0.0 regression incident).
- Remaining: 12 pending swing BUYs decision (URGENT, before 13:30 UTC), rawEdgeBps producer, bar freshness, D1 Sep 1 limits + plan upgrade, trade 703 strategy=null, run-log gaps.

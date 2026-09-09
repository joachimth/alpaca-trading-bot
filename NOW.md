# NOW
- Alpaca Control-485 (Sep 9 08:00 UTC): HEALTHY 2.7.0, no defect, no deploy (docs-only). Live curls all 6 GET routes 200. Equity /api/account $97,591.60 POSITIVE (~$592 over floor), change_today_pct +0.01%; /api/dashboard portfolio_value $97,596.63. Daytrading FLAT EOD.
- 14 positions broker-authoritative (current_state_source=alpaca, metadata_source=d1) 0 null-strategy, stay swing (cost $5,364.82 CAPITAL_CAP). 150-run window 9319-9468 contiguous 0 id-gaps/0 error/0 LEASE/0 PQM.
- Crypto :07/:37 exact CRYPTO_DISABLED_BY_CONFIG (skip chain RECONC_DEFERRED + EQUITY_DIRECTION_FALLBACK + CRYPTO_DISABLED, openCrypto 0); reconcile */10 MAINTENANCE_ONLY; daytrading 1-59/5 pre-market skips; swing fire 9269 delivered Sep 8 22:01 (next Wed Sep 9 22:00 DOW=4). No twelfth dispatch ~185h+.
- Edge-gate wiring present upstream-disabled (crypto_trading_enabled false). Trades 1131-1180 all daytrading filled conservative gross/fee/net null (filled_lot_exact_unavailable), 0 null-strategy (C-430 held).
- ALL verification green: 241 tests/893, typecheck clean, diff-check clean, tree clean. Deployed 2fe9c5a zero src diff, repo HEAD c76da47→C-485 docs commit. Caps unchanged 5000/3700/2000.
- NOTE: schedules API GET blocked (no cloudflare cred id resolvable) — run-log cadence authoritative, all 4 schedules evidenced. No defect.
- Follow-ups: FIFO item-5 queued 2.7.x; D1 paid-tier decision; docs-push 413 (OPERATIONS ~1,146KB); next daytrading open Sep 9 13:30 UTC; swing fire 22:00 UTC.

# NOW

## 2026-08-06 10:12 CEST - Swing cron fix live
- Swing data-window fix committed as `c3db68b`; degraded-entry guard committed as `27ea342`.
- Cloudflare Worker version 50 (`46677609-f3e7-4f37-94a1-c0be17a7c836`) is active at 100% traffic.
- Swing now requests buffered completed-session daily bars and skips new entries when fewer than 20 fresh candidates remain.
- Alpaca account is ACTIVE; schedules unchanged: swing `0 22 * * 1-5` UTC, next test Aug 7 00:00 CEST.
- Historical failures: Aug 4 was Alpaca 401; Aug 5 was empty swing universe. No orders were placed during the fix.

## Open
- Verify the next swing run and its `ok` or `degraded` status.

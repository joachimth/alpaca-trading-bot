# NOW
- Alpaca Control-9 remains FAIL/DEGRADED after strict GET-only verification on August 22, 2026.
- Local correction: broker-unavailable `/api/positions` now performs no D1 positions read or fallback; focused 61/0 (246 assertions), full 161/0 (537), typecheck, diff-check, and dry-run passed.
- Live `/health=1.0.0` and `/api/config=2.4.0` conflict with local deployable 2.6.0; Wrangler is unauthenticated, so the correction is not live-proven.
- Final live pass: `/api/positions` recovered to `200`, `positionsAvailable=true`, `source=alpaca`, 29 broker rows; dashboard equity 98504.50 vs last_equity 98504.5039.
- Caps remain $5000/$3700/$2000; four local schedules and crypto fail-closed edge gate are unchanged.
- Fresh reconciliation MAINTENANCE_ONLY and crypto skips delivered, but Alpaca 503 errors occurred at 12:00:46, 12:07:40, and 12:10:40 UTC; crypto is around :08/:38.
- No fresh successful daytrading/swing delivery is proven; trade lifecycle fields exist, but gross/fee/net remain null under unavailable_fill_lot_exact.
- Follow-up: restore authenticated release verification, deploy only the validated artifact if authorized, then repeat separate GET-only and natural weekday checks.

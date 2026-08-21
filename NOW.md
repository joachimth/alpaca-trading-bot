## August 21, 2026 swing-cap correction

Confirmed swing cap admission gap corrected locally: cycle-level planned entry notional is now included in each subsequent swing BUY check, with structured CAPITAL_CAP skips at exhausted $3,700 headroom.
Validation passed: focused tests, full 115 tests / 340 assertions, TypeScript, diff-check, and Wrangler dry-run. Not deployed yet; direct upload and separate GET-only verification remain pending.
Remaining degraded state: crypto BUYs fail closed without calibrated rawEdgeBps, lifecycle persistence is incomplete, P&L is not fill-exact, and natural post-release strategy/reconciliation success is not yet observed.

## August 21, 2026 control update, 08:02:29 UTC

Strict GET-only production control is **DEGRADED**. All six endpoints returned 200; broker positions are authoritative (`source: alpaca`, 29 positions), equity is rising, and caps remain 5000/3700/2000. Crypto ran at 07:37:34 UTC with structured skips; reconciliation ran through 08:00:31 UTC with maintenance-only details and a prior lease-held skip. Fresh August 21 daytrading and swing success is pending their natural UTC windows; historical swing error and August 10 cap-breach evidence remain explicit follow-ups. No code or deployment change was required; no broker mutation was used.

# NOW
## 2026-08-21 09:00 CEST
- Production control is degraded, not healthy: lease-held skips, stale/missing fresh run proof, gross/net display inconsistency, and partial-exit lifecycle risk were found by read-only GET audit.
- Correction is deployed from commit 10061d3 as Cloudflare deployment 07615065-0302-41c6-8a22-4203ea38b5c9, Worker version bb3f45f3-03e8-453c-bb0d-876181d15d4c, 100% traffic; all four schedules present.
- Correction adds net-consistent `totalPl`, `/api/runs` pagination/filters, broker-authoritative quantity persistence, pending stock/swing exit guards, and precise BUY-block mismatch observability.
- Validation passed: 108 tests / 318 assertions, TypeScript, diff-check, dry-run, and separate GET-only live verification; no broker mutation used for validation.
- Vital parameters unchanged: daytrading $5,000, swing $3,700, crypto $2,000.
- Remaining degraded follow-up: no post-deployment natural strategy/reconciliation run observed; latest reconciliation at 2026-08-21 07:00:24 UTC was CYCLE_LEASE_HELD.

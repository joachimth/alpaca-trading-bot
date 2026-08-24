# CORRECTION WORK ITEM: Control-27

Date: Sunday, August 23, 2026. Disposition: **LOCAL PRESENTATION CORRECTION COMPLETE; PRODUCTION NOT DEPLOYED**.

## Scope

This bounded correction addresses only the trade-table presentation contract. The dashboard now makes clear that `estimated_value` is an **order-time estimate**, and it displays `filled_notional` plus `estimated_vs_filled_delta` when the read-only trade response provides those values. Missing values remain displayed as `-`.

The correction is presentation-only. It does not change order submission, sizing, capital caps, schedules, reconciliation, broker authority, fee/gross/net semantics, accounting status, leases, risk gates, or any trading behavior. The existing API/database enrichment contract remains authoritative: `filled_notional` is derived from broker-reconciled `filled_qty * avg_fill_price`, and the delta remains `filled_notional - estimated_value`; no new calculation or persistence path was added.

## Implementation

- `dashboard/index.html`
  - Added an order-time estimate clarification above each of the four trade tables.
  - Renamed the estimate header presentation to `Est. Value (order-time)`.
  - Added `Filled Notional` and `Est. vs Filled Δ` columns.
  - Added null-safe signed-currency formatting for the delta.
  - Escaped rendered ticker, side, and status text in this table; this is display hardening only.
- `test/dashboard-readonly.test.ts`
  - Added a focused static regression asserting the estimate label, both comparison columns, null-safe render calls, and explanatory note.

## Validation

All requested local validation completed successfully:

- Focused: `bun test test/dashboard-readonly.test.ts test/order-reconciliation.test.ts` — **28 tests passed / 164 expect() calls**, 0 failures.
- Full: `bun test` — **173 tests passed / 603 expect() calls** across 25 files, 0 failures.
- TypeScript: `bunx tsc --noEmit` — **PASS (exit 0)**.
- Patch check: `git diff --check` — **PASS (exit 0)**.

The full test output includes expected diagnostic logging from existing safety-regression tests; the suite completed with 173 pass and 0 fail.

## Deployment and mutation boundary

No deployment was performed. No production endpoint was called, and no mutating production endpoint, trigger, order, close, cancel, replace, retry, migration, or preview was used. This work item is not a claim that the dashboard correction is live. The correction remains local until a separately authorized deployment and GET-only verification establish source-to-Worker identity.

## Acceptance status

**Accepted locally for the bounded presentation scope.** The trade table now distinguishes order-time estimate from realized filled notional without changing trading or accounting behavior. Production status remains **not deployed / not live-proven**.

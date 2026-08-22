# Alpaca Control-8 correction work item

Date: 2026-08-22
Disposition: local validation passed; production deployment blocked; live status remains FAIL/DEGRADED

## Exact source correction

Fixed the confirmed swing source defect in `src/swing-strategy.ts`: the `RISK_HALTED` skip context previously stored `{ reason: riskManager.isTradingHalted() }`, which recorded boolean `true` instead of the risk manager's actual halt explanation. `SwingRiskManager` now exposes a read-only `getKillState()` accessor, and the swing cycle copies `getKillState().reason` into the structured skip context and halt log message.

This is observability-only. Caps remain exactly $5,000 daytrading, $3,700 swing, and $2,000 crypto. Schedules, broker authority, edge gates, TIF, sizing, leases, and trading behavior are unchanged.

## Regression coverage

- `test/swing-risk-halt.test.ts` proves a concrete halt reason is serialized as a string and is not boolean `true`.
- `test/audit-regressions.test.ts` guards the swing source branch against reintroducing the boolean context.
- `test/trade-identity.test.ts` records the crypto fee-timing decision: a CFEE timestamp posted at `2026-08-21T23:59:59Z` is still unavailable at `2026-08-22T00:02:00Z` under the existing 60-second freshness gate.

The crypto fee telemetry timing mismatch is explicitly deferred. Current `getBrokerFeeSummary()` uses `MAX(COALESCE(created_at, created_date))` across CFEE rows, while CFEE activity may be posted on the next UTC day; the strategy then applies a 60-second freshness check. This can repeatedly produce `FEE_DATA_UNAVAILABLE` even when delayed broker fee activity is eventually present. No freshness window, timestamp basis, admission gate, or crypto behavior was loosened in this work item; fail-closed admission is preserved until broker posting semantics and a safe freshness design are established.

## Validation and deployment

Required local validation is run after the final edits:

- focused regressions: **22 tests / 55 assertions passed**
- full `bun test`: **160 tests / 531 assertions passed**
- `bunx tsc --noEmit`: passed
- `git diff --check`: passed
- Wrangler dry-run: passed; upload 281.66 KiB, gzip 63.96 KiB

Normal authenticated deployment was not attempted because `bunx wrangler whoami` reports `You are not authenticated` and no credentials are available. Temporary preview deployment is prohibited and was not used. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.

Production remains FAIL/DEGRADED. Live GET-only verification status: rerun with GET-only requests. `/health` remains 1.0.0, `/api/config` remains 2.4.0, `/api/positions` returns HTTP 503 with `positionsAvailable: false` and `source: alpaca`, `/api/dashboard` reports broker account/position 503 failures, `/api/runs` shows a recent reconciliation 503/error, and `/api/trades` remains readable. The corrected source is not deployed; source identity remains unresolved versus local 2.6.0. The next authorized step is authenticated source verification, deployment if required, then separate GET-only verification.

## Risks and follow-up

The swing correction has no admission or execution risk; it only makes an existing skip reason accurate. The deferred crypto timing gap retains the safer false-negative behavior (skips rather than admitting without fresh fee telemetry), but may suppress otherwise eligible crypto BUY entries and produce repeated `FEE_DATA_UNAVAILABLE` skips.

Follow-up: capture broker CFEE posting timestamps and cycle timestamps across a UTC date boundary, determine whether `created_at`, `created_date`, or another broker event timestamp is authoritative, then design and regression-test a bounded freshness policy before changing crypto admission behavior.

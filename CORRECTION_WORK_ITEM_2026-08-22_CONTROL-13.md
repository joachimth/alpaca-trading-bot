# Alpaca Control-13 correction work item

Date: 2026-08-22 (Saturday)
Disposition: local documentation and regression correction validated; no deployment or broker mutation

## Trigger

`README.md` described `run_log.trades_executed` as “Orders submitted,” but the intentional implementation behavior counts only broker-confirmed full fills. The metric is incremented in `src/index.ts`, `src/swing-strategy.ts`, and `src/crypto-strategy.ts` only after the broker-full-fill predicates succeed. This work item corrects the semantic contract without adding a submitted-order counter or changing trading behavior.

## Exact correction

- `README.md`, `docs/OPERATIONS.md`, and `docs/DEPLOYMENT_RUNBOOK.md` now state that `trades_executed` counts broker-confirmed full fills: broker status `filled` with filled quantity at least 99.9% of requested quantity.
- The documentation explicitly distinguishes submitted, accepted, pending, rejected, canceled, and partially filled orders recorded in `trades` from the filled count in `run_log`.
- `dashboard/index.html` now labels the run-history value `Full fills` and explains that `trades_executed` is not a submitted-order count.
- `test/trades-executed-semantics.test.ts` covers accepted, pending, partial, underfilled, and fully filled broker snapshots, crypto lifecycle classification, and source guards for all three strategy increment sites.

No production logic, counters, caps, schedules, leases, broker authority, edge gates, order behavior, or mutation boundaries were changed. No submitted counter was added.

## Validation

- Focused regression: **51 tests passed, 0 failed, 227 expect() calls**.
- Full `bun test`: **168 tests passed, 0 failed, 584 expect() calls**.
- `bunx tsc --noEmit`: passed.
- `git diff --check`: passed.
- Wrangler dry-run: passed with a **282.79 KiB** upload preview and D1 binding; no deployment occurred.

These checks were run locally after the final source and documentation edits. No deployment or temporary preview was run.

## Deployment and safety boundary

No deployment, temporary preview, trigger, order submission, cancel, close, replace, retry, migration, or other broker-mutating endpoint was used or is authorized by this correction. Production/live status is unchanged; this work item records a local documentation and regression correction only.

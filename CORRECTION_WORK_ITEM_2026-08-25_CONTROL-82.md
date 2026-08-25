# CORRECTION_WORK_ITEM_2026-08-25_CONTROL-82.md

## Disposition

**OPEN FAIL/DEGRADED for production; LOCAL VALIDATED.** This work item records reliability-only corrections from the completed Control-81 source audit. It does not claim deployment or production verification.

## Exact source identity

- Repository: `/workspace/alpaca-trading-bot`
- Exact HEAD before source commit: `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`
- Exact validated HEAD after source commit: `20d80ac87e08271fb0d9c1c7ea1027b72eebd48d`
- Branch: `fix/remove-premature-position-upsert-entryside`
- Release metadata: `2.6.0`
- Commit created: `20d80ac87e08271fb0d9c1c7ea1027b72eebd48d` (`fix: harden runtime observability and data freshness`).

## Corrections implemented

1. Clean scheduled maintenance/reconciliation now records `status='ok'` rather than `skipped`; structured `MAINTENANCE_ONLY` remains informational. Lookup failures and ledger truncation still produce degraded/error status as appropriate.
2. `RECONCILIATION_DEFERRED_TO_MAINTENANCE` is classified as informational for evaluated swing/crypto cycles. True blocking skips and errors remain blocking.
3. Daytrading 5-minute and crypto 15-minute paths now validate latest-bar timestamps for invalid, bounded stale, and future data before TA. Rejected data emits structured skip codes and no signals/orders are generated from it.
4. Broker `change_today_pct` zero/missing cases now expose a structured equity-delta fallback for observability and risk context. Kill-switch logic remains fail-safe; no caps or thresholds changed.
5. Swing cap accounting now includes positive unattributed broker exposure conservatively when the configured swing cap is active, without assigning it to a strategy category or changing configured cap values.

## Invariants preserved

- Capital caps remain exactly `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto.
- Four cron expressions and schedules are unchanged.
- Existing thresholds, sizing, order semantics, broker authority, and protective-exit behavior are unchanged except for fail-closed data validation and conservative exposure accounting.
- No deployment, external mutation, broker order action, trigger, migration, or database schema change was performed.

## Validation results

- Full test suite: **213 tests / 796 assertions — PASS**.
- Focused regressions: included maintenance status, informational deferral status, intraday stale/future bars, equity fallback, and unattributed swing exposure.
- TypeScript: `bun run typecheck` — **PASS**.
- Patch hygiene: `git diff --check` — **PASS**.
- Test-results placeholder for any future release pipeline: **TBD — do not infer deployment from local validation**.
- Deployment receipt placeholder: **NONE — no deployment performed**.
- Post-deployment GET-only verification placeholder: **TBD — not run**.

## Open risks / follow-up

Production remains **OPEN FAIL/DEGRADED**. Required follow-up is authenticated source-tied deployment only after release review, then a separate read-only verification of live identity, schedules, status/skip semantics, latest-bar evidence, equity-direction source, conservative cap accounting, and unchanged caps/order behavior. Do not use trading triggers or broker-mutating endpoints as smoke tests.

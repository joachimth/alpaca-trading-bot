# Correction work item: Control-70 broker-only reconciliation severity

**Date:** Monday, August 24, 2026  
**Disposition:** **LOCAL CORRECTION COMPLETE / LIVE OPEN FAIL-DEGRADED**

## Confirmed defect and safety boundary

The strict GET-only production control identified that live run **3317** (`cron`, `2026-08-24 13:41:16 UTC`) was marked `status=error` solely because successful broker-authoritative reconciliation of internal-only `MSTR`, `INTC`, and `NOW` rows was appended to the runtime `errors` array. That caused `runStatus()` to classify the run as an error even though the D1-only reconciliation completed.

The correction changes only this severity classification. The broker remains authoritative; the same broker-to-D1 upserts and D1-only closures remain unchanged. Actual reconciliation failures, quantity mismatches, broker/API failures, Cloudflare exhaustion, and other runtime errors remain errors. No capital cap, schedule, threshold, sizing, signal, fee-freshness, edge-gate, order, or trading behavior changed. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker mutation was performed.

## Local correction

In `src/index.ts`, the broker-only divergence branch now records structured non-error detail:

- code: `BROKER_ONLY_RECONCILED`
- scope: `reconciliation`
- message: `Broker-authoritative position divergence reconciled into D1`
- context: original divergence details

The quantity-mismatch branch still records `POSITION_QTY_MISMATCH`, blocks new entries, preserves broker quantity, halts risk admission, and pushes actual errors. The existing broker-authoritative sync path and D1 protective metadata behavior remain intact.

## Live evidence and remaining production status

The separate live GET-only verification still reports:

- All six required endpoints return HTTP 200 JSON.
- Live `/health` is version **1.0.0** and `/api/config` is version **2.4.0**, versus local validated release **2.6.0**. Source-to-Worker provenance is unresolved, so production remains **OPEN FAIL/DEGRADED**, not healthy.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 21 broker rows. Current account equity was **98,435.13 USD** versus `last_equity=98,504.5039 USD`, direction **down**. The latest stored snapshot was **98,457.30 USD** at `2026-08-24 13:46:02 UTC`.
- Caps are configured as **5,000 / 3,700 / 2,000 USD** for daytrading/swing/crypto. However, live read-only evidence conflicts: a category snapshot showed swing market value **2,810.205704 USD**, while `strategyComparison` showed **3,774.37046 USD**, above the 3,700 USD cap. Cap configuration is unchanged, but live enforcement cannot be certified from conflicting read-only aggregates.
- Local schedules remain daytrading `*/5 13-21 * * 1-5` → `cron`, swing `0 22 * * 1-5` → `swing_cron`, crypto `7-59/30 * * * *` → `crypto_cron`, and reconciliation `*/10 * * * *` → `reconcile_cron`. Crypto delivery remains near `:07/:37 UTC`; reconciliation delivery remains near ten-minute cadence.
- Live run 3315 (`crypto_cron`, `13:38:00 UTC`) is an intentional `DECISION_HOLD`; run 3316 (`reconcile_cron`, `13:40:58 UTC`) is an intentional `MAINTENANCE_ONLY` skip with `ledgerTruncated=false` and `ledgerDegraded=false`; run 3317 is the false-error case corrected locally. No explicit lease-held record was observed, so lease behavior remains unproven. No fresh August 24 swing strategy run was observed; the latest swing run 3182 on August 23 ended in error, including historical Cloudflare subrequest exhaustion.
- Trade lifecycle fields are present, including pending and filled quantities/timestamps. Sampled filled trades still expose `gross=null`, `fee=null`, and `net=null` under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact per-fill economics remain unavailable. Aggregate crypto arithmetic is internally consistent, but does not prove exact lot attribution.
- Live run aliases/candidate counters and complete run/trade filter/pagination behavior remain absent, ignored, or unproven on the older artifact. Local tests cover the intended behavior.
- Dashboard labels crypto fee telemetry `available`, but `cryptoFeeAsOf=2026-08-18T09:37:52.56276Z` is stale relative to the August 24 capture. This conflicts with the intended 60-second freshness gate and remains a live observability/data-freshness gap; no fee gate was loosened.

## Validation

Completed on the corrected tree:

- Focused regression suite: **100 passed / 0 failed / 469 assertions across 8 files**; receipt `/workspace/alpaca_control_2026-08-24/control70_focused.txt`.
- Full `bun test`: **201 passed / 0 failed / 763 assertions across 26 files**; receipt `/workspace/alpaca_control_2026-08-24/control70_full.txt`.
- `bun run typecheck`: exit 0; receipt `/workspace/alpaca_control_2026-08-24/control70_typecheck.txt`.
- `git diff --check`: exit 0; receipt `/workspace/alpaca_control_2026-08-24/control70_diffcheck.txt`.

Receipts are retained under `/workspace/alpaca_control_2026-08-24/control70_*.txt`.

## Deployment blocker and follow-up

`wrangler whoami` remains blocked by: **`You are not authenticated. Please run \`wrangler login\`.`** Do not use a dirty or temporary preview deployment. Authenticate through the secure credential flow, isolate a clean immutable reliability-only artifact, deploy only if still required and authorized under the standing maintenance rule, then perform a separate GET-only verification of release identity, broker authority, corrected reconciliation severity, all four schedules, natural swing/daytrading delivery, filters/pagination, lifecycle/accounting, cap consistency, fee freshness, and crypto edge-gate wiring.

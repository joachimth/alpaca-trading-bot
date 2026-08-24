# CORRECTION WORK ITEM: Control-43

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only**.

## Scope

Control-43 used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only schedule, filtered-run, and trade-pagination probes. No trigger, submit, cancel, close, replace, retry, migration, preview, deployment, or broker-mutating endpoint was called.

## Live observations

- All six required endpoints returned HTTP 200. `/health` observed `status=ok`, service `alpaca-trading-bot`, version `1.0.0`; `/api/config` observed `version=2.4.0`. These are timestamped live observations, not proof of release identity. Local HEAD is `e805da1` and local release is `2.6.0`; the active deployed bundle/source SHA remains unbound.
- `/api/positions` remains broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows. D1 is not treated as live position authority in the local implementation.
- Dashboard account equity is `98504.50` versus `last_equity=98504.5039`, with `change_today=0` and `daily_pl=0`; the small direct delta is negative but material current-day equity direction is not established.
- Caps remain exactly `$5000` daytrading, `$3700` swing, and `$2000` crypto in live config/dashboard observations. No cap or vital risk parameter changed.
- The live schedule artifact records all four expected crons: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` (`:07/:37`), and reconciliation `*/10 * * * *`. The artifact is not cryptographically bound to the active Worker, so deployed schedule provenance remains unresolved.
- Fresh live delivery is visible for daytrading through `2026-08-23 19:55:49Z` as an explicit `MARKET_CLOSED` skip, crypto at `19:37:54Z` and earlier around `:07/:37` with zero trades and structured skips, and reconciliation at `19:50:48Z` as `MAINTENANCE_ONLY`. Sunday has no expected weekday swing cron delivery; no `swing_cron` appears in the inspected page, so swing failure is inconclusive rather than proven. No current lease-held row is visible; historical lease/error and risk-halt evidence remains separately documented.
- Live filtered run responses omit the locally implemented `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; trade offsets repeat the first page IDs (`642,641,640`). This is live API-contract drift and not a new local runtime defect.
- Sampled filled trades expose order/fill identity, status, quantities, broker timestamps, lifecycle timestamps, and reconciliation fields. Exact per-fill `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` with `fee_attribution=none-recorded`, so per-fill fee/gross/net consistency does not pass. Aggregate dashboard arithmetic is internally consistent but not auditable per fill.
- Dashboard fee telemetry reports availability while crypto run skips report `FEE_DATA_UNAVAILABLE`; semantics and scope are unresolved, so this control does not assert a contradiction. The configured crypto edge threshold is visible, but live calculated calibrated edge is not exposed.

## Repository assessment and disposition

Local source contains the broker-authoritative position failure path, bounded read-only reconciliation, filtered run observability, distinct pagination, conservative accounting, symbol-less USD CFEE handling, and fail-closed calibrated crypto fee/edge gates. No additional runtime or trading-logic change is justified by this audit. The correction is documentation/status-only and does not change caps, schedules, sizing, leases, accounting policy, edge gates, trading behavior, deployment state, or broker state.

## Validation and blockers

Run focused and full regressions, typecheck, and diff-check after this documentation update. Wrangler authentication is required before any release identity reconciliation or authorized deployment; no deployment is attempted in this control. Keep production **OPEN FAIL/DEGRADED** until the active bundle/SHA/release and API contract are bound, swing history is checked over a sufficient page range, fee telemetry semantics are reconciled, and a later authorized deployment receives separate GET-only verification.

## Explicit follow-ups

1. Restore authenticated Wrangler access and bind active Worker, bundle, source SHA, release identity, traffic, and schedule provenance.
2. Inspect deeper paginated run history for swing delivery and lease/error evidence.
3. Reconcile dashboard fee availability with run-level `FEE_DATA_UNAVAILABLE` semantics without weakening conservative attribution.
4. After an authorized release decision, deploy only the validated artifact, capture rollback/receipt evidence, and repeat the six endpoints plus filtered/pagination probes read-only.

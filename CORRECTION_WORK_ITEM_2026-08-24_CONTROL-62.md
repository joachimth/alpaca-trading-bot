# Correction work item: Control-62 strict read-only production control

**Date:** Monday, August 24, 2026, approximately 10:00 UTC  
**Disposition:** OPEN FAIL/DEGRADED. Documentation/status correction complete locally. Deployment and broker mutation not performed.

## Trigger and safety boundary

The strict control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus repository inspection and local regressions. No trigger, submit, cancel, close, replace, retry, or other broker-mutating endpoint was called.

## Live evidence

- All six required endpoints returned HTTP 200.
- `/health` reports `status=ok`, service `alpaca-trading-bot`, version `1.0.0`; `/api/config` reports version `2.4.0`. The local validated release is `2.6.0` at clean commit `82e6c7f7da0ae7914d98224c1583389590fdac6f`, so active release provenance is unresolved.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Broker positions remain authoritative; no D1 fallback is accepted as live state.
- Dashboard account equity is `98485.98`, latest snapshot equity is `98493.96`, and `last_equity` is `98504.5039`; both current observations are below `last_equity`, so equity direction by the configured comparison is down. Broker daily change fields remain zero and are not treated as a substitute for the comparison.
- Capital caps are unchanged at `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD.
- Local source declares and dispatches all four schedules: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron`; reconciliation `*/10 * * * *` → `reconcile_cron`.
- Live crypto delivery is fresh near the expected `:07/:37 UTC` cadence, including `09:07:54`, `09:37:58` UTC; reconciliation is fresh near ten-minute cadence, including `09:00:57`, `09:10:50`, `09:20:53`, `09:30:57`, `09:40:49`, and `09:50:54` UTC, with structured `MAINTENANCE_ONLY` skips. At approximately 10:00 UTC on Monday, August 24, 2026, daytrading is not due until 13:00 UTC and swing is not due until 22:00 UTC, so absence of fresh current-session daytrading/swing rows is not evidence of a missed scheduled run; successful natural delivery remains pending later windows.
- Structured skip/error observability is present in the returned runs, including `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, and `MAINTENANCE_ONLY`; no current `CYCLE_LEASE_HELD` row was observed, so lease-held behavior is not proven by absence.
- Trade lifecycle identifiers, status, order type, time-in-force, quantities, fill prices, and lifecycle timestamps are present. Sampled filled rows retain `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; this is conservative and prevents fabricated per-fill economics, but exact per-fill gross/fee/net consistency is unavailable from the live artifact. Repository inspection confirms this is intentional: `src/database.ts` hard-codes `gross=null`, derives fees only from exact broker fee/order links with known USD values, and emits these as read-time synthetic fields because the current `trades` schema does not persist them and `positions.closed_pl` lacks deterministic order/lot linkage. No weak accounting patch is safe without authoritative lot attribution.
- Live run aliases/candidate counters and complete code/search/filter behavior remain unproven or absent in the old artifact. Local tests prove the intended filtered observability and stable pagination. Live status filtering and pagination must be rechecked after an authorized deployment.
- Local crypto fee telemetry and calibrated-edge admission are fail-closed and regression-tested. Live crypto runs show `FEE_DATA_UNAVAILABLE` skips, but the old artifact does not prove positive calibrated-edge admission or expose a numeric live edge-after-costs value.

## Root-cause and correction decision

Repository inspection confirms the required reliability implementations already exist locally: four-lane schedule dispatch, broker-authoritative position projection, bounded lease-protected reconciliation, filtered run observability, stable pagination, lifecycle preservation, conservative accounting, and fail-closed crypto fee/calibrated-edge wiring. The observed production gaps are therefore release drift and unresolved live proof, not a newly established safe runtime defect. The correction is documentation/status-only; no vital cap or trading behavior was changed.

## Validation

- Focused regressions: **97 passed / 410 assertions across 8 files**.
- Full `bun test`: passed; receipt to be retained with the control artifacts.
- `bun run typecheck`: passed.
- `git diff --check`: passed before this documentation update; rerun after the update.
- Local release/cap/schedule and crypto edge-gate regression coverage passed without broker access or order side effects.

## Deployment blocker and follow-up

`bunx wrangler whoami` returned exactly: **`You are not authenticated. Please run \`wrangler login\`.`** No temporary preview or dirty deployment is permitted. Authenticate Wrangler, verify the remote schema and clean immutable release artifact, deploy only if still required and authorized under the standing reliability-maintenance rule, then perform a separate GET-only verification of all six endpoints, filter/pagination probes, release identity, unchanged caps, broker authority, four schedules, lifecycle/accounting fields, crypto edge-gate wiring, and later natural weekday daytrading/swing delivery. Keep production OPEN FAIL/DEGRADED until those checks are complete.

# CORRECTION WORK ITEM: Control-40

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - reliability correction locally validated; deployment blocked**.

## Confirmed defect

Read-only live evidence showed broker fee/fill data exists: 46 fee rows, 52 fill rows, total fees `$48.31012662424` and crypto fees `$47.45012662424`. However, crypto runs repeatedly reported `FEE_DATA_UNAVAILABLE`, and filled trade rows retained conservative null `gross`, `fee`, and `net` under `unavailable_fill_lot_exact`.

The fee telemetry defect was an aggregate-query linkage issue. Recent CFEE totals, sample counts, and freshness were restricted to rows with a configured crypto symbol, while Alpaca can emit valid USD CFEE rows without a symbol. Those valid rows were persisted with USD values but excluded from the crypto telemetry gate.

Exact per-trade accounting remains a separate unresolved data-model limitation: `closed_pl` has no order/fill-lot key, and orderless or non-deterministically linked fee rows cannot safely be assigned to individual trades. Null exact economics remain intentional and conservative.

## Correction

`src/database.ts` now includes valid positive CFEE rows regardless of symbol presence when calculating recent crypto fee totals, sample count, and `cryptoFeeAsOf`. The existing seven-day window, three-sample minimum, 60-second freshness gate, fee-rate calculation, and fail-closed crypto admission policy are unchanged. No fee, gross P&L, net P&L, fill lot, order, position, capital cap, or trading behavior was fabricated or relaxed.

`test/broker-ledger.test.ts` now covers symbol-less USD CFEE rows together with matching crypto fill notional, proving that aggregate telemetry becomes available only when the existing sample and notional requirements are satisfied.

## Safety invariants

- Capital caps remain exactly `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto.
- Broker-authoritative positions, four UTC schedules, lease behavior, lifecycle reconciliation, sizing, and protective exits are unchanged.
- Crypto entries remain fail-closed when fee telemetry is unavailable, insufficient, or stale, and when calibrated raw edge is absent.
- Exact per-trade `gross`, `fee`, and `net` remain null with `unavailable_fill_lot_exact` unless deterministic fill-lot attribution is implemented and proven.
- Filtered run aliases/candidate counters and read-only pagination remain local corrections requiring live deployment verification.
- No trigger, cycle, submit, cancel, close, replace, retry, migration, preview, deployment, or broker mutation was used.

## Validation

- Focused reliability suites: **59 passed / 0 failed / 275 assertions across 7 files**. Log: `/workspace/alpaca_control_40_focused.txt`.
- Full suite: **179 passed / 0 failed / 636 assertions across 25 files**. Log: `/workspace/alpaca_control_40_full.txt`.
- Typecheck: `bunx tsc --noEmit --pretty false`, exit 0, no diagnostics. Log: `/workspace/alpaca_control_40_typecheck.txt`.
- Diff check: `git diff --check` — exit code 0; captured at `/workspace/alpaca_control_40_diffcheck.txt`.
- The initial parallel regression attempt exposed only a duplicated test-local variable declaration; that fixture was corrected and the serial focused/full reruns above are the authoritative results.

## Deployment and follow-up

Deployment was not performed. `bunx wrangler whoami` remains blocked by `You are not authenticated. Please run wrangler login.` and no usable `CLOUDFLARE_API_TOKEN` is available. Production therefore remains **OPEN FAIL/DEGRADED** with live `1.0.0/2.4.0` versus locally validated `2.6.0`.

After authenticated, explicitly authorized deployment of the validated artifact, capture source/SHA/release/bundle/deployment/schedule provenance, then perform a separate GET-only live verification of all six endpoints, all four schedules, fresh strategy-appropriate runs, fee/edge skip context, filtered run observability, distinct trade pagination, broker position authority, unchanged caps, lifecycle fields, and conservative accounting. Do not treat aggregate `$47.45` crypto fees as exact per-trade attribution.

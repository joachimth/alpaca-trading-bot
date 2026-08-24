# CORRECTION WORK ITEM: Control-42

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - read-only control completed; deployment blocked**.

## Strict read-only scope

Control-42 used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filtered run, dashboard, and trade-pagination probes. No trigger, submit, cancel, close, replace, retry, migration, preview, deployment, or broker-mutating endpoint was called.

## Confirmed live evidence

- All six required endpoints returned HTTP 200. `/health` returned `status=ok`, service `alpaca-trading-bot`, version `1.0.0`; `/api/config` reports version `2.4.0`. The checked-out local release is `2.6.0` at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; active deployed source/SHA and schedule provenance remain unresolved.
- `/api/positions` is broker-authoritative and available: `positionsAvailable=true`, `source=alpaca`, 29 rows. Dashboard positions and availability agree. Current position freshness is not fully explainable because the latest snapshot is `2026-08-23 18:37:48` while runs continue through `18:55:49`, and many position `updated_at` values are older.
- Dashboard account equity is `98504.50` versus `last_equity=98504.5039`, a direct decrease of approximately `$0.0039`; `change_today=0` and `daily_pl=0`, so material same-day direction remains unverified despite the small snapshot delta.
- Configured caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`; dashboard cap cards agree. Historical `$5679.8784` daytrading exposure and direct live enforcement remain unresolved follow-ups. No vital cap changed.
- Local source retains all four schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for `:07/:37`, and reconciliation `*/10 * * * *`. Live run history confirms recurring daytrading `MARKET_CLOSED`, crypto around `:07/:37`, and reconciliation about every 10 minutes, but no swing run is exposed in the inspected history, so swing delivery and deployed schedule identity are not proven.
- Current daytrading runs are explicit `MARKET_CLOSED` skips with `errors=0`; crypto runs are fresh with zero trades and structured `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, and `DECISION_HOLD` skips; reconciliation is fresh `MAINTENANCE_ONLY` with `ledgerTruncated=false` and `ledgerDegraded=false`. Lease state is not exposed, and no `LEASE_HELD` row appeared in the inspected history, so lease behavior is only partially verifiable. Historical swing divergence/`RISK_HALTED` remains visible.
- Live dashboard query filters are ignored. Filtered run responses omit locally validated `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; `/api/trades?limit=3&offset=0` and `offset=30` both return IDs `642,641,640`, proving old pagination behavior remains live.
- Sampled filled trades expose order IDs, decision linkage where available, quantities, full-fill status, broker timestamps, lifecycle timestamps, and reconciliation timestamps. Exact per-trade `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` with `fee_attribution=none-recorded`; crypto runs report `FEE_DATA_UNAVAILABLE`. Aggregate broker fee evidence must not be forced into exact per-fill attribution.

## Repository and correction assessment

The local source contains the reliability fixes for broker-authoritative positions, read-only failure handling, bounded reconciliation, filtered run observability, distinct pagination, conservative accounting, symbol-less USD CFEE telemetry, and calibrated crypto edge/fee fail-closed gates. `technical-analysis.ts` only declares optional `rawEdgeBps`; no calibrated edge producer or positive-edge production path is proven. Existing tests cover the crypto edge gate wiring and must remain green.

No additional runtime change is justified by this control. The confirmed live gaps require authenticated release/provenance reconciliation and a later authorized deployment, not a speculative trading-logic patch. The correction is therefore documentation/status-only; caps, schedules, sizing, broker authority, leases, accounting policy, edge gates, and trading behavior were not changed.

## Validation

- Focused regression: `/workspace/alpaca_control_42_focused.txt` passed 67 tests / 322 assertions.
- Full regression: `/workspace/alpaca_control_42_full.txt` passed 179 tests / 636 assertions.
- Typecheck: `/workspace/alpaca_control_42_typecheck.txt` passed with no diagnostics.
- Diff check: `/workspace/alpaca_control_42_diffcheck.txt` passed.
- Deployment authentication: `/workspace/alpaca_control_42_wrangler_whoami.txt` reports `You are not authenticated. Please run wrangler login.` No deployment was attempted.

## Required follow-up

Restore authenticated Wrangler access, resolve the branch/ref inconsistency and bind the exact source SHA, release version, Worker artifact, traffic, and all four schedules. Only then deploy the validated reliability release under the standing maintenance rule, capture a receipt and rollback target, and perform a separate GET-only verification of release identity, position authority, equity direction, caps, all schedule deliveries, lease/error skips, filtered run fields, distinct trade pages, lifecycle fields, fee/gross/net semantics, and crypto fee/raw-edge gate behavior. Keep production **OPEN FAIL/DEGRADED** until that verification passes.

## 2026-08-23 19:00:49Z current-evidence addendum

This addendum supersedes any less-specific earlier timing/status language while preserving the strict read-only disposition. The audit capture used only GET requests; all six required endpoints returned HTTP 200. Live health is `1.0.0` and `config.version=2.4.0`, while local `2.6.0` is at HEAD `e805da1`. Live positions remain `positionsAvailable=true`, `source=alpaca`, 29 rows. Equity is `98504.50` versus `last_equity=98504.5039`, `change_today=0`; the earlier `2026-08-21 21:37:58Z` equity was `98542.39`. Caps remain `5000/3700/2000`.

Live run evidence reaches `18:55:49Z`: `cron` daytrading rows are `MARKET_CLOSED`; `crypto_cron` rows at `18:37:55Z` and `18:07:53Z` have zero trades; `reconcile_cron` is `MAINTENANCE_ONLY` at `18:50:48Z`. No `swing_cron` appears in the fetched page, which is insufficient to claim swing schedule failure. Lease-held is not currently visible. Local-only schedules remain daytrading `*/5 13-21` weekdays, swing `0 22` weekdays, crypto `7-59/30` hourly (`:07/:37`), and reconciliation `*/10`.

Observed live dashboard filter parameters were ignored; because support is not documented as a supported contract here, this is recorded as an observation and not called a broken feature. Filtered runs omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`. Trade offsets `0` and `30` repeat IDs `642,641,640`; lifecycle fields are present. Sampled `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact`. Dashboard aggregate net arithmetic is internally consistent but not auditable per fill. Dashboard crypto fee telemetry says available while live crypto runs report `FEE_DATA_UNAVAILABLE`; crypto edge threshold `8` is visible, but calculated edge is not exposed.

The corresponding reliability changes remain local-only and are not live-proven. No extra runtime fix is justified. Wrangler remains blocked by `You are not authenticated. Please run wrangler login.` No deployment was attempted, and no source, test, schema, Wrangler configuration, package, cap, schedule, trading, broker, or deployment state was changed. Production remains **OPEN FAIL/DEGRADED** pending authenticated provenance, any explicitly authorized deployment decision, and separate GET-only verification.

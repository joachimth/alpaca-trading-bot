# CORRECTION WORK ITEM: Control-58

Date: Monday, August 24, 2026. Fresh GET-only evidence capture: 2026-08-24 UTC, through live run `3254` at `07:00:56 UTC`. Disposition: **OPEN FAIL/DEGRADED - documentation/status correction only**.

## Safety boundary

This control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only strategy, trigger, code, search, status, offset, and page probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was called.

## Confirmed live evidence

- All six required endpoints returned HTTP 200.
- `/health` returned `status=ok`, service `alpaca-trading-bot`, version `1.0.0`. `/api/config` returned version `2.4.0`. Local HEAD is `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`, package/source release `2.6.0`; the active Worker artifact and source commit remain unproven and inconsistent.
- `/api/positions` returned `positionsAvailable=true`, `source=alpaca`, and 29 rows. Broker positions are authoritative; D1 is metadata-only for current state. The payload still contains stale position timestamps and null protective stop/take values, so metadata freshness is not proven.
- Fresh live dashboard captures ranged from approximately `98489.91` to `98490.93` versus `last_equity=98504.5039`, a negative comparison of about `-14.59` to `-13.57`; the latest snapshot was `98473.92` versus the same last equity, `-30.5839`. Broker `change_today` and `change_today_pct` remain zero, so direction is down versus the stored last-equity baseline while broker intraday fields remain internally inconsistent with the dashboard comparison.
- Capital caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD.
- Local source retains all four UTC schedules and dispatch mappings: daytrading `*/5 13-21 * * 1-5` to `cron`, swing `0 22 * * 1-5` to `swing_cron`, crypto `7-59/30 * * * *` to `crypto_cron` at approximately `:07/:37`, and reconciliation `*/10 * * * *` to `reconcile_cron`.
- Live crypto delivery is fresh through run `3251` at `2026-08-24 06:37:55 UTC`, with prior runs at `06:07:54`, `05:37:55`, `05:07:56`, `04:37:56`, and `04:07:55`, matching the expected approximately `:07/:37` cadence. Crypto rows are skipped with structured `NO_POSITION_TO_EXIT`, `CONFIDENCE_BELOW_THRESHOLD`, and historical `FEE_DATA_UNAVAILABLE` reasons; no live positive calibrated-edge admission is exposed.
- Live reconciliation delivery is fresh through run `3254` at `2026-08-24 07:00:56 UTC`, with runs at approximately ten-minute intervals back through `06:10:49`. Runs are structured `MAINTENANCE_ONLY`, with bounded broker-order and ledger context and no reported reconciliation degradation.
- Daytrading strategy filtering returns carried-forward `MARKET_CLOSED` rows through run `3180` at `2026-08-23 21:55:47 UTC`; current-session daytrading freshness is not proven. Swing filtering returns latest run `3182` at `2026-08-23 22:01:16 UTC` with status `error`, eight errors, and prior Cloudflare subrequest exhaustion plus broker-authoritative sync absence evidence. A current successful swing delivery is not proven.
- Lease-held observability is CANNOT VERIFY. Structured skips and historical errors are present, but `code=CYCLE_LEASE_HELD` and `search=lease` probes returned the same ordinary unfiltered recent page, so absence or presence of a current lease-held run cannot be concluded from the live API.
- Filtered run strategy and trigger results are distinguishable for crypto, daytrading, swing, and reconciliation, and the reconciliation alias maps to the same rows. However, live rows omit local contract fields `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; `code` and `search` filters are ignored by the active artifact.
- Trade lifecycle fields are present. Sampled accepted and filled rows expose Alpaca order IDs, client IDs, quantities, filled quantities, submitted timestamps, and filled timestamps where applicable. The `status=filled`, `status=accepted`, `status=failed`, and `status=canceled` probes all returned the same mixed set, and `offset=10` plus `page=2` repeated the first-page IDs `645` through `636`; live trade status filtering FAILS and pagination remains broken.
- Every sampled filled trade row retains `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Fees and exact gross/net consistency therefore FAIL/CANNOT VERIFY at per-fill level. Aggregate crypto evidence reports gross P&L `-56.616426`, fees `269.11016882811`, and net P&L `-325.72659482811`, which is arithmetically consistent as an aggregate, but it does not establish deterministic per-fill lot attribution. No values are fabricated.
- Local crypto edge and fee wiring remains fail-closed: fee telemetry requires sufficient fresh maintenance data, calibrated raw edge is required for positive BUY admission, and confidence is not used as an edge substitute. This is covered by local tests, but live proof is partial only: config exposes `crypto_min_edge_after_costs=8` and runs expose `FEE_DATA_UNAVAILABLE` skips, while no numeric edge-after-costs field or positive calibrated-edge admission is exposed.

## Correction disposition

No new local runtime defect was established by this control. The local tree already contains the required reliability behavior for broker-authoritative positions, four-lane dispatch and leases, bounded maintenance reconciliation, filtered run observability, stable pagination, lifecycle preservation, conservative accounting, and crypto fee/calibrated-edge gating. The correction is therefore limited to recording the fresh evidence and preserving the **OPEN FAIL/DEGRADED** status.

No cap, schedule, threshold, sizing, signal, order, trading-behavior, schema, deployment-configuration, or broker-state change was made.

## Validation receipt

- Focused regressions: **46 tests / 261 assertions**, covering broker authority, entry-position persistence, filtered run and trade observability, lifecycle/accounting shape, release version, and crypto edge/runtime behavior. Receipt: `/workspace/control58_focused.txt`.
- Full regressions: **189 tests / 705 assertions** across 26 files. Receipt: `/workspace/control58_full.txt`.
- Typecheck: passed. Receipt: `/workspace/control58_typecheck.txt`.
- Diff check: passed. Receipt: `/workspace/control58_diff_check.txt`.
- Prior-receipt discrepancy: Control-57 documentation states full validation `189/705`, while the saved `/workspace/alpaca_control_57_full.txt` reports `184/678`; the focused `88/391` receipt agrees. This remains an unexplained documentation/receipt gap and is not treated as a runtime pass.

## Deployment and follow-up

Deployment was not attempted. `bunx wrangler whoami` returned the exact blocker: **`You are not authenticated. Please run \`wrangler login\`.`** The worktree is dirty across pre-existing runtime, test, schema, and documentation changes, so no dirty artifact may be deployed.

Required follow-up: restore authenticated Wrangler access, isolate and review a clean immutable release artifact, bind active Worker version and source commit, verify all four deployed schedules, resolve live filtered-run and trade pagination drift, and perform a separate GET-only post-release control. Keep production **OPEN FAIL/DEGRADED** until those checks succeed.

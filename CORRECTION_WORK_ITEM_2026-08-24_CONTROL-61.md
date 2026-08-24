# CORRECTION WORK ITEM: Control-61

Date: Monday, August 24, 2026. Strict read-only production control captured approximately 09:00 UTC. Disposition: **DOCUMENTATION CORRECTION COMPLETE / LIVE OPEN FAIL-DEGRADED**.

## Safety boundary

The control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus read-only run/trade filter and pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, or other broker-mutating endpoint was called. No capital cap, threshold, max-trade limit, universe, schedule, sizing, signal, edge-gate, or order-semantics parameter was changed.

## Live evidence

- All six required endpoints returned HTTP 200.
- `/health` reports version `1.0.0`; `/api/config` reports version `2.4.0`. The local repository release is `2.6.0` at commit `82e6c7f7da0ae7914d98224c1583389590fdac6f`, so the active Worker/source mapping remains unproven.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Broker positions remain authoritative; D1 metadata is not treated as live position state.
- Dashboard account equity was `98458.01` versus `last_equity=98504.5039`; the latest snapshot was `98440.07`, so the observed current-vs-last direction is down. Broker daily change fields remain zero, limiting independent daily-direction validation.
- Live caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD.
- Local source retains all four schedules and dispatch mappings: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron`; reconciliation `*/10 * * * *` → `reconcile_cron`.
- Fresh live crypto delivery is present at `08:07:57` and `08:37:58` UTC, close to the expected `:07/:37` cadence. Fresh reconciliation delivery is present at `08:50:52` and `09:00:57` UTC as `MAINTENANCE_ONLY`. Current successful daytrading and swing delivery are not proven by the returned live window.
- Structured skip observability is present, including `NO_POSITION_TO_EXIT`, `CONFIDENCE_BELOW_THRESHOLD`, `FEE_DATA_UNAVAILABLE`, and `MAINTENANCE_ONLY`. No current `CYCLE_LEASE_HELD` row was observed; absence is not proof that no historical lease-held skips occurred.
- Sampled trade rows contain broker order IDs, client IDs, status, quantities, fill fields, and lifecycle timestamps. Filled rows retain `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; no values are fabricated and per-fill gross/fee/net consistency is not claimable.
- Live run rows omit the locally supported `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` fields. Some trigger/strategy filtering works or aliases to canonical triggers, but unsupported probes are ignored or return unproven results. Trade status filtering and offset/page pagination remain not live-proven and prior evidence shows stale/ignored behavior.
- Local crypto edge-gate wiring remains fail-closed and regression-tested: calibrated raw edge is never inferred from confidence, unavailable fee/edge telemetry blocks admission, and the configured crypto minimum edge remains 8 bps. Live positive calibrated-edge admission is not proven.

## Correction and disposition

This work item updates release/status documentation only. The live gaps are deployment/source provenance, incomplete live observability, unavailable exact per-fill accounting, and missing natural strategy-run evidence. Repository inspection found no newly reproducible runtime defect that can be fixed safely without changing trading behavior; the existing local controls remain the intended safeguards. Vital caps, schedules, thresholds, sizing, edge-gate policy, broker authority, leases, and order behavior are unchanged.

## Validation and deployment

Focused validation passed **107 tests / 445 assertions across 10 files**; the full suite passed **197 tests / 738 assertions across 26 files**. `bun run typecheck` and `git diff --check` passed. Deployment is not attempted because `bunx wrangler whoami` returns the exact blocker: `You are not authenticated. Please run \`wrangler login\`.` The worktree/release provenance must be clean and authenticated before any deployment of the local `2.6.0` artifact. No temporary preview deployment is used.

Required follow-up: authenticate Wrangler, verify remote schema/provenance for the exact immutable release, deploy only the reliability correction if still required under the standing maintenance rule, then perform a separate GET-only verification of all six endpoints, all four schedule lanes, filtered run observability, trade pagination/status behavior, lifecycle/accounting fields, caps, and crypto edge-gate evidence. Observe natural weekday daytrading and swing runs before declaring production healthy.

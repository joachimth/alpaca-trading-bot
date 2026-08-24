# CORRECTION WORK ITEM: Control-55

Date: Monday, August 24, 2026. Audit capture: approximately 2026-08-24 04:00 UTC. Disposition: **OPEN FAIL/DEGRADED - strict read-only production control failed live verification**.

## Safety boundary

This control and correction used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus safe GET-only observability probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was called. No capital cap, schedule, sizing, threshold, edge-gate policy, order semantic, or trading behavior was changed.

## Final live evidence

- All six required endpoints returned HTTP 200 JSON.
- `/health` reported `status=ok`, service `alpaca-trading-bot`, version `1.0.0`; `/api/config` reported version `2.4.0`. Local tested release is `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Active Worker/source provenance is unresolved.
- `/api/positions` reported `positionsAvailable=true`, `source=alpaca`, and 29 positions. Dashboard position/account data matched the broker-backed projection. The final account snapshot observed equity `98471.10` versus `last_equity=98504.5039`, a downward comparison of `33.4039`; `change_today` and `change_today_pct` remained zero. Equity direction is therefore down on the comparison metric, while intraday fields are not informative.
- Configured caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`. The read-only surfaces do not prove historical baseline equality, reservation exposure, or complete cap-enforcement arithmetic; no cap was changed.
- Local source preserves all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37`, and reconciliation `*/10 * * * *`. Live reconciliation delivered `MAINTENANCE_ONLY` at `04:00:53` and repeatedly at approximately ten-minute cadence. Crypto delivered at `03:07:57` and `03:37:54` UTC and earlier `:07/:37` cycles. Daytrading freshness is not proven in the returned current page; the latest observed row is the prior `2026-08-23 21:55:47` market-closed skip. Swing freshness is not proven; the latest observed dedicated swing run is `3182` at `2026-08-23 22:01:16`.
- Swing run `3182` ended `error` with eight errors, including `Too many subrequests by single Worker invocation`, and recorded incomplete accepted exits plus broker-authoritative sync/held-score skip evidence. This remains a material live reliability failure, although the bounded/deferred reconciliation fix exists locally.
- Current run rows contain only `reconcile_cron` and `crypto_cron` in the returned page, all `skipped`. No explicit current `CYCLE_LEASE_HELD` row was observed, so lease-held delivery remains unproven. Structured skip evidence is present for `MAINTENANCE_ONLY`, `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, `NO_POSITION_TO_EXIT`, and related risk/hold conditions.
- Live rows omit locally implemented `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`. Prior safe probes confirmed the active artifact ignored run `code`/`search` filtering. Trade `status` filtering and offset/page pagination were also not honored, with repeated first-page IDs such as `645`, `644`, and `643`.
- Trade lifecycle fields are present. Accepted orders such as `645` retain broker/client IDs, submitted/broker-updated timestamps, zero fills, and no terminal timestamp; filled rows such as `642` and `641` retain filled quantity, average fill price, `filled_at`, and `leaves_qty=0`. Sampled `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact per-fill gross/fee/net consistency is therefore **CANNOT VERIFY**, and values are not fabricated. Dashboard aggregate fee arithmetic remains explicitly separate from exact per-fill lot attribution.
- Local crypto edge-gate wiring remains explicit and fail-closed: calibrated raw edge is required, fee telemetry is required, insufficient/stale/unavailable telemetry rejects entries, and structured skip context preserves the numeric comparison without inventing gross/net. Live deployment of this wiring is not proven because the active release is older and does not expose the required evidence.

## Local correction and validation

Repository inspection confirms the local source already contains broker-authoritative position projection, isolated bounded read-only reconciliation, separate leases for daytrading/swing/crypto/maintenance, filtered run observability, stable trade pagination, lifecycle preservation, conservative fee accounting, and crypto fee/calibrated-edge gating. No additional runtime correction is justified from this control, so the correction is documentation/status-only and preserves caps, schedules, sizing, thresholds, edge policy, order behavior, and broker state.

Validation receipts from the local tree:

- Focused: **75 tests passed, 0 failed, 337 assertions across 7 files** (`/workspace/alpaca_control_55_focused_final2.txt`).
- Full: **184 tests passed, 0 failed, 678 assertions across 26 files** (`/workspace/alpaca_control_55_full_final2.txt`).
- Typecheck: passed (`/workspace/alpaca_control_55_typecheck_final2.txt`).
- `git diff --check`: passed (`/workspace/alpaca_control_55_diff_check_final4.txt`).

## Deployment blocker and follow-up

Deployment was not attempted. `assistant platform status` is available, but `bunx wrangler whoami` reports: **`You are not authenticated. Please run \`wrangler login\`.`** The worktree is dirty, so uncommitted files must not be deployed and temporary preview deployment is prohibited.

Required follow-up:

1. Restore authenticated Wrangler access and establish a clean immutable release artifact containing only reviewed reliability/documentation changes.
2. Bind the active Worker identity, version, source SHA, traffic, and all four cron expressions to that artifact.
3. Deploy only under the standing reliability-maintenance authorization and only after clean-artifact verification; do not mutate broker state for validation.
4. Perform a separate GET-only post-release verification of release identity, broker position source, equity direction, caps, all four lanes, lease/error skips, run filters/aliases/candidate counts, trade pagination, lifecycle/accounting, and crypto edge-gate evidence.
5. Observe the next natural weekday swing window and resolve the historical `5679.8784` versus `$5,000` exposure question without changing caps or trading behavior.

Until these conditions are met, production remains **OPEN FAIL/DEGRADED**, not healthy.

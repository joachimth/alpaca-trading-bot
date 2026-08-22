# Alpaca production control correction work item: Control-6

- **Opened:** August 22, 2026 UTC during strict read-only production control.
- **Disposition:** **FAIL/DEGRADED**, not healthy.
- **Scope:** Release identity, run observability, and evidence documentation only. No cap, schedule, threshold, sizing, broker-authority, edge-gate, or trading-behavior change.

## Confirmed live GET evidence

- `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` all returned HTTP 200.
- Live release identity is inconsistent: `/health` reports version **1.0.0**, `/api/config.config.version` reports **2.4.0**, while the deployable repository reports **2.6.0** in `package.json`, `src/version.ts`, `schema.sql`, and the dashboard release marker.
- `/api/positions` reports `positionsAvailable: true`, `source: "alpaca"`, and **29** broker positions. The source contract remains broker-authoritative; D1 is metadata only and broker failure must not fall back to D1.
- Live dashboard account equity is **98,504.50** versus `last_equity` **98,504.5039**, a current-minus-last delta of **-0.0039**. `change_today`, `change_today_pct`, snapshot `daily_pl`, and `daily_plpc` are zero; the recent history also fell from **98,572.37 at 2026-08-21 22:07:58 UTC** to **98,504.50 at 2026-08-22 09:37:57 UTC**. Daily direction is therefore not independently reliable from the exposed fields.
- Capital caps are unchanged and consistent: **$5,000 daytrading, $3,700 swing, $2,000 crypto** in both live config and dashboard.
- Fresh reconciliation delivery is present at approximately ten-minute intervals. The latest observed run, **id 2785 at 2026-08-22 10:01:01 UTC**, is `reconcile_cron`, status `skipped`, structured `MAINTENANCE_ONLY`, with 47 ledger activities, one page, a five-page budget, and `ledgerTruncated: false`, `ledgerDegraded: false`.
- Fresh crypto delivery is present near the configured `:07/:37 UTC` cadence but records approximately **:08/:38** jitter: observed runs include **07:08:02, 07:38:00, 08:08:01, 08:38:00, 09:08:01, and 09:38:02 UTC**. The latest crypto run is a structured skip with three decisions, zero trades, and zero errors; reasons include `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, and `NO_POSITION_TO_EXIT`.
- No fresh daytrading or swing trigger/success is evidenced in the fetched run pages. Older daytrading records include `CYCLE_LEASE_HELD`; no current swing trigger appears in the fetched history. Weekend scheduling may explain the absence, but the permitted endpoints do not prove the active schedule control-plane state.
- Lease-held and error evidence remains material: historical maintenance/daytrading `CYCLE_LEASE_HELD` skips, crypto `D1_ERROR: too many SQL variables`, and `Too many subrequests by single Worker invocation` failures are present in run history. Later fresh crypto/reconciliation records have structured skips and zero errors, but historical failures remain unresolved risk evidence.
- Sampled filled trades expose `alpaca_order_id`, quantities, `filled_qty`, `leaves_qty`, broker/reconciliation timestamps, `submitted_at`, `filled_at`, and all terminal lifecycle fields. All sampled `gross`, `fee`, and `net` values are null with `accounting_status: unavailable_fill_lot_exact` and `fee_attribution: none-recorded`. Aggregate crypto gross/fee/net is mathematically consistent, but it is not deterministic fill/lot accounting and must not be represented as per-trade exact.
- Aggregate crypto fee telemetry is reported available with stale `cryptoFeeAsOf` data, while current crypto decisions report `FEE_DATA_UNAVAILABLE`; this is an unexplained observability/freshness gap, not a reason to weaken the fail-closed gate.
- Local source and regression evidence pass for broker-authoritative positions, all four schedules, isolated leases, structured skips, filtered run predicates and aliases, conservative fee handling, unchanged caps, and fail-closed crypto edge gates. No production caller supplies calibrated `rawEdgeBps`; positive-edge crypto admission remains fail-closed.
- Filtered run alias behavior is source/test verified but not live-proven against the local 2.6.0 release identity. Canonical stored triggers must remain unchanged.

## Local validation

- Focused control regressions: **89 tests / 323 assertions passed**.
- Full regression: **157 tests / 520 assertions passed**.
- `bunx tsc --noEmit`: passed.
- `bunx wrangler deploy --dry-run --outdir /workspace/alpaca-control-6-dry-run`: passed; 281.40 KiB upload preview, no upload.
- `git diff --check`: passed for the repository documentation changes.
- Local `wrangler.toml` and `src/index.ts` retain exactly four UTC schedules: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`.

## Deployment decision and blocker

No deployment was performed. `bunx wrangler whoami` reports **You are not authenticated**, and the known non-interactive deployment path requires `CLOUDFLARE_API_TOKEN`; stored credential metadata exists, but the credential is not available to Wrangler through the current process path. Historical deployment receipts conflict with the live 1.0.0/2.4.0 identity and are not proof of the active source. Do not use a temporary preview deployment.

## Final verification update — August 22, 2026 at approximately 11:00 UTC

- A separate GET-only fetch again returned HTTP 200 for all six required endpoints.
- Live alias checks remain defective: `trigger=daytrading_cron` and `trigger=reconciliation_cron` return canonical rows with `trigger_alias: null`; the local response-only fix is not live-proven.
- Latest live reconciliation was `reconcile_cron` at `2026-08-22 11:00:58`, still structured `MAINTENANCE_ONLY`; latest fetched crypto was `crypto_cron` at `2026-08-22 10:38:02`, a zero-error structured skip. No fresh daytrading or swing run is evidenced; those requirements remain CANNOT VERIFY from the permitted run pages.
- Crypto timestamps are visibly near `:07/:37`, but their naive timestamp strings have no timezone suffix, so strict UTC labeling is CANNOT VERIFY.
- Final sampled trade page contains 50 filled rows; all 50 retain null `gross`, `fee`, and `net` with `unavailable_fill_lot_exact`. Aggregate crypto gross/fee/net arithmetic is consistent but not fill-lot exact, and no numeric live edge-gate result or explicit wiring field is exposed; live crypto edge-gate wiring remains CANNOT VERIFY.
- Focused validation passed **59 tests / 253 assertions**; full validation passed **157 tests / 520 assertions**; typecheck and diff check passed; Wrangler dry-run passed with a 281.40 KiB upload preview and no upload.
- `bunx wrangler whoami` still reports **You are not authenticated**. No deployment, temporary preview, trigger, migration, or broker-mutating endpoint was used.

## Saved-artifact evidence update — August 22, 2026

- The complete saved schedule artifact `/workspace/alpaca-post-release-schedules.json` contains all four cron expressions, while the older `/workspace/alpaca-live-schedules-api.json` contains only three and omits `*/10` reconciliation; schedule metadata is therefore stale and contradictory.
- Saved alias probes for `trigger=daytrading_cron` and `trigger=reconciliation_cron` are empty while canonical `cron` and `reconcile_cron` captures contain rows; this independently preserves the live alias-observability gap. The requested saved path `runs_trigger_reconcile_cron_limit_5.json` is absent, so that exact limited query cannot be reconstructed from artifacts.
- Saved current-position evidence still reports `positionsAvailable=true`, `source=alpaca`, 29 positions, and an unattributed MSTR position. Saved daytrading evidence is latest `2026-08-20 21:55:24` with `CYCLE_LEASE_HELD`; saved swing evidence is latest `2026-08-18 22:00:36` with divergence/RISK_HALTED. These remain unresolved freshness/delivery gaps, not authorization to trigger runs.
- Sampled saved filled trades expose lifecycle timestamps and retain null `gross`, `fee`, and `net` under `unavailable_fill_lot_exact`. No saved artifact exposes a numeric computed crypto edge or explicit live edge-gate wiring.

## Source and observability audit update — August 22, 2026

- Source review confirms filtered/analyzed candidate counts are logged only to console (`src/index.ts`) and are not persisted in `run_log`; durable count observability remains an explicit gap requiring a separate reliability work item.
- Source review confirms crypto enables `requireFeeTelemetry` and `requireCalibratedEdge`, while no production path assigns calibrated `rawEdgeBps`; positive crypto BUY admission therefore remains intentionally fail-closed. Do not derive an edge from confidence, fees, TA, sentiment, or any uncalibrated proxy.
- Current source submits crypto BUYs with `time_in_force: 'gtc'` and regression coverage confirms persistence. Historical live rows showing `day` remain a source/deployment identity discrepancy; no TIF or trading-behavior change is justified.
- Complete and older saved schedule artifacts disagree on three versus four crons, and the requested limited reconciliation artifact is absent. Treat saved artifacts as incomplete evidence, not as authorization to trigger or mutate production.

## Required follow-up

- **Owner:** Joachim.
- **Trigger:** restore a Wrangler-compatible authenticated Cloudflare deployment path and obtain a reproducible receipt tied to the exact validated 2.6.0 artifact and all four schedules.
- Then deploy only the reliability/observability correction if still required, and perform a separate GET-only verification of release identity, all six endpoints, filtered run aliases, broker-authoritative positions, equity direction, natural schedule delivery, lifecycle/accounting fields, fee freshness, crypto edge-gate observability, and unchanged caps.
- Observe natural daytrading and swing windows; do not trigger them for validation. Keep per-trade gross/fee/net null until deterministic fill/lot matching exists. Keep production **FAIL/DEGRADED** until the evidence and source-identity gaps are closed.

## Safety boundary

No trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating endpoint was called. No broker mutation or production deployment occurred during Control-6.

## Files modified

- `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-6.md`
- `README.md`
- `docs/OPERATIONS.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `/workspace/NOW.md`

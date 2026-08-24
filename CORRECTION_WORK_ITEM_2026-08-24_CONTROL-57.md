# CORRECTION WORK ITEM: Control-57

Date: Monday, August 24, 2026. Evidence capture: fresh strict GET-only production probes against `https://alpaca-trading-bot.joachim-763.workers.dev`. Disposition: **OPEN FAIL/DEGRADED**.

## Safety boundary

The control used only `GET /health`, `GET /api/config`, `GET /api/dashboard`, `GET /api/positions`, `GET /api/runs`, `GET /api/trades`, plus GET-only observability probes. Never call trigger, submit, cancel, close, replace, retry, or any broker-mutating endpoint. No deployment is authorized or performed by this work item unless separately permitted by the standing maintenance rule after validation and clean-artifact review.

## Confirmed production evidence

- All six required GET endpoints returned HTTP 200.
- Live `/health` reports `version=1.0.0`; live `/api/config` reports `version=2.4.0`. Local HEAD is `e805da1` and the tested local release is `2.6.0`, so active release/source provenance is unresolved.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Broker state remains authoritative; D1 is metadata-only.
- Live account equity is `98470.34` versus `last_equity=98504.5039`, a comparison delta of `-34.1639`; `change_today=0` and `change_today_pct=0`, so the comparison points down but does not independently establish intraday direction.
- Capital caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD. No cap or trading parameter is changed.
- Local `wrangler.toml` and dispatch code retain four schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at `:07/:37 UTC`, and reconciliation `*/10 * * * *`.
- Live reconciliation delivery is present near ten-minute cadence as `MAINTENANCE_ONLY`; crypto delivery is present near `:07/:37 UTC` and records fail-closed `FEE_DATA_UNAVAILABLE` skips. The returned page does not establish current daytrading freshness beyond carried-forward `MARKET_CLOSED` rows, and prior swing run `3182` remains an error with Cloudflare subrequest exhaustion and broker-authoritative sync absence evidence.
- Lease-held/error/skip evidence is structured locally, but current lease-held delivery is not proven absent from the live page.
- Live run probes `?code=MAINTENANCE_ONLY`, `?search=MAINTENANCE_ONLY`, and `?trigger_alias=reconcile_cron` returned the same unfiltered page; live rows omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`.
- Live trade probe `?status=filled` returned accepted rows, and `offset=10`/`page=2` repeated the first-page IDs. Lifecycle fields are exposed, but sampled `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; no values are fabricated.

## Correction scope

Local review confirmed a reliability defect in `src/crypto-strategy.ts`: the crypto lane still performs `syncBrokerLedger` and `reconcileBrokerOrders` even though the dedicated lease-protected maintenance lane owns bounded broker reconciliation. This duplicates broker fan-out and can consume Worker subrequest budget. Implement the smallest reliability-only correction by deferring duplicate crypto reconciliation to maintenance, preserving fail-closed crypto fee telemetry when the maintenance-fed summary is unavailable or stale, and preserving all caps, schedules, sizing, thresholds, edge-gate policy, order semantics, broker authority, and trading behavior.

The local source already contains the broker-authoritative position projection, four-lane leases, filtered run observability, stable pagination, lifecycle preservation, conservative accounting, and crypto calibrated-edge/fee fail-closed controls. Do not broaden this correction into a strategy or cap change.

## Validation and release gates

The correction must run focused tests covering the crypto maintenance boundary and edge/fee behavior, full `bun test`, `bun run typecheck`, and `git diff --check`. Update `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` with actual results, deployment state, known risks, and follow-ups.

Deployment is currently blocked by exact Wrangler state: `bunx wrangler whoami` returns `You are not authenticated. Please run \`wrangler login\`.` The repository worktree is dirty, so no dirty artifact may be deployed. If correction deployment is not possible, leave the exact blocker and an explicit authenticated clean-artifact follow-up. After any authorized deployment, perform a separate read-only verification of all six endpoints and the requested observability/accounting controls.

## Correction completed locally

Two reliability-only defects were corrected without changing caps, schedules, thresholds, sizing, signals, order semantics, trading behavior, or broker authority:

1. `src/crypto-strategy.ts` no longer imports or calls `syncBrokerLedger` or `reconcileBrokerOrders`; it records `RECONCILIATION_DEFERRED_TO_MAINTENANCE` and continues to fail closed when the maintenance-fed fee summary is missing or stale.
2. `Database.getRecentEquityHistory()` reads a bounded persisted account-equity window, and daytrading, swing, and crypto load it before evaluating rolling drawdown. `RiskManager` and `SwingRiskManager` retain only the last 20 valid observations.

The local regression contract now covers the crypto maintenance boundary, fee freshness, four schedules/dispatch, broker-authoritative positions, filtered run observability, lifecycle semantics, conservative accounting, and durable rolling drawdown.

## Validation receipt

- Focused: **88 tests / 391 assertions** across 8 files. Receipt: `/workspace/alpaca_control_57_focused.txt`.
- Full: **189 tests / 705 assertions** across 26 files. Receipt: `/workspace/alpaca_control_57_full.txt`.
- Typecheck: passed. Receipt: `/workspace/alpaca_control_57_typecheck.txt`.
- Diff check: passed. Receipt: `/workspace/alpaca_control_57_diff_check.txt`.

## Current state and deployment

The fresh live GET control remains **OPEN FAIL/DEGRADED**. All six endpoints returned HTTP 200, but live `/health=1.0.0` and `/api/config.version=2.4.0` remain older than local release 2.6.0 at HEAD `e805da1`. Live positions are broker-authoritative (`source=alpaca`, 29 rows); equity is `98470.34` versus `last_equity=98504.5039`; caps remain `5000/3700/2000 USD`. Reconciliation and crypto cadence are observed, but live filters, candidate fields, trade filtering/pagination, exact per-fill accounting, current daytrading/swing freshness, position freshness, and active schedule/source provenance remain unresolved.

Deployment was not performed. Separate GET-only live verification after the local correction still observed the old artifact: `/health=1.0.0`, `/api/config.version=2.4.0`, positions `source=alpaca` with 29 rows, equity `98459.78` versus `last_equity=98504.5039`, caps `5000/3700/2000`, reconciliation run `3248` at `06:10:49 UTC`, and crypto run `3247` at `06:07:54 UTC`. Run filters/aliases/candidate fields and trade status/pagination remained ignored or absent. `bunx wrangler whoami` returns exact blocker **`You are not authenticated. Please run \`wrangler login\`.`** The worktree is dirty, so no dirty artifact may be deployed. Required follow-up is authenticated provenance, clean immutable release review, separately authorized deployment only if still required, then separate GET-only post-release verification. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was used.

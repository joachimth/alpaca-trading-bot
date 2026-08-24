# CORRECTION WORK ITEM: Control-41

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - locally validated reliability release, production deployment blocked**.

## Strict read-only scope

The control used only GET requests against `https://alpaca-trading-bot.joachim-763.workers.dev/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filtered run/trade probes. No trigger, submit, cancel, close, replace, retry, migration, preview, deployment, or broker-mutating endpoint was called.

## Confirmed production defects and gaps

- Release identity is unresolved and stale: live `/health.version=1.0.0` and `/api/config.version=2.4.0`, while the checked-out validated source is `2.6.0` at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Wrangler independently reports `You are not authenticated. Please run wrangler login.`
- Broker-authoritative positions are available: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `$98,504.50` versus `last_equity=$98,504.5039`, with `change_today=0`; material current-day equity direction is therefore not verifiable from this snapshot.
- Caps remain exactly `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto. Local source retains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for the expected `:07/:37` cadence, and read-only reconciliation `*/10 * * * *`; deployed schedule provenance is not exposed or bound to the live release.
- Sunday crypto delivery is fresh around `:07/:37` UTC, including `03:07:58`, `03:37:56`, `04:07:55`, and `04:37:55`, with `errors=0` and `trades_executed=0`. Reconciliation is fresh through run `2936` at `04:50:49` as structured `MAINTENANCE_ONLY`. No fresh August 23 daytrading or swing delivery is proven; historical daytrading `CYCLE_LEASE_HELD` and swing position-divergence/`RISK_HALTED` skips remain visible.
- Live `/api/dashboard?strategy=crypto` and `?trigger=crypto_cron` return the same unfiltered dashboard as `/api/dashboard`, so dashboard filter observability is not live-proven. Live filtered `/api/runs` and `/api/trades` work, but the old response omits locally validated `trigger_alias` and durable analyzed/filtered candidate counts, and old trade offset pagination repeats the first slice.
- Filled trades expose lifecycle identifiers, quantities, broker timestamps, and terminal fields, but sampled exact `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Dashboard strategy fee totals conflict with those null per-trade fields, so exact populated accounting is **FAIL/CANNOT VERIFY**. Aggregate broker fee evidence exists, including symbol-less USD CFEE rows; it must not be forced into exact per-trade attribution.
- Crypto runs repeatedly report `FEE_DATA_UNAVAILABLE` and zero trades. The local correction includes valid symbol-less USD CFEE rows in aggregate telemetry while preserving the existing freshness/sample gates and calibrated raw-edge fail-closed gate; this behavior is not live-proven.

## Correction performed

No new runtime change was justified in this control. The already-prepared bounded reliability release remains the correction: broker-authoritative position projection, read-only API behavior, filtered-run aliases and durable candidate counts, distinct trade pagination, conservative lifecycle/accounting fields, symbol-less USD CFEE telemetry inclusion, and explicit calibrated crypto edge-gate wiring. These preserve caps and schedules, but the fail-closed fee/edge admission can conservatively suppress entries when evidence is unavailable, so it must not be described as having zero trading-behavior effect.

This control updates the correction record, `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md`. No caps, schedules, sizing parameters, broker authority, reconciliation write behavior, or broker state were changed.

## Validation

- Full local regression: `bun test`, captured at `/workspace/alpaca_control_41_full.txt`.
- Focused reliability/read-only regression: `bun test test/dashboard-readonly.test.ts test/order-reconciliation.test.ts test/broker-ledger.test.ts test/risk-fee-aware.test.ts test/audit-regressions.test.ts test/release-version.test.ts test/entry-position-authority.test.ts test/trades-executed-semantics.test.ts`, captured at `/workspace/alpaca_control_41_focused.txt`.
- Typecheck: `bun run typecheck`, captured at `/workspace/alpaca_control_41_typecheck.txt`.
- Diff check: `git diff --check`, captured at `/workspace/alpaca_control_41_diffcheck.txt`.
- Deployment authentication check: `bunx wrangler whoami`, captured at `/workspace/alpaca_control_41_wrangler_whoami.txt`, failed before mutation with `You are not authenticated. Please run wrangler login.`

## Deployment and explicit follow-up

The standing maintenance rule permits deploying this bounded reliability release, but deployment is required to resolve the live drift and cannot proceed without authenticated Wrangler access. Restore authentication, bind the exact source SHA `e805da1a4d83a8fa816ebe09c500a57fed5c9c24` to the deployment receipt, bundle/version, traffic, and all four schedules, then deploy only the validated artifact. After deployment, perform a separate GET-only verification of all six endpoints, dashboard/run/trade filters and pagination, broker position source, equity direction, unchanged caps, natural strategy/reconciliation delivery, crypto `:07/:37` cadence, lease/error skips, lifecycle fields, fee/gross/net semantics, and crypto fee/edge skip evidence; keep production OPEN FAIL/DEGRADED until those checks pass.

## Addendum: corroborating release audit

The completed repository/release audit independently corroborates the disposition. No exact active deployed source SHA is proven. Saved production schedule artifacts conflict: one records all four schedules while another omits reconciliation, so the active deployed schedule set is unresolved. A historical daytrading exposure snapshot of `$5,679.8784` exceeds the configured `$5,000` cap and requires separate attribution and direct live-enforcement verification; current displayed caps remain unchanged at `$5,000/$3,700/$2,000`.

Local crypto edge wiring is correctly fail-closed through `requireFeeTelemetry=true` and `requireCalibratedEdge=true`, but no calibrated `rawEdgeBps` producer or positive-edge production path is documented or proven. Exact fill-lot accounting, strategy attribution for broker-only positions/trades, and complete partial/cancel/replace/retry lifecycle coverage remain unresolved product/evidence gaps and are not to be papered over with inferred values.

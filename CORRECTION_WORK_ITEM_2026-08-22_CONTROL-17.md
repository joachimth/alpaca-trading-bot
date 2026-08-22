# CORRECTION WORK ITEM: Control-17

Date: 2026-08-22 UTC
Disposition: OPEN FAIL/DEGRADED. Documentation/status-only correction.

## Trigger
The 22:00 UTC strict read-only production control found all six required GET endpoints responding HTTP 200, but production identity and acceptance evidence remain unresolved. Live `/health` is `1.0.0`, persisted `/api/config.version` is `2.4.0`, and repository HEAD `1013f3dc979fd9b56a7cae1b843177bb3ab5f21f` is deployable version `2.6.0`.

## Evidence
- Positions: `positionsAvailable=true`, `source=alpaca`, 29 rows. Broker remains authoritative; D1 is metadata only.
- Equity: `98,504.50` versus `last_equity=98,504.5039`, delta about `-0.0039`; `change_today=0`, so material daily direction is unverified.
- Caps: exactly 5000/3700/2000 USD for daytrading/swing/crypto.
- Local/release schedules: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, `*/10 * * * *`; captured schedule responses disagree, so active four-schedule deployment identity is unverified.
- Reconciliation: fresh `MAINTENANCE_ONLY` run 2880 at `2026-08-22 21:50:51 UTC`, with bounded ledger context.
- Crypto: fresh runs at `21:07:57` and `21:37:56 UTC`, around expected `:07/:37`; entry skips remain fail-closed on fee telemetry and calibrated edge requirements.
- Daytrading/swing: no fresh Saturday weekday proof; newest filtered rows are daytrading run 2556 at `2026-08-20 21:55:24 UTC` with `CYCLE_LEASE_HELD`, and swing run 2200 at `2026-08-18 22:00:36 UTC` with divergence and `RISK_HALTED`.
- Trades: lifecycle fields are present; sampled filled rows have `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`.
- Filtered observability: canonical rows are returned, but live old output omits local response-only `trigger_alias`; analyzed/filtered counts are not persisted in `run_log`.

## Scope
No source, schema, capital-cap, schedule, edge-gate, accounting, broker-authority, or trading-behavior change is justified by this control. Update only release/status documentation and preserve the known gaps explicitly.

## Validation
Focused read-only regressions covering dashboard/position authority, release identity, audit regressions, skip reasons, fee-aware risk, entry authority, and crypto wiring passed **50 tests / 243 assertions**. The full `bun test` passed **168 tests / 584 assertions** across 25 files; `bun run typecheck` and `git diff --check` passed.

## Deployment and follow-up
Deployment is blocked until Wrangler authentication is restored and separately authorized. Do not use a temporary preview. After any authorized promotion, perform a separate GET-only verification of release identity, all six endpoints, caps, positions/source, equity direction, four schedules, filtered aliases, natural weekday daytrading/swing delivery, crypto cadence/edge gates, reconciliation freshness, lifecycle fields, fees, and gross/net semantics.

## Mutation boundary
This work item used no trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint.

## Final read-only verification

A separate GET-only snapshot was captured under `/workspace/alpaca-control-17-final-live-20260822T2205Z/`. It confirmed `/health=ok` version `1.0.0`, config version `2.4.0`, positions `source=alpaca` with `positionsAvailable=true` and 29 rows, caps `5000/3700/2000`, equity `98504.50` versus `last_equity=98504.5039`, fresh reconciliation run `2881` at `2026-08-22 22:00:57 UTC`, and filled trade lifecycle fields with conservative null gross/fee/net accounting.

# CORRECTION WORK ITEM: Control-18

Date: 2026-08-22 UTC
Disposition: OPEN FAIL/DEGRADED. Documentation/status-only correction.

## Trigger
The 23:00 UTC strict read-only production control returned HTTP 200 from all six required GET endpoints, but production remains degraded. Live `/health` reports version `1.0.0`, `/api/config.version` is `2.4.0`, and local deployable source HEAD `131898b9e4cab3544ae9b793123c1c86d5763cdc` is version `2.6.0`; active Worker/source identity is unresolved.

## Evidence
- `/api/positions`: `positionsAvailable=true`, `source=alpaca`, 29 rows. Broker positions remain authoritative; D1 is metadata only.
- Dashboard equity: `98,504.50` versus `last_equity=98,504.5039`, approximately `-0.0039`; `change_today=0`, so material equity direction cannot be verified.
- Caps are unchanged at `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto.
- Local source has all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, reconciliation `*/10 * * * *`. Active deployed four-schedule identity remains unverified.
- Fresh reconciliation delivery is present through run `2889` at `2026-08-22 23:00:53`, as structured `MAINTENANCE_ONLY` skips near ten-minute cadence.
- Fresh crypto delivery is present around `:07/:37`: runs `2882` at `22:07:57`, `2886` at `22:37:56`, and earlier matching runs, with structured skips.
- Daytrading is stale: filtered `daytrading_cron` returns canonical `cron` rows, newest run `2556` at `2026-08-20 21:55:24`, `CYCLE_LEASE_HELD`; no fresh 2026-08-21 or 2026-08-22 delivery is present.
- Swing is stale: newest known run `2200` at `2026-08-18 22:00:36`, with divergence and `RISK_HALTED`; no fresh weekday delivery is proven.
- Lease-held, risk-halted, provider-error, maintenance, fee-telemetry, no-position, and hold skips remain structured and visible.
- `/api/trades` returns 50 filled rows with broker order, submitted, filled, reconciliation, and terminal lifecycle fields. Sampled rows have `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`; exact fee/gross/net consistency cannot be verified.
- Live alias-filter responses return canonical rows but omit the locally validated response-only `trigger_alias`; analyzed/filtered candidate counts are not persisted in `run_log`.
- Local crypto wiring remains fail-closed on unavailable fee telemetry or missing calibrated `rawEdgeBps`; `crypto_min_edge_after_costs=8`. Live `FEE_DATA_UNAVAILABLE` skips confirm blocking behavior, but positive calibrated-edge producer evidence is unavailable.

## Scope and correction
No code defect was isolated. The required correction is documentation/status-only. Do not change source, schema, caps, schedules, broker authority, leases, accounting semantics, crypto edge gates, or trading behavior.

## Validation
Focused read-only/control regressions passed **78 tests / 327 assertions**. The full `bun test` passed **168 tests / 584 assertions**. `bun run typecheck` and `git diff --check` passed.

## Deployment and follow-up
`bunx wrangler whoami` reports the exact blocker **`You are not authenticated`**. Do not use a temporary preview. Restore authenticated Wrangler access, inspect active deployment provenance and schedule identity, obtain separate deployment authorization, deploy only if still required, then perform a separate GET-only verification of release identity, all six endpoints, filtered aliases, broker-authoritative positions, equity direction, all four schedules, natural weekday daytrading/swing delivery, crypto cadence and edge-gate evidence, lifecycle/accounting fields, and caps.

## Mutation boundary
This control and correction used no trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint.

## Separate live verification
A separate GET-only snapshot is preserved under `/workspace/alpaca-control-18-live-20260822T230209Z/`. It reconfirms the stale live identity, broker-authoritative positions, unchanged caps, fresh reconciliation/crypto delivery, stale daytrading/swing delivery, absent live `trigger_alias`, and unavailable per-fill accounting.

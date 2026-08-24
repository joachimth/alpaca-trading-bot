# CORRECTION WORK ITEM: Control-52

Date: Monday, August 24, 2026. Audit capture: around `2026-08-24T02:00Z`. Disposition: **OPEN FAIL/DEGRADED — strict read-only production control remains unresolved**.

## Strict read-only boundary

This control used only GET-only observation. The six required endpoints were `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; all six returned HTTP 200. No deployment, Wrangler deploy, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating action was performed. No broker state was changed.

## Captured live evidence

- `/health` reported `status=ok` and `version=1.0.0`.
- `/api/config` reported `version=2.4.0`, while the local release is `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Active Worker/source provenance is therefore unresolved.
- `/api/positions` reported `positionsAvailable=true`, `source=alpaca`, and 29 rows. The broker remains authoritative for the available position set.
- Observed account equity ranged approximately from `98497.23` to `98499.29`, versus `last_equity=98504.5039` and `change_today=0`. Reliable direction is ambiguous/degraded; this is not a healthy directional-control pass.
- Capital caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD.
- Local UTC schedule declarations remain unchanged: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37`, and reconciliation `*/10 * * * *`.
- Fresh crypto runs were observed at `01:07:55` and `01:37:55` UTC. Reconciliation was observed around its expected ten-minute cadence. Daytrading run `3180` was `MARKET_CLOSED`. Swing run `3182` ended `error` with 8 errors, including Cloudflare subrequest exhaustion.
- Structured skip/error history exists, but current `lease-held` delivery is not proven.
- Live run rows omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`. Live run `code`/`search` filters were ignored. The trade `status=filled` filter was ignored, and offset/page probes repeated IDs `645`, `644`, and `643`.
- Lifecycle fields exist, but sampled `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`.
- Local crypto fee/calibrated-edge fail-closed wiring and regressions pass locally, but the corrected behavior is not live-proven.

These observations keep production **OPEN FAIL/DEGRADED**, not healthy. HTTP 200 availability alone does not clear release identity, filtered observability, pagination, lease delivery, accounting, or live edge-gate provenance.

## Correction assessment

No additional runtime fix is justified by this control. Local source already contains the reliability corrections for:

- run and trade filters;
- bounded, stable pagination;
- broker-authoritative positions;
- lifecycle and conservative accounting;
- the reconciliation boundary that defers bounded maintenance work; and
- fail-closed crypto fee and calibrated-edge gates.

Those local corrections are not live-proven because the active release is still observed as `1.0.0`/`2.4.0` and the live API behavior remains the old/contradictory contract. This work item changes documentation and status only. It does not change runtime code, caps, schedules, sizing, thresholds, trading behavior, schema, broker state, deployment configuration, or any other runtime artifact.

## Local validation receipt

The supplied local validation record is:

- Focused validation: **87 passed, 388 assertions across 9 files**.
- Full validation: **184 passed, 678 assertions across 26 files**.
- Typecheck: **passed**.
- Diff-check: **passed**.

These are recorded validation results; this documentation-only update does not rerun tests or typecheck.

## Deployment and follow-up state

The exact blocker is the output of `bunx wrangler whoami`:

> `You are not authenticated. Please run \`wrangler login\``

The worktree is dirty. **Never deploy uncommitted files.** No deployment was performed and no broker mutation was performed.

Required follow-up, in order:

1. Restore authenticated, reproducible provenance and identify the active Worker/source artifact.
2. Establish a clean immutable commit containing only the separately authorized release artifact; never deploy a dirty worktree.
3. Obtain separate authorization for deployment, and deploy only if it is still required.
4. Perform a separate GET-only verification of all six endpoints, release identity, filters, pagination, broker-authoritative positions, accounting, caps, schedules, reconciliation, and crypto edge-gate evidence.
5. Observe a natural weekday swing run and verify that the subrequest-exhaustion failure is not repeated.

Until those gates are independently evidenced, production remains **OPEN FAIL/DEGRADED**, and no healthy claim is permitted.

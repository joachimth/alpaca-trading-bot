# CORRECTION WORK ITEM: Control-59

Date: Monday, August 24, 2026. Strict read-only production control captured around 08:01 UTC; latest reconciliation evidence is `2026-08-24 08:01:06 UTC`. Disposition: **OPEN FAIL/DEGRADED — documentation/status correction only**.

## Safety boundary

This correction records GET-only production evidence. No deployment, trigger, submit, cancel, close, replace, retry, migration, broker mutation, or external/broker endpoint call was performed. Runtime code, caps, schedules, thresholds, sizing, edge-gate policy, order semantics, and trading behavior are unchanged.

## Precise evidence

- All six required GET endpoints — `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` — returned HTTP 200.
- Live health is `1.0.0` and live config is `2.4.0`; local release is `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Active live artifact/source provenance is therefore unresolved and live deployment of the local release is not proven.
- `/api/positions` is broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows. Account equity is `98485.98`; latest snapshot is `98493.96`, both below `last_equity=98504.5039`, while broker daily fields remain zero.
- Capital caps are unchanged: `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`.
- Local source retains the exact four UTC schedules and dispatch: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron`; reconciliation `*/10 * * * *` → `reconcile_cron`.
- Fresh crypto runs were observed near `2026-08-24 07:07:54 UTC` and `07:38:11 UTC`; reconciliation was fresh at `08:01:06 UTC` as `MAINTENANCE_ONLY`. Current daytrading freshness and successful swing freshness are not proven. Historical swing run `3182` errored with Cloudflare subrequest exhaustion.
- Structured skip observability is present. No current `CYCLE_LEASE_HELD` row was observed, but lease absence is not treated as proof beyond the returned read-only data. Live run aliases, candidate counters, and run code/search/strategy/trigger filters are absent, ignored, or unproven; trade status filtering and pagination are likewise absent, ignored, or unproven.
- Trade lifecycle fields exist. Sampled filled rows retain `gross=null`, `fee=null`, and `net=null` under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Exact historical fee artifacts are not current per-fill truth and no values are fabricated.
- Local crypto fail-closed edge-gate behavior and regressions pass, but live deployment of that behavior is not proven. The prior Control-57 receipt discrepancy remains: documentation reported `189/705`, while the saved full receipt reported `184/678`.

## Correction disposition

No additional runtime fix is justified by this control. The disposition is documentation/status only, preserving the prior history and recording the current **OPEN FAIL/DEGRADED** state. No cap, schedule, threshold, sizing, edge-gate, order, lifecycle, accounting, deployment, or broker-state change was made.

## Deployment blocker and follow-up

The exact Wrangler blocker is: **`You are not authenticated. Please run \`wrangler login\`.`** The repository worktree is dirty, so no dirty artifact may be deployed. Follow-up: authenticate Wrangler, isolate a clean immutable artifact, deploy only if authorized under the standing reliability-maintenance rule, then perform separate GET-only verification and natural weekday swing observation.

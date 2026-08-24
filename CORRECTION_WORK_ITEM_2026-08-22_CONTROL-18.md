# CORRECTION WORK ITEM: Control-18

Date: 2026-08-22 UTC
Disposition: OPEN FAIL/DEGRADED. Documentation/status-only correction.

## Trigger

The **2026-08-22 23:00:16-23:00:17 UTC** production control was strictly read-only. GET requests to `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` all returned HTTP 200. Production remains **OPEN FAIL/DEGRADED, not healthy**: live `/health` version `1.0.0`, `/api/config` version `2.4.0`, local HEAD `131898b9e4cab3544ae9b793123c1c86d5763cdc`, and deployable version `2.6.0` leave active Worker/source identity unresolved.

## Evidence

- Positions: `positionsAvailable=true`, `source=alpaca`, count `29`; broker positions remain authoritative.
- Dashboard equity: `98504.50` versus `last_equity=98504.5039`, delta about `-0.0039`; `change_today=0`, so material direction cannot be verified.
- Caps are exactly `5000/3700/2000` USD for daytrading/swing/crypto.
- Local UTC schedules are daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; active deployed four-schedule identity remains unresolved.
- Fresh reconciliation runs `2888` at `22:50:50` and `2887` at `22:40:49` are structured `MAINTENANCE_ONLY`.
- Fresh crypto runs `2886` at `22:37:56`, `2882` at `22:07:57`, `2878` at `21:37:56`, and `2874` at `21:07:57` are around `:07/:37` with structured skips.
- The current Saturday page has no fresh daytrading or swing proof; historical lease/error/risk skips remain.
- `/api/trades` returns 50 filled rows with `submitted_at` and `filled_at` present, inapplicable terminal fields null, `gross`/`fee`/`net` all null, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`; aggregate arithmetic is not exact fill-lot proof.
- The live old response omits locally validated `trigger_alias`, and `run_log` lacks durable analyzed/filtered counts.
- Local source/test wiring for filtered aliases and the crypto fee/`rawEdgeBps` fail-closed gate passes; live positive calibrated-edge producer evidence is unavailable.
- Wrangler's exact blocker is **`You are not authenticated`**.

## Scope and correction

No code defect was isolated. This is a documentation/status-only correction. No trading/reliability code, configuration, capital cap, schedule, or edge-gate change is made. Existing broker authority, leases, lifecycle/accounting semantics, and fail-closed safety behavior remain unchanged.

## Required follow-up

Restore authenticated Wrangler access, inspect active deployment provenance and schedule identity, obtain separate deployment authorization, deploy only if required, then perform a separate GET-only verification of release identity, all six endpoints, caps, positions/source, equity direction, four schedules, natural weekday daytrading/swing delivery, crypto cadence and edge evidence, reconciliation freshness, lifecycle/accounting fields, aliases, and durable analyzed/filtered observability.

## Validation

Focused read-only/control regressions passed **78 tests / 327 assertions**. The full `bun test` passed **168 tests / 584 assertions**. `bun run typecheck` and `git diff --check` passed.

## Mutation boundary

This work item used no trigger, submit, cancel, close, replace, retry, migration, deployment, or broker mutation. Preserve the strict no-mutation boundary.

## Final read-only disposition

Keep production **OPEN FAIL/DEGRADED, not healthy** until authenticated provenance and separately authorized deployment, if required, are followed by independent GET-only verification. Do not rewrite prior control history; Control-18 records only the current status correction.

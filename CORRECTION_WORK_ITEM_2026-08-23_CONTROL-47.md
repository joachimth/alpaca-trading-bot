# CORRECTION WORK ITEM: Control-47

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - live release/API provenance and observability correction**.

## Trigger and live evidence

Strict GET-only control captured at `2026-08-23T22:00:47Z` against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; all returned HTTP 200. Production is not healthy or release-verifiable:

- `/health.version` is `1.0.0`; `/api/config.config.version` is `2.4.0`; local release is `2.6.0` at the current dirty worktree HEAD.
- Positions are available and broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows); account equity is `98504.50`, `last_equity=98504.5039`, `change_today=0`, with broader captured history downward.
- Displayed capital caps remain `5000/3700/2000` USD.
- Fresh daytrading delivery is structured `MARKET_CLOSED`; crypto delivery is present at `21:07:55` and `21:37:55 UTC`; reconciliation is present at `22:00:50 UTC` as `MAINTENANCE_ONLY`; Sunday provides no legitimate fresh swing window, while historical swing rows include position divergence and `RISK_HALTED`.
- Live runs omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; filtered run responses otherwise return rows, so local observability is not live-proven.
- Live trade pagination is broken or ignored: `offset=0`, `offset=10`, and `page=2` repeat IDs `642,641,640`; filled rows expose lifecycle timestamps and broker IDs, but sampled `gross`, `fee`, and `net` are null under `unavailable_fill_lot_exact`.
- Live crypto fee aggregate reports available telemetry while exact per-fill attribution remains conservatively unavailable; this is not treated as an arithmetic defect without deterministic fill-lot evidence.

## Required correction scope

1. Preserve and verify local broker-authoritative positions, four cron dispatches, leases, structured skip/error/degraded handling, conservative fee accounting, filtered run observability, and fail-closed calibrated crypto edge-gate wiring.
2. Correct or harden the local release/API projection so canonical version, run filter fields, and trade pagination have explicit regression coverage and cannot silently regress. Do not change caps, schedules, sizing, entry/exit behavior, or broker authority.
3. Update `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` with the exact live evidence, validation, deployment/provenance blocker, rollback/recovery path, and explicit next swing-window verification.
4. Run focused tests, full `bun test`, typecheck, diff/secret checks, and a separate GET-only live verification after local work. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint is permitted.

## Deployment decision and follow-up

Deployment is **not authorized/possible from the current state** until active Worker provenance is bound to the validated source and authenticated Wrangler access is restored. If deployment later becomes required under the standing maintenance rule, preserve the caps `5000/3700/2000`, use a rollback target, deploy once, and perform a separate GET-only post-release verification. Until then production remains **OPEN FAIL/DEGRADED**, and the next legitimate weekday swing schedule observation must be recorded separately.

# CORRECTION WORK ITEM: Control-28

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED — strict read-only control; no release or runtime change justified**.

## Scope and control boundary

Control-28 records the current production state only. The control used GET-only evidence from `/workspace/control-health.json`, `/workspace/control-api-config.json`, `/workspace/control-api-dashboard.json`, `/workspace/control-api-positions.json`, `/workspace/control-api-runs.json`, `/workspace/control-api-trades.json`, and the saved filtered probes under `/workspace/control-28-*.json` and `/workspace/control-_api_*.json`. No mutating endpoint, trigger, order, close, cancel, replace, retry, migration, preview, deployment, or broker mutation was used. No runtime, capital-cap, schedule, migration, configuration, or trading-behavior change is authorized or justified by this evidence.

## Exact live evidence

- All six required GETs — `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` — returned **HTTP 200**.
- Live identity is stale and unresolved: `/health` reports service `alpaca-trading-bot`, status `ok`, version **`1.0.0`**; `/api/config` reports version **`2.4.0`**; the checked-out local validated source reports **`2.6.0`** at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. A local version is not proof of active Worker identity.
- `/api/positions` is broker-authoritative and available: `source=alpaca`, `positionsAvailable=true`, and **29 rows**. Dashboard account evidence reports `equity=98504.50`, `last_equity=98504.5039`, and `change_today=0`; the approximately `-0.0039` difference is rounding-level and material current-day direction remains **unverified**.
- Dashboard `capitalCaps` and `/api/config` agree on unchanged caps: **5000 USD daytrading / 3700 USD swing / 2000 USD crypto**.
- The local `wrangler.toml` retains four UTC crons: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`. Live schedule identity remains unresolved because the old live response does not prove the checked-out schedule set.
- Fresh reconciliation is maintenance-only: filtered reconciliation evidence reaches run **2945** at **`2026-08-23 06:00:56` UTC**, with `status=skipped`, `decisions_made=0`, `trades_executed=0`, and structured `MAINTENANCE_ONLY`; run 2944 at `05:50:51` and the intervening ten-minute runs show the same maintenance contract. Fresh crypto filtered evidence reaches run **2942** at **`05:37:56` UTC** and run **2938** at **`05:07:55` UTC**, near the expected **`:07/:37`** cadence, with structured no-position skips and zero trades executed.
- Sunday, August 23, 2026 has no expected weekday daytrading or swing cron delivery. The filtered daytrading latest run is stale at **run 2556, `2026-08-20 21:55:24` UTC**, with `CYCLE_LEASE_HELD`; the filtered swing latest run is stale at **run 1236, `2026-08-11 22:01:17` UTC** (the separate swing probe also retains run 2200 at `2026-08-18 22:00:36` with position divergence and `RISK_HALTED`). Therefore no Sunday weekday daytrading/swing delivery proof exists.
- Historical error and lease/risk skips remain observable. The error probe includes Alpaca 503s at run **2803 (`2026-08-22 12:10:40`)** and **2802 (`2026-08-22 12:07:40`)**, plus a D1 `too many SQL variables` failure at run **2678 (`2026-08-21 20:38:00`)**. These are retained as historical evidence, not as justification for a new runtime change.
- The live filtered run responses remain old/unproven: filtered rows do not expose the locally corrected `trigger_alias` or durable `analyzed_candidates` / `filtered_candidates` fields. The read-only trade pagination probes at offsets **0, 30, and 60** each return the same 30 IDs **642..613**, so corrected pagination is not live-proven.
- Filled trade lifecycle fields exist in the 50-row live sample (`status=filled`, broker/client identifiers, quantities, and lifecycle timestamps including `submitted_at`/`filled_at`), but every sampled row keeps exact `gross`, `fee`, and `net` as **null** with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Exact fill-lot economics are unavailable; no inferred values are permitted.

## Local correction state

The checked-out local source contains the crypto edge-gate wiring and filtered observability corrections: explicit finite calibrated `rawEdgeBps` propagation with fail-closed missing-edge behavior, durable run candidate counters including the insufficient-TA early return, filtered-run alias serialization, corrected trade offset pagination, broker-authoritative positions, isolated leases, and conservative fee semantics. Relevant local wiring is present in `src/crypto-strategy.ts`, `src/api.ts`, and `src/database.ts`, with regression coverage; none of these corrections is live-proven while production remains `1.0.0`/`2.4.0` and deployment provenance is unresolved.

## Validation and deployment disposition

Local validation is required after this documentation update. Results are recorded in `/workspace/control-28-focused-tests.log`, `/workspace/control-28-full-tests.log`, `/workspace/control-28-typecheck.log`, `/workspace/control-28-diff-check.log`, and `/workspace/control-28-wrangler-whoami.log`.

Deployment is blocked by Wrangler authentication. No deployment occurred and no broker mutation occurred. The production disposition remains **OPEN FAIL/DEGRADED, not healthy**. Restore authenticated Wrangler access, then separately authorize and deploy only the already-validated artifact if required; tie any release receipt to the exact source and four schedules, and perform separate GET-only verification. Do not use trigger or broker-mutating routes as smoke tests.

## Acceptance status

**Documentation/status correction only.** No runtime, cap, schedule, migration, configuration, or trading-behavior change is justified. No broker mutation or deployment occurred.

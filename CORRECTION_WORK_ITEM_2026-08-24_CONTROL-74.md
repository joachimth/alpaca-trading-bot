# Correction work item: Control-74 strict read-only production control

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED**  
**Correction result:** local documentation/status alignment complete; deployment blocked

## Safety boundary

Only GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, with read-only filter and pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, external write, or broker-mutating endpoint was called.

## Current live evidence

- All six required endpoints returned HTTP 200 JSON.
- `/health`: `status=ok`, version **1.0.0**. `/api/config`: persisted config version **2.4.0**.
- Local deployable release: **2.6.0**, commit `cef5a4d826a12311c413fecacdf46cb23f2b63fa`.
- `/api/positions`: `positionsAvailable=true`, `source=alpaca`, 21 broker rows. Broker is authoritative; D1 is metadata only and broker failure must not fall back to D1.
- `/api/dashboard`: equity **98395.26** versus `last_equity=98504.5039`, down **109.2439 USD** by current-minus-last comparison; broker daily change fields are zero.
- Caps remain exactly **5000 / 3700 / 2000 USD**.
- Schedules remain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` near `:07/:37 UTC`, and reconciliation `*/10 * * * *`.
- Latest observed delivery: daytrading run **3387** (`MARKET_CLOSED`), crypto run **3381** (`FEE_DATA_UNAVAILABLE`, `DECISION_HOLD`), reconciliation run **3386** (`MAINTENANCE_ONLY`). Latest swing run is **3182** from **2026-08-23 22:01:16 UTC**, `error`, with Cloudflare subrequest exhaustion. No fresh successful swing run or live `CYCLE_LEASE_HELD` row is proven.
- Live run rows omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; `code=LEASE_HELD` and `search=LEASE` repeat the unfiltered page.
- Live trade strategy filtering is observed, but status/pagination metadata is absent and `offset=10` / `page=2` repeat the first page.
- Lifecycle fields are present. Filled rows conservatively expose `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`.
- Aggregate accounting recomputes as strategy gross **-241.468094** minus fees **272.320169** equals overall net **-513.788263**. This is not exact per-fill economics. Crypto fee telemetry is stale at `2026-08-18T09:37:52.56276Z` despite the legacy availability label, so fail-closed fee and calibrated-edge controls remain required.

## Correction and validation

The checked-out source already contains the needed reliability controls: broker-authoritative position projection with no D1 fallback, bounded lease-protected read-only reconciliation, structured skip/error and candidate-count observability, run/trade filters and pagination, lifecycle reconciliation, conservative accounting, unchanged caps/schedules, and fail-closed crypto fee/calibrated-edge admission. No further source change was justified, and no cap, schedule, config, migration, threshold, sizing, order-semantic, or trading-behavior change was made.

- Focused regressions: **86 tests, 362 assertions, 0 failures**.
- Full `bun test`: **204 tests, 775 assertions, 0 failures**.
- `bun run typecheck`: passed.
- `git diff --check`: passed.
- `bunx wrangler deploy --dry-run`: passed, **300.45 KiB** preview, no deployment.
- Required docs updated: `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md`.

## Exact blocker and follow-up

`bunx wrangler whoami` returns: `You are not authenticated. Please run wrangler login.` Active Worker provenance and deployment authorization therefore remain unresolved. Restore Wrangler credentials only through the secure credential flow, establish the active deployment/source identity and rollback receipt, obtain or confirm deployment authorization, deploy only the already-validated reliability artifact if authorized, then perform separate GET-only verification of release identity, broker-authoritative positions, equity direction, caps, all four schedules, natural daytrading/swing/crypto/reconciliation delivery, lease/error skips, filtered observability, lifecycle fields, accounting consistency, and crypto edge-gate wiring.

Until that follow-up completes, production remains **OPEN FAIL/DEGRADED**, not healthy.

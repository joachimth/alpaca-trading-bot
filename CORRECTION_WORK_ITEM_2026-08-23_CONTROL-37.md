# CORRECTION WORK ITEM: Control-37

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only; deployment blocked**.

## Scope and safety

This control used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus filtered run and disjoint paginated trade probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live evidence

- All six required production endpoints returned HTTP 200.
- Production identity is stale and unresolved: `/health` reports `version=1.0.0`, while `/api/config` reports `config.version=2.4.0`; the canonical local source release is `2.6.0` (`src/version.ts` / commit `e805da1`). The live API also does not expose the local `release_version` field. `bunx wrangler whoami` reports `You are not authenticated. Please run wrangler login.` and `CLOUDFLARE_API_TOKEN` is missing.
- `/api/positions` is broker-authoritative and available: `positionsAvailable=true`, `source=alpaca`, and 29 rows. The local authority contract remains intact: Alpaca supplies current quantity, price, value, and P&L; D1 is metadata-only and is not accepted as live fallback.
- `/api/dashboard` reports equity `98504.50`, `last_equity=98504.5039`, `change_today=0`, and `change_today_pct=0`. The observed performance history declined from `98525.19` at `2026-08-21 17:38:05` to `98504.50` at `2026-08-23 14:37:51`, but same-day direction is not informative from the live `change_today` fields.
- Live caps are unchanged at exactly `$5000` daytrading, `$3700` swing, and `$2000` crypto. Dashboard market values are approximately daytrading `$3355.5983`, swing `$3249.2831`, and crypto `$0`; direct enforcement and deployed-source provenance remain unresolved while the serving release is stale. No vital risk parameter changed.
- The local source declares all four UTC schedules in `wrangler.toml`: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for the expected `:07/:37` cadence, and reconciliation `*/10 * * * *`. Active deployed schedule provenance cannot be independently verified without authenticated Wrangler access.
- Fresh Sunday daytrading delivery is present through `2026-08-23 15:00:58 UTC` as `MARKET_CLOSED` skips. Sunday is not a weekday trading proof. Fresh reconciliation is present through `2026-08-23 15:00:59 UTC` as `MAINTENANCE_ONLY`, with `ledgerActivities=18`, one ledger page, `ledgerTruncated=false`, and `ledgerDegraded=false`.
- Fresh crypto delivery is present at `2026-08-23 14:07:57` and `14:37:56 UTC`, repeatedly landing approximately 55-58 seconds after `:07/:37`. Runs show fail-closed or no-action reasons including `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, `NO_POSITION_TO_EXIT`, and `DECISION_HOLD`; no positive-edge crypto BUY path is live-proven because ordinary calibrated `rawEdgeBps` production is not evidenced.
- Swing freshness fails: the latest filtered `swing_cron` row is `2026-08-18 22:00:36`, with position divergence and `RISK_HALTED`; no newer weekday swing delivery is visible in the required read-only data. An exact freshness SLA is not exposed. Historical `CYCLE_LEASE_HELD` evidence exists in prior stored run history, but this control does not exhaustively prove its current absence.
- Filled trade rows expose lifecycle and full-fill fields. Trade `642`, for example, has `qty=filled_qty=0.15`, `leaves_qty=0`, `time_in_force=day`, submitted/filled/broker-updated timestamps in order, and terminal cancel/expire/fail/replace fields null. Exact per-trade `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; aggregate gross/fee/net arithmetic reconciles where reported, but exact fill-lot economics cannot be verified.
- `/api/trades?limit=3&offset=0`, `offset=3`, and `offset=30` all return IDs `642,641,640`, confirming the old deployed pagination behavior. Filtered `/api/runs` responses omit the local `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` fields. These are live release/provenance gaps, not justification for changing accounting or trading behavior.

## Local source and regression evidence

- Broker-authoritative positions and no-D1-fallback behavior are implemented in `src/position-projection.ts` and `src/api.ts`.
- Filtered run parsing, aliases, deterministic SQL pagination, and durable candidate counters are implemented in `src/api.ts` and `src/database.ts`.
- Conservative trade accounting is implemented in `src/database.ts`; uncertain fill-lot economics remain unattributed rather than inferred.
- Crypto fee telemetry and calibrated raw-edge gates are fail-closed in `src/crypto-strategy.ts` and `src/risk-manager.ts`; confidence is not converted into edge.
- Local focused validation passed **72 tests / 331 assertions across 7 files**. Full `bun test` passed **178 tests / 632 assertions**. `bunx tsc --noEmit --pretty false` passed with no diagnostics, and repository-scoped `git diff --check` passed. No validation command triggered a cycle or broker mutation.

## Correction decision

The confirmed defect is stale/unresolved deployment provenance and the old live artifact not serving already-implemented safe read-only pagination and filtered-run observability. No new runtime correction is justified without changing release behavior or risking unverified trading semantics. Capital caps, schedules, leases, broker authority, sizing, accounting semantics, crypto edge admission, and trading behavior remain unchanged.

## Blocker and follow-up

Restore authenticated Wrangler access and establish the exact active Worker/source and cron provenance. Under the standing maintenance rule, deploy only the already-validated reliability artifact if deployment is authorized and required; do not use a temporary preview as production proof. After any authorized deployment, perform a separate GET-only verification of release identity, all six endpoints, broker-authoritative positions, equity direction, unchanged caps, all four schedules, natural weekday daytrading and swing delivery, crypto `:07/:37` cadence, lease/error skips, lifecycle fields, conservative fees/gross/net semantics, filtered run fields, and disjoint trade pages. Until that occurs, production remains **OPEN FAIL/DEGRADED, not healthy**.

No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred.

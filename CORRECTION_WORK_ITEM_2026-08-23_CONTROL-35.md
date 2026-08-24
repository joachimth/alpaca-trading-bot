# CORRECTION WORK ITEM: Control-35

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; local correction already present; deployment blocked**.

## Scope and safety

This control used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus filtered `/api/runs` and disjoint paginated `/api/trades` probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live evidence at approximately 2026-08-23 13:01 UTC

- All six required endpoints returned HTTP 200.
- Live identity is still stale/unresolved: `/health` reports version `1.0.0`, `/api/config.version` reports `2.4.0`, and `/api/config` omits `release_version`; the local validated release is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.
- Wrangler remains unauthenticated: `bunx wrangler whoami` returned `You are not authenticated. Please run wrangler login.` and no `CLOUDFLARE_API_TOKEN` is available. Active Worker/source and deployed-cron provenance therefore remain unverified.
- Positions are broker-authoritative: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 positions. The dashboard reports equity `$98504.50` versus `last_equity=$98504.5039`, a direct delta of about `-$0.0039`, but `change_today=0` and `change_today_pct=0`; material current-day equity direction remains unverified.
- Capital caps are unchanged at `$5000` daytrading, `$3700` swing, and `$2000` crypto. Local defaults, aliases, and sizing enforcement pass; direct live enforcement remains unverified because the serving release is unresolved. No vital risk parameter changed.
- Local source retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37`, and reconciliation `*/10 * * * *`. Deployed schedule identity cannot be independently confirmed without authenticated Cloudflare provenance.
- Fresh delivery is present for daytrading as run `3001` at `2026-08-23 13:01:00`, correctly skipped with `MARKET_CLOSED` and next open `2026-08-24T09:30:00-04:00`. Sunday, August 23, 2026 has no expected swing cron delivery because the configured swing schedule is weekdays at `22:00 UTC`; the latest filtered swing run remains stale/error-prone at run `2200` on August 18 with position divergence and `RISK_HALTED`.
- Fresh crypto delivery is present through run `2998` at `2026-08-23 12:37:57`, matching the `:07/:37` cadence. Its structured skips include `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, and `DECISION_HOLD`. Fresh reconciliation is present through run `3002` at `2026-08-23 13:01:00`, with `MAINTENANCE_ONLY`, `ledgerActivities=18`, `ledgerTruncated=false`, and `ledgerDegraded=false`.
- Lease/error observability remains visible: historical filtered daytrading run `2552` records `CYCLE_LEASE_HELD`; filtered swing run `2200` records a divergence error plus `RISK_HALTED`; filtered error queries expose prior Alpaca `503` and D1 `too many SQL variables` failures.
- Filled trade rows expose order IDs, full-fill quantities, TIF, submitted/filled/broker-updated/reconciled timestamps, and terminal lifecycle fields. All 50 sampled live rows have `gross`, `fee`, and `net` null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact per-fill economics remain unavailable by design. Aggregate crypto arithmetic is internally consistent where reported: `grossTotalPl - feesUsd = netTotalPl` within rounding, and total/account-level fee sums reconcile.
- A live pagination defect is confirmed: `/api/trades?limit=3&offset=0`, `offset=3`, and `offset=30` all return IDs `642,641,640`. Live filtered run responses also omit the local `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` annotations. These are not healthy-release proof.
- Additional live accounting/attribution gaps remain unexplained: trade `642` has filled notional `$39.2997` versus `estimated_value` `$39.230985`, a `$0.068715` difference; trades `597` (AFRM sell) and `568` (BBD sell) have null strategy and decision linkage. The API exposes no cap-utilization or cap-decision telemetry, and the unattributed MSTR position remains outside strategy enforcement proof.
- Dashboard strategy trade counts total 553 (`40 + 263 + 0 + 250`) while top-level `totalTrades` and `executedTrades` are 642, leaving 89 trades outside the strategy breakdown. This remains a coverage observability gap, not evidence for inferred attribution.

## Correction decision

The confirmed live defects are release/provenance drift and the old Worker artifact not serving the already-implemented local pagination and filtered-run observability corrections. No additional safe runtime code change is justified: local `src/api.ts`/`src/database.ts` already implement SQL `LIMIT/OFFSET`, filtered run metadata, conservative accounting, broker-authoritative positions, and fail-closed crypto edge wiring. Repairing live behavior requires deploying the validated artifact, which is blocked by missing Wrangler authentication and unresolved deployment authorization. No caps, schedules, leases, broker authority, accounting semantics, edge gates, sizing, or trading behavior were changed.

## Local validation

- Focused suites: **60 tests / 287 assertions across 8 files passed**.
- Full `bun test`: **178 tests / 632 assertions across 25 files passed**.
- `bunx tsc --noEmit` passed.
- `git diff --check` passed for the Alpaca repository.

## Blocker and required follow-up

Restore authenticated Wrangler access, reconcile active Worker/source and cron provenance, and obtain authorization under the standing maintenance rule before deploying the already-validated `2.6.0` reliability artifact. After any authorized deployment, perform a separate GET-only verification of release identity, all six endpoints, four schedules, fresh natural delivery, filtered aliases/candidate counts, disjoint trade pages, lifecycle ordering, fee/gross/net status, caps, and crypto edge-gate observability. Until then, production remains **OPEN FAIL/DEGRADED, not healthy**.

No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred.

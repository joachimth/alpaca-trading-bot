# CORRECTION WORK ITEM: Control-36

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only; deployment blocked**.

## Scope and safety

This control used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus filtered run and disjoint paginated trade probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live evidence

- All six required production endpoints returned HTTP 200.
- Live release identity remains stale and unresolved: `/health` reports `1.0.0` and `/api/config.version` reports `2.4.0`; local validated source is release `2.6.0` at commit `e805da1` and its version contract is not live-proven. Wrangler `whoami` reports `You are not authenticated. Please run wrangler login.` and no `CLOUDFLARE_API_TOKEN` is available.
- Positions remain broker-authoritative and available: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows; dashboard broker-derived aggregates use the same available position set. D1 is not accepted as live position authority.
- Equity direction is negative over the observed dashboard history: equity declined from `$98560.32` at `2026-08-21 15:37:56` to `$98504.50` at `2026-08-23 13:37:51`; the latest account also reports `last_equity=98504.5039`, `change_today=0`, and `total_pl≈-0.0039`, so the current-day direction field remains non-informative despite the observed historical decline.
- Capital caps are unchanged at exactly `$5000` daytrading, `$3700` swing, and `$2000` crypto. No vital risk parameter changed. Direct live cap-enforcement provenance remains unresolved while the serving release is stale; the unattributed MSTR exposure remains outside strategy-specific enforcement proof.
- Local `wrangler.toml` declares all four UTC schedules unchanged: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for approximately `:07/:37`, and reconciliation `*/10 * * * *`. Authenticated deployment provenance is unavailable, so the complete active deployed schedule set cannot be independently verified.
- Fresh Sunday delivery is present for daytrading as `MARKET_CLOSED` skips through `2026-08-23 14:01:02 UTC`; Sunday is not a weekday trading proof. Swing has no expected Sunday weekday cron delivery. Crypto runs are fresh near the expected cadence, including `13:07:57` and `13:37:58 UTC`, with decision-level `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, `NO_POSITION_TO_EXIT`, and HOLD skips and zero trades. Reconciliation runs are fresh at approximately ten-minute intervals through `14:01:02 UTC`, marked `MAINTENANCE_ONLY` with `ledgerActivities=18`, one ledger page, and `ledgerTruncated=false` / `ledgerDegraded=false`.
- Lease/error observability is present in stored live history: older daytrading runs recorded `CYCLE_LEASE_HELD`; swing history contains position divergence and `RISK_HALTED`; historical errors include Alpaca 503s, D1 `too many SQL variables`, and Cloudflare subrequest-limit failures. Current filtered responses still omit the local release's durable `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` fields.
- Filled trade samples expose lifecycle fields including broker order/client IDs, quantity and full-fill state (`filled_qty=qty`, `leaves_qty=0`), TIF, submitted, filled, broker-updated, and last-reconciled timestamps. Exact per-fill `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` with `fee_attribution=none-recorded`, so per-fill fee/gross/net consistency cannot be verified. Reported aggregate crypto accounting is arithmetically consistent where present (`grossTotalPl - feesUsd = netTotalPl` within rounding), but this does not replace exact fill-lot evidence.
- `/api/trades?limit=3&offset=0`, `offset=3`, and `offset=30` all return IDs `642,641,640`, confirming the old deployed pagination behavior. Local SQL pagination and filtered-run observability corrections are present but not live-proven.
- Local crypto risk wiring requires an explicit calibrated `rawEdgeBps` input and fails closed when unavailable. The repository contains no ordinary live producer proving calibrated raw edge for the current crypto runs, so no positive-edge crypto BUY path is proven; this is an intentional safety state, not a justification to infer edge from confidence or alter trading behavior.

## Correction decision

No new runtime/trading-code correction is justified by this control. The confirmed defects are stale/unresolved deployment provenance and the old live artifact not serving already-implemented safe reliability fixes for pagination and filtered run observability. The local 2.6.0 source already preserves broker-authoritative positions, isolated leases, all four schedules, unchanged caps, conservative fee accounting, and fail-closed crypto edge admission. Only documentation and status are corrected here.

## Validation

Validation completed after this record/update. Focused affected-area regressions passed **46 tests** with 0 failures; full `bun test` passed **178 tests / 632 assertions** with 0 failures; `bunx tsc --noEmit --pretty false` passed with exit code 0 and no diagnostics; and repository-scoped `git diff --check` passed. No test or validation command triggered a trading cycle or broker mutation.

## Blocker and follow-up

Restore authenticated Wrangler access and reconcile the active Worker/source and deployed cron provenance. Obtain the required deployment authorization under the standing maintenance rule, deploy only the already-validated reliability artifact if still required, then perform a separate GET-only verification of matching release identity, all six endpoints, broker-authoritative positions, equity direction, unchanged caps, all four schedules, fresh natural delivery, lease/error skips, crypto cadence and edge evidence, lifecycle fields, fee/gross/net semantics, filtered run fields, and disjoint trade pages. A natural weekday window must verify daytrading and swing delivery. Until then, production remains **OPEN FAIL/DEGRADED, not healthy**.

No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred.

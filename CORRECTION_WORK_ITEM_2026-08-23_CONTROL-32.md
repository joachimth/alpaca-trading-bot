# CORRECTION WORK ITEM: Control-32

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only**.

## Read-only scope

Only HTTP GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, plus filtered run and paginated trade GET probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live evidence

- All six required endpoints returned HTTP 200.
- Release provenance remains unresolved: live `/health` reports `1.0.0` and `/api/config.version` reports `2.4.0`; local validated release is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.
- Positions are broker-authoritative and available: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. The dashboard also reports broker-derived strategy values of approximately daytrading `$3355.5983`, swing `$3249.2831`, crypto `$0`, and unattributed `$1866.2625`.
- Equity is `$98504.50` versus `last_equity=$98504.5039`; the displayed delta is approximately `-$0.0039`, but `change_today=0`, so material current-day equity direction is not independently verifiable.
- Capital caps are unchanged and under observed strategy values: daytrading `$5000`, swing `$3700`, crypto `$2000`.
- Local `wrangler.toml` retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for `:07/:37`, and reconciliation `*/10 * * * *`. The complete deployed cron declaration is not independently exposed by the live API.
- Fresh crypto delivery is present at `2026-08-23 09:07:55` and `09:37:56` UTC, consistent with the expected `:07/:37` cadence. Fresh reconciliation delivery is present at `09:40:51`, `09:50:50`, and `10:01:02` UTC, with explicit `MAINTENANCE_ONLY` skips and `ledgerActivities=18`, `ledgerTruncated=false`, and `ledgerDegraded=false`.
- Sunday, August 23, 2026 has no expected weekday daytrading or swing cron delivery. Filtered daytrading remains stale at run `2556` from August 20 with `CYCLE_LEASE_HELD`; filtered swing has no fresh successful run, with run `2200` from August 18 ending in `RISK_HALTED` plus position divergence and run `1236` from August 11 skipped. Historical Alpaca 503 and D1 SQL-variable errors remain observable in stored run evidence.
- Live crypto run skips are explicit, including `NO_POSITION_TO_EXIT`; stored/live evidence also contains `FEE_DATA_UNAVAILABLE` and `CONFIDENCE_BELOW_THRESHOLD` skip categories. No natural positive-edge crypto BUY run is proven.
- Filled trade rows expose broker order IDs, quantities, filled quantities, status, TIF, broker update time, submitted time, filled time, and terminal lifecycle fields. Exact per-fill `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact`; this is conservative and not arithmetic fabrication.
- A separate unexplained lifecycle anomaly is present in imported trade `id=597`: `created_at` is later than its submitted, filled, and broker-updated timestamps. This needs follow-up before lifecycle ordering can be considered fully healthy.
- Aggregate accounting is internally consistent within rounding: crypto gross `-56.616426000004` minus crypto fees `269.11016882811` equals crypto net `-325.72659482810997`; total strategy net is `-331.17464582810993`, with account-level fees `3.21` and total recorded fees `272.32016882811`.
- Live filtered run responses return the canonical trigger but omit the local release's expected `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` annotations. Live trade offsets `0`, `3`, `10`, `20`, `30`, and `60` repeat IDs `642..640`, confirming the old deployed pagination behavior.
- Stored schedule evidence is inconsistent: one live schedule artifact exposes only three schedules while local source/metadata declare four; reconciliation run cadence is visible, but the authoritative active schedule set is not.
- A prior stored daytrading snapshot showed market value `5679.8784` against the unchanged `$5000` cap. Current observed daytrading value is below cap, but historical cumulative cap enforcement remains unresolved and must not be “fixed” by changing the cap or trading behavior.
- Local source contains the filtered-run/candidate-count observability correction, broker-authoritative position failure path, conservative accounting, and calibrated crypto `rawEdgeBps` fail-closed wiring. These corrections are not live-proven while production serves the unresolved `1.0.0`/`2.4.0` identity; no production caller supplying calibrated raw edge and no natural positive-edge run is proven.

## Correction decision

The only authorized correction is documentation/status-only. No source, schedule, cap, database, lease, broker-authority, accounting, edge-gate, sizing, or trading-behavior change is justified from this control. The conflicting schedule artifact and historical daytrading cap overage remain explicit follow-ups, not accepted behavior. The lifecycle anomaly is recorded as an explicit follow-up rather than “fixed” by rewriting historical timestamps or weakening ordering semantics.

Required follow-up: restore authenticated Wrangler access, reconcile exact Worker/source provenance, obtain deployment authorization, deploy only the already-validated reliability artifact if still required, then perform a separate GET-only verification of release identity, all six endpoints, filtered aliases and candidate counts, disjoint trade pagination, position freshness/source, caps, four schedules, crypto edge evidence, lifecycle ordering, and aggregate accounting. A natural weekday window must verify daytrading and swing delivery.

## Validation and blocker

This docs/status correction updated `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md`; it did not alter runtime code. Focused validation passed **67 tests / 321 assertions** across 6 files; full `bun test` passed **178 tests / 632 assertions** across 25 files; `bunx tsc --noEmit` and `git diff --check` passed. Separate post-correction GET-only verification returned all six endpoints HTTP 200 and reproduced live health `1.0.0`, config `2.4.0`, positions `source=alpaca`/`positionsAvailable=true` with 29 rows, caps `5000/3700/2000`, fresh crypto/reconciliation runs, stale daytrading/swing run evidence, absent live aliases/candidate counts, and repeated trade IDs `642..640` at offsets `0` and `30`. Wrangler verification remains blocked by the exact result: `You are not authenticated. Please run wrangler login.`; the environment has no `CLOUDFLARE_API_TOKEN`. No deployment or broker mutation occurred.

**Acceptance: production remains OPEN FAIL/DEGRADED, not healthy.**

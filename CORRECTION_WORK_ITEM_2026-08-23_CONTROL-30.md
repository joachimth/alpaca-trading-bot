# CORRECTION WORK ITEM: Control-30

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - local correction validated, production deployment blocked**.

## Read-only evidence

- Only GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, plus filtered/paginated GET probes. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.
- All six required endpoints returned HTTP 200. Live `/health` reports `1.0.0`; live `/api/config` reports persisted `version=2.4.0`. The checked-out release is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`, so active Worker provenance remains unresolved.
- `/api/positions` is broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows. D1 remains metadata-only in the local authority path, and broker failure is fail-closed rather than a D1 fallback.
- Dashboard account is ACTIVE/USD with equity `98504.50`, `last_equity=98504.5039`, `total_pl≈-0.0039`, and `change_today=0`; the sign is directionally negative versus the last snapshot, but material current-day direction is not independently verifiable from the zero `change_today` field.
- Capital caps remain unchanged at `$5000` daytrading, `$3700` swing, and `$2000` crypto. Current broker-derived strategy values are approximately daytrading `$3355.5983`, swing `$3249.2831`, and unattributed `$1866.2625`; no cap breach is asserted because the cap contract is strategy-specific and unattributed exposure is not assigned to a strategy.
- Local `wrangler.toml` retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` (`:07/:37`), and reconciliation `*/10 * * * *`; local dispatch tests pass. Live crypto delivery is fresh at `07:07:57`, `07:37:56`, `08:07:57`, and `08:37:57` UTC, and reconciliation is fresh through run `2968` at `08:50:51`.
- Sunday, August 23, 2026 has no expected weekday daytrading or swing cron delivery. Filtered daytrading is stale at run `2556` on August 20 with `CYCLE_LEASE_HELD`; filtered swing is stale at run `1236` on August 11, with run `2200` retaining divergence and `RISK_HALTED` evidence. Historical Alpaca 503, D1 variable-limit, and subrequest errors remain visible.
- Live crypto run `2966` at `08:37:57` delivered 8 decisions and 0 fills with structured `NO_POSITION_TO_EXIT` skips. Earlier live crypto evidence includes `FEE_DATA_UNAVAILABLE` and `CONFIDENCE_BELOW_THRESHOLD`; numeric edge-after-costs values are not exposed in the live GET responses, but local crypto edge gating is fail-closed and tested.
- Filled trades expose order ID, client order ID, quantity, filled quantity, leaves quantity, status, TIF, broker update time, submitted/filled timestamps, and terminal timestamps. Sampled exact per-fill `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; aggregate crypto gross/fee/net arithmetic remains internally consistent and conservative.
- Live `/api/runs?trigger=daytrading_cron` and `/api/runs?trigger=reconciliation_cron` return canonical triggers without the local release's expected `trigger_alias` annotation. Live `/api/trades?offset=0`, `10`, and `20` repeat IDs `642..633`, confirming the old deployed trade-pagination behavior.

## Correction update

The independent audit found no additional run-filtering defect: filtered `/api/runs` preserved trigger/status filters and offset pagination. It did confirm that the live artifact cannot independently prove exact fill-lot accounting, numeric edge-after-costs calculations, broker-position freshness, or cap scope for unattributed exposure.

No safe runtime patch was applied: exact `gross`/`fee`/`net` values must not be invented, missing numeric edge inputs must remain fail-closed, broker authority must remain unchanged, and position stop/take values must not be synthesized from stale or absent metadata. The local 2.6.0 source remains the validated correction artifact; production still serves the older unresolved release.

## Correction and validation

- The local 2.6.0 source already contains the bounded reliability fixes: stable trade pagination, filtered-run alias mapping, durable analyzed/filtered candidate counts including crypto insufficient-TA early returns, broker-authoritative positions, conservative accounting fields, and calibrated crypto edge-gate wiring. No new trading-code change is justified by this control.
- Updated `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and both status notes with this Control-30 disposition, evidence, and follow-up. Vital caps, schedules, broker authority, leases, accounting semantics, and trading behavior were not changed.
- Focused validation: 64 tests / 282 assertions passed across dashboard/run/trade observability, authority, schedules, edge gates, fees, and caps. Full validation: 173 tests / 603 assertions passed across 25 files. `bunx tsc --noEmit` passed; `git diff --check` passed.
- Deployment verification is blocked exactly by Wrangler: `You are not authenticated. Please run wrangler login.` The non-interactive environment also lacks `CLOUDFLARE_API_TOKEN`. No temporary preview or deployment was attempted.

## Acceptance / follow-up

**Production remains OPEN FAIL/DEGRADED, not healthy.** The remaining gaps are blocked by stale live provenance and unavailable broker evidence, not accepted as healthy behavior. Restore authenticated Wrangler provenance, obtain the required deployment authorization, deploy only the already-validated reliability artifact if still required, then perform a separate GET-only verification of release identity, all six endpoints, filtered aliases/candidate counts, disjoint trade pages, caps, schedules, fresh runs, lifecycle fields, and aggregate accounting. Keep a natural weekday window for daytrading/swing delivery verification. 

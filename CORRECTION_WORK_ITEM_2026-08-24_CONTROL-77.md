# Correction work item: Control-77 strict read-only production control

**Date:** Monday, August 24, 2026, with live records through Tuesday, August 25, 2026 00:01:15 UTC  
**Disposition:** **OPEN FAIL/DEGRADED** for live production; **LOCAL VALIDATED**  
**Scope:** strict GET-only production control and documentation/status correction

## Safety boundary

This control used only GET requests to `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filter and pagination probes on those same endpoints. No trigger, submit, cancel, close, replace, retry, migration, deployment, external write, or broker-mutating endpoint was called. Capital caps remain exactly **5000 / 3700 / 2000 USD**; schedules, thresholds, sizing, fee policy, edge policy, order semantics, and trading behavior were not changed.

## Exact current source and live evidence

The deployable repository is `/workspace/alpaca-trading-bot`, branch `fix/remove-premature-position-upsert-entryside`, exact checked-out HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`, release **2.6.0** from `src/version.ts` and `package.json`. The branch ref and `git rev-parse HEAD` agree at this commit. `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` identify this exact HEAD.

All six approved live endpoints returned HTTP 200 JSON. Live `/health` reports version **1.0.0** and `/api/config` reports persisted version **2.4.0**, so the active Worker is not source-tied to the current local release. `bunx wrangler whoami` is blocked by the exact credential error: `You are not authenticated. Please run \`wrangler login\`.` No deployment was attempted.

`/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and **21** rows. Broker positions are authoritative for the observed current position set; D1 is not used as a live fallback. Dashboard account equity is **98390.96 USD** versus `last_equity=98504.5039 USD`, a downward difference of **113.5439 USD**. The latest snapshot is **98399.76 USD** at `2026-08-24 23:38:13 UTC`, versus the earlier performance baseline **98504.50 USD** at `2026-08-23 17:37:48 UTC`.

## Caps and schedules

The live config exposes exact caps: `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`. The checked-out `wrangler.toml` exposes the unchanged four schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for the intended **:07/:37 UTC** cadence, and reconciliation `*/10 * * * *`.

Filtered live crypto records show the configured **:07/:37 UTC** cadence with seconds-level completion jitter: recent runs include `21:38:16`, `22:08:18`, `22:38:16`, `23:08:20`, and `23:38:18`, with older records at `07:07:54` and `07:38:11`. Crypto cadence therefore **PASSES**; the completion timestamps are not exact to the second but remain aligned to the configured half-hour schedule. Daytrading delivery is evidenced by run **3407** at `2026-08-24 21:55:47 UTC` with structured `MARKET_CLOSED`; reconciliation delivery is fresh through run **3425** at `2026-08-25 00:01:15 UTC` with bounded `MAINTENANCE_ONLY` context; the latest swing run **3409** at `2026-08-24 22:01:37 UTC` is `error` with Cloudflare **Too many subrequests**, so swing delivery is **FAIL/DEGRADED**.

## Observability, skips, and crypto edge gate

Runs expose structured skip/error detail. Reconciliation rows include `brokerOrders`, `ledgerActivities`, `ledgerPages`, `ledgerPageBudget`, `ledgerTruncated=false`, and `ledgerDegraded=false`. Crypto run **3422** at `2026-08-24 23:38:18 UTC` records `FEE_DATA_UNAVAILABLE` twice and `CONFIDENCE_BELOW_THRESHOLD` once; the live config has `crypto_min_edge_after_costs=8`, and the checked-out source carries calibrated-edge and fee fail-closed logic. Positive live calibrated edge admission is not proven: no computed edge value or threshold-decision field is exposed in the live records, and crypto fee telemetry is insufficient/stale (`cryptoFeeSampleCount=1`, `cryptoFeeAsOf=2026-08-18T09:37:52.56276Z`, status `insufficient`).

Lease skip behavior is implemented and locally tested, but live lease observability **FAILS/CANNOT VERIFY**: `code=CYCLE_LEASE_HELD` and `search=LEASE` both return the same latest unfiltered-looking page beginning at run 3425. The same behavior is seen for `code=FEE_DATA_UNAVAILABLE`; trigger and strategy filters work, but code/search filtering is not reliable on the live artifact. The source has durable `analyzed_candidates`/`filtered_candidates` and read-only strategy/status/code/search/pagination handling, but the live old artifact does not prove all of those fields.

The dashboard reports **$8,938.576216** current swing market value for 21 open swing positions, while the prior captured dashboard aggregate was **$8,943.86301**. Against the unchanged **$3,700** swing cap, this is a live cap-control **FAIL** if the cap governs total current gross swing exposure. Historical category snapshots also exceeded the cap, reaching **$8,924.01** and **$8,938.58**. Do not correct this by changing the cap, resizing positions, or issuing broker actions during this control.

## Trade and accounting findings

`/api/trades` returns 50 rows: **47 filled** and **3 accepted**. Lifecycle fields are present, including broker order IDs, submitted/filled timestamps, filled and remaining quantities, and reconciliation/terminal fields. Every inspected row retains `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact per-fill economics remain unavailable and are correctly not invented.

The dashboard aggregate is arithmetically consistent: swing gross/net **-169.051566**, crypto gross **-56.616426** less crypto fees **269.11016882811** equals crypto net **-325.72659482811**, daytrading gross/net **-20.104746**, and total net **-518.09290682811** equals gross **-245.772738** less total fees **272.32016882811**. This does not establish exact per-fill attribution. Live `status=accepted` and `status=filled` probes return the same mixed page, and `offset=0&limit=3` and `offset=3&limit=3` both return IDs **703, 702, 701**, so live trade filtering and pagination are **FAIL/DEGRADED**.

Further live contradictions are present: dashboard recent decisions include `executed=2` with an execution reason describing a skip, while the corresponding run reports `trades_executed=0`; dashboard `unattributedUsd` equals all fees although crypto fees are separately labeled broker-attributed; and accepted trades 701-703 have persistence timestamps later than their submission timestamps. These relationships are unexplained and remain observability **DEGRADED** findings. The 22:01:37 swing run also recorded accepted EOG/HON exits and a PLD failure while the current positions still contain those symbols, so final exit resolution is not proven.

## Correction decision and validation

No source, config, cap, schedule, migration, trading-behavior, or deployment correction is justified by this read-only evidence. The checked-out source already contains broker-first position projection with no D1 fallback, bounded read-only reconciliation, lease protection, structured skips/errors, durable candidate counters, lifecycle persistence, conservative accounting, read-only filters/pagination, and crypto fail-closed fee/calibrated-edge gates. The live defects are consistent with deployment drift and an older active artifact, not a proven local defect with a safe minimal fix. The final filtered audit confirms crypto `:07/:37` cadence and strategy/trigger filters, but code/search filters, trade status/offset filters, live lease proof, positive calibrated-edge proof, exact per-fill accounting, and current crypto trade delivery remain unresolved.

The required documentation and workspace status were updated to this exact Control-77 evidence. Focused regressions passed **100 tests / 370 expect() calls** across 11 files. Full `bun test` passed **204 tests / 775 expect() calls** across 26 files. `bun run typecheck` exited 0 and `git diff --check` passed. No source/config/cap/schedule/trading-behavior change was made.

## Explicit follow-up blocker

Restore Wrangler authentication through the secure credential flow, establish exact Worker/source provenance and deployment authorization, deploy only the already-validated reliability artifact if separately authorized by the standing maintenance rule, then perform a separate GET-only post-release verification. The existing hourly follow-up `864e3971-0655-4d0f-ac81-95ba66595335` remains the explicit recheck for swing delivery, crypto cadence/edge evidence, live filters/candidate counters, lifecycle/accounting proof, cap enforcement, and release identity.

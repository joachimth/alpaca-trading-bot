# Control-87 strict read-only Alpaca production control

Date: 2026-08-25 UTC (probes ~11:00 UTC / 09:00 UTC server clock)
Verdict: OPEN FAIL/DEGRADED
Scope: read-only GET-only control plus documentation update; no code change, no deployment

## Safety boundary

Only GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, including same-endpoint filter and pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, external write, or broker-mutating endpoint was called.

## Live evidence (2026-08-25 ~09:00 UTC server / ~11:00 UTC CPH)

- `/health`: HTTP 200, service `alpaca-trading-bot`, version `1.0.0`.
- `/api/config`: HTTP 200, persisted version `2.4.0`; caps exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, `crypto_max_capital_usd=2000`; `crypto_min_edge_after_costs=8`.
- `/api/dashboard`: HTTP 200; equity `$98,492.42`, `last_equity=$98,386.6243`, positive delta `$105.7957`; `change_today=0`, `change_today_pct=0` (equity-direction fallback not present on live API account/dashboard); `market_value=$9,040.54`; latest snapshot id `871` at `2026-08-25 08:38:12 UTC` equity `$98,487.06`, positions_count `21`; stats totalDecisions `6464`, totalTrades `703`, executedTrades `700`, winRate `23.636%`.
- `/api/positions`: HTTP 200; `positionsAvailable=true`, `source=alpaca`, 21 broker rows. Broker-authoritative. PASS.
- `/api/runs`: HTTP 200; latest run `3471` reconcile_cron `08:51:11 UTC` MAINTENANCE_ONLY (brokerOrders 3, ledgerActivities 111, ledgerPages 2, no truncation/degradation); crypto run `3469` at `08:38:19 UTC` with 7 decisions / 0 trades, structured skips FEE_DATA_UNAVAILABLE (BTCUSD x4), CONFIDENCE_BELOW_THRESHOLD (BCHUSD x2), DECISION_HOLD (DOTUSD); reconciliation runs every ~10 min. PASS for reconciliation and structured skip observability.
- `/api/trades`: HTTP 200; trades `703/702/701` are `accepted` with `filled_qty=0` (swing run 3409 exhaustion artifacts from 2026-08-24 22:01 UTC); trade `700` WMT sell `filled` at `106.472`; sampled per-fill `gross`, `fee`, `net` remain null with `accounting_status=unavailable_fill_lot_exact`, conservatively avoiding unsupported lot matching. PASS for conservative accounting; CANNOT VERIFY exact fill-lot economics.

## Filter and pagination probes

- Run `status=filled`: returned empty runs array (plausible - no runs carry status `filled`). Inconclusive.
- Run `code=FEE_DATA_UNAVAILABLE`: returned run `3471` which is MAINTENANCE_ONLY, not FEE_DATA_UNAVAILABLE. Filter ignored - returns unfiltered first page. FAIL.
- Run `search=MAINTENANCE`: returned run `3471` MAINTENANCE_ONLY (matches, but cannot distinguish filtering from first-page coincidence). Inconclusive.
- Trade `status=filled`: returned trade `703` which is `accepted`, not `filled`. Filter ignored. FAIL.
- Trade `offset=10`: returned trade `703` (same as offset 0). Pagination broken. FAIL.
- Trade `page=2`: returned trade `703` (same as page 1). Pagination broken. FAIL.

Filtered observability is NOT production-equivalent. The local source implements correct filters/pagination (src/api.ts, src/database.ts), but the live Worker predates those corrections.

## Schedule and cadence

- Local four-schedule wiring unchanged: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, reconciliation `*/10 * * * *`.
- Reconciliation delivery observed every ~10 min (runs 3467-3471). PASS.
- Crypto completions around `:08/:38`; exact `:07/:37` event delivery not proven (stored timestamps are completion/logging times). CANNOT VERIFY exact cadence.
- Fresh successful daytrading delivery: NOT proven (no daytrading runs in latest window; daytrading is weekday 13-21 UTC). CANNOT VERIFY.
- Fresh successful swing delivery: NOT proven; latest swing run `3409` (2026-08-24 22:01:37 UTC) failed with Cloudflare subrequest exhaustion. FAIL.

## Cap and exposure

- Caps 5000/3700/2000 USD unchanged and correct in live config. PASS.
- Swing market_value `$9,040.54` exceeds swing cap `$3,700` and global cap `$5,000`. Historical accumulated exposure, not a source defect under this control. The local source treats unattributed broker exposure conservatively in swing cap checks (src/swing-risk.ts). Requires no trading mutation here.

## Crypto edge gate

- `crypto_min_edge_after_costs=8`, `requireFeeTelemetry=true`, `requireCalibratedEdge=true` in local source.
- Live crypto BUYs fail closed with FEE_DATA_UNAVAILABLE (fee telemetry insufficient). PASS for fail-closed behavior.
- No normal producer of `rawEdgeBps` found in `technical-analysis.ts`; AI refinement only propagates existing edge. Unresolved reliability/strategy-operability defect; no behavior change authorized here.

## Repository identity

- Actual checked-out HEAD: `383f82350408931ac1d9eb18d0dfef9a18df13bd` (docs-only: "docs: finalize Control-86 provenance").
- Code-bearing commit: `ce58d018585200af00032e5d624d6c989c2178fe` ("fix: harden read-only Alpaca observability").
- Branch: `fix/remove-premature-position-upsert-entryside`. Release: `2.6.0`.
- `main` ref: `cfdee6438db5a9da360f880a1fdeaa60ff7593f3`.
- Docs (README/OPERATIONS/RUNBOOK) pin `ce58d018` as the code-bearing commit and acknowledge later docs-only commits. The absolute HEAD `383f8235` is a docs-only commit, consistent with the documented convention.
- Wrangler: unauthenticated ("You are not authenticated. Please run `wrangler login`."). Source-to-Worker provenance unresolved.

## Local validation

- `bun test`: 217 pass / 0 fail / 816 expect() calls across 28 files. PASS.
- `bun run typecheck`: exit 0. PASS.
- `git diff --check`: clean. PASS.
- Worktree: clean (no uncommitted changes).

## Verdict and disposition

Production remains **OPEN FAIL/DEGRADED**. The live Worker reports `1.0.0`/`2.4.0` against local release `2.6.0`; deployment identity is unproven; Wrangler is unauthenticated. Live filter/pagination defects, swing subrequest exhaustion, and null per-fill economics persist on the older deployed artifact. No code change is warranted - the local source already contains the reliability corrections; the live defects are deployment drift. No deployment is performed (Wrangler blocked, no explicit deployment authorization).

## Required follow-up

1. Restore secure Wrangler authentication.
2. Establish exact Worker/source provenance (which commit/version is deployed).
3. Obtain explicit deployment authorization from Joachim.
4. Deploy the already locally validated reliability artifact (ce58d018).
5. Perform separate GET-only post-deployment verification: identity, all four schedules, natural daytrading/swing/crypto/reconciliation delivery, filters, lifecycle/accounting, cap semantics, crypto edge telemetry.
6. Observe a natural weekday swing run without renewed subrequest exhaustion.
7. Resolve the missing `rawEdgeBps` producer for crypto strategy operability (separate authorized change).

## August 22, 2026 Control-3 correction: filtered runs, release identity, and evidence gaps

Additional control evidence keeps production **FAIL/DEGRADED**: `/workspace/alpaca-live-schedules-api.json` has only three schedules and omits reconciliation, while `/workspace/alpaca-post-release-schedules.json` and current `wrangler.toml` contain all four configured expressions. Filtered/analyzed counts are console-only and not persisted in `run_log`; per-trade gross/net remain conservatively null until deterministic fill/lot matching, and aggregate strategy gross/net must not be interpreted as fill/lot exact because it uses broker-snapshot unrealized/realized values plus fees. Source contracts pass for broker-authoritative positions, structured skip logging, unchanged caps, filtered-run predicates, and fail-closed crypto edge gates, but live proof remains partial or failed for active schedule identity, fresh daytrading/swing success, exact cadence, complete lifecycle scenarios, direct cap enforcement, production `rawEdgeBps`, and source-to-Worker identity. No cap, schedule, broker-authority, edge-gate, or trading behavior change was made.

## August 22, 2026 Control-3 correction: filtered runs and release identity

Production control found a release/version mismatch: live `/health` reports `1.0.0` and live `/api/config` reports `2.4.0`, while the deployable source reports `2.6.0`. An earlier capture also showed `/api/runs` filter loss; fresh post-attempt GET probes now return correctly filtered rows, but the corrected source is still not live-proven. The local reliability-only correction is present in `src/api.ts`, `src/database.ts`, and `src/version.ts`; it preserves broker-authoritative positions, all four schedules, caps of **$5,000/$3,700/$2,000**, crypto calibrated-edge fail-closed behavior, and trading semantics.

The required correction work item is `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-3.md`; production remains **FAIL/DEGRADED** until deployment and separate GET-only verification succeed. Deployment evidence is contradictory: `/workspace/alpaca-control/final-deployments.json` records `f181f9c3...` at `2026-08-21T21:03:38Z`, while `/workspace/alpaca-control/direct-upload-5bb8153-20260822.json` records direct-upload deployment `b6293793...` modified at `2026-08-22T01:14:22Z`; neither reconciles with live `1.0.0/2.4.0`, so both are historical artifacts rather than active source proof. No broker-mutating endpoint or trading trigger was used.

## August 22, 2026 release-version observability correction — source-to-Worker identity unresolved

The canonical local release version is **`2.6.0`**, established by the deployable source's `schema.sql` `bot_config.version` seed and the existing dashboard footer. `package.json`, local Worker health code, the dashboard release marker/footer, and the version regression agree on `2.6.0`, but live `/health` remains `1.0.0` and live `/api/config` remains `2.4.0`. Saved deployment receipts claim successful historical uploads, including `f181f9c3...` and a later direct-upload artifact `b6293793...`, but they do not reconcile with live identity or prove which source is active. This remains a reliability-only observability correction: no trading logic, schedules, caps, edge gates, broker calls, D1 mutation semantics, or endpoint methods changed.

Focused validation for this correction: `bun test test/release-version.test.ts test/dashboard-readonly.test.ts crypto-runtime.test.ts` — **26 tests passed, 154 expect() calls**. Full `bun test` — **157 tests passed, 518 expect() calls**; `bunx tsc --noEmit` passed; repo-scoped `git diff --check -- .` passed; and `bunx wrangler deploy --dry-run --outdir /tmp/alpaca-trading-bot-version-dry-run` passed with a 281.23 KiB upload preview and no deployment. Deployment was attempted but blocked because Wrangler requires `CLOUDFLARE_API_TOKEN`; no broker-mutating endpoint was used for this work.

Production remains **FAIL/DEGRADED**, not healthy. Existing unresolved gaps remain: no fresh successful daytrading or swing run is proven, direct cap enforcement is not exercised for all strategies, crypto delivery commonly lands at `:08/:38` rather than exact `:07/:37`, exact fill-lot accounting remains unavailable, and historical subrequest/position-divergence evidence remains open. The prior August 22, 2026 deployment receipt is historical evidence only and does not represent this local correction as deployed.

## August 21, 2026 strict read-only Alpaca control — FAIL/DEGRADED (latest)

**Status: FAIL/DEGRADED, not healthy.** Final separate GET-only verification completed at approximately **23:01 UTC**. No trigger, cycle, submit, cancel, close, replace, retry, deployment, or other broker-mutating route was used for this control.

- All six required GET endpoints returned **HTTP 200**: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`.
- `/api/positions` returned `positionsAvailable: true`, `source: alpaca`, and **29 positions**. Final dashboard equity was **98,552.09**, above `last_equity` **98,270.0927**, confirming positive equity direction.
- Caps remain unchanged at **$5,000 daytrading / $3,700 swing / $2,000 crypto**. Source, release-bundle, and dry-run evidence preserve all four schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and read-only reconciliation `*/10 * * * *`, all UTC.
- Filtered run observability and alias wiring pass source, bundle, regression, and prior live checks: `daytrading_cron` maps to stored `cron`, and `reconciliation_cron` maps to stored `reconcile_cron` without rewriting history. Current run evidence still does not prove a fresh successful daytrading or swing strategy run; historical daytrading lease-held/error skips remain.
- Reconciliation delivery is fresh and read-only: the latest run at **23:01:01 UTC** was `reconcile_cron`, `MAINTENANCE_ONLY`, with `ledgerPages=1`, `ledgerPageBudget=5`, `ledgerTruncated=false`, and `ledgerDegraded=false`.
- Crypto cadence is approximately the expected **:07/:37 UTC** schedule, with natural runs at **21:08:11, 21:38:05, 22:08:04, and 22:38:04 UTC** completing as structured skips with zero errors. Earlier natural crypto runs at **19:38:03, 20:08:01, and 20:38:00 UTC** failed with `D1_ERROR: too many SQL variables`; older evidence also records Worker subrequest-limit failures.
- The SQL-variable failures at **18:08, 18:38, 19:08, 19:38, 20:08, and 20:38 UTC on August 21, 2026** are pre-release history, before the recorded **21:03:38 UTC** batching release. Fresh post-release crypto runs through **03:38 UTC on August 22** show no recurrence; retain the historical errors as risk evidence, not as a newly active failure.
- `/api/trades` exposes lifecycle fields including `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at`; all sampled current rows are `filled` with submitted/filled timestamps and null inapplicable terminal timestamps. All 50 sampled rows have `gross`, `fee`, and `net` as `null`, `accounting_status: unavailable_fill_lot_exact`, and `fee_attribution: none-recorded`, so per-trade fee/gross/net consistency is not demonstrable.
- Crypto edge-gate wiring passes source, deployed-bundle, and regression checks, including calibrated-edge fail-closed behavior; a live positive `rawEdgeBps` comparison remains unproven. Fee telemetry is currently unavailable/stale, producing expected fail-closed `FEE_DATA_UNAVAILABLE` skips.
- Full regression passed **154/0** with **488 assertions**; focused dashboard/read-only regression passed **9/0** with **76 assertions**; TypeScript, `git diff --check`, and Wrangler dry-run passed.
- Cap audit: configured values are unchanged and observed daytrading exposure remained below $5,000, but direct cap-denial/enforcement evidence for daytrading, swing, and crypto is absent. An unattributed MSTR broker position of approximately **$1,901.48** prevents complete strategy attribution; crypto history showed zero observed positions, so the $2,000 cap was not exercised.
- Additional live-evidence gaps: schedule captures disagree between three and four configured expressions, the requested snapshot has no schedule artifact or response headers, and no current-window delivery evidence proves the stock `*/5` or weekday `22:00` paths. Crypto delivery is approximately :07/:37 but commonly records :08/:38 jitter; current crypto history includes `FEE_DATA_UNAVAILABLE` skips and zero observed crypto positions.
- Final release review confirms the bounded/read-only design and deployed wiring, but the bounded ledger page budget does not eliminate total Worker subrequest exhaustion in historical live runs. Further partitioning requires a separate reliability work item; exact fill-lot matching is also still required before non-null per-trade gross/fee/net can be claimed.
- The captured trade page contains only 50 filled rows, so non-filled lifecycle paths are unverified; daily `change_today`/`daily_pl` fields are zero despite fluctuating equity history, limiting independent daily-direction validation. Reconciliation is repeatedly `MAINTENANCE_ONLY`, and historical lease/subrequest failures remain unresolved evidence.
- Release/live mismatch remains explicit: checked-in four-schedule wiring and run aliasing pass source and regression checks, but live crypto timestamps show minute-level jitter rather than exact :07/:37 delivery, historical crypto and reconciliation runs include fatal subrequest-limit errors, per-trade accounting remains null/unavailable_fill_lot_exact despite aggregate gross/net, and fresh successful daytrading and swing delivery is still absent.

**Required follow-up:** repair read-only Cloudflare credentials and independently verify the active Worker/source identity; obtain fresh natural daytrading and swing strategy delivery evidence; and close the deterministic fill/lot accounting gap before any health claim. Keep production marked FAIL/DEGRADED.

## August 21, 2026 D1 SQL-variable correction deployed and post-release verified

Reliability-only correction `f5fddcbe829a4b6a6436b110ab0d19e3ab11c5aa` batches read-only `broker_fees` enrichment queries in groups of 50, removing the production `too many SQL variables` failure without changing caps, schedules, thresholds, sizing, order behavior, or broker authority. Focused validation passed 9 tests / 76 assertions; full validation passed 154 tests / 488 assertions, typecheck, diff-check, and Wrangler dry-run.

Direct Cloudflare upload succeeded on **August 21, 2026 at 21:03:38 UTC** as deployment `f181f9c3-4c72-4854-8173-fe88e0ed8cb1`, Worker version `84069389-3596-49b4-98dd-795c694e8d19`, at 100% traffic, annotated with the correction commit. Live settings retain D1 `2bc505a2-d744-4322-8c3b-5f5ebe35f9a1`, `nodejs_compat`, and all four schedules: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`.

Separate GET-only verification after the first natural post-release crypto tick at **2026-08-21 21:08:11 UTC** returned a structured `crypto_cron` skip with 5 decisions and 0 errors; the prior SQL-variable failure did not recur. No trigger or broker-mutating endpoint was used.

Production remains **FAIL/DEGRADED, not healthy** because daytrading lease/error delivery, fresh swing success, cadence jitter, null or incomplete lifecycle evidence, aggregate-only gross/fee/net accounting, unattributed exposure, and live calibrated `rawEdgeBps` comparison remain unresolved. Caps remain **$5,000/$3,700/$2,000**.

## August 21, 2026 D1 SQL-variable overflow correction — locally validated, source identity unresolved

Confirmed production defect: `/api/runs` showed a D1 `too many SQL variables` error at **2026-08-21 18:38:03 UTC**. Source inspection traced the overflow to the read-only trade observability enrichment used by API/scheduled reads: `enrichTradeAccounting()` built one `broker_fees.order_id IN (?, ...)` list from every returned trade, then bound the entire list at once.

Smallest safe fix: batch order IDs into read-only groups of **50** before querying `broker_fees`, preserving fee semantics, broker authority, reconciliation bounds, schedules, thresholds, sizing, order behavior, and caps of **$5,000/$3,700/$2,000**. Local validation passed: focused dashboard-readonly **9 tests / 76 assertions**, full `bun test` **154 tests / 488 assertions**, typecheck, diff-check, and Wrangler dry-run. The current local candidate is **not proven live**.

A separate deployment artifact confirms deployment `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b`, Worker version `a23c13a1-6b61-4c03-aae9-738d35118af9`, at 100% traffic on **August 21, 2026 at 17:15:44 UTC**. However, the artifact does not establish that this deployment contains the current local batching correction or current source commit; prior docs also contain conflicting deployment receipts. Therefore the release state is **SOURCE-TO-WORKER IDENTITY UNRESOLVED**, not “not deployed” and not “verified live.” The missing Cloudflare credential reference and unauthenticated Wrangler identity still block independent deployment verification. No broker-mutating endpoint was called. Follow-up is identity/credential repair, exact bundle-to-Worker verification, then separate GET-only checks and natural scheduled evidence.

Test-layout note: crypto runtime regression coverage is stored at the repository root as `crypto-runtime.test.ts`, not `test/crypto-runtime.test.ts`; `bun test crypto-runtime.test.ts` passes 14 tests / 48 assertions.

## August 21, 2026 strict read-only control update — FAIL/DEGRADED

The latest GET-only control confirms source labeling but not full broker-authoritative consistency: historical runs recorded internal-versus-broker quantity mismatches for SOFI (73 vs 114 at 16:10:47 UTC), MSTR (3 vs 7 at 16:20:46 UTC), and NOW (1 vs 2 at 16:35:42 UTC). Daytrading remains lease-held/error without fresh healthy delivery, swing delivery is not verified, crypto has cadence gaps and errors, reconciliation is maintenance-only, sampled lifecycle and gross/fee/net fields remain null, and live calibrated edge-after-costs evidence is unavailable. Caps remain $5,000/$3,700/$2,000 and no broker-mutating endpoint or deployment was used.

## August 21, 2026 additive trade observability correction — deployed and GET-only verified

Reliability-only correction deployed from published commit `71aad14b0df1fc693de0e002e1b91d5cb6460eb5`. It preserves broker `time_in_force` on persisted trades, including crypto `gtc`; exposes `/api/trades` fields `gross`, `fee`, and `net` with explicit `accounting_status` and `fee_attribution`; leaves gross/net null until deterministic fill/lot matching exists; exposes a fee only for complete non-negative USD broker-fee rows linked directly by `order_id`; and records bounded broker-ledger truncation as top-level run status `degraded`. Caps remain **$5,000/$3,700/$2,000**, all four schedules, thresholds, sizing, submitted order behavior, and broker safety boundaries are unchanged.

Validation passed: **153 tests / 483 assertions**, `bunx tsc --noEmit`, `git diff --check`, and fresh Wrangler dry-run. Direct Cloudflare upload succeeded as deployment `061b8e22-184d-4c46-8f54-2bf0c4682dc8`, Worker version `07c901cc-d936-4bb8-a7e9-8dc6689b0fa3`, at 100% traffic; the upload used the exact bundle built from the published commit and retained all four schedules. Separate GET-only verification on August 21, 2026 confirmed HTTP 200 for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; positions remained `source: alpaca` with 29 rows, equity remained above `last_equity`, and caps remained 5000/3700/2000. Filtered run and trade endpoints also returned the new observability fields.

Production remains **FAIL/DEGRADED, not healthy**. Fresh daytrading success and swing delivery are still not proven, historical subrequest-limit errors and broker/internal quantity divergence remain in run history, filled historical rows still have null lifecycle timestamps where Alpaca/D1 supplied no reliable values, crypto fee telemetry remains unavailable in current skips, calibrated `rawEdgeBps` is still not supplied by a production caller, and unattributed broker exposure limits complete cap-enforcement attribution. No trigger, submit, cancel, close, replace, retry, or other broker-mutating endpoint was used.

## August 21, 2026 additive trade observability correction — release candidate

This reliability-only correction preserves broker-reported `time_in_force` on persisted trades, including crypto `gtc`, and exposes conservative `/api/trades` accounting fields: `gross`, `fee`, and `net`. Gross and net remain `null` with `accounting_status: unavailable_fill_lot_exact` until deterministic fill/lot matching exists; `fee` is populated only for a complete, positive-USD broker-fee set linked directly by `order_id`, while orderless or uncertain fees remain `null` and account-level fees are not assigned to trades. Bounded broker-ledger truncation now persists the top-level run status `degraded` rather than understating it as skip-only. No cap, schedule, threshold, sizing, order, or strategy behavior changed; caps remain **$5,000 daytrading / $3,700 swing / $2,000 crypto**.

Focused tests passed: **19 tests / 37 assertions**. Full regression, TypeScript, diff-check, and Wrangler dry-run are required before release. Deployment and separate GET-only verification remain pending; production remains **FAIL/DEGRADED**, with fresh daytrading/swing delivery, historical lifecycle population, calibrated crypto-edge evidence, full cap enforcement attribution, and fill/lot-exact gross/net still open.

## August 21, 2026 additive per-trade accounting and crypto TIF observability correction

`GET /api/trades` now preserves every existing trade field and adds `gross`, `fee`, and `net` plus explicit attribution/status metadata. Gross and net remain `null` when D1 cannot prove a single trade/lot attribution; the existing model P&L is not projected onto order rows. `fee` is populated only from `broker_fees` rows with a non-empty matching `order_id` and complete non-negative USD values. Orderless or account-level fees remain unattributed and are never assigned to a trade. `net` is computed only when both gross and fee are known. This is read-only observability and does not change caps, schedules, thresholds, sizing, submitted orders, or trading behavior.

The same correction persists the broker-provided `time_in_force` on `trades`, including crypto `gtc`; the submitted TIF and all execution behavior are unchanged. Historical rows remain null only where the broker/D1 record did not provide reliable evidence. Validate field presence, linked-fee-only behavior, conservative nulls, account-level fee exclusion, and crypto GTC persistence before any release.

## August 21, 2026 bounded broker-ledger subrequest correction — deployed and post-release verified

The confirmed failing path is addressed: scheduled `syncBrokerLedger` now uses `getAccountActivitiesBounded` with an explicit **5-page / 500-activity request budget** instead of the prior 30-page loop. A page-budget hit returns `truncated: true, degraded: true`, emits structured `BROKER_LEDGER_DEGRADED` observability in scheduled run details, and relies on the existing 3-day overlap plus idempotent activity IDs so later schedules converge without broker mutation. Pending read-only `getOrder` reconciliation lookups remain capped at 8 per invocation. All four schedules, trading decisions, order behavior, and caps **$5,000/$3,700/$2,000** are unchanged.

Focused entry-authority, bounded ledger/activity, and reconciliation validation passed: **24 tests / 90 assertions**. Full `bun test` passed: **149 tests / 470 assertions**; `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run` also passed. Direct upload of commit `656cefd1b647c4127e01ddfbebaa8a451e80bd0b` succeeded as Cloudflare deployment `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b`, Worker version `a23c13a1-6b61-4c03-aae9-738d35118af9`, at 100% traffic. Separate GET-only verification returned HTTP 200 for all six endpoints; the first post-release reconciliation at `2026-08-21 17:21:00 UTC` completed with `ledgerPages: 1`, `ledgerPageBudget: 5`, and `ledgerDegraded: false`. Production remains **DEGRADED, not healthy**: fresh daytrading/swing success is still absent, sampled lifecycle and per-trade gross/fee/net fields remain null or absent, and cap enforcement is configured but not fully proven. Post-release crypto delivery is now verified at `2026-08-21 17:38:12 UTC` as a structured skip with no subrequest error; the run recorded `NO_POSITION_TO_EXIT` and `DECISION_HOLD`. No trigger or broker-mutating endpoint was used.

## August 21, 2026 strict read-only production control and alias-correction status

The `/api/runs` trigger-alias correction and bounded dashboard/lifecycle correction are deployed and separately GET-only verified. Cloudflare version/deployment `45d067bc-1944-4041-ae8e-0f7fc261dd55` serves source commit `30b605ff4bbbb86a60d67a9fb4f4a58d0cbb0be1`; the correction makes dashboard aggregates consistent with broker positions, counts all broker positions in every shared snapshot writer, normalizes submitted orders, and preserves broker lifecycle timestamps during read-only reconciliation. Caps, schedules, thresholds, sizing, and trading behavior are unchanged. The API alias maps `daytrading_cron` to stored `cron` and `reconciliation_cron` to stored `reconcile_cron`.

Local validation for this correction passed: focused dashboard/lifecycle/broker/snapshot regressions **25 tests / 104 assertions**, full `bun test` **138 tests / 422 assertions**, `bunx tsc --noEmit`, and `git diff --check`. Direct deployment and separate GET-only live verification were completed; the August 21, 2026 post-release GET audit confirms all six required endpoints return HTTP 200, positions are broker-authoritative with `source: alpaca` and 29 rows, dashboard `account.market_value` is `$8,494.11`-equivalent from the broker position set, `latestSnapshot.positions_count` is 29, caps remain `$5,000/$3,700/$2,000`, and equity direction is positive. Production remains **DEGRADED, not healthy**: fresh daytrading and swing success is not proven, lease/error/fee skips are present, lifecycle timestamps remain null in the sampled historical trades, per-trade gross/fee/net fields are absent, crypto edge comparison is not live-proven, and one crypto cadence gap remains documented. No trigger, order, cancel, close, replace, retry, or broker-mutating endpoint was used.


## August 21, 2026 bounded Alpaca lifecycle-timestamp correction — deployed and read-only verified

This additive reliability correction persists the existing Alpaca `Order` lifecycle fields `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at`. New imports and read-only reconciliation preserve each incoming non-null timestamp monotonically without changing trading behavior, edge-gate behavior, schedules, sizing, or caps, which remain **$5,000 daytrading / $3,700 swing / $2,000 crypto**.

Validation passed: **123 tests / 361 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. Remote D1 now contains all six additive columns; the release is live as deployment `6ef8737a-85ca-4fbb-8886-c938237dc993`, version `5ff1ee08-bdc1-46b7-9aa6-93962d25beb4`, at 100% traffic, with all four schedules. A separate post-deployment GET-only verification at **11:04:24–11:04:25 UTC on August 21, 2026** returned HTTP 200 for all six endpoints; `/api/positions` remained broker-backed (`source: alpaca`, 29 positions), and `/api/trades` exposes all lifecycle fields. The six nullable lifecycle fields are exposed and populated only when Alpaca supplies non-null values; historical rows remain null in the sampled data. Production remains **DEGRADED**, not healthy, because fresh daytrading/swing success is still unverified and prior swing history contains errors.

## August 21, 2026 swing-cap correction

The confirmed swing admission gap is corrected locally. Swing BUY checks now carry approved cycle-level entry notional into subsequent checks, so current broker-backed swing exposure plus planned entries cannot exceed the unchanged **$3,700** cap; exhausted headroom is recorded as structured `CAPITAL_CAP` observability. Exits, protective behavior, thresholds, turnover/minimum-size behavior, daytrading, crypto, and all vital caps remain unchanged.

Validation passed on August 21, 2026: focused swing/risk/cap/skip/pagination tests, full suite **115 tests / 346 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. The correction is deployed and separately read-only verified. Commit `d9c8ec6fd0315980549078169c3e2d69986700d0` is live as Cloudflare deployment `602cdd72-1a49-4db5-bd86-898efea14315`, Worker version `7b20c401-fe15-41e5-ac71-a8d798e8112d`, at 100% traffic. All four schedules and all six GET endpoints passed; no broker-mutating endpoint was used.

Known remaining gaps remain explicit: crypto positive-edge BUYs fail closed as `EDGE_CALIBRATION_UNAVAILABLE` because no production caller supplies calibrated `rawEdgeBps`; several broker lifecycle timestamps and crypto GTC `time_in_force` are not fully persisted; P&L remains model/gross-style plus conservative attributed fees rather than fill/lot-exact accounting; and fresh natural post-release strategy/reconciliation success is still required before health can be declared.

## August 21, 2026 targeted swing-cap correction — local validation status

The confirmed swing multi-entry cap gap is corrected locally. Each approved swing BUY now reserves its proposed notional before the next `checkEntry` call, so the unchanged **$3,700** `swing_max_capital_usd` cap is enforced across all proposed entries in one cycle even when broker positions remain unchanged. Turnover control remains a turnover/minimum-size filter; it no longer serves as the cap guard. Exits, protective behavior, caps, thresholds, and strategy budgets are unchanged.

Required validation before any release decision: run `bun test test/risk-fee-aware.test.ts`, `bun test`, `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. Do not use trading triggers or broker-mutating endpoints. The correction is deployed as Cloudflare deployment `602cdd72-1a49-4db5-bd86-898efea14315`, Worker version `7b20c401-fe15-41e5-ac71-a8d798e8112d`, at 100% traffic with all four schedules present. Separate GET-only verification passed all six endpoints; natural post-release evidence remains required.

## August 21, 2026 strict read-only production control, 08:02:29 UTC (historical receipt)

Result: **DEGRADED, not healthy**. All six required GET endpoints returned HTTP 200, but fresh successful daytrading and swing runs have not yet been observed in the current August 21 UTC cycle, and the live history contains explicit lease-held and error skips.

- `/api/positions` returned 29 positions with `positionsAvailable: true` and `source: "alpaca"`; broker values are authoritative and D1 contributes metadata only.
- Equity direction was positive at the check: account equity `$98,439.92` versus last equity `$98,270.0927` (`+$169.8273`); the latest snapshot rose from `$98,417.98` at 07:07:31 UTC to `$98,439.21` at 07:37:32 UTC.
- The four checked-in schedules and dispatch paths remain exact: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37`, and reconciliation `*/10 * * * *`.
- Fresh crypto delivery was observed at `2026-08-21 07:37:34` UTC with 7 decisions, 0 trades, 0 errors, and structured `NO_POSITION_TO_EXIT` plus `FEE_DATA_UNAVAILABLE` skips. Reconciliation delivered `MAINTENANCE_ONLY` runs through `08:00:31` UTC; `07:20:24` recorded an explicit `CYCLE_LEASE_HELD` skip. The latest daytrading success remains `2026-08-20 16:25:42` UTC, while the latest swing history is an error at `2026-08-18 22:00:36` UTC; no August 21 daytrading or swing success can be expected before their scheduled UTC windows.
- The 50 returned trade rows expose `client_order_id`, `filled_qty`, `leaves_qty`, `avg_fill_price`, `status`, `broker_updated_at`, and `last_reconciled_at`, but all six lifecycle timestamps (`submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, `replaced_at`) are null in the sample.
- `/api/dashboard` exposes aggregate strategy gross/fee/net arithmetic, while `/api/trades` exposes no per-trade gross, fee, or net fields. These dashboard values are model/ledger aggregates—not fill-exact per-trade accounting—and fresh crypto runs also record `FEE_DATA_UNAVAILABLE`.
- Live caps remain configured at daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`; runtime enforcement is covered by tests but not fully proven by this read-only sample. A historical August 10 daytrading exposure of `$5,679.878` remains a prior-release defect record.
- Filtered `/api/runs` observability passed for the visible trigger families and exposes structured skips. Crypto edge-gate wiring is present in source and tests, but the live sample only proves fee-telemetry gating and does not exercise or expose the configured post-cost edge comparison.

No code, cap, strategy, or deployment mutation was required for this control correction. The follow-up remains natural scheduled evidence and a future reliability correction for the documented gaps; no trigger, submit, cancel, close, replace, retry, or broker-mutating endpoint was called.

## August 21, 2026 bounded `/api/runs` trigger-alias observability correction — deployment blocked

This local, read-only observability correction addresses a false evidence gap: historical live `run_log` rows store daytrading as `cron` and maintenance as `reconcile_cron`, while production control and documentation may request `daytrading_cron` and `reconciliation_cron`. Only `GET /api/runs` trigger filtering translates `daytrading_cron → cron` and `reconciliation_cron → reconcile_cron`; exact canonical filters (`cron` and `reconcile_cron`) continue to work, and returned rows preserve their stored trigger values. No historical rows, scheduler dispatch, schedules, caps, strategy thresholds, sizing, or broker behavior changed, and no migration or DDL was added.

**Deployment status: NOT YET DEPLOYED.** No live endpoint, trigger, cycle, or broker-mutating endpoint was used.

Validation run locally:

- `bun test test/dashboard-readonly.test.ts` — passed, **5 tests / 53 assertions**; covers both aliases, both canonical filters, unsupported trigger behavior, invalid strategy behavior, and read-only no-DDL checks.
- `bun test` — passed, **131 tests / 403 assertions**.
- `bunx tsc --noEmit` — passed.
- `git diff --check` — passed from `/workspace/alpaca-trading-bot`.
- `bunx wrangler deploy --dry-run` — passed; bundle built and dry-run exited without deployment.

Remaining production gaps are explicit: **no fresh August 21 daytrading run; no fresh swing run; lease/error/fee skips; lifecycle timestamps null in the sample; per-trade gross/fee/net absent; crypto edge comparison not live-proven; and source/control-plane identity not independently verified.**

# Alpaca AI Trading Bot

## August 21, 2026 read-only observability and stale-D1 correction — deployed and verified

This bounded reliability correction makes `GET /api/trades?strategy=daytrading|swing|crypto` apply the requested filter and reject invalid strategy values with HTTP 400 instead of silently returning unfiltered data. `/api/runs` now also rejects invalid strategy filters. Swing reconciliation treats broker-absent, D1-only rows as stale local metadata after a complete broker snapshot, closes only those D1 rows without pending broker orders, and records `BROKER_AUTHORITATIVE_SYNC_ABSENT`; actual broker/internal quantity mismatches retain the current-cycle BUY safety halt. Caps remain **$5,000 daytrading / $3,700 swing / $2,000 crypto**, and no signal thresholds, schedules, sizing, or broker behavior changed.

Validation passed: **125 tests / 374 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. The correction is live as Cloudflare deployment `1b286e9a-6d2f-45b9-a439-72fd12654f9c`, Worker version `ced43daf-ed03-4add-ac07-1d8bf562b72c`, at 100% traffic with all four schedules. Separate GET-only verification on August 21, 2026 confirmed all six endpoints, broker-backed positions (`source: alpaca`, 29 rows), caps, invalid-filter HTTP 400 behavior, and `/api/trades?strategy=crypto` returning 20 crypto-only rows. Production remains **DEGRADED**, not healthy, because no fresh natural daytrading or swing success is visible; the six exposed nullable lifecycle timestamps remain null on historical rows, fee telemetry can be unavailable, and per-trade fee/gross/net fields are not modeled.

## August 21, 2026 additive trade-lifecycle persistence correction — deployed

The lifecycle observability gap is corrected with additive `trades` columns for broker-provided `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at`. New order imports and later read-only reconciliation persist non-null timestamps monotonically without erasing earlier evidence; caps, schedules, strategy thresholds, order sizing, and broker behavior are unchanged. Legacy D1 now contains the six columns.

Full validation passed: **123 tests / 361 assertions**, TypeScript, diff-check, and Wrangler dry-run. Separate GET-only verification passed all six endpoints, deployment `6ef8737a-85ca-4fbb-8886-c938237dc993` is live at 100% traffic, and `/api/trades` exposes the new fields. Production remains **DEGRADED** because fresh August 21 daytrading/swing delivery is unverified and prior swing history contains errors; no broker-mutating endpoint was used.

## August 21, 2026 runtime-cap and scheduler DDL correction — deployed and read-only verified

This narrow reliability correction aligns the daytrading and swing runtime loaders with the existing `/api/config` cap aliases: daytrading accepts `maxCapitalUsd` and `max_capital_usd`; swing accepts `swing_maxCapitalUsd` and `swing_max_capital_usd`. Missing or malformed overrides retain the existing fallbacks. The correction also removes the per-cron `ALTER TABLE positions ADD COLUMN strategy` and replaces it with a read-only schema gate; strategy cycles fail closed and record an error when the required column is absent. Apply the explicit `positions-strategy-column-migration.sql` once for legacy D1 databases.

Local validation passed: focused `bun test test/runtime-config-schema.test.ts test/capital-caps.test.ts` (**12 tests / 31 assertions**), full `bun test` (**121 tests / 359 assertions**), `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. Deployed from source commit `2637a1e07bedbc72592f546302a94fd9c195b927` as Cloudflare deployment `2c222e36-a64c-414e-898c-cbdfb10cb58f`, Worker version `e7425217-78c6-4bd2-bc2b-ee1e14cbd123`, at 100% traffic; all four schedules and six required GET endpoints passed. Remote D1 read-only verification confirmed `positions.strategy` exists, so no migration was needed. No trigger or broker-mutating operation was used. Production remains **DEGRADED**, with missing swing delivery evidence, crypto history/fee-edge blocks, crypto ownership/GTC lifecycle persistence gaps, P&L gaps, and pending natural scheduled evidence.


## August 21, 2026 `/api/runs` pagination reliability fix

Fixed a read-only observability defect in `GET /api/runs`: when `offset` is explicitly supplied, the response now reports `page = floor(offset / limit) + 1`, matching the returned slice; page-based requests retain their existing page-to-offset behavior. This is metadata-only and does not change caps, strategy thresholds, order sizing, trading decisions, or any other trading behavior.

Validation requirements for this local correction are `bun test test/dashboard-readonly.test.ts`, `bun test`, `bunx tsc --noEmit`, and `git diff --check`. Do not deploy or call live endpoints for this change; any later release must use read-only verification and wait for natural scheduled-run evidence.

Production remains **DEGRADED, not healthy**: swing delivery evidence is incomplete, crypto history/fee or edge-gate blocks remain, crypto ownership and GTC/lifecycle persistence still need a separate correction, fill-exact P&L gaps remain, and fresh natural daytrading/swing strategy evidence is still pending. Vital caps remain daytrading **$5,000**, swing **$3,700**, and crypto **$2,000**.

Autonomous AI-assisted trading bot running on a Cloudflare Worker with D1 persistence, Alpaca paper trading, and a GitHub Pages dashboard.

## August 21, 2026 crypto edge-gate correction

The local correction closes the confirmed crypto economics gap without inventing an edge from confidence. Crypto BUY admission now fails closed when the configured positive `minEdgeAfterCosts` gate has no calibrated `rawEdgeBps` source, and records `EDGE_CALIBRATION_UNAVAILABLE` in structured run details. If a real calibrated edge is later supplied, the existing cost-adjusted edge check remains active. Daytrading and swing behavior are unchanged.

Local validation on August 21, 2026: **111 tests passed, 330 assertions**, TypeScript typecheck, `git diff --check`, and a fresh Wrangler dry-run passed. The existing `/api/runs` pagination/filter correction remains covered and was live-verified with `?trigger=crypto_cron`: the latest observed run at `2026-08-21 07:37:34` CPH recorded 7 decisions, 0 trades, 0 errors, with `NO_POSITION_TO_EXIT` and `FEE_DATA_UNAVAILABLE` skips. No trading cycle, order, cancel, close, replace, retry, or other broker mutation was used.

Deployment completed on August 21, 2026 through the documented Cloudflare upload: deployment `47158569-968b-4bae-83ad-0c24134d42d2`, Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, 100% traffic, and all four schedules present. Read-only smoke checks for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, and filtered `/api/runs` passed; `/api/positions` remained broker-authoritative with 29 positions. Vital parameters remain unchanged: daytrading **$5,000**, swing **$3,700**, crypto **$2,000**. A natural post-release scheduled crypto run is still pending, so production remains degraded until that run confirms the new skip code in live run details.

## August 21, 2026 reliability correction candidate

The August 21 correction is deployed and live-verified. It fixes the confirmed gross/net presentation bug by aligning legacy `totalPl` with `netTotalPl` while retaining explicit gross fields, adds bounded `/api/runs` pagination and filters, persists broker-authoritative quantities while retaining the current-cycle mismatch safety block, and prevents repeated non-terminal stock/swing SELL/CLOSE submissions with structured `PENDING_EXIT_EXISTS` observability. Final follow-up deployment `b1c1bc11ce6a451da97a8325a70f89bb` was accepted after base deployment `07615065-0302-41c6-8a22-4203ea38b5c9`, from source commit `dab504cb091b2bf20120d9f8d3fd2d18ca61a4dc`; the four schedules remain present. The mismatch guard remains broker-authoritative: new daytrading BUY admission is blocked for the cycle, while risk-reducing/protective exits remain eligible.

Final local validation: **109 tests, 321 assertions**, TypeScript, diff-check, and fresh Wrangler dry-run passed. Final GET-only verification passed for all six endpoints, broker position source, corrected net accounting, filtered/paginated runs, lifecycle fields, and unchanged caps. A post-deployment successful scheduled strategy/reconciliation run has not yet been observed; the latest visible reconciliation at 2026-08-21 07:20:24 UTC was lease-skipped, so production remains degraded pending natural scheduled-run evidence.

Vital parameters remain unchanged: daytrading **$5,000**, swing **$3,700**, crypto **$2,000**.

## Bounded entry-identity fix — August 18, 2026 (deployed and live-verified)

A bounded, non-vital fix makes stock/swing entry identity deterministic and retry duplicate-protection concrete, mirroring the crypto pattern. It preserves all vital parameters (daytrading **$5,000**, swing **$3,700**, crypto **$2,000**, confidence gates, max-trade limits, universes, risk params) and does not touch the exit decision-correlation gap.

- Daytrading and swing BUY `client_order_id` values are now derived from `decision ID + symbol` (`bot_<decisionId>_<symbol>` / `swing_<decisionId>_<symbol>`) instead of `Date.now()`, matching `crypto_<decisionId>_<symbol>`.
- Those BUYs persist immediately through `db.logOrderTrade(order, …)` (the crypto order-shaped path) so broker fields/fill state/timestamps come from the broker response.
- New `Database.findNonTerminalTradeByClientOrderId(clientOrderId)` is called before stock/swing BUY: a non-terminal existing trade skips the retry with an auditable `DUPLICATE_ORDER_PREVENTED` reason and a decision-status note. Terminal rows do not block retry.
- Crypto fee telemetry routes through `feeTelemetryFromAggregate` with `maxAgeMs: 60_000` (fails closed when stale); `getBrokerFeeSummary` now exposes `cryptoUsdRecent` so the aggregate rate matches the existing seven-day window.

Local validation August 18, 2026: **101 tests, 294 assertions**, TypeScript typecheck and diff-check passed. Deployment and live verification completed August 18, 2026 from source commit `f122287703087ab959768d02ec931e21d85319a3`: Cloudflare deployment `03e3ef01-bb25-4010-b4b3-03829e7c09d5`, Worker version `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69`, 100% traffic, all four schedules, HTTP 200 read-only endpoints, `capitalCaps` `{ daytrading: 5000, swing: 3700, crypto: 2000 }`, and `/api/positions` broker-backed with 38 positions. Remote D1 schema verification passed. No trading trigger, order, cancel, close, retry, or other broker mutation was used.

## August 10, 2026 lifecycle hardening candidate

The August 10 worktree contained a release candidate that preserved the vital risk parameters: daytrading cap **$5,000**, swing cap **$3,700**, crypto cap **$2,000**, existing confidence gates, max-trade settings, and strategy universes. It removed premature stock/swing position upserts, enforced same-cycle daytrading entry notional against the existing cap, linked swing entries to decisions, synchronized newly broker-confirmed positions, closed stale D1 current-position rows only after a complete broker snapshot, and updated decision metadata from broker-confirmed order states.

Committed crypto reservations are never released by local TTL alone; only terminal broker evidence releases them. Crypto entries now fail closed below the **$10** venue minimum, include cross-cycle reservation notional in cap sizing, enforce the total per-cycle trade limit, retain reservations while a broker order is live, release them only on terminal broker evidence, retain reservations after an unknown post-submit local failure, and persist ATR stop/target intent for broker-confirmed position reconstruction.

Local validation on August 10, 2026: **92 tests passed, 273 assertions**, TypeScript typecheck passed, and repository diff-check passed. No trading cycle, order, close, cancel, replace, retry, or other broker mutation was used. Live verification completed on August 10, 2026: deployment `32fdaa9c-0609-4be1-b16c-6369af4dfc8e`, Worker version `dff3e198-1cb3-49d1-ac5d-706a7d292258`, and 100% traffic are confirmed. All four Worker schedules, health, and read-only endpoints returned successfully; no trading mutation was used.

## Latest release receipt and current worktree

The latest recorded release receipt is the August 21 strategy-filter and broker-authoritative reconciliation correction. This read-only control did not independently authenticate Cloudflare deployment identity or traffic, so the receipt is not presented as fresh control-plane proof. No manual trading trigger, order, cancellation, close, replace, retry, or broker mutation was used.

- **Repository:** `joachimth/alpaca-trading-bot`
- **Worker:** `alpaca-trading-bot.joachim-763.workers.dev`
- **Dashboard:** `joachimth.github.io/alpaca-trading-bot/`
- **Current source worktree:** branch `fix/remove-premature-position-upsert-entryside`
- **Latest captured deployment receipt:** `47158569-968b-4bae-83ad-0c24134d42d2`, Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, created August 21, 2026 at 07:57:51 UTC, 100% recorded traffic
- **Earlier captured receipts:** `1b286e9a-6d2f-45b9-a439-72fd12654f9c` / `ced43daf-ed03-4add-ac07-1d8bf562b72c`, then lifecycle receipt `6ef8737a-85ca-4fbb-8886-c938237dc993` / `5ff1ee08-bdc1-46b7-9aa6-93962d25beb4`
- **Latest local correction validation:** 130 tests / 388 assertions, TypeScript, diff-check, and Wrangler dry-run; the 125 / 374 result remains the historical deployed release receipt
- **Identity caveat:** source-to-deployment mapping and current live control-plane identity were not independently revalidated in this control
- **Account mode:** Alpaca paper trading
- **Status:** **DEGRADED, not healthy**. Fresh crypto and reconciliation deliveries are visible, but the sampled runs are skipped outcomes; fresh successful daytrading and swing delivery is not established.

The live sample also shows broker/internal position divergence, all six exposed nullable lifecycle timestamps null on the 50 sampled trades, no per-trade gross/fee/net fields, fee telemetry skips, and no end-to-end live proof that the crypto edge comparison against the configured threshold was exercised. A bounded local correction now derives dashboard account market value from the broker positions returned in that same response, sets it unavailable when broker positions cannot be read, records all broker positions in every account-wide snapshot writer, and normalizes submitted-order lifecycle timestamps. Read-only reconciliation also revisits terminal rows with status-relevant missing lifecycle fields and persists only non-null timestamps returned by Alpaca; inapplicable nullable fields remain null and timestamps are never inferred. The dashboard is a static GitHub Pages frontend that calls only the Worker API and never contains Alpaca credentials.

### Dashboard read-only hotfix (August 10, 2026)

`GET` API paths construct `Database` in explicit `readOnly` mode. That mode skips all runtime schema-repair DDL, `ALTER TABLE`, index creation, and schema checks; trading and write paths retain the existing schema-readiness behavior. The Worker fetch path contains no unconditional `ALTER TABLE positions` repair. `/api/dashboard` also uses bounded 90-row chart/category windows and no longer issues duplicate per-strategy history queries. Alpaca remains authoritative for current positions: if the broker position request fails, the response reports `positionsAvailable: false` and does not substitute D1 positions.

Validation for the deployed release: 85 Bun tests passed with 257 assertions, TypeScript typecheck passed, `git diff --check` passed, and the Wrangler dry-run passed. The explicit reservations migration was applied and verified in remote D1; the direct Cloudflare upload was used because Wrangler deploy can be false-positive in this proxy environment.

Read-only live Worker verification ran on August 10, 2026 at 13:43:32-13:43:35 UTC. `/health`, `/api/runs`, `/api/trades`, `/api/positions`, `/`, and `/api/config` returned HTTP 200; `/api/positions` reported `positionsAvailable: true`, `source: alpaca`, and 18 positions. Cloudflare deployment/version/traffic/schedules were not freshly verified: Wrangler was unauthenticated, Cloudflare API requests returned HTTP 403, and the documented `24b7df43`/`d304d14c` pair conflicts with a later `5088dbe0`/`cb88271c` artifact. The local Worker configuration contains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and maintenance `*/10 * * * *`, but that is not proof of live scheduler state. D1 SELECT-only evidence recorded daytrading cron runs 913, 914, and 915 at 13:25:59, 13:35:59, and 13:40:59 UTC, each skipped with `CYCLE_LEASE_HELD` and `trades_executed: 0`. The source uses separate `daytrading` and `maintenance` lease keys; exact historical lease ownership is not reconstructable from available artifacts. No trigger, reconciliation, order, close, cancel, retry, or other mutating endpoint was called.

### Capital-cap release evidence

The earlier read-only capital-cap release remains the historical baseline for the current live cap values. The August 10, 2026 hardening release supersedes it with bounded dashboard reads, explicit read-only GET behavior, crypto lifecycle classification, and persistent reservations; the live `/api/dashboard` response still returns `capitalCaps.daytrading = 5000`, `capitalCaps.swing = 3700`, and `capitalCaps.crypto = 2000`.

## Architecture

```text
Alpaca API <---- server-side calls ---- Cloudflare Worker
                                         |
                                         +-- Trading cycles
                                         +-- REST API for dashboard
                                         +-- D1 decisions, trades, positions, snapshots

GitHub Pages dashboard ---- HTTPS REST calls ----> Worker API
```

### Source of truth for positions

Alpaca is authoritative for **current broker state**:

- symbol and side
- quantity
- average entry price
- current price
- market value
- unrealized P&L
- intraday P&L fields

D1 is authoritative only for application metadata and history:

- strategy ownership when it can be determined
- stop-loss and take-profit metadata
- timestamps and lifecycle history
- decisions, orders/trades, runs, snapshots, and realized P&L history

A D1-only row is not an open current position. The API projection emits only symbols currently present at Alpaca. A broker-present symbol without reliable D1 ownership is returned as `strategy: "unattributed"`, never silently assigned to daytrading.

If the Worker cannot fetch Alpaca positions, it does **not** fall back to D1 rows. The dashboard receives an unavailable state, and `/api/positions` returns HTTP 503 with an error payload.

- The August 10 hardening release includes the crypto correctness patch: protective exits run before discretionary halts, entries are limited to one per cycle by default, discretionary exits have a separate two-exit budget, pending entries reserve capital and position capacity, recent D1 orders provide persistent entry-rate protection, fee telemetry is scoped to the curated crypto universe and a seven-day window, reopened positions receive a fresh `opened_at`, and schema version correction is explicit. Historical realized P&L remains model/gross-style until fill-lot matching is implemented.

## Trading strategies and schedules

- **Daytrading:** every 5 minutes during the configured UTC window, `*/5 13-21 * * 1-5`; Alpaca's market clock remains authoritative.
- **Swing:** once daily after market close, `0 22 * * 1-5`.
- **Crypto:** every 30 minutes at approximately `:07` and `:37` UTC, `7-59/30 * * * *`; crypto is intentionally kept at this cadence pending telemetry.
- **Maintenance/reconciliation:** every 10 minutes, `*/10 * * * *`; read-only broker/order reconciliation under a separate maintenance lease, so it cannot block daytrading, swing, or crypto. Strategy leases are isolated and expire after 10 minutes for bounded recovery.

The strategies use explicit asset and strategy isolation. A strategy may use D1 ownership and risk metadata, but current broker quantity and valuation must come from Alpaca.

## Features

- Autonomous paper trading with separate daytrading, swing, and crypto paths
- Technical analysis: RSI, MACD, EMA, ATR, Stochastic, Bollinger Bands, ADX, and OBV
- Optional LLM refinement of technical signals
- Risk controls: account block checks, daily loss limits, position limits, sizing, stops, take-profits, trailing stops, cooldowns, order-rate limits, quantity-aware cost gates, and discretionary exit protection
- Fee-aware P&L: strategy rows preserve `grossTotalPl` and `netTotalPl`; legacy `totalPl` is net-semantic and equals `netTotalPl`; CFEE is attributed only to crypto, while orderless/account-level fees remain explicitly unattributed
- Exit policy: only signal-driven discretionary SELL/CLOSE actions may be held when estimated costs consume a small positive gross gain; protective, EOD, and manual closes bypass that gate
- Swing edge policy: spread/slippage/fee costs are logged with explicit bps units; BUY rejection is disabled until a calibrated `expectedEdgeBps` is configured
- Universe scanner for liquid US equities
- D1 logging for decisions, trades, runs, snapshots, and position metadata
- GitHub Pages dashboard with bounded equity history, broker-backed positions, decisions, trades, and run history
- Isolated D1 leases per strategy plus a separate maintenance lease, scheduled read-only broker/order reconciliation, bounded broker requests, and pre-cycle status refresh

## Setup and development

### Prerequisites

- Cloudflare account with Workers and D1
- Alpaca paper-trading account
- Alpaca API credentials
- GitHub account if hosting the dashboard on GitHub Pages
- Bun or Node.js with Wrangler

### Install

```bash
cd alpaca-trading-bot
bun install
```

### Create or configure D1

```bash
bunx wrangler d1 create alpaca-trading-bot
bunx wrangler d1 execute alpaca-trading-bot --remote --file=schema.sql
```

Before deploying crypto BUY code, apply the explicit reservation migration once. It is idempotent and must be run by an authorized release operator, not by the Worker:

```bash
bun run db:migrate:crypto-reservations:remote
bun run db:verify:crypto-reservations:remote
 bun run db:migrate:trade-intent:remote
 bun run db:verify:trade-intent:remote
```

The verification command is read-only and must show both `crypto_entry_reservations` and `idx_crypto_entry_reservations_expiry`. A missing table or index is a release blocker; runtime self-healing is intentionally not relied on for this safety-critical gate.

Update `wrangler.toml` with the returned database ID when creating a new environment. The production Worker uses the D1 binding named `DB`.

### Configure secrets

Use Wrangler or the platform's encrypted secret store. Never put secrets in source files, the dashboard, commits, or chat messages.

```bash
bunx wrangler secret put ALPACA_API_KEY
bunx wrangler secret put ALPACA_API_SECRET
bunx wrangler secret put ALPACA_BASE_URL
bunx wrangler secret put LLM_API_KEY
```

`ALPACA_BASE_URL` is normally `https://paper-api.alpaca.markets` for this project.

## Current configuration defaults

The runtime fallback defaults are strategy-specific and can be overridden through D1 configuration:

The dashboard's **Capital cap** cards are read-only. `/api/dashboard` returns a server-resolved `capitalCaps` object using the exact runtime-compatible configuration keys and fallback defaults: `maxCapitalUsd` = `$5,000`, `swing_maxCapitalUsd` = `$3,700`, and `crypto_maxCapitalUsd` = `$2,000`. The runtime accepts both camelCase and snake_case aliases, with the documented resolver precedence; `/api/config` remains raw diagnostic configuration and is not used by the frontend for cap inference. The frontend never derives a cap from Alpaca buying power, cash, equity, portfolio value, positions, or any other account metric. Missing runtime-compatible D1 overrides use the documented fallback; malformed or negative overrides, and invalid or unavailable `capitalCaps` API payloads, render as `Unavailable`.

| Setting | Daytrading | Swing | Crypto |
|---------|------------|-------|--------|
| Minimum confidence / entry score | `0.7` | `0.5` composite z-score | `0.7` |
| Max positions | `15` | `30` | `5` |
| Max capital | `$5,000` | `$3,700` | `$2,000` |
| Max order rate | `10/min` | `15/min` | `5/min` persistent entry guard |
| Max new entries / cycle | strategy-specific | strategy-specific | `1` default |
| Max discretionary exits / cycle | strategy-specific | strategy-specific | `2` default |
| Minimum hold | `15 min` | strategy-specific | `30 min` |
| Re-entry cooldown | `30 min` | strategy-specific | `60 min` |
| EOD flatten | `true` | not applicable | `false` |

ATR-scaled stop-loss/take-profit settings are used by the trading paths. Margin is enabled for daytrading by default, disabled for swing, and disabled for crypto. These are fallback values only; inspect `/api/config` and D1 before assuming a live value.

### Run tests and build checks

```bash
bun test
bun run typecheck
bunx wrangler deploy --dry-run
```

The deployed release passed 85 tests with 257 assertions. Migration coverage includes fresh-schema apply and idempotent reapply for the crypto reservation table and index; dashboard coverage includes read-only/no-DDL and bounded-payload tests. `bunx tsc --noEmit`, `bun test`, `git diff --check`, and `bunx wrangler deploy --dry-run` passed before the direct Cloudflare upload.

### Deploy

Use [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md). In this proxy environment, `bunx wrangler deploy` can return exit code 0 without creating a new Worker version, so the canonical path is:

1. Pass typecheck, tests, dry-run, and `git diff --check`.
2. Commit and push to the active release branch, then verify the matching remote hash (`origin/fix/remove-premature-position-upsert-entryside` for the current release line).
3. Build a fresh explicit bundle with `bunx wrangler deploy --dry-run --outdir <new-directory>`.
4. Upload that exact bundle through the direct Cloudflare multipart API using the encrypted credential store.
5. Verify a new Cloudflare version at 100% traffic, all four cron schedules, and read-only HTTP 200 smoke tests.

Never put `CLOUDFLARE_API_TOKEN` in source, documentation, chat, or commits. Never use trigger, cycle, order, or close endpoints as deployment tests.

The dashboard is the static file `dashboard/index.html`. It uses the Worker URL in `API_BASE` and must never be changed to call Alpaca directly.

## API contract

All Alpaca access is server-side inside the Worker.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` or `/health` | GET | Worker health response |
| `/api/dashboard` | GET | Combined account, broker-backed positions, decisions, trades, runs, bounded snapshots, strategy comparison, and server-resolved `capitalCaps`; returns `positionsAvailable`, `positionsError`, and `strategyComparison: null` when the broker position fetch fails |
| `/api/account` | GET | Account data fetched server-side from Alpaca, returned as `{ account }` |
| `/api/positions` | GET | Current broker positions projected with D1 metadata; includes `positionsAvailable` and `source: "alpaca"`; returns HTTP 503 when broker positions are unavailable |
| `/api/decisions` | GET | Recent decisions from D1, returned as `{ decisions }` |
| `/api/trades` | GET | Recent trades from D1, returned as `{ trades }`; broker reconciliation runs only on scheduled/cycle paths |
| `/api/performance` | GET | Performance snapshots from D1, returned as `{ performance }` |
| `/api/runs` | GET | Read-only run history from D1, returned as `{ runs, limit, offset, page }`; supports bounded `limit` (max 500), `offset` or 1-based `page`, plus `strategy`, `trigger`, and `status` filters |
| `/api/stats` | GET | Aggregate statistics from D1 |
| `/api/strategy-comparison` | GET | Historical strategy metrics plus broker-backed current exposure; returns an unavailable state if positions cannot be fetched |
| `/api/config` | GET | Raw bot configuration from D1 for diagnostics; the dashboard does not infer capital caps from this raw response |
| `/api/trigger` | POST | Requests the daytrading path to run on its scheduled path; treat as an operational action |
| `/api/trigger-swing` | POST | Runs a swing cycle immediately; treat as an operational action |
| `/api/trigger-crypto` | POST | Runs a crypto cycle immediately; treat as an operational action |
| `/api/positions/close?symbol=X` | POST | Submits a close order for one symbol |
| `/api/positions/close-all` | POST | Submits close orders for all broker positions |
| `/api/debug` | GET | Operational/debug data |
| `/api/debug-crypto` | GET | Crypto operational/debug data |

### `/api/dashboard` position fields

When `positionsAvailable` is `true`, `positions` contains only broker-present symbols. Broker values such as `qty`, `current_price`, `market_value`, and unrealized P&L come from Alpaca. D1 metadata fields such as `strategy`, stops, and timestamps are carried only when a matching D1 row exists.

When `positionsAvailable` is `false`, `positions` is empty and `positionsError` explains the failure. The dashboard also returns `account.market_value: null` and `latestSnapshot.positions_count: null`; the frontend must display those broker-derived aggregates as unavailable rather than reconstructing them from D1. When positions are available, `account.market_value` is the sum of the broker position `market_value` fields and `latestSnapshot.positions_count` is the broker position count from that same response.

## Risk management

The risk manager enforces hard rules that override AI and technical-analysis decisions:

- account blocked and trading halt checks
- daily loss and rolling drawdown limits
- confidence threshold
- position count and capital limits
- position sizing
- stop-loss and take-profit calculation
- trailing-stop handling
- order-rate limits
- minimum hold and re-entry cooldowns
- broker/D1 divergence checks where applicable

Run history labels `trades_executed` as **Orders submitted**. A submitted order may be pending, rejected, canceled, partially filled, or filled; persisted trade status and broker fill records are the authoritative execution evidence.

## Operational verification checklist

Before declaring a deployment complete:

1. Update the documentation for every source, configuration, schema, migration, test, or operational change.
2. Run `git diff --check`, `bunx tsc --noEmit`, `bun test`, and a Wrangler dry-run.
3. Commit and push the code and documentation; confirm local `HEAD` equals the remote release branch hash.
4. Build and upload a fresh explicit Worker bundle through the documented direct Cloudflare multipart API.
5. Confirm the newest Cloudflare version is receiving 100% traffic and all four schedules are present.
6. Fetch `/health`, `/api/dashboard`, `/api/trades`, `/api/runs`, and `/api/positions` through the Worker URL.
7. Confirm broker availability fields and that symbols match the broker account.
8. Confirm the GitHub Pages HTML contains the Worker API URL and no direct Alpaca URL.
9. Record the release result and open next steps in `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and the workspace status note.
10. Do not use trigger, cycle, order, or close endpoints as deployment tests.

## Documentation rule

Documentation is part of the implementation, not a follow-up task. Every future change must update the relevant README, operations/runbook, release receipt, and next-step status in the same work item. A change is not complete until the documented behavior, validation results, deployment state, known risks, and remaining follow-ups match reality.

## Known risks and follow-up work

- Partial-fill/retry/cancel handling has a confirmed lifecycle gap: August 6 live evidence showed repeated partial-filled exits and subsequent quantity mismatches. Current daytrading and swing paths do have a non-terminal pending-exit guard (`PENDING_EXIT_EXISTS`), so a later cycle suppresses a duplicate SELL/CLOSE while the earlier broker order remains non-terminal. Broader partial-fill/cancel/replace/retry behavior and paper-session evidence remain open.
- Entry identity and duplicate protection are deployed: stock/swing BUY `client_order_id` values now use decision+symbol, BUYs persist through `logOrderTrade`, and retries are guarded by `findNonTerminalTradeByClientOrderId` (`DUPLICATE_ORDER_PREVENTED`). A partial or pending BUY can still inflate internal quantity before reconciliation, and stock/swing exits still lack deterministic decision-derived IDs even though their non-terminal pending-exit guard is present. Crypto has its own pending-exit guard and deterministic client IDs, but it still lacks a complete broker retry/cancel/replace lifecycle.
- Order-to-decision correlation is improved on the entry side by the August 18 source candidate (deterministic `client_order_id`, `logOrderTrade` with decision ID for stock/swing BUY), but stock/swing **exits** still omit a decision-derived deterministic ID, so exit correlation and historical attribution for those rows remain incomplete until paper-session evidence arrives.
- Strategy `grossTotalPl`, `feesUsd`, and `netTotalPl` are aggregate model/ledger values: closed P&L still comes from broker-position/unrealized snapshots, not matched fills. The fee ledger currently imports a bounded three-day overlap, so net figures mean gross model P&L less fees currently present in the ledger; they are not fill-exact per-trade accounting.
- Regulatory/account-level fees are intentionally not assigned to daytrading or swing; unmatched broker positions are shown as `Unattributed` rather than hidden from the overview.
- A true swing trailing stop still needs persisted peak-price state; the current swing protective path uses the hard stop and explicit data-integrity protection.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; they must not be bulk-attributed without deterministic evidence.
- The swing production path has been verified with bounded batch-bar handling and degraded-data safeguards; trigger attribution and decision-row accounting remain follow-up consistency work.
- Some position upsert/reconciliation paths still need stronger strategy attribution and lifecycle correlation.
- Scheduled reconciliation is intentionally read-only and does not replace a future explicit retry/cancel lifecycle design.
- Automated coverage is improving but does not yet provide full live-broker integration coverage for every partial-fill and retry edge case.
- D1-only historical rows may remain open in storage until a separate, complete reconciliation policy is implemented. GET handlers do not close or synthesize positions.

## Prior-release natural reconciliation evidence

The prior-release natural reconciliation check completed on August 8, 2026 using only GET requests to the live Worker. The `/api/runs` response recorded 23 `reconcile_cron` entries from `2026-08-08 06:40:53` through `2026-08-08 10:30:51` UTC; 16 completed with the `MAINTENANCE_ONLY` marker and 7 were explicitly skipped because the global cycle lease was held. The live `/api/trades` response contained 19 rows with `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at`; reconciliation timestamps ranged from `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC. Maintenance logs reported `trades_executed: 0`, `imported: 0`, and no order submission, cancel, replace, retry, or close action. Source inspection confirms the maintenance reconciler only reads recent/individual broker orders and writes D1 lifecycle state.

This confirms prior-release scheduled execution and lifecycle-state writes without broker-side mutation evidence; it does not mean the six nullable Alpaca lifecycle timestamps were populated. It does not establish a completed post-August 10 reconciliation: the latest observed `reconcile_cron` records at 07:10, 07:30, and 07:50 UTC were skipped with `CYCLE_LEASE_HELD`, and the later 13:25:59-13:40:59 UTC window contained no maintenance rows. The 13:25:59-13:40:59 daytrading rows were also skipped with `CYCLE_LEASE_HELD`; no 13:30:00 UTC row was retained in the 30-row response, so that exact first market-open tick is an evidence gap. Source inspection confirms maintenance uses its own lease key; exact historical lease ownership is not reconstructable from available artifacts. A strict broker order before/after comparison remains unavailable because the supported Worker API has no read-only `/api/orders` route and no same-window order snapshot pair was captured; the result is therefore “no mutation observed or indicated,” not a categorical broker audit assertion.

A verified weekly read-only follow-up job, `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`), runs Mondays at 10:00 Europe/Copenhagen and reviews the remaining accounting, lifecycle, attribution, swing-state, and live-integration risks.

## Next steps

1. Observe the first natural paper-session behavior of the deployed deterministic entry identity and retry guard without manually triggering a cycle.
2. Define and test the remaining partial-fill, cancel, replace, and retry lifecycle under a paper session, separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.

## License

Private project.

## August 21, 2026 strict read-only production control, final status

**Result: FAIL/DEGRADED, not healthy.** The control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; all six returned HTTP 200. No trigger, submit, cancel, close, replace, retry, or other broker-mutating endpoint was called, and no deployment was performed.

- Broker authority passed: `/api/positions` returned `positionsAvailable: true`, `source: "alpaca"`, and 29 broker-backed positions. D1 contributes strategy and historical metadata only; the broker remains the live position source. MSTR remains broker-present but `unattributed`, so complete strategy cap attribution is not proven.
- Equity direction passed at the snapshot level: dashboard equity was **$98,546.76** versus `last_equity` **$98,270.0927**; the latest snapshot was **$98,556.33** at `2026-08-21 23:37:58` UTC. Daily change fields remain zero despite changing equity history, so independent daily-direction validation is limited.
- Configured caps are unchanged at **$5,000 daytrading / $3,700 swing / $2,000 crypto**. Source and `wrangler.toml` retain all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and read-only reconciliation `*/10 * * * *`.
- Fresh reconciliation delivery is present through `2026-08-22 00:01:01` UTC as structured `MAINTENANCE_ONLY` skips with one ledger page, a five-page budget, and no degradation. Fresh crypto delivery is present at `2026-08-21 23:08:04` and `23:38:04` UTC with structured skips and zero errors. Natural crypto delivery is approximately the expected `:07/:37` cadence but commonly lands at `:08/:38`.
- Daytrading filtered alias observability works: `GET /api/runs?trigger=daytrading_cron` maps to canonical `cron` and shows repeated `CYCLE_LEASE_HELD` skips, with the latest captured row at `2026-08-20 21:55:24` UTC. No fresh successful daytrading run is proven. No fresh successful swing run is proven. Historical crypto and reconciliation errors include D1 variable overflow and Worker subrequest exhaustion; the deployed batching correction prevents recurrence in the fresh post-release crypto sample, but historical errors remain part of the risk record.
- Trade and fill lifecycle fields are exposed and persisted conservatively. The current sampled rows are filled with submitted and filled timestamps, while inapplicable terminal fields are null. `gross`, `fee`, and `net` remain null with `accounting_status: unavailable_fill_lot_exact`; deterministic fill/lot accounting and non-crypto strategy fee attribution remain unresolved, so per-trade gross/fee/net consistency cannot be claimed.
- Crypto edge-gate wiring passes source and regression inspection: fee telemetry is required, calibrated `rawEdgeBps` is required, confidence is never converted to edge, and reservation admission is fail-closed. Live positive calibrated-edge comparison remains unproven; current crypto skips include `FEE_DATA_UNAVAILABLE`.
- Regression status is green locally: full `bun test` passed **154 tests / 488 assertions**. TypeScript, diff-check, and prior Wrangler dry-run evidence also pass. This does not clear the production evidence gaps.
- Deployment identity remains unresolved. `bunx wrangler whoami` reports `You are not authenticated`; therefore the active Worker/source mapping and live schedule control-plane state cannot be independently authenticated. No deployment was required for this control.

**Correction work item:** the existing `CORRECTION_WORK_ITEM_2026-08-21.md` remains open and has been updated with this control. No new code correction was justified because the confirmed live issues are unresolved evidence, attribution, cadence, and credential/source-identity gaps, not a newly reproducible cap, schedule, broker-authority, or edge-gate regression. Required follow-up is authenticated read-only Cloudflare verification, natural daytrading and swing evidence, exact fill/lot accounting, and cap-enforcement attribution without changing vital caps or trading behavior.

## Crypto edge/TIF investigation — August 21, 2026

Investigation result: **no safe trading-code correction is justified**. Repository-wide source and history inspection found no production producer for calibrated `rawEdgeBps`; the only positive value is a test fixture. The crypto caller enables `requireCalibratedEdge` and does not derive edge from confidence, TA, sentiment, fees, or any other uncalibrated signal. With the configured positive `minEdgeAfterCosts`, crypto BUY admission therefore remains fail-closed and records `EDGE_CALIBRATION_UNAVAILABLE` in structured run details. Do not add a constant, confidence conversion, fee-derived proxy, or other invented edge.

The reported crypto TIF mismatch is not reproduced in source: `src/crypto-strategy.ts` explicitly submits crypto BUYs with `time_in_force: 'gtc'`; the generic Alpaca client defaults to `day` only when a caller omits TIF. The returned broker TIF is persisted by `logOrderTrade`, and regression coverage confirms `gtc` persistence. No TIF, cap, threshold, sizing, schedule, or order-behavior change was made. If a future live row shows `day`, capture the decision/order ID and broker response before changing code; it would indicate a caller/deployment/source-mapping mismatch rather than this source path.

Required observability remains: monitor structured `EDGE_CALIBRATION_UNAVAILABLE` and `FEE_DATA_UNAVAILABLE` crypto skips, and compare submitted broker TIF to persisted `trades.time_in_force` by `client_order_id`/order ID using read-only evidence. Deployment is **not required** for this documentation-only investigation.

## August 22, 2026 read-only trade-shape correction

The correction adds stable lifecycle and accounting keys to legacy `/api/trades` response rows without DDL or write-path changes, and strengthens combined `/api/runs` filter regression coverage. The stale `/workspace/src` tree is reference-only and must not be treated as deployable source. Caps remain `$5,000/$3,700/$2,000`, crypto calibrated-edge and fee gates remain fail-closed, schedules and trading behavior are unchanged, and no broker-mutating endpoint is used for validation.

Validation passed: focused **24 tests / 126 assertions**, full **156 tests / 511 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. Release is authorized under the standing maintenance rule as a reliability-only API compatibility fix; separate GET-only live verification remains required after deployment. Production remains **FAIL/DEGRADED** until live strategy-delivery, cap-enforcement, source identity, cadence, and exact fill-lot accounting gaps are resolved.

## August 22, 2026 Control-3 final outcome — correction not live-proven

The strict read-only control completed at **2026-08-22 05:03 UTC**. All six required GET endpoints returned HTTP 200; `/api/positions` remained broker-authoritative with `source: alpaca` and 29 rows; dashboard equity was **98,504.50** versus `last_equity` **98,270.0927**; and caps remained **$5,000/$3,700/$2,000**. Fresh reconciliation delivery continued through **05:01:02 UTC** as structured `MAINTENANCE_ONLY` skips, while crypto delivery continued through **04:38:03 UTC** near the configured `:07/:37` cadence with fail-closed fee/confidence skips. No fresh successful daytrading or swing run was proven; sampled trade lifecycle fields were coherent but gross/fee/net remained null with `unavailable_fill_lot_exact`.

The local reliability correction remains validated by focused **26 tests / 154 assertions**, full **157 tests / 518 assertions**, TypeScript, diff-check, and Wrangler dry-run. A secure Wrangler deployment retry produced no usable deployment receipt, and separate GET-only verification still reports live `/health` **1.0.0** and `/api/config` **2.4.0** versus local release **2.6.0**; production therefore remains **FAIL/DEGRADED**, not healthy. Explicit follow-up: restore and verify the Cloudflare deployment receipt, deploy the exact validated correction, then repeat separate GET-only release, filter, schedule, position, run, trade, fee, and cap checks without changing vital caps or trading behavior.

## August 22, 2026 Control-4 strict read-only production control

**Disposition: FAIL/DEGRADED, not healthy.** This control called only the six required GET endpoints. All returned HTTP 200, but live release identity remains inconsistent: `/health` reports `1.0.0` and `/api/config` reports `2.4.0`, while the local deployable source/package/schema/dashboard report `2.6.0`.

Live positions remain broker-authoritative (`positionsAvailable: true`, `source: alpaca`, 29 rows), and equity direction is upward (`98504.50` versus `98270.0927`, +`234.4073`), although daily direction is not independently validated because `change_today` and daily P/L fields are zero. Caps remain unchanged at **$5,000/$3,700/$2,000**. Fresh reconciliation is `MAINTENANCE_ONLY`; crypto delivery is near the configured `:07/:37 UTC` cadence but commonly records `:08/:38`; category history is populated through `2026-08-22 06:37:57`, but fresh successful daytrading and swing strategy runs are not proven. Recent daytrading rows are repeated `CYCLE_LEASE_HELD` skips, and the latest available swing row is an `2026-08-18 22:00:36` position-divergence/RISK_HALTED error; historical crypto SQL-variable and subrequest failures remain part of the risk record.

Sampled trades expose lifecycle fields, but `gross`, `fee`, and `net` are null with `accounting_status: unavailable_fill_lot_exact` and `fee_attribution: none-recorded`; aggregate strategy gross/net remains conservative but is not fill-lot exact. Local source contracts and existing regressions cover broker authority, four schedules, filtered runs, structured skips, unchanged caps, conservative fees, and fail-closed crypto edge gates, but live source identity, complete scheduled delivery, exact cadence, complete lifecycle scenarios, direct cap enforcement, and positive production `rawEdgeBps` remain unresolved. Correction work item: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-4.md`; no code change or deployment is claimed, and no broker-mutating endpoint was used.

## August 22, 2026 Control-4 execution result

Focused regressions passed **26/154**, full regressions passed **157/518**, TypeScript and diff checks passed, and the Wrangler dry-run produced a 281.23 KiB upload preview. Deployment was attempted under the standing maintenance rule but stopped before upload with the exact Wrangler blocker: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` The secure vault credential was supplied through the process path but was not accepted by Wrangler; no temporary claim deployment was used.

Separate post-attempt GET-only verification still reports live `/health` `1.0.0` and `/api/config` `2.4.0` versus local `2.6.0`; all six endpoints remain HTTP 200, positions remain broker-authoritative, and caps remain `$5,000/$3,700/$2,000`. Production remains **FAIL/DEGRADED**.

Explicit follow-up: restore a Wrangler-compatible authenticated Cloudflare deployment path, deploy the exact validated artifact with a source-and-schedule-tied receipt, then repeat separate GET-only verification. Fresh canonical and alias `/api/runs` probes currently match, but older saved captures returned empty alias arrays; treat alias behavior as unresolved until post-deploy GET evidence converges. The run log still does not persist analyzed/filtered candidate counts, and no production caller supplies calibrated `rawEdgeBps`; daily direction remains unproven because live daily change/P&L fields are zero.

## August 22, 2026 Control-4 execution result

Focused validation passed **26 tests / 154 assertions** and full validation passed **157 tests / 518 assertions**; TypeScript, diff-check, and Wrangler dry-run also passed. Deployment was attempted under the standing maintenance rule but stopped before upload with the exact blocker: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` The secure vault credential was supplied through the process path but was not accepted by Wrangler.

Separate GET-only verification still reports live `1.0.0/2.4.0` versus local `2.6.0`; all six endpoints remain 200, broker-authoritative positions and unchanged caps remain intact, and production remains **FAIL/DEGRADED**. Follow-up is to restore the authenticated Wrangler path, deploy the exact validated artifact with a tied receipt, and repeat GET-only verification.

## August 22, 2026 Control-4 execution result and blocker

The exact local artifact passed focused **26/154** and full **157/518** regression gates, TypeScript, diff-check, and Wrangler dry-run. The authorized deployment attempt stopped before upload because Wrangler reported: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` The secure vault credential was supplied to the process path but was not accepted; no temporary claim deployment was used.

Post-attempt GET-only verification confirms the old live identity remains `/health` `1.0.0` and `/api/config` `2.4.0`, so the correction is not deployed or live-proven. Keep **FAIL/DEGRADED**, restore the authenticated Wrangler path, tie the next receipt to the exact source commit and four schedules, then perform separate GET-only verification.

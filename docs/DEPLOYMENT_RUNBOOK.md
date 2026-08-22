## August 22, 2026 Control-3 correction: filtered runs and release identity

Production control found a release/version mismatch: live `/health` reports `1.0.0` and live `/api/config` reports `2.4.0`, while the deployable source reports `2.6.0`. An earlier capture also showed `/api/runs` filter loss; fresh post-attempt GET probes now return correctly filtered rows, but the corrected source is still not live-proven. The local reliability-only correction is present in `src/api.ts`, `src/database.ts`, and `src/version.ts`; it preserves broker-authoritative positions, all four schedules, caps of **$5,000/$3,700/$2,000**, crypto calibrated-edge fail-closed behavior, and trading semantics.

The required correction work item is `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-3.md`; production remains **FAIL/DEGRADED** until deployment and separate GET-only verification succeed. No broker-mutating endpoint or trading trigger was used.

## August 22, 2026 release-version observability correction — not deployed

The canonical release version is **`2.6.0`**, established by the deployable source's `schema.sql` `bot_config.version` seed and the existing dashboard footer. `package.json`, the Worker health response, the dashboard release marker/footer, and the version regression now agree on `2.6.0`. The health response reads the shared `src/version.ts` constant; `/api/config` remains the raw D1 configuration response and no runtime configuration value is changed. This is reliability-only observability work: no trading behavior, schedules, caps, edge gates, broker calls, D1 mutation semantics, or endpoint methods changed.

Focused validation: `bun test test/release-version.test.ts test/dashboard-readonly.test.ts crypto-runtime.test.ts` — **26 tests passed, 154 expect() calls**; full `bun test` — **157 tests passed, 518 expect() calls**; `bunx tsc --noEmit` passed; repo-scoped `git diff --check -- .` passed; and `bunx wrangler deploy --dry-run --outdir /tmp/alpaca-trading-bot-version-dry-run` passed with no deployment. Deployment was attempted but blocked because Wrangler requires `CLOUDFLARE_API_TOKEN`; the separate GET-only recheck still shows live `/health` version `1.0.0`. No broker-mutating endpoint was used.

No migration, trigger, order, cancellation, close, replace, retry, cap change, schedule change, crypto edge-gate change, or trading-behavior change was made. Production remains **FAIL/DEGRADED**, not healthy, because fresh daytrading/swing success, direct cap enforcement, exact crypto cadence, exact fill-lot accounting, and historical runtime/divergence evidence remain unresolved.

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

Confirmed incident: `/api/runs` reported D1 `too many SQL variables` at **2026-08-21 18:38:03 UTC**. Root cause was the read-only trade accounting enrichment constructing one `IN` placeholder/binding list for all returned order IDs.

The candidate changes only `src/database.ts`: `broker_fees` lookups now run in sequential batches of 50 order IDs and preserve existing fee-map/output semantics. Focused regression coverage proves 50/50/1 batching; full release gates passed with **154 tests / 488 assertions**, typecheck, diff-check, and Wrangler dry-run. No schedule, threshold, sizing, broker action, reconciliation authority, or cap changed; caps remain **$5,000/$3,700/$2,000**.

Artifact `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b` / Worker version `a23c13a1-6b61-4c03-aae9-738d35118af9` is recorded at 100% traffic on **August 21, 2026 at 17:15:44 UTC**, but the artifact does not prove that it contains the current local candidate. Mark the release **SOURCE-TO-WORKER IDENTITY UNRESOLVED** until exact bundle identity and current traffic are independently verified. Wrangler is unauthenticated and the prior `unknown credential reference(s): cloudflare` error remains a blocker. No broker endpoint was called; post-release checks must remain GET-only plus natural scheduled evidence.

Test-layout note: crypto runtime regression coverage is stored at the repository root as `crypto-runtime.test.ts`, not `test/crypto-runtime.test.ts`; `bun test crypto-runtime.test.ts` passes 14 tests / 48 assertions.

## August 21, 2026 strict read-only control update — FAIL/DEGRADED

Control evidence confirms `/api/positions` source labeling only. Historical broker/internal quantity mismatches remain recorded for SOFI 73 vs 114 at 16:10:47 UTC, MSTR 3 vs 7 at 16:20:46 UTC, and NOW 1 vs 2 at 16:35:42 UTC; daytrading has lease-held/error delivery, swing is unverified, crypto has cadence gaps/errors, reconciliation is maintenance-only, sampled lifecycle and gross/fee/net fields are null, and calibrated edge-after-costs is not exposed by live evidence. Do not label healthy or manufacture evidence with triggers; caps remain $5,000/$3,700/$2,000 and no deployment or broker mutation occurred.

## August 21, 2026 additive trade observability correction — deployed and GET-only verified

Scope was reliability-only: preserve broker-provided `time_in_force` including crypto `gtc`; expose conservative `/api/trades` `gross`, `fee`, and `net` fields with explicit status/attribution metadata; keep gross/net null until deterministic fill/lot matching exists; expose fees only for complete non-negative USD values linked directly by order ID; and persist bounded ledger truncation as top-level `degraded`. All four schedules, caps **$5,000/$3,700/$2,000**, thresholds, sizing, order behavior, and broker mutation boundaries were preserved.

Release gates passed: **153 tests / 483 assertions**, `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. Published commit `71aad14b0df1fc693de0e002e1b91d5cb6460eb5` was uploaded directly through the authorized Cloudflare API as deployment `061b8e22-184d-4c46-8f54-2bf0c4682dc8`, Worker version `07c901cc-d936-4bb8-a7e9-8dc6689b0fa3`, at 100% traffic with all four schedules. Separate GET-only verification confirmed all six endpoints, broker position source, positive equity direction, unchanged caps, filtered run observability, and the new trade accounting/TIF fields.

Release is complete, but production remains **FAIL/DEGRADED**: natural fresh daytrading/swing success is absent, historical subrequest errors and broker/internal quantity divergence remain, sampled filled rows have null lifecycle timestamps, current crypto fee telemetry is unavailable, production does not supply calibrated `rawEdgeBps`, and unattributed exposure prevents complete cap-enforcement attribution. Follow-up remains natural strategy delivery, lifecycle population, edge calibration, and fill/lot-exact accounting evidence; never use a manual trigger or broker-mutating endpoint to manufacture that evidence.

## August 21, 2026 additive trade observability correction — release candidate

Scope is limited to reliability and observability. Persist broker-provided `time_in_force` on new and reconciled trades, including crypto `gtc`; expose `gross`, `fee`, and `net` on `/api/trades`; keep gross/net `null` until deterministic fill/lot matching exists; populate fee only when all directly order-linked broker-fee rows have known positive USD values; and classify bounded ledger truncation as top-level `degraded`. Do not assign orderless/account-level fees to an individual trade. Preserve all four schedules, caps **$5,000/$3,700/$2,000**, thresholds, sizing, order behavior, and broker safety boundaries.

Focused validation passed: **19 tests / 37 assertions**. Required release gates are full `bun test`, `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. If those pass, deployment is authorized under the standing reliability-maintenance rule using the stored Cloudflare credential. After deployment, verify the actual Cloudflare deployment/version and then separately perform only GET checks for all six endpoints, caps, broker position source, run status/details, crypto cadence, lifecycle/TIF/accounting fields, and filtered run observability. Never call trigger, submit, cancel, close, replace, retry, or any broker-mutating endpoint.

## August 21, 2026 additive per-trade accounting and crypto TIF observability correction

`GET /api/trades` now preserves every existing trade field and adds `gross`, `fee`, and `net` plus explicit attribution/status metadata. Gross and net remain `null` when D1 cannot prove a single trade/lot attribution; the existing model P&L is not projected onto order rows. `fee` is populated only from `broker_fees` rows with a non-empty matching `order_id` and complete non-negative USD values. Orderless or account-level fees remain unattributed and are never assigned to a trade. `net` is computed only when both gross and fee are known. This is read-only observability and does not change caps, schedules, thresholds, sizing, submitted orders, or trading behavior.

The same correction persists the broker-provided `time_in_force` on `trades`, including crypto `gtc`; the submitted TIF and all execution behavior are unchanged. Historical rows remain null only where the broker/D1 record did not provide reliable evidence. Validate field presence, linked-fee-only behavior, conservative nulls, account-level fee exclusion, and crypto GTC persistence before any release.

## August 21, 2026 bounded broker-ledger subrequest correction — deployed and post-release verified

Scope: reliability-only and specifically fixes the confirmed `Broker ledger sync failed: Too many subrequests by single Worker invocation` path. Scheduled `syncBrokerLedger` now calls `getAccountActivitiesBounded` with an explicit **5-page / 500-activity budget** instead of the prior 30-page loop. If another page exists at the boundary, the result is explicitly `truncated: true, degraded: true`; scheduled callers record `BROKER_LEDGER_DEGRADED` with page/activity context, and the existing three-day overlap plus idempotent activity IDs lets later scheduled passes converge. Pending read-only `getOrder` lookups remain capped at 8 per invocation. No broker mutation, schedule, trading decision, order behavior, or cap change is included; caps remain **$5,000/$3,700/$2,000**.

Release gates passed: focused `bun test test/entry-position-authority.test.ts test/alpaca-activities.test.ts test/broker-ledger.test.ts test/order-reconciliation.test.ts` (**24 tests / 90 assertions**), full `bun test` (**149 tests / 470 assertions**), `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. Direct upload of commit `656cefd1b647c4127e01ddfbebaa8a451e80bd0b` produced deployment `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b`, version `a23c13a1-6b61-4c03-aae9-738d35118af9`, at 100% traffic. Separate GET-only verification passed all six endpoints, and the first post-release reconciliation at `2026-08-21 17:21:00 UTC` used one activity page within the five-page budget with `ledgerDegraded: false`. Production remains DEGRADED because the previously documented daytrading/swing, lifecycle, economics, and cap-enforcement gaps remain. Post-release crypto delivery is verified at `2026-08-21 17:38:12 UTC` as a structured skip with no subrequest error (`NO_POSITION_TO_EXIT`, `DECISION_HOLD`). Never use trigger, order, close, cancel, replace, retry, or other broker-mutating endpoints as validation.

## August 21, 2026 bounded dashboard and order-lifecycle correction — deployed and GET-only verified

Scope was reliability-only: correct missing or false-zero account market value from broker long/short aggregates, count all broker positions in every account-wide snapshot writer, normalize `submitOrder` responses so authoritative lifecycle timestamps persist, and let read-only reconciliation refresh status-relevant missing lifecycle fields on terminal rows. Persist only non-null broker timestamps; inapplicable fields remain null. No timestamps were inferred, D1 was not used as a broker-state fallback, and caps `$5,000/$3,700/$2,000`, schedules, thresholds, sizing, and trading behavior were preserved.

Validation passed: **138 tests / 422 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. Direct multipart upload of source commit `30b605ff4bbbb86a60d67a9fb4f4a58d0cbb0be1` produced Cloudflare version/deployment `45d067bc-1944-4041-ae8e-0f7fc261dd55` at 100% traffic; read-only Cloudflare metadata confirmed all four schedules. Separate GET-only verification returned HTTP 200 for all six endpoints, `/api/positions` reported `source: alpaca` with 29 positions, and `/api/dashboard` reported `market_value: 8494.11`-equivalent and `latestSnapshot.positions_count: 29`. Production remains DEGRADED because fresh daytrading/swing success, populated historical lifecycle fields, per-trade gross/fee/net accounting, fee telemetry, quantity-divergence resolution, the observed crypto cadence gap, and calibrated crypto edge proof remain incomplete.

## August 21, 2026 strict read-only production control and alias-correction release gate

Status: **LOCAL VALIDATION COMPLETE; PRODUCTION DEPLOYMENT AND SOURCE IDENTITY NOT ESTABLISHED; production remains DEGRADED and is not healthy.** The alias correction is a read-only `/api/runs?trigger=` boundary change mapping `daytrading_cron` to stored `cron` and `reconciliation_cron` to stored `reconcile_cron`. Exact canonical filters continue to work and returned rows preserve stored trigger values. Do not alter run history, scheduler dispatch, schedules, caps, strategy thresholds, sizing, or broker behavior; no DDL or migration is required.

The August 21 GET audit confirmed HTTP 200 for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; broker-authoritative positions reported `source: alpaca` with 29 rows; caps remained `$5,000/$3,700/$2,000`; and equity direction was positive. Fresh daytrading and swing success is not proven, lease/error/fee skips are present, lifecycle timestamps are null in sampled trades, per-trade gross/fee/net fields are absent, crypto edge comparison is not live-proven, and current Cloudflare/source identity is not independently verified.

Local validation: focused dashboard-readonly tests **5 tests / 53 assertions**, full suite **131 tests / 403 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run passed. Deployment requires a separate authorized release action and secure Cloudflare credentials, followed by separate GET-only live verification.

## August 21, 2026 strategy-filtered trades and broker-authoritative swing reconciliation — latest recorded release receipt

Status: **RELEASE RECEIPT RECORDED; live control remains DEGRADED and is not healthy.** The correction validates `GET /api/trades?strategy=daytrading|swing|crypto`, bounds `limit` at 500 (default 50), returns explicit response metadata, and rejects invalid trade/run strategy filters with HTTP 400. Read-only API requests issue no DDL. Swing D1-only rows are closed locally through `closePosition(..., 'broker_authoritative_sync_absent')` with structured `BROKER_AUTHORITATIVE_SYNC_ABSENT`; actual broker/internal quantity mismatches still halt new swing BUY admission for the current cycle. The current GET-only control did not independently authenticate Cloudflare deployment identity or traffic.

Release receipt: **125 tests / 374 assertions**, TypeScript, diff-check, and Wrangler dry-run passed. Captured deployment receipt `1b286e9a-6d2f-45b9-a439-72fd12654f9c` served Worker version `ced43daf-ed03-4add-ac07-1d8bf562b72c` at recorded 100% traffic with all four schedules. A later captured deployment receipt is `47158569-968b-4bae-83ad-0c24134d42d2` / Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, created August 21, 2026 at 07:57:51 UTC. Source mapping and current live control-plane identity were not independently revalidated by this control. Separate GET-only checks confirmed all six endpoints, broker source `alpaca` with 29 positions, caps `$5,000/$3,700/$2,000`, invalid-filter HTTP 400 responses, and 20 crypto-only trades. No trigger or broker-mutating endpoint was used.


## August 21, 2026 read-only trade-filter and stale-D1 correction

This bounded reliability correction addresses two live defects. `GET /api/trades` now applies `strategy=daytrading|swing|crypto` and rejects invalid values with HTTP 400. Swing reconciliation closes broker-absent D1-only rows through `broker_authoritative_sync_absent` only when no pending broker order explains them, while actual broker/internal quantity mismatches retain the current-cycle BUY safety halt. Invalid `/api/runs` strategy filters now also fail closed with HTTP 400.

Required local gates: focused dashboard/reconciliation tests, full `bun test`, `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. Preserve caps **$5,000/$3,700/$2,000**, schedules, thresholds, sizing, and all broker-authoritative semantics. After release, separately GET all six required endpoints, filtered `/api/trades?strategy=crypto`, invalid trade/run filters, filtered run families, caps, source, schedules, lease/error observability, lifecycle fields, and aggregate gross/fee/net. Do not use triggers or any broker-mutating endpoint; do not label production healthy without fresh natural daytrading and swing evidence.

Release receipt: validation passed with **125 tests / 374 assertions**, TypeScript, diff-check, and Wrangler dry-run. Cloudflare deployment `1b286e9a-6d2f-45b9-a439-72fd12654f9c` serves Worker version `ced43daf-ed03-4add-ac07-1d8bf562b72c` at 100% traffic with all four schedules. Separate GET-only verification confirmed the six required endpoints, broker source `alpaca` with 29 positions, caps `$5,000/$3,700/$2,000`, invalid trade/run filter HTTP 400 responses, and `/api/trades?strategy=crypto` returning 20 rows all tagged `crypto`.

Production remains **DEGRADED**, not healthy. No fresh natural daytrading or swing success is visible after release; lease-held and historical divergence/error runs remain explicit. The six nullable lifecycle timestamps are exposed but remain null on the sampled historical rows; per-trade fee/gross/net fields are unavailable and were not fabricated.

## August 21, 2026 bounded Alpaca lifecycle-timestamp correction — deployed and verified

This additive correction adds six nullable `trades` columns and persists only corresponding non-null Alpaca Order timestamps: `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at`. Updates are monotonic per field and never erase stored lifecycle evidence; caps **$5,000 daytrading / $3,700 swing / $2,000 crypto**, all schedules, edge-gate behavior, read-only reconciliation, and trading behavior are unchanged.

Validation passed: **123 tests / 361 assertions**, `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. Remote D1 migration was applied and all six columns verified. Deployment `6ef8737a-85ca-4fbb-8886-c938237dc993` serves version `5ff1ee08-bdc1-46b7-9aa6-93962d25beb4` at 100% traffic with all four schedules; a separate post-deployment GET-only verification at **11:04:24–11:04:25 UTC on August 21, 2026** returned HTTP 200 for all six endpoints and confirmed broker-authoritative positions, unchanged caps, and lifecycle field exposure. Natural August 21 daytrading and swing success remains unverified; prior swing history includes errors, so production remains **DEGRADED**, not healthy. Do not manually trigger a cycle or use any broker-mutating endpoint to close this gap.

## August 21, 2026 additive trade-lifecycle persistence correction — release gate

Scope: additive persistence only. The correction adds `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at` to `trades`, wires broker order imports and read-only reconciliation to preserve non-null timestamps monotonically, and leaves caps, schedules, strategy behavior, sizing, and order paths unchanged. Apply `trade-lifecycle-columns-migration.sql` once on legacy D1 before deploying the Worker.

Required validation: focused lifecycle/read-only tests, full `bun test`, `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. After an authorized release, perform separate GET-only checks for all six endpoints, verify `/api/trades` exposes the new fields, recheck broker-authoritative positions, caps, filtered runs, schedules, fees/gross/net, and natural scheduled evidence. Do not trigger cycles or call submit, cancel, close, replace, retry, or any other broker-mutating endpoint.

## August 21, 2026 runtime-cap and scheduler DDL correction — deployed

The local correction makes runtime cap loading consistent with `/api/config`: daytrading uses `maxCapitalUsd` or `max_capital_usd`, and swing uses `swing_maxCapitalUsd` or `swing_max_capital_usd`, with existing defaults retained for missing/malformed values. `scheduled()` no longer mutates D1 schema. It performs a read-only `pragma_table_info('positions')` check before strategy cycles; absent `positions.strategy` blocks the cycle and records an error rather than attempting runtime DDL. Apply `positions-strategy-column-migration.sql` through the normal migration process for legacy databases before an authorized release.

Local gate passed: focused `bun test test/runtime-config-schema.test.ts test/capital-caps.test.ts` (**12 tests / 31 assertions**), full `bun test` (**121 tests / 359 assertions**), `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. Source commit `2637a1e07bedbc72592f546302a94fd9c195b927` is deployed as Cloudflare deployment `2c222e36-a64c-414e-898c-cbdfb10cb58f`, Worker version `e7425217-78c6-4bd2-bc2b-ee1e14cbd123`, at 100% traffic. All four schedules and six required GET endpoints passed; remote D1 read-only verification confirmed `positions.strategy` exists, so no migration was needed. No trigger or broker-mutating operation was used. Production remains **DEGRADED** pending swing delivery, crypto history/fee-edge, the separate crypto ownership/GTC persistence correction, lifecycle/P&L, and natural scheduled-run evidence.

## August 21, 2026 swing-cap correction

The confirmed swing admission gap is corrected locally. Swing BUY checks now carry approved cycle-level entry notional into subsequent checks, so current broker-backed swing exposure plus planned entries cannot exceed the unchanged **$3,700** cap; exhausted headroom is recorded as structured `CAPITAL_CAP` observability. Exits, protective behavior, thresholds, turnover/minimum-size behavior, daytrading, crypto, and all vital caps remain unchanged.

Validation passed on August 21, 2026: focused swing/risk/cap/skip/pagination tests, full suite **115 tests / 346 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. The correction is deployed and separately read-only verified. Commit `d9c8ec6fd0315980549078169c3e2d69986700d0` is live as Cloudflare deployment `602cdd72-1a49-4db5-bd86-898efea14315`, Worker version `7b20c401-fe15-41e5-ac71-a8d798e8112d`, at 100% traffic. All four schedules and all six GET endpoints passed; no broker-mutating endpoint was used.

Known remaining gaps remain explicit: crypto positive-edge BUYs fail closed as `EDGE_CALIBRATION_UNAVAILABLE` because no production caller supplies calibrated `rawEdgeBps`; several broker lifecycle timestamps and crypto GTC `time_in_force` are not fully persisted; P&L remains model/gross-style plus conservative attributed fees rather than fill/lot-exact accounting; and fresh natural post-release strategy/reconciliation success is still required before health can be declared.

## August 21, 2026 targeted swing-cap correction — release gate

Local source correction: swing BUY admission now carries cycle-level proposed notional into every subsequent risk check. This enforces the unchanged **$3,700** swing cap across multiple proposals while preserving existing turnover/minimum-size behavior, thresholds, all other caps, exits, and protective behavior. The correction is deployed and live-verified as Cloudflare deployment `602cdd72-1a49-4db5-bd86-898efea14315`, Worker version `7b20c401-fe15-41e5-ac71-a8d798e8112d`, at 100% traffic.

Before any authorized deployment, run and record: `bun test test/risk-fee-aware.test.ts`, `bun test`, `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. Review the diff to confirm only swing entry-cap admission and focused tests/docs changed. Do not run a trigger, cycle, submit, close, cancel, replace, retry, or any broker-mutating endpoint. After deployment, use only GET/read-only checks first, then wait for a natural swing schedule run and verify proposed/submitted BUY notional does not exceed **$3,700**.

## Strict read-only production control receipt, August 21, 2026, current sample through 12:50:59 UTC

Status: **DEGRADED, do not label healthy**.

- All required GET endpoints returned HTTP 200: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`.
- Broker authority passed: `/api/positions` reported `positionsAvailable: true`, `source: "alpaca"`, and 29 broker positions; failed broker fetch behavior remains fail-closed with no D1 live-state fallback.
- Equity direction passed in the current sample: `$98,482.90` current equity versus `$98,270.0927` last equity; the latest stored snapshot is `$98,483.26` at `2026-08-21 12:38:04` UTC. Configured caps remain `$5,000/$3,700/$2,000`.
- Schedule source/dispatch passed for daytrading, swing, crypto `:07/:37`, and reconciliation. Natural crypto delivery was observed at `09:07:33`, `09:37:33`, `10:07:35`, `10:37:33`, `11:07:33`, `11:37:33`, `12:07:33`, and `12:38:10` UTC; reconciliation delivered about every 10 minutes through `12:50:59`, including `MAINTENANCE_ONLY` and `CYCLE_LEASE_HELD` skips. The latest known daytrading strategy run ended in broker/internal quantity-divergence error at `2026-08-20 16:35:42`; no swing run was visible in the fetched history.
- The sampled 50 trades expose broker fill/status fields, but all six nullable lifecycle timestamps are null; their presence in the API is exposure only, not proof of population. No per-trade gross, fee, or net fields are exposed. Dashboard gross/fee/net values are aggregate model/ledger outputs and are not fill-exact per-trade accounting.
- Filtered run observability passed for the visible trigger families. Crypto edge-gate source/test wiring passed inspection, but the live sample only demonstrates fee-telemetry gating and does not prove the configured post-cost edge comparison was exercised.
- Historical cap evidence: August 10 daytrading exposure `$5,679.878` remains a prior-release defect record. Current configured caps remain `$5,000/$3,700/$2,000`; runtime enforcement is covered by regression tests but not fully proven by this read-only sample.

Correction action: documentation and `/workspace/NOW.md` were refreshed to preserve the degraded state and explicit follow-up. No code/config/deployment mutation was required. Do not manually trigger a cycle to close the evidence gap; rerun the same GET-only control after the next natural daytrading and swing windows.

## August 21, 2026 crypto edge-gate correction

Release scope: add an explicit crypto-only fail-closed gate for a configured positive `minEdgeAfterCosts` when no calibrated `rawEdgeBps` exists; never derive edge from confidence; preserve daytrading/swing behavior and caps `$5,000/$3,700/$2,000`; classify the skip as `EDGE_CALIBRATION_UNAVAILABLE`. No D1 migration is required.

Pre-release evidence: 111 tests passed with 330 assertions, TypeScript passed, `git diff --check` passed, and `bunx wrangler deploy --dry-run --outdir /workspace/alpaca-worker-bundle-crypto-edge-fix` passed. Live GET-only probes passed for `/health`, `/api/config`, `/api/positions`, `/api/dashboard`, and filtered `/api/runs`; the natural crypto run at `2026-08-21 07:37:34` CPH had 7 decisions, 0 trades, and 0 errors. No trigger, submit, cancel, close, replace, retry, or other broker mutation was used.

Release status: **deployed, read-only verified, natural post-release run pending**. Cloudflare deployment `47158569-968b-4bae-83ad-0c24134d42d2` serves Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e` at 100% traffic, with all four schedules present. The upload response was successful, and `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, and filtered `/api/runs` smoke checks returned successfully. The next required evidence is the first natural post-release crypto run showing the new structured skip behavior; do not manually trigger a cycle or label production healthy before that evidence exists.

## August 21, 2026 reliability correction candidate

Before deployment, require the complete local gates and review the bounded changes: net/gross presentation consistency, `/api/runs` pagination and filtering, broker-authoritative quantity persistence with the existing mismatch safety block, one cycle-level `POSITION_QTY_MISMATCH` event, and non-terminal stock/swing SELL/CLOSE suppression via `PENDING_EXIT_EXISTS`. Confirm caps remain `$5,000/$3,700/$2,000`, no strategy thresholds or trade budgets changed, protective/risk-reducing exits remain eligible, and no broker-mutating endpoint was used. After deployment, perform a separate read-only verification of all six endpoints, fresh run delivery, skip observability, lifecycle fields, fees/net, caps, and the four schedules.

Current status: **deployed and live-verified, with fresh successful scheduled-run evidence pending**. Final source commit `dab504cb091b2bf20120d9f8d3fd2d18ca61a4dc` was accepted as follow-up deployment `b1c1bc11ce6a451da97a8325a70f89bb` after base deployment `07615065-0302-41c6-8a22-4203ea38b5c9`. Full local validation passed with 109 tests and 321 assertions, typecheck, diff-check, and Wrangler dry-run; final GET-only checks passed for all six endpoints. The latest reconciliation at `2026-08-21 07:20:24` UTC was `CYCLE_LEASE_HELD`, so do not label the control healthy until a natural successful post-release run is observed.

## Bounded entry-identity release — August 18, 2026 (deployed and live-verified)

The release uses deterministic stock/swing `client_order_id`, `logOrderTrade` BUY persistence, the `findNonTerminalTradeByClientOrderId` retry guard, and crypto fee telemetry through `feeTelemetryFromAggregate` with 60 s freshness. Local validation passed with 101 tests and 294 assertions, TypeScript typecheck, and diff-check. Live release receipt from source commit `f122287703087ab959768d02ec931e21d85319a3`: deployment `03e3ef01-bb25-4010-b4b3-03829e7c09d5`, Worker version `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69`, 100% traffic, all four schedules, HTTP 200 read-only endpoint checks, dashboard caps `5000/3700/2000`, broker-backed positions with 38 symbols, and remote D1 lifecycle schema verified. No trading action was used for deployment or smoke testing.

## Lifecycle hardening release gate — August 10, 2026

Before deploying this candidate, run the full local gates: `bun test`, `bunx tsc --noEmit`, and `git diff --check`. Confirm that the release preserves daytrading **$5,000**, swing **$3,700**, and crypto **$2,000** caps and does not alter confidence thresholds, max-trade settings, universes, or fee gates.

Apply/verify the additive trade-intent columns `intent_stop_loss_price` and `intent_take_profit_price` through the normal write-path schema readiness, and verify the existing `crypto_entry_reservations` migration remotely before any crypto entry cycle. Do not use a trading cycle as a migration or smoke test.

After deployment, verify the new Worker version, 100% traffic, configured schedules, health, read-only GET endpoints, remote D1 schema, broker-authoritative positions, reservation counts/notional, pending/partial/filled decision convergence, and category exposure against caps. Read-only checks must not submit, cancel, replace, retry, or close orders. Roll back to the prior verified Worker version if schema readiness fails, broker/D1 lifecycle divergence persists, or cap enforcement is not evidenced.

Current candidate validation: 92 tests passed with 273 assertions, typecheck and diff-check passed, and no broker mutation was used. Remote D1 schema and live Worker deployment are verified: deployment `32fdaa9c-0609-4be1-b16c-6369af4dfc8e`, version `dff3e198-1cb3-49d1-ac5d-706a7d292258`, 100% traffic, four schedules, and read-only endpoints passed.

# Deployment runbook

## August 21, 2026 `/api/runs` pagination reliability/observability fix

Local source correction: `GET /api/runs` now derives response `page` from an explicitly supplied offset as `floor(offset / limit) + 1`; requests using `page` continue to derive offset from page exactly as before. This changes only read-only pagination metadata. It does not change daytrading, swing, or crypto caps, strategy thresholds, budgets, order sizing, or trading behavior.

Validation gate before any authorized release: run `bun test test/dashboard-readonly.test.ts`, `bun test`, `bunx tsc --noEmit`, and `git diff --check`. This work is not deployed and must not call a live endpoint. Any future release must use GET-only smoke tests and require natural scheduled-run evidence; never use trigger, order, close, cancel, replace, retry, or other broker-mutating endpoints as validation.

Current production state remains **DEGRADED, not healthy**: missing swing delivery evidence, crypto history/fee or edge-gate blocks, lifecycle/P&L gaps, and pending natural strategy evidence remain. Vital caps are unchanged at daytrading **$5,000**, swing **$3,700**, and crypto **$2,000**.

## Dashboard 1102 hotfix gate — August 10, 2026

Before any release of the local dashboard hotfix, verify that every GET/read-only API construction uses `new Database(env.DB, { readOnly: true })`. Read-only construction must perform zero DDL, `ALTER TABLE`, index creation, pragma/schema checks, or other repair work; write/trading construction remains the only runtime schema-readiness path. Confirm `src/index.ts` has no unconditional fetch-time `ALTER TABLE positions` or equivalent schema repair.

The dashboard uses bounded history windows (90 performance rows and 90 category rows per strategy) and does not issue the removed duplicate per-strategy decision/trade/run history fan-out. Verify broker-authoritative positions: when Alpaca positions fail, return `positionsAvailable: false` with no D1 fallback. The pre-release validation gate was local/read-only; the release is now deployed and live evidence is recorded below.

Required commands from `/workspace/alpaca-trading-bot`:

```bash
bun test
bunx tsc --noEmit
git diff --check
bunx wrangler deploy --dry-run
```

Record exact pass counts and dry-run output in the release evidence. A failed or timed-out dashboard dry-run, any read-only DDL, an unbounded history query, or a broker-failure D1 fallback is a release blocker.

This is the canonical release procedure for `alpaca-trading-bot`.

## Important environment fact

In the current proxy environment, `bunx wrangler deploy` can exit successfully without creating a new Cloudflare Worker version. Treat Wrangler's exit code and console output as a build/upload attempt, not as proof of a live deployment.

For this Worker, the authoritative proof is the Cloudflare API deployment list showing a new version at 100% traffic, followed by read-only HTTP smoke tests.

## 1. Review and test locally

Run from the repository root. The local migration command is safe for a disposable/local D1; do not use the remote command during local validation:

```bash
bun run db:migrate:crypto-reservations
```

For the release environment, after source review and before deployment, an authorized operator must apply the idempotent migration and run the read-only verification:

```bash
bun run db:migrate:crypto-reservations:remote
bun run db:verify:crypto-reservations:remote
bun run db:migrate:trade-intent:remote
bun run db:verify:trade-intent:remote
```

The verification must show the `crypto_entry_reservations` table and `idx_crypto_entry_reservations_expiry` index, and the trade-intent verification must show both additive intent columns. A missing object blocks deployment; the Worker fails closed rather than creating this safety-critical table at runtime.

Run from the repository root:

```bash
cd /workspace/alpaca-trading-bot
git status --short
git diff --check
bunx tsc --noEmit
bun test
bunx wrangler deploy --dry-run
```

Expected current baseline:

- TypeScript check passes.
- 85 tests pass, 0 fail, 257 assertions, including fresh/idempotent crypto schema migration, crypto reservation, dashboard read-only, fee telemetry, budget, risk, strategy-comparison, and reconciliation coverage.
- `git diff --check` passes.
- Wrangler dry-run succeeds.
- The earlier capital-cap release is the historical baseline; the current hardening release is recorded in the August 10, 2026 release block below.
- A dry-run warning must be investigated rather than ignored if it is new.

Do not run trading triggers, close endpoints, manual cycles, or order actions as deployment tests.

## 2. Commit and push source changes

Review the diff, then commit and push:

```bash
git diff --stat
git add <intended-files>
git commit -m "<short release description>"
git push origin main
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

The final two commit hashes must match. A clean working tree is preferred before deployment.

## 3. Build an explicit fresh bundle

Do not select an arbitrary directory under `.wrangler/tmp`; it may contain an older bundle. Build to a new explicit output directory:

```bash
rm -rf /workspace/alpaca-worker-bundle-release
bunx wrangler deploy --dry-run --outdir /workspace/alpaca-worker-bundle-release
ls -l /workspace/alpaca-worker-bundle-release/index.js
```

The file uploaded below must be the `index.js` from this explicit build.

## 4. Upload directly through the Cloudflare multipart API

The production Worker is:

- Account ID: `763e5b5405cdf8b307fe62dbf68c4f32`
- Script: `alpaca-trading-bot`
- Public hostname: `alpaca-trading-bot.joachim-763.workers.dev`
- D1 database ID: `2bc505a2-d744-4322-8c3b-5f5ebe35f9a1`

Never paste the token into source, documentation, chat, or command history. In the managed assistant environment, retrieve it from the encrypted credential store:

```bash
export CLOUDFLARE_API_TOKEN="$(assistant credentials reveal --service cloudflare --field api_token)"
```

Create metadata with the binding and all four schedules. The `database_id` and `database_name` fields are both required for this multipart upload:

```bash
cat > /workspace/alpaca-worker-metadata.json <<'JSON'
{"main_module":"index.js","compatibility_date":"2024-06-20","compatibility_flags":["nodejs_compat"],"bindings":[{"type":"d1","name":"DB","database_id":"2bc505a2-d744-4322-8c3b-5f5ebe35f9a1","database_name":"alpaca-trading-bot"}],"triggers":{"crons":["*/5 13-21 * * 1-5","0 22 * * 1-5","7-59/30 * * * *","*/10 * * * *"]}}
JSON
```

Upload the exact fresh bundle. Use `--fail-with-body` so API errors are not mistaken for success:

```bash
curl --fail-with-body --silent --show-error --max-time 120 \
  -X PUT \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -F "metadata=@/workspace/alpaca-worker-metadata.json;type=application/json" \
  -F "index.js=@/workspace/alpaca-worker-bundle-release/index.js;type=application/javascript+module" \
  "https://api.cloudflare.com/client/v4/accounts/763e5b5405cdf8b307fe62dbf68c4f32/workers/scripts/alpaca-trading-bot" \
  | tee /workspace/alpaca-worker-direct-upload.json
```

The response must contain `success: true` and a new `deployment_id`. Do not assume that a response from Wrangler means the same thing.

## 5. Verify the actual Cloudflare deployment

Query the authoritative deployment list directly:

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/763e5b5405cdf8b307fe62dbf68c4f32/workers/scripts/alpaca-trading-bot/deployments"
```

The newest deployment must show:

- a new deployment ID;
- a new version ID;
- `percentage: 100`.

Verify schedules separately:

```bash
curl --fail-with-body --silent --show-error \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/763e5b5405cdf8b307fe62dbf68c4f32/workers/scripts/alpaca-trading-bot/schedules"
```

The expected schedules are:

- `*/5 13-21 * * 1-5`
- `0 22 * * 1-5`
- `7-59/30 * * * *`
- `*/10 * * * *` read-only maintenance/reconciliation

If a schedule is missing, stop and repair the schedule configuration before declaring the release complete.

## 6. Run read-only live smoke tests

For this dashboard change, also inspect the JSON from `GET /api/dashboard`: `capitalCaps.daytrading`, `.swing`, and `.crypto` must be finite, non-negative resolved values or `null`. Verify the Pages dashboard renders the three clearly labeled **Capital cap** cards. A missing or malformed cap, dashboard HTTP failure, or timeout must show `Unavailable`; do not use buying power, cash, equity, portfolio value, or positions to fill it. This check is read-only and must not call trigger, close, submit, cancel, replace, or any other broker mutation endpoint.

```bash
base='https://alpaca-trading-bot.joachim-763.workers.dev'
for path in health api/dashboard api/trades api/runs; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$base/$path")
  printf '%s %s\n' "$path" "$code"
done
```

Expected result: HTTP 200 for all four endpoints.

Also check `/api/positions` when validating broker availability. Do not use `/api/trigger`, `/api/trigger-swing`, `/api/trigger-crypto`, close endpoints, or any order endpoint for smoke testing.

## 7. Documentation and release receipt

Documentation is part of every release. Before declaring work complete, update the relevant README, `docs/OPERATIONS.md`, this runbook, and the workspace status note. The update must state what changed, why it changed, validation results, deployment state, known risks, and concrete next steps. Do not leave documentation for a later cleanup pass.

Record these values in the release note or conversation:

- Git commit pushed to the active release branch (`origin/fix/remove-premature-position-upsert-entryside` for this release).
- Cloudflare deployment ID and version ID.
- Traffic percentage.
- Schedule list.
- Test/typecheck result.
- Read-only HTTP status results.
- Confirmation that no manual cycle, order, cancel, close, or retry was run.

## Historical release evidence

The following August 18, 2026 receipt is retained for audit history and is not the current deployment:

- Runtime source commit: `f122287703087ab959768d02ec931e21d85319a3` (`fix: deterministic entry identity and retry guard`), pushed to `origin/fix/remove-premature-position-upsert-entryside`
- Cloudflare deployment: `03e3ef01-bb25-4010-b4b3-03829e7c09d5`
- Worker version: `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69`
- Cloudflare control-plane verification: completed August 18, 2026; newest version at 100% traffic
- Live schedules: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`
- Remote D1: `crypto_entry_reservations`, `idx_crypto_entry_reservations_expiry`, `client_order_id`, fill/lifecycle columns, and both trade-intent columns verified
- Validation: 101 tests passed with 294 assertions; TypeScript, diff-check, and fresh Wrangler dry-run passed
- Read-only HTTP verification: `/health`, `/api/dashboard`, `/api/trades`, `/api/runs`, and `/api/positions` returned HTTP 200; `/api/dashboard` reported caps `5000/3700/2000`; `/api/positions` reported `positionsAvailable: true`, `source: alpaca`, and 38 positions
- Latest maintenance evidence: `/api/runs` showed `MAINTENANCE_ONLY`, `trades_executed: 0`, broker order reads, and no imported broker orders; no manual trading cycle, order, cancel, close, retry, reconciliation trigger, or other mutating endpoint was run during verification
- Source mapping note: Cloudflare artifacts do not embed the Git SHA; the exact bundle was built from the pushed source commit and uploaded directly.

## Prior-release natural reconciliation evidence

Read-only live verification on August 8, 2026 confirmed that the prior-release natural maintenance schedule had run. `/api/runs` returned 23 `reconcile_cron` entries from `2026-08-08 06:40:53` through `2026-08-08 10:30:51` UTC, including 16 `MAINTENANCE_ONLY` completions and 7 `CYCLE_LEASE_HELD` skips. `/api/trades` returned 19 rows with populated `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at` fields, with reconciliation timestamps from `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC.

No mutating endpoint was called. The run details reported `trades_executed: 0` and `imported: 0`, and the reconciler implementation is limited to broker order GETs plus D1 updates. This supports “no broker mutation observed or indicated” for that prior-release window. It does not provide a strict broker order before/after proof because `/api/orders` is unsupported and no same-window order snapshot pair was available. The latest post-August 10 `reconcile_cron` records observed at 07:10:59, 07:30:59, and 07:50:59 UTC were `CYCLE_LEASE_HELD` skips with `trades_executed: 0`; no completed post-release reconciliation is confirmed. The later daytrading open-window rows at 13:25:59, 13:35:59, and 13:40:59 UTC were also `CYCLE_LEASE_HELD` skips; no 13:30:00 UTC daytrading row was retained in the 30-row response, so that exact first market-open tick is an evidence gap.

## Lease starvation incident and fix

The August 9, 2026 live audit found that read-only `reconcile_cron` shared the strategy lease and could hold it while bounded broker imports were still in flight. That produced repeated `CYCLE_LEASE_HELD` skips and could starve trading. The fix isolates `maintenance`, `daytrading`, `swing`, and `crypto` lease keys, bounds the default lease TTL to 10 minutes, and applies a 12-second timeout to each Alpaca HTTP request. The fix is read-only with respect to broker trading actions; deployment verification must confirm independent lease behavior through run logs, not by triggering a cycle or submitting an order.

## Confirmed lifecycle evidence

Read-only source and historical live evidence confirm a higher-severity lifecycle gap than reconciliation alone: the August 6, 2026 live audit recorded repeated partial-filled exits and subsequent quantity mismatches for daytrading/swing symbols. The August 18 release fixes deterministic stock/swing BUY identity, broker-shaped BUY persistence, and duplicate non-terminal BUY retry protection. Current daytrading and swing SELL/CLOSE paths also have non-terminal pending-exit suppression via `PENDING_EXIT_EXISTS`; remaining production risks are exit decision-derived correlation, the broader partial-fill/cancel/replace lifecycle, and FIFO/lot realization. Crypto has a pending-exit guard and deterministic client IDs, but no complete broker retry/cancel/replace lifecycle.

## Fee-aware release notes

This local patch hardens crypto execution economics without changing the $2,000 crypto cap: protective exits run before discretionary halts, entries default to one per cycle, discretionary exits default to two per cycle, pending entries reserve position/capital capacity, D1 supplies persistent recent-order rate state, and fee telemetry is scoped to positive curated-universe samples from seven days. Strategy tabs still show gross P&L, recorded attributable fees, and net P&L; historical realized P&L remains model/gross-style until fill-lot matching is implemented.

BUY cost checks are quantity/notional-aware. Discretionary signal SELL/CLOSE checks are separate from BUY sizing, and protective, EOD, and manual exits bypass them. Swing cost estimates use explicit bps conversion and round-trip costs; BUY rejection remains disabled until calibrated `expectedEdgeBps` is configured.

Before deployment, rerun the full local gates, review the direct diff, commit/push, build an explicit bundle, upload through the documented Cloudflare multipart path, then verify a new version, 100% traffic, all four schedules, and read-only endpoints. Do not use trading actions as smoke tests.

## Current follow-up queue

The active weekly read-only deferred-risk review is `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`), every Monday at 10:00 Europe/Copenhagen. It is verified active and must not trigger broker mutations.

1. Verify a completed post-August 10 `reconcile_cron` run, lifecycle-field population, run-log evidence, and absence of broker mutations without triggering reconciliation; the checked 07:10:59, 07:30:59, and 07:50:59 UTC records were skips.
2. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.
6. Revalidate Cloudflare deployment identity, 100% traffic, and all four live schedules when authenticated read-only Cloudflare credentials are available; the August 10 conflict remains unresolved.

## Strict read-only production control record, August 21, 2026

**Release/control status: FAIL/DEGRADED, not healthy.** The six required GET endpoints all returned HTTP 200. No trigger, submit, cancel, close, replace, retry, deployment, or broker-mutating operation was used.

Required checks completed:

- Broker-authoritative positions: PASS. `/api/positions` returned `positionsAvailable: true`, `source: "alpaca"`, and 29 rows. D1-only positions are not used as live fallback. MSTR remains unattributed, limiting strategy ownership and cap attribution.
- Equity direction: PASS for current versus last equity, `$98,546.76 > $98,270.0927`; latest snapshot `$98,556.33` at `2026-08-21 23:37:58` UTC. Daily fields are zero and are not sufficient for independent daily validation.
- Caps: PASS for unchanged configured values `$5,000/$3,700/$2,000`. Four source schedules remain exact: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *` UTC.
- Run delivery: reconciliation is fresh through `2026-08-22 00:01:01` UTC and crypto is fresh at `23:08:04` and `23:38:04` UTC with structured zero-error skips. Crypto timing is approximately `:07/:37` but commonly observed at `:08/:38`. Filtered `daytrading_cron` aliasing and structured lease-held observability pass, but fresh successful daytrading and swing delivery are not proven. Historical SQL-variable and subrequest-limit errors remain documented.
- Trade lifecycle/accounting: lifecycle fields are exposed and conservatively persisted. Current filled rows have submitted/filled timestamps, but `gross`, `fee`, and `net` are null with `unavailable_fill_lot_exact`; exact fill/lot accounting and complete fee attribution remain unresolved.
- Crypto edge gate: source and regression wiring pass. Fee telemetry and calibrated raw edge are fail-closed requirements, and confidence is not converted to edge. Live positive `rawEdgeBps` comparison is not proven; current fee telemetry skips are expected degraded evidence.
- Regression: full local suite passed **154 tests / 488 assertions**; typecheck, diff-check, and dry-run evidence remain green.

No deployment is authorized or required from this control. The exact release-verification blocker is unauthenticated Wrangler control-plane access: `bunx wrangler whoami` returned `You are not authenticated`. Keep the existing correction work item open, repair authenticated read-only Cloudflare access, then independently verify the active Worker/source mapping and schedules. Do not manufacture missing strategy evidence with manual triggers or broker mutations.

## Crypto edge/TIF investigation disposition, August 21, 2026

No deployment is required for this investigation. Source and history inspection found no genuine production `rawEdgeBps` producer: only the RiskManager input and a test fixture exist. The production crypto caller enables calibrated-edge fail-closed behavior without supplying a value, so BUYs must remain observable as `EDGE_CALIBRATION_UNAVAILABLE`; never derive edge from confidence, TA, sentiment, fee telemetry, or a configured constant.

The reported day-vs-GTC mismatch is not reproduced in source. Crypto BUY submission explicitly sets `time_in_force: 'gtc'`; Alpaca’s generic helper default is `'day'` only when TIF is omitted, and returned broker TIF is persisted to `trades.time_in_force`. Before any future code change, obtain read-only evidence linking decision ID, client order ID, broker order response, persisted TIF, and deployed source identity. A `day` row would be evidence of caller/deployment/source mismatch, not proof that crypto should be changed to another TIF.

Validation for this documentation-only disposition must not call triggers or broker-mutating routes. Trading logic, caps, thresholds, sizing, schedules, and order behavior remain unchanged.

## August 22, 2026 read-only trade-shape correction release

Release scope is limited to API compatibility and observability: legacy `/api/trades` rows now receive stable lifecycle/accounting keys, and `/api/runs` combined filter coverage is strengthened. The patch preserves read-only GET semantics, broker-authoritative positions, all four schedules, caps `$5,000/$3,700/$2,000`, crypto fail-closed edge/fee gates, GTC crypto order behavior, and all trading logic.

Pre-release validation passed: focused **24 tests / 126 assertions**, full **156 tests / 511 assertions**, `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. Deploy only the repository source at `/workspace/alpaca-trading-bot`; do not use the stale `/workspace/src` tree. After deployment, run separate GET-only checks for all six endpoints plus filtered runs/trades, and record the active release identity if Cloudflare credentials permit.

## August 22, 2026 Control-3 final outcome — deployment follow-up required

The reliability-only correction passed focused **26/154** and full **157/518** regression gates, TypeScript, diff-check, and Wrangler dry-run. The secure Wrangler retry produced no usable deployment receipt; separate GET-only verification still serves `/health` **1.0.0** and `/api/config` **2.4.0**, while local deployable source is **2.6.0**. Treat the release as **not live-proven** and production as **FAIL/DEGRADED**.

Next authorized maintenance step: restore and verify the Cloudflare deployment receipt, deploy the exact validated correction, and then separately GET-check all six endpoints plus filtered `/api/runs`, four schedule expressions/delivery, broker position source, equity direction, lifecycle fields, fee/gross/net consistency, and unchanged caps **$5,000/$3,700/$2,000**. Never use trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating endpoints for this control.

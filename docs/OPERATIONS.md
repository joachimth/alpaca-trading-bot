## August 22, 2026 Control-6 saved-artifact evidence update — FAIL/DEGRADED

Saved artifacts remain contradictory: `/workspace/alpaca-post-release-schedules.json` has all four schedules, while older `/workspace/alpaca-live-schedules-api.json` omits reconciliation; alias captures for `daytrading_cron` and `reconciliation_cron` are empty while canonical filters contain rows, and the requested limited reconciliation artifact is missing. Saved daytrading evidence ends at `2026-08-20 21:55:24` with `CYCLE_LEASE_HELD`, saved swing evidence ends at `2026-08-18 22:00:36` with divergence/RISK_HALTED, and current positions include an unattributed MSTR row. Keep production **FAIL/DEGRADED**; no trigger or broker mutation is authorized by this evidence.

## August 22, 2026 Control-6 strict read-only production control — FAIL/DEGRADED

The current control remains **FAIL/DEGRADED**, not healthy. All six required GET endpoints returned HTTP 200 at approximately 11:00 UTC, but live release identity is inconsistent: `/health` is `1.0.0`, `/api/config` is `2.4.0`, and the validated local deployable source is `2.6.0`. Positions remain broker-authoritative (`positionsAvailable: true`, `source: "alpaca"`, 29 rows), equity direction is current `98,504.50` versus `last_equity` `98,504.5039` (`-0.0039`), and caps remain `$5,000/$3,700/$2,000`.

Reconciliation is delivering fresh structured `MAINTENANCE_ONLY` skips near ten-minute cadence. Crypto delivery is near `:07/:37` but observed around `:08/:38`; timestamps have no timezone suffix, so UTC labeling is not proven. No fresh successful daytrading or swing run is evidenced. Filled trades expose lifecycle fields, while sampled gross/fee/net remain conservatively null under `unavailable_fill_lot_exact`; live numeric crypto edge-gate wiring is not exposed. Live alias filters return canonical rows without `trigger_alias`; the local response-only alias fix is regression-tested but not live-proven.

Local focused control tests passed 59 tests / 253 assertions, full regression passed, typecheck and diff check passed, and Wrangler dry-run passed. Deployment is blocked because `bunx wrangler whoami` reports `You are not authenticated`; no deployment, preview, trigger, migration, or broker mutation was attempted. Keep the system degraded until authenticated source verification, deployment if still required, separate GET-only verification, and natural daytrading/swing observation are complete. See `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-6.md`.

## August 22, 2026 Control-5 correction: explicit filtered-run aliases — FAIL/DEGRADED

The live defect was unreliable filtered-run observability: strict GET-only captures showed `daytrading_cron` and `reconciliation_cron` alias filters returning empty rows while canonical `cron` and `reconcile_cron` filters returned rows, and alias-filtered responses lacked an explicit stable alias indicator. The smallest correction is limited to the read-only API boundary in `src/api.ts`: retain existing SQL alias filtering, add response-only `trigger_alias` values (`daytrading_cron` or `reconciliation_cron`) for alias requests, and preserve canonical stored/returned `trigger` values (`cron` or `reconcile_cron`). Canonical requests receive no invented alias. No DDL, migration, broker access/calls, schedules, caps, broker authority, or trading logic changed.

Required validation and local results: focused `test/dashboard-readonly.test.ts` alias/canonical/no-broker/no-DDL regression **11 tests / 101 assertions passed**; full `bun test` **157 tests / 520 assertions passed**; `bunx tsc --noEmit` passed; and `git diff --check` passed. Deployment was not performed: Wrangler is blocked by the missing `CLOUDFLARE_API_TOKEN` with the exact error `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` No broker-mutating endpoint was used. Production remains **FAIL/DEGRADED**, not healthy, pending authenticated deployment and separate GET-only live verification.

## August 22, 2026 Control-3 correction: filtered runs, release identity, and evidence gaps

Additional control evidence keeps production **FAIL/DEGRADED**: one saved live schedule artifact omits reconciliation, although the post-release artifact and current `wrangler.toml` contain all four UTC schedules. Filtered/analyzed counts are console-only and not persisted in `run_log`; per-trade gross/net remain null until deterministic fill/lot matching, while aggregate gross/net are broker-snapshot-derived and not fill/lot exact. Source contracts pass for broker-authoritative positions, structured skip logging, unchanged caps, filtered-run predicates, and fail-closed crypto edge gates, but live proof remains partial or failed for active schedule identity, fresh daytrading/swing success, exact cadence, complete lifecycle scenarios, direct cap enforcement, production `rawEdgeBps`, and source-to-Worker identity. No cap, schedule, broker-authority, edge-gate, or trading behavior change was made.

## August 22, 2026 Control-3 correction: filtered runs and release identity

Production control found a release/version mismatch: live `/health` reports `1.0.0` and live `/api/config` reports `2.4.0`, while the deployable source reports `2.6.0`. An earlier capture also showed `/api/runs` filter loss; fresh post-attempt GET probes now return correctly filtered rows, but the corrected source is still not live-proven. The local reliability-only correction is present in `src/api.ts`, `src/database.ts`, and `src/version.ts`; it preserves broker-authoritative positions, all four schedules, caps of **$5,000/$3,700/$2,000**, crypto calibrated-edge fail-closed behavior, and trading semantics.

The required correction work item is `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-3.md`; production remains **FAIL/DEGRADED** until deployment and separate GET-only verification succeed. Deployment evidence is contradictory: `final-deployments.json` records `f181f9c3...` at `2026-08-21T21:03:38Z`, while `direct-upload-5bb8153-20260822.json` records deployment `b6293793...` modified at `2026-08-22T01:14:22Z`; neither reconciles with live `1.0.0/2.4.0`, so neither proves the active source/version. No broker-mutating endpoint or trading trigger was used.

## August 22, 2026 release-version observability correction — source-to-Worker identity unresolved

The canonical local release version is **`2.6.0`**, established by the deployable source's `schema.sql` `bot_config.version` seed and the existing dashboard footer. Local metadata and tests agree on `2.6.0`, but live `/health` remains `1.0.0` and live `/api/config` remains `2.4.0`. Historical deployment receipts claim successful uploads, yet they conflict with live identity and with a later direct-upload artifact, so none independently proves the active source/version. This is reliability-only observability work: no trading behavior, schedules, caps, edge gates, broker calls, D1 mutation semantics, or endpoint methods changed.

Focused validation: `bun test test/release-version.test.ts test/dashboard-readonly.test.ts crypto-runtime.test.ts` — **26 tests passed, 154 expect() calls**; full `bun test` — **157 tests passed, 518 expect() calls**; `bunx tsc --noEmit` passed; repo-scoped `git diff --check -- .` passed; and `bunx wrangler deploy --dry-run --outdir /tmp/alpaca-trading-bot-version-dry-run` passed with no deployment. Deployment was attempted but blocked because Wrangler requires `CLOUDFLARE_API_TOKEN`; the separate GET-only recheck still shows live `/health` version `1.0.0`. No broker-mutating endpoint was used.

Caps remain **$5,000/$3,700/$2,000**; crypto calibrated-edge and fee gates remain fail-closed; schedules, broker calls, and trading behavior are unchanged. Production remains **FAIL/DEGRADED**, not healthy, because fresh daytrading/swing success, direct cap enforcement, exact cadence, exact fill-lot accounting, and historical runtime/divergence follow-up remain unresolved.

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

Incident: live `/api/runs` showed a D1 `too many SQL variables` error at **2026-08-21 18:38:03 UTC**. The affected read-only/scheduled observability path was `Database.enrichTradeAccounting()`, which built one dynamic `broker_fees.order_id IN (...)` statement for all returned trades.

Correction: query order IDs in sequential read-only batches of 50 and merge fee rows into the existing map. This preserves fee semantics, broker-linked attribution, conservative null/gross/net behavior, broker-authoritative positions, bounded/read-only reconciliation, all schedules, thresholds, sizing, broker actions, and caps **$5,000/$3,700/$2,000**. Local validation passed: focused 9 tests / 76 assertions, full 154 tests / 488 assertions, typecheck, diff-check, and Wrangler dry-run.

Deployment artifact `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b` with Worker version `a23c13a1-6b61-4c03-aae9-738d35118af9` is recorded at 100% traffic on **August 21, 2026 at 17:15:44 UTC**, but it is not mapped to the current local source/bundle. Current release state is **SOURCE-TO-WORKER IDENTITY UNRESOLVED**. Wrangler remains unauthenticated and the prior Cloudflare credential-reference error remains unresolved. No broker endpoint was called. Follow-up: repair identity/credential access, verify the exact bundle-to-Worker mapping, then perform only GET-only and natural scheduled verification. Do not use triggers or broker-mutating endpoints as validation.

Test-layout note: crypto runtime regression coverage is stored at the repository root as `crypto-runtime.test.ts`, not `test/crypto-runtime.test.ts`; `bun test crypto-runtime.test.ts` passes 14 tests / 48 assertions.

## August 21, 2026 strict read-only control update — FAIL/DEGRADED

The latest GET-only control confirms `/api/positions` source labeling (`alpaca`) but historical run evidence still records broker/internal quantity mismatches: SOFI 73 vs 114 at 16:10:47 UTC, MSTR 3 vs 7 at 16:20:46 UTC, and NOW 1 vs 2 at 16:35:42 UTC. Daytrading is lease-held/error without fresh healthy delivery, swing delivery is unverified, crypto cadence has gaps and errors, reconciliation is maintenance-only, sampled lifecycle and gross/fee/net fields are null, and calibrated edge-after-costs is not live-verifiable. Keep production marked FAIL/DEGRADED; caps and trading behavior are unchanged and no broker mutation or deployment was performed.

## August 21, 2026 additive trade observability correction — deployed and GET-only verified

The reliability correction is live from commit `71aad14b0df1fc693de0e002e1b91d5cb6460eb5`. Broker `time_in_force` is now persisted on new and reconciled trades, including crypto GTC; `/api/trades` adds conservative `gross`, `fee`, and `net` plus explicit accounting and fee-attribution metadata; gross/net remain null until fill/lot matching is provable; direct order-linked fees are exposed only when all linked USD values are known and non-negative; and bounded ledger truncation now persists top-level `degraded` status while retaining `BROKER_LEDGER_DEGRADED` details. No caps, schedules, thresholds, sizing, order behavior, or broker safety boundary changed.

Validation and release receipt: **153 tests / 483 assertions**, TypeScript, diff-check, and Wrangler dry-run passed. Direct upload deployment `061b8e22-184d-4c46-8f54-2bf0c4682dc8` serves Worker version `07c901cc-d936-4bb8-a7e9-8dc6689b0fa3` at 100% traffic with all four schedules. Separate GET-only verification confirmed all six required endpoints, broker-authoritative positions (`source: alpaca`, 29 rows), positive equity direction, caps 5000/3700/2000, filtered run observability, and the new trade fields.

Production remains **FAIL/DEGRADED**, not healthy: latest natural crypto and reconciliation runs are structured skips, historical subrequest-limit errors and position divergence remain, fresh daytrading/swing success is not proven, lifecycle timestamps remain null on sampled historical fills, current crypto fee telemetry is unavailable, calibrated edge is not supplied in production, and unattributed exposure limits full cap attribution. No broker-mutating endpoint was used.

## August 21, 2026 additive trade observability correction — release candidate

The reliability correction preserves broker `time_in_force` in `trades`, including crypto GTC orders, exposes conservative per-trade `gross`, `fee`, and `net` fields, and marks unresolved fill/lot accounting explicitly as `accounting_status: unavailable_fill_lot_exact`. Fees are populated only from complete positive-USD broker-fee rows linked directly to the trade `order_id`; uncertain, orderless, and account-level fees remain unattributed. Ledger truncation now sets the persisted run status to `degraded` while retaining structured `BROKER_LEDGER_DEGRADED` details. Caps remain **$5,000/$3,700/$2,000**, schedules and trading behavior are unchanged, and no broker-mutating endpoint is used for validation.

Focused validation passed: **19 tests / 37 assertions**. Full suite, typecheck, diff-check, Wrangler dry-run, deployment, and separate GET-only verification remain required. Production is still **FAIL/DEGRADED**, not healthy, because live strategy-delivery, lifecycle population, calibrated edge, cap-attribution, and fill/lot-exact accounting evidence remain incomplete.

## August 21, 2026 additive per-trade accounting and crypto TIF observability correction

`GET /api/trades` now preserves every existing trade field and adds `gross`, `fee`, and `net` plus explicit attribution/status metadata. Gross and net remain `null` when D1 cannot prove a single trade/lot attribution; the existing model P&L is not projected onto order rows. `fee` is populated only from `broker_fees` rows with a non-empty matching `order_id` and complete non-negative USD values. Orderless or account-level fees remain unattributed and are never assigned to a trade. `net` is computed only when both gross and fee are known. This is read-only observability and does not change caps, schedules, thresholds, sizing, submitted orders, or trading behavior.

The same correction persists the broker-provided `time_in_force` on `trades`, including crypto `gtc`; the submitted TIF and all execution behavior are unchanged. Historical rows remain null only where the broker/D1 record did not provide reliable evidence. Validate field presence, linked-fee-only behavior, conservative nulls, account-level fee exclusion, and crypto GTC persistence before any release.

## August 21, 2026 bounded broker-ledger subrequest correction — deployed and post-release verified

Scope is reliability-only and addresses the confirmed failing path `Broker ledger sync failed: Too many subrequests by single Worker invocation`. Scheduled `syncBrokerLedger` now uses `getAccountActivitiesBounded` with an explicit **5-page / 500-activity budget**, replacing the prior 30-page loop. When the broker exposes another page at the budget boundary, the read returns `truncated: true, degraded: true`; scheduled callers emit structured `BROKER_LEDGER_DEGRADED` details and continue using the existing 3-day overlap/idempotent activity IDs for later convergence. Pending read-only `getOrder` reconciliation lookups remain capped at 8 per invocation. No broker state is mutated, and all four schedules, trading decisions, order behavior, and caps **$5,000/$3,700/$2,000** are unchanged.

Focused entry-authority, bounded ledger/activity, and reconciliation validation passed: **24 tests / 90 assertions**. Full `bun test` passed with **149 tests / 470 assertions**; TypeScript, diff-check, and Wrangler dry-run also passed. Direct upload of commit `656cefd1b647c4127e01ddfbebaa8a451e80bd0b` produced deployment `2bf8e6c6-3d6d-456d-ad65-0bb6bfeef07b`, Worker version `a23c13a1-6b61-4c03-aae9-738d35118af9`, at 100% traffic. Separate GET-only verification passed all six endpoints; the first post-release reconciliation at `2026-08-21 17:21:00 UTC` completed with one activity page within the five-page budget and no degradation. Production remains **DEGRADED, not healthy** because fresh daytrading/swing success, populated historical lifecycle fields, per-trade gross/fee/net accounting, and live cap enforcement remain incomplete. Post-release crypto delivery is verified at `2026-08-21 17:38:12 UTC` as a structured skip with no subrequest error (`NO_POSITION_TO_EXIT`, `DECISION_HOLD`). No trigger, submit, cancel, close, replace, retry, or broker-mutating endpoint was used.

## August 21, 2026 bounded dashboard and order-lifecycle correction — deployed and GET-only verified

The correction is limited to reliability and observability: the dashboard derives `account.market_value` from the broker positions returned in that same response and sets it to `null` when that broker read is unavailable; `latestSnapshot.positions_count` follows the same broker position set. All shared account-wide snapshots count the complete broker position set, including swing and crypto schedule writers, and `submitOrder` normalizes broker responses so non-null lifecycle timestamps reach persistence. Read-only reconciliation revisits terminal rows with status-relevant missing lifecycle fields and persists only non-null timestamps returned by Alpaca; inapplicable nullable fields remain null and no timestamp is inferred when Alpaca returns null. Caps remain $5,000/$3,700/$2,000, all four schedules and strategy behavior are unchanged. Validation passed with **138 tests / 422 assertions**, TypeScript, diff-check, and Wrangler dry-run; direct upload produced version/deployment `45d067bc-1944-4041-ae8e-0f7fc261dd55`, and separate GET-only verification passed. Production remains DEGRADED because fresh daytrading/swing success, historical lifecycle population, per-trade gross/fee/net accounting, fee telemetry, quantity-divergence resolution, the observed crypto cadence gap, and calibrated crypto-edge proof remain incomplete.

## August 21, 2026 strict read-only production control and alias-correction status

Status: **LOCAL VALIDATION COMPLETE; PRODUCTION DEPLOYMENT AND SOURCE IDENTITY NOT ESTABLISHED; production remains DEGRADED and is not healthy.** The alias correction is limited to the read-only `GET /api/runs?trigger=` boundary: `daytrading_cron` maps to stored `cron` and `reconciliation_cron` maps to stored `reconcile_cron`. Canonical filters continue to work, historical rows retain stored trigger values, and no storage, scheduler dispatch, schedule, cap, threshold, sizing, or broker behavior changed.

The August 21 GET audit confirmed all six required endpoints returned HTTP 200, `/api/positions` reported `source: alpaca` with 29 broker-backed rows, configured caps remained `$5,000/$3,700/$2,000`, and equity direction was positive. Fresh daytrading and swing success is not proven; lease/error/fee skips are present; lifecycle timestamps are null in the sample; per-trade gross/fee/net fields are absent; crypto edge comparison is not live-proven; and current Cloudflare/source identity is not independently verified. No trigger, cycle, or broker-mutating endpoint was used.

Local validation remains: focused dashboard-readonly tests **5 tests / 53 assertions**, full suite **131 tests / 403 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run passed. Deployment is a separate authorized follow-up and is not part of this strict read-only control.

## August 21, 2026 strategy-filtered trades and broker-authoritative swing reconciliation — deployed

Status: **DEPLOYED AND READ-ONLY VERIFIED; production remains DEGRADED.** `GET /api/trades` validates `strategy=daytrading|swing|crypto`, bounds `limit` to 500 with default 50, and returns explicit `limit`/strategy metadata while preserving the default unfiltered trade list. `/api/runs` rejects invalid strategy filters. Read-only API construction performs no DDL. Swing reconciliation closes D1-only rows after a complete broker snapshot via `closePosition(..., 'broker_authoritative_sync_absent')` and emits structured `BROKER_AUTHORITATIVE_SYNC_ABSENT`; only actual broker/internal quantity mismatches retain the current-cycle new-BUY halt. No caps, thresholds, schedules, sizing, order behavior, or broker endpoints changed.

Validation passed: **125 tests / 374 assertions**, TypeScript, diff-check, and Wrangler dry-run. Cloudflare deployment `1b286e9a-6d2f-45b9-a439-72fd12654f9c` serves Worker version `ced43daf-ed03-4add-ac07-1d8bf562b72c` at 100% traffic with all four schedules. Separate GET-only verification passed all six endpoints, broker source `alpaca` with 29 positions, caps `$5,000/$3,700/$2,000`, invalid filters HTTP 400, and 20 crypto-only filtered trades. Production remains DEGRADED until fresh natural swing and daytrading evidence exists.


## August 21, 2026 bounded Alpaca lifecycle-timestamp correction — deployed and read-only verified

The correction additively persists the existing Alpaca Order fields `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at` on `trades`. Incoming non-null values are monotonic per lifecycle field and NULL broker snapshots cannot erase stored evidence; no trading behavior, edge gate, schedule, sizing, or cap changed. Caps remain **$5,000 / $3,700 / $2,000**.

Validation passed: **123 tests / 361 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. Remote D1 contains all six columns. Deployment `6ef8737a-85ca-4fbb-8886-c938237dc993`, version `5ff1ee08-bdc1-46b7-9aa6-93962d25beb4`, is at 100% traffic with all four schedules; a separate post-deployment GET-only verification at **11:04:24–11:04:25 UTC on August 21, 2026** returned HTTP 200 for all six endpoints, with broker-authoritative positions and the configured caps intact. `/api/trades` exposes the new fields, but historical lifecycle timestamps remain null until natural broker updates populate them. Production remains **DEGRADED**, not healthy, pending fresh daytrading/swing success and because prior swing runs include errors.

## August 21, 2026 additive trade-lifecycle persistence correction — deployed

The lifecycle persistence gap is corrected with additive broker timestamp columns on `trades`: `submitted_at`, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, and `replaced_at`. Initial imports, direct status updates, and scheduled read-only reconciliation retain non-null timestamps monotonically; trading behavior, schedules, sizing, thresholds, and caps remain unchanged at $5,000/$3,700/$2,000. Remote D1 contains all six columns.

Full validation passed **123 tests / 361 assertions**, TypeScript, diff-check, and Wrangler dry-run. Deployment `6ef8737a-85ca-4fbb-8886-c938237dc993` is live at 100% traffic; all six GET endpoints passed separately and `/api/trades` exposes the new fields. Production remains **DEGRADED** pending fresh August 21 daytrading/swing delivery; prior swing history includes errors.

## August 21, 2026 runtime-cap and scheduler DDL correction — deployed and read-only verified

Scope is limited to two reliability defects. Daytrading and swing runtime config loaders now use the same existing camelCase/snake_case aliases as `/api/config`, while missing or malformed overrides preserve the current defaults. The scheduled handler no longer performs `ALTER TABLE positions ADD COLUMN strategy` on every invocation; strategy cron paths perform a read-only `pragma_table_info` readiness check and fail closed with a recorded error when `positions.strategy` is absent. Legacy databases must receive the explicit `positions-strategy-column-migration.sql` migration once; current schema and behavior are unchanged.

Validation passed locally: focused `bun test test/runtime-config-schema.test.ts test/capital-caps.test.ts` (**12 tests / 31 assertions**), full `bun test` (**121 tests / 359 assertions**), `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run. Source commit `2637a1e07bedbc72592f546302a94fd9c195b927` is deployed as Cloudflare deployment `2c222e36-a64c-414e-898c-cbdfb10cb58f`, Worker version `e7425217-78c6-4bd2-bc2b-ee1e14cbd123`, at 100% traffic. All four schedules and six required GET endpoints passed; remote D1 confirmed `positions.strategy` exists and no migration was required. No trigger or broker-mutating operation was used. Production remains **DEGRADED** because swing delivery is incomplete, crypto history/fee-edge and ownership/GTC lifecycle gaps remain, P&L is not fill-exact, and fresh natural scheduled evidence is pending.

## August 21, 2026 swing-cap correction

The confirmed swing admission gap is corrected locally. Swing BUY checks now carry approved cycle-level entry notional into subsequent checks, so current broker-backed swing exposure plus planned entries cannot exceed the unchanged **$3,700** cap; exhausted headroom is recorded as structured `CAPITAL_CAP` observability. Exits, protective behavior, thresholds, turnover/minimum-size behavior, daytrading, crypto, and all vital caps remain unchanged.

Validation passed on August 21, 2026: focused swing/risk/cap/skip/pagination tests, full suite **115 tests / 346 assertions**, TypeScript, `git diff --check`, and Wrangler dry-run. The correction is deployed and separately read-only verified. Commit `d9c8ec6fd0315980549078169c3e2d69986700d0` is live as Cloudflare deployment `602cdd72-1a49-4db5-bd86-898efea14315`, Worker version `7b20c401-fe15-41e5-ac71-a8d798e8112d`, at 100% traffic. All four schedules and all six GET endpoints passed; no broker-mutating endpoint was used.

Known remaining gaps remain explicit: crypto positive-edge BUYs fail closed as `EDGE_CALIBRATION_UNAVAILABLE` because no production caller supplies calibrated `rawEdgeBps`; several broker lifecycle timestamps and crypto GTC `time_in_force` are not fully persisted; P&L remains model/gross-style plus conservative attributed fees rather than fill/lot-exact accounting; and fresh natural post-release strategy/reconciliation success is still required before health can be declared.

## August 21, 2026 targeted swing-cap correction — local validation status

The confirmed swing capital-cap enforcement gap is corrected locally. Swing cycle entry admission now carries approved BUY notional from earlier proposals into each subsequent `checkEntry` call, enforcing the existing **$3,700** cap across the complete proposal batch despite unchanged broker positions. This is an entry-admission reliability fix only: turnover limits, minimum trade size, confidence/edge thresholds, all strategy caps, exits, and protective exits remain unchanged.

Release validation requirements are: focused swing risk regressions, full `bun test`, `bunx tsc --noEmit`, `git diff --check`, and `bunx wrangler deploy --dry-run`. Validation must remain local/read-only; never trigger a strategy cycle or call submit, close, cancel, replace, retry, or another broker-mutating endpoint. After any authorized release, require natural swing-cycle evidence that proposed and submitted BUY notional remains at or below **$3,700**.

## August 21, 2026 strict read-only production control, current sample through 12:50:59 UTC

Control result: **DEGRADED, not healthy**. All six GET endpoints returned HTTP 200. Broker positions remained authoritative (`/api/positions`: 29 positions, `source: "alpaca"`), equity direction was positive (`$98,480.48` versus `$98,270.0927` last equity), and configured caps remained `$5,000/$3,700/$2,000`.

The checked-in and dispatched schedules are daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`. Crypto delivered repeatedly around `:07/:37` UTC through `12:38:10`; reconciliation delivered about every 10 minutes through `12:50:59`, including `MAINTENANCE_ONLY` and `CYCLE_LEASE_HELD` skips. The latest known daytrading strategy run ended in broker/internal quantity-divergence error at `2026-08-20 16:35:42`; no swing run was visible in the fetched history, so fresh successful daytrading and swing delivery is not established.

Run observability and structured skip reporting pass. The sampled 50 trades expose broker fill/status fields, but all six nullable lifecycle timestamps are null; their API presence is exposure only, not proof of population. No per-trade gross, fee, or net fields are exposed. Crypto source/test edge-gate wiring passes inspection, while live end-to-end comparison against the configured threshold remains unverified. The historical August 10 daytrading exposure of `$5,679.878` remains a prior-release follow-up. This check required documentation/status correction only, not deployment, and used no broker-mutating endpoint.

## Bounded entry-identity fix — August 18, 2026 (deployed and live-verified)

A bounded, non-vital fix removes `Date.now()` from stock/swing entry identity and makes retry duplicate protection deterministic. It does **not** alter the vital caps (daytrading **$5,000**, swing **$3,700**, crypto **$2,000**), confidence gates, max-trade limits, strategy universes, or risk parameters, and it does **not** change the exit decision-correlation gap or the running crypto reservation semantics.

- Daytrading and swing BUY submissions now use a deterministic `client_order_id` derived from the decision ID and symbol (`bot_<decisionId>_<symbol>` / `swing_<decisionId>_<symbol>`) instead of `Date.now()`. This matches the existing crypto pattern (`crypto_<decisionId>_<symbol>`) so every entry has stable retry identity.
- Those BUY submissions now persist immediately through `db.logOrderTrade(order, …)` (the same order-shaped path crypto already uses) rather than a hand-mapped `logTrade` shape, so broker fields, fill state, and timestamps are recorded from the broker response.
- A new reusable `Database.findNonTerminalTradeByClientOrderId(clientOrderId)` detects an existing non-terminal trade before a stock/swing BUY is submitted, so a retry/duplicate of the same decision is skipped before reaching the broker with an auditable `DUPLICATE_ORDER_PREVENTED` skip reason and a decision-status note. Terminal rows (`rejected`/`canceled`/`expired`/`done_for_day`/`stopped`/`replaced`) do **not** block a retry, because they prove the prior order no longer leads to an open position. The lookup orders by `COALESCE(broker_updated_at, timestamp)` then `id` so ties are deterministic.
- Crypto fee telemetry is now routed through the canonical `feeTelemetryFromAggregate` gate with an explicit freshness `maxAgeMs` of **60,000 ms**: telemetry older than the max age fails closed to `unavailable`, sub-threshold samples return `insufficient`, and a failed ledger sync or missing summary returns `unavailable` so an unproven rate is never used for new-entry cost estimation. `getBrokerFeeSummary` now also exposes `cryptoUsdRecent` (the seven-day curated CFEE window) so the aggregate's computed rate matches the existing recent-window rate.

Local validation on August 18, 2026: **101 tests, 294 assertions**, TypeScript typecheck and diff-check passed. Deployment and live verification completed from source commit `f122287703087ab959768d02ec931e21d85319a3`: Cloudflare deployment `03e3ef01-bb25-4010-b4b3-03829e7c09d5`, Worker version `b5b4cb6e-71d2-4b78-924c-fd12acd4ac69`, 100% traffic, all four schedules, HTTP 200 read-only endpoints, `/api/positions` source `alpaca` with 38 broker positions, and `/api/dashboard` caps `5000/3700/2000`. Remote D1 reservation/lifecycle schema verification passed. No trading trigger, order, cancellation, close, replace, retry, or other broker mutation was used.

## Lifecycle hardening candidate — August 10, 2026

The hardening candidate keeps broker positions authoritative and keeps GET/read-only reconciliation free of broker mutations. Current-position rows are created or updated only from broker snapshots; requested quantities are never written as filled positions. Decision metadata converges from broker order status, including pending, partial, filled, and terminal rejection states.

Daytrading admission now carries approved entry notional across the current cycle so the existing **$5,000** cap cannot be exceeded by multiple individually valid entries. Swing entries retain immutable decision linkage and newly filled positions are included in the post-submit broker sync. Crypto reservation state is persistent across cycles and fail-closed: active/committed reservation notional is included in the **$2,000** cap calculation, live orders keep reservations beyond the short rate window, unknown post-submit outcomes retain reservations, and terminal broker evidence releases them.

Committed crypto reservations are never released by local TTL alone; only terminal broker evidence releases them. Crypto BUYs below **$10** estimated notional are skipped before reservation/submission with an auditable `MIN_ORDER_NOTIONAL` reason. ATR stop/target intent is stored with the crypto entry trade and used to reconstruct missing position protection after broker-confirmed sync.

Validation receipt: 92 tests, 273 assertions, typecheck, and diff-check passed locally on August 10, 2026. No broker mutation was used. Remote D1 schema verification is complete for the reservation table/index and both trade intent columns. Live deployment is verified: deployment `32fdaa9c-0609-4be1-b16c-6369af4dfc8e`, Worker version `dff3e198-1cb3-49d1-ac5d-706a7d292258`, 100% traffic, all four schedules, and read-only endpoint checks passed. Natural paper-session observation remains the follow-up gate for proving no cap breach or live-order reservation expiry under real post-release cycles.

# Operations and release notes

## August 21, 2026 read-only trade-filter and stale-D1 correction

The bounded correction addresses two observed reliability defects. `GET /api/trades` now supports bounded `strategy=daytrading|swing|crypto` filtering and rejects invalid values with HTTP 400; `/api/runs` rejects invalid strategy filters the same way. Swing reconciliation closes broker-absent D1-only rows through `broker_authoritative_sync_absent` only when no pending broker order explains them, while real broker/internal quantity mismatches still block new swing BUY entries for the current cycle.

Validation passed: focused and full suites **125 tests / 374 assertions**, TypeScript, diff-check, and Wrangler dry-run. Deployed as Cloudflare deployment `1b286e9a-6d2f-45b9-a439-72fd12654f9c`, Worker version `ced43daf-ed03-4add-ac07-1d8bf562b72c`, at 100% traffic; all four schedules remain present. Separate GET-only verification confirmed HTTP 200 for the six required endpoints, broker-authoritative positions (`source: alpaca`, 29 positions), caps `$5,000/$3,700/$2,000`, invalid-filter HTTP 400 responses, and 20 crypto-only rows from `/api/trades?strategy=crypto`.

Production remains **DEGRADED**, not healthy: latest daytrading evidence is lease-held skips through August 20, latest swing evidence is the August 18 divergence error, and no fresh natural post-release daytrading/swing success exists. The six nullable lifecycle fields are exposed but remain null in the historical sample; fee telemetry can be unavailable, and exact per-trade fee/gross/net accounting is not exposed.


## August 21, 2026 `/api/runs` pagination reliability/observability fix

The local read-only correction fixes pagination metadata for `GET /api/runs`: an explicitly supplied `offset` now reports `page = floor(offset / limit) + 1`, while page-based requests preserve their existing page/offset behavior. The fix is limited to response metadata and regression coverage; no caps, strategy thresholds, trade budgets, order sizing, or trading behavior changed.

Required local validation: `bun test test/dashboard-readonly.test.ts`, `bun test`, `bunx tsc --noEmit`, and `git diff --check`. Do not deploy or call any live endpoint for this work. If released later, validate only with GET/read-only checks and require natural scheduled-run evidence before changing the operational health assessment.

Current production status remains **DEGRADED, not healthy** because swing delivery evidence is incomplete, crypto history and fee/edge blocks remain, crypto ownership and GTC/lifecycle persistence still require a separate correction, P&L accounting is not fill-exact, and fresh natural daytrading/swing success evidence is pending. Vital caps remain daytrading **$5,000**, swing **$3,700**, and crypto **$2,000**.

## August 21, 2026 crypto edge-gate correction

Crypto BUYs now fail closed when `minEdgeAfterCosts` is positive but no calibrated `rawEdgeBps` is available. Confidence is never converted to basis points. The rejection is exposed as `EDGE_CALIBRATION_UNAVAILABLE`, so the missing economics calibration is visible in `run_log.error_details` and dashboard run details instead of being silently treated as a generic risk decision. Daytrading and swing callers do not opt into this gate.

Validation passed with 111 tests and 330 assertions, typecheck, diff-check, and Wrangler dry-run. The correction is deployed as Cloudflare deployment `47158569-968b-4bae-83ad-0c24134d42d2`, Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, at 100% traffic; all four schedules are present. Read-only live checks confirmed `/health`, `/api/config`, `/api/positions`, and `/api/dashboard` returned HTTP 200, with broker-authoritative positions still available. The filtered `/api/runs?trigger=crypto_cron&limit=1` probe returned the latest natural pre-release crypto run at `2026-08-21 07:37:34` CPH with 7 decisions, 0 trades, 0 errors, and explicit skip details. No broker-mutating endpoint was used. A natural post-release crypto run remains pending, and the system must not be called healthy until it confirms the new `EDGE_CALIBRATION_UNAVAILABLE` detail.

Vital caps remain daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`.

## August 21, 2026 reliability correction candidate

The August 21 reliability correction is deployed and live-verified. It aligns legacy strategy `totalPl` with `netTotalPl` while preserving `grossTotalPl`, adds bounded `/api/runs` pagination/filter observability, persists broker-authoritative quantity corrections while retaining the current-cycle BUY safety block, and adds non-terminal stock/swing exit guards with structured `PENDING_EXIT_EXISTS` fields. The final August 21 correction includes mismatch-count context in the cycle event and direct regression coverage; it does not change trading behavior. Caps remain daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`.

Final release receipt: source commit `dab504cb091b2bf20120d9f8d3fd2d18ca61a4dc`; follow-up Cloudflare deployment `b1c1bc11ce6a451da97a8325a70f89bb` accepted after base deployment `07615065-0302-41c6-8a22-4203ea38b5c9`; all four schedules remain present. Local validation passed with 109 tests/321 assertions, TypeScript, diff-check, and dry-run. Separate final GET-only checks passed for health, config, dashboard, positions, runs, and trades.

Remaining degraded follow-up: no post-release successful strategy/reconciliation run is visible yet; the latest reconciliation at `2026-08-21 07:20:24` UTC was `CYCLE_LEASE_HELD`. The unresolved historical partial-exit/mismatch lifecycle remains monitored.

## Dashboard 1102 hotfix — August 10, 2026

The deployed dashboard hotfix makes all GET/read-only `Database` instances skip runtime schema-repair DDL, `ALTER TABLE`, index creation, and schema checks. Trading and write paths retain the existing schema-readiness process, and the Worker `fetch` path has no unconditional `ALTER TABLE positions` repair.

Dashboard fan-out is reduced by removing duplicate per-strategy history queries and bounding performance and category history to 90 rows per series. Current positions remain Alpaca-authoritative; broker position failure returns an unavailable state and never falls back to D1 positions.

Historical August 10 evidence, superseded by the August 18 release below: source commit `4261009` was pushed to `origin/main`; read-only Worker endpoints returned HTTP 200 with broker-backed positions, while Cloudflare identity was not then verifiable because Wrangler was unauthenticated and API requests returned HTTP 403. Remote D1 contained the reservation table/index; 85 tests/257 assertions, typecheck, diff-check, and dry-run passed; no broker mutation was used.

## Current control status

The latest recorded release receipt is the August 21 strategy-filter and broker-authoritative reconciliation correction. Deployment identity below is a chronology of captured receipts, not singular current proof: the current read-only control did not independently authenticate Cloudflare deployment identity or traffic. No broker order, cancellation, close, or manual trading trigger was used.

- Latest recorded source worktree: branch `fix/remove-premature-position-upsert-entryside`
- Latest captured deployment receipt: `47158569-968b-4bae-83ad-0c24134d42d2` / Worker version `2756aeb6-e71a-4a11-ab7c-a3a1a6dbbf4e`, created August 21, 2026 at 07:57:51 UTC, 100% recorded traffic
- Earlier captured release receipts: `1b286e9a-6d2f-45b9-a439-72fd12654f9c` / `ced43daf-ed03-4add-ac07-1d8bf562b72c`, and lifecycle `6ef8737a-85ca-4fbb-8886-c938237dc993` / `5ff1ee08-bdc1-46b7-9aa6-93962d25beb4`
- Latest local correction validation: 130 tests / 388 assertions, TypeScript, diff-check, and Wrangler dry-run; 125 / 374 remains the historical deployed release receipt
- Identity caveat: source-to-deployment mapping and current live control-plane identity were not independently revalidated in this control
- Live read-only status: **DEGRADED, not healthy**
- Current evidence: broker-authoritative positions and unchanged caps pass; crypto `:07/:37` and reconciliation cadence pass; explicit lease/error/skip observability passes.
- Open gaps: broker/internal quantity divergence, no fresh successful daytrading or swing run, all six exposed nullable lifecycle timestamps null across the sampled 50 trades, no per-trade gross/fee/net fields, fee telemetry unavailable in fresh crypto skips, and no end-to-end live proof of the configured crypto edge comparison. Dashboard aggregate gross/fee/net values exist, but fill-exact per-trade accounting is unavailable.

Dashboard capital-cap evidence remains read-only and server-resolved: `/api/dashboard` returned `{ daytrading: 5000, swing: 3700, crypto: 2000 }` with broker positions available. The UI never substitutes buying power, cash, equity, portfolio value, or positions for a missing cap.

## Release verification

Before any deployment that can submit crypto BUY orders, an authorized operator must apply the idempotent reservation migration and complete the read-only verification. The August 10 hardening release recorded that the migration was applied and verified in remote D1; these commands remain the reproducible release gate for future deployments:

```bash
bun run db:migrate:crypto-reservations:remote
bun run db:verify:crypto-reservations:remote
```

The verification must return both `crypto_entry_reservations` and `idx_crypto_entry_reservations_expiry`; the trade-intent verification must return `intent_stop_loss_price` and `intent_take_profit_price`. Do not substitute a Worker-triggered CREATE TABLE for this gate. If the table is absent, crypto BUY reservation calls fail closed and no BUY may proceed.

1. Run `git diff --check`, `bunx tsc --noEmit`, `bun test`, and `bunx wrangler deploy --dry-run`.
2. Commit and push to the active release branch; for this release line use `origin/fix/remove-premature-position-upsert-entryside`, then confirm local `HEAD` equals `git ls-remote origin refs/heads/fix/remove-premature-position-upsert-entryside`.
3. Build a fresh explicit bundle with `bunx wrangler deploy --dry-run --outdir <new-directory>`.
4. Upload that exact bundle through the direct Cloudflare multipart API. In this proxy environment, do not trust a successful `wrangler deploy` exit code as proof of a new version.
5. Verify the newest Cloudflare deployment has a new version at `100%` traffic.
6. Verify all four schedules, including the read-only `*/10 * * * *` maintenance schedule.
7. Query `/health`, `/api/dashboard`, `/api/trades`, and `/api/runs`; expect HTTP 200. Confirm `/api/dashboard.capitalCaps` contains only finite, non-negative numbers or `null`, and confirm each strategy tab shows either a USD cap or `Unavailable` without using account metrics as a fallback.
8. Query `/api/positions` when checking broker availability and confirm `positionsAvailable: true`, `source: "alpaca"`, and broker-matching symbols.
9. Confirm GitHub Pages contains the Worker URL and no direct Alpaca URL.
10. Never use trading triggers, cycle endpoints, order endpoints, or close endpoints as deployment tests.

See [`docs/DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md) for exact commands and the direct-upload procedure.

## Documentation rule

Documentation is a release requirement. Every source, configuration, schema, migration, test, or operational change must update the relevant README, operations/runbook, release receipt, and next-step status in the same work item. Work is not complete until documented behavior, validation results, deployment state, known risks, and remaining follow-ups match reality.

## Fee-aware P&L and decision policy

- Strategy comparison exposes `grossTotalPl`, `feesUsd`, `netTotalPl`, and `feeAttribution` for each row.
- CFEE is defensibly attributed to crypto. Orderless/regulatory FEE remains account-level and is exposed as `accountLevelFeesUsd`; it is not fabricated into daytrading or swing.
- Current category snapshots and historical cumulative curves remain gross-only. Strategy comparison exposes aggregate gross/fee/net values, but those model/ledger aggregates are not fill-exact per-trade accounting. The fee ledger uses a bounded three-day import overlap, while the crypto entry fee-rate uses only positive curated-universe samples from the most recent seven days.
- Daytrading and crypto BUY decisions use quantity/notional-aware estimated costs. Crypto entries default to one per cycle and discretionary signal SELL/CLOSE actions default to a separate two-exit budget; protective exits bypass both budgets and the fee gate. Loss-reducing, EOD, and manual closes bypass the discretionary fee gate.
- Swing logs round-trip spread/slippage/fee costs with explicit bps units. `expectedEdgeBps` defaults to zero, so swing BUY is not rejected from an invented z-score-to-bps conversion; configure a calibrated edge before enabling rejection.
- All fee-gate skips must retain the estimated costs and reason in decision/run observability.

## Position-state contract

Alpaca supplies current symbol, quantity, side, prices, market value, and unrealized P&L. D1 supplies matching strategy, stop, timestamp, and historical metadata only. D1-only rows are excluded from current API positions. Broker-only symbols are `unattributed` until ownership is established. A broker-fetch failure is surfaced as unavailable; D1 is never used as a silent live fallback.

## Schedules

- Daytrading: `*/5 13-21 * * 1-5` UTC, gated by Alpaca's market clock.
- Swing: `0 22 * * 1-5` UTC.
- Crypto: `7-59/30 * * * *` UTC, at approximately `:07` and `:37`, 24/7.
- Maintenance/reconciliation: `*/10 * * * *` UTC, read-only broker/order reconciliation under a separate `maintenance` lease. Daytrading, swing, and crypto use isolated leases; each lease expires after 10 minutes so a stalled broker call cannot block unrelated strategies indefinitely.

## Prior-release natural reconciliation evidence

The prior-release natural reconciliation check completed on August 8, 2026 using only live GET endpoints. `/api/runs` recorded 23 `reconcile_cron` entries between `2026-08-08 06:40:53` and `2026-08-08 10:30:51` UTC. Sixteen runs completed with `MAINTENANCE_ONLY`; seven recorded `CYCLE_LEASE_HELD`. `/api/trades` showed 19 rows with all five lifecycle fields populated: `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at`; the observed reconciliation window was `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC.

The maintenance run details reported `trades_executed: 0` and `imported: 0`, and source inspection shows reconciliation calls only Alpaca order reads (`getRecentOrders` and `getOrder`) before persisting D1 state. No reconciliation-caused broker mutation was observed or indicated. A categorical broker before/after conclusion is not available because the Worker exposes no read-only `/api/orders` route and no same-window order snapshot pair exists.

The August 9, 2026 audit found lease starvation: maintenance shared the strategy lease and repeated `CYCLE_LEASE_HELD` skips could block trading. The deployed fix uses separate `maintenance`, `daytrading`, `swing`, and `crypto` lease keys, a 10-minute default TTL, and a 12-second timeout for each Alpaca HTTP request. Source inspection confirms distinct `maintenance` and `daytrading` lease keys. Available D1 artifacts do not reconstruct exact historical lease ownership for each skipped invocation, so the verification confirms the design and current evidence boundary, not a complete historical ownership timeline. A maintenance run may still be skipped by another maintenance run, but it must not block a strategy lease.

## Deferred-risk monitoring

The active weekly read-only review job `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`) runs Mondays at 10:00 Europe/Copenhagen. It reviews partial-fill/retry lifecycle, deterministic attribution, fill/FIFO accounting, swing peak-price state, and live integration coverage without triggering broker mutations.

## Known risks

- The crypto patch is deployed, but Cloudflare deployment artifacts do not embed the Git SHA; the release bundle-to-commit mapping is recorded by the release process.
- Current validation and live evidence: 123 tests, 361 assertions, TypeScript, diff-check, and fresh dry-run passed; current source commit `5b01066430cf529db8e7329c970882718d0d8d2c` maps to deployment `6ef8737a-85ca-4fbb-8886-c938237dc993` / Worker version `5ff1ee08-bdc1-46b7-9aa6-93962d25beb4` at 100%; all read-only smoke endpoints returned HTTP 200; remote lifecycle schema passed; no broker mutation was used. The older `f122287` receipt is historical.
- `git diff --check` from the workspace root is contaminated by unrelated generated `/workspace/data` changes; the bot repository diff must be checked with `git -C /workspace/alpaca-trading-bot diff --check`.
- Wrangler dry-run remains validation-only and was not used as a deployment.


- August 6 live evidence showed repeated partial-filled exits and quantity mismatches. Current stock/swing SELL/CLOSE paths have non-terminal pending-exit guards (`PENDING_EXIT_EXISTS`), and the guard behavior is covered by regression tests; broker-authoritative mismatch protection remains in place and paper-session evidence is still required after deployment.
- Partial/fill lifecycle on the entry side: the August 18 release gives stock/swing BUYs deterministic `client_order_id` values and pre-submit `DUPLICATE_ORDER_PREVENTED` guards against retrying a non-terminal order. The August 21 local correction now guards stock/swing SELL/CLOSE paths against repeat non-terminal exits with `PENDING_EXIT_EXISTS`; it does not cancel, replace, retry, or weaken broker authority. Broader partial-fill/cancel/replace lifecycle and paper-session evidence remain follow-ups. Crypto has its own pending-exit guard and deterministic client IDs, but no complete broker retry/cancel/replace lifecycle.
- Order-to-decision correlation: as of the August 18 source candidate, daytrading/swing BUY entries carry a deterministic decision-derived `client_order_id`, and the local generic entry path persists `logOrderTrade` with the decision ID. It remains incomplete that stock/swing **exits** still do not carry a decision-derived deterministic ID, so exit correlation and historical attribution need completion and paper-session evidence. Historical swing/crypto rows without stable attribution remain excluded from deterministic lifecycle attribution.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; those rows remain excluded from strategy-attributed history unless deterministic attribution is available.
- Swing batch-bar and degraded-data safeguards have been verified in production; future changes should preserve the bounded request and completed-session checks.
- Daytrading/crypto position sync can preserve an existing strategy-less row.
- Some historical and broker-only trades still need stronger deterministic strategy attribution and lifecycle correlation.
- Automated coverage includes reconciliation, partial-fill persistence, terminal statuses, idempotency, broker projection, fee attribution, quantity-aware costs, calibrated swing-edge behavior, and no-side-effect assertions, but not full live-broker integration.

## Next steps

1. Observe the first natural paper-session behavior of the deployed deterministic entry identity and retry guard without manually triggering a cycle.
2. Verify the remaining partial-fill, cancel, replace, and retry lifecycle under a paper session, separate from read-only reconciliation.
3. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
4. Add targeted live-broker integration checks without using trading actions as smoke tests.
5. Finish swing trigger attribution and decision-row accounting consistency work.
6. Keep the documented source-to-deployment mapping synchronized on every future release; Cloudflare artifacts do not embed the Git SHA.

## August 21, 2026 strict read-only control update

Control result: **FAIL/DEGRADED, not healthy**. All six required GET endpoints returned HTTP 200. The control was strictly read-only and called no trigger, order, cancellation, close, replace, retry, or broker-mutating endpoint.

Live evidence: `/api/positions` reported `positionsAvailable: true`, `source: alpaca`, and 29 broker positions. Dashboard equity was `$98,546.76` versus `last_equity` `$98,270.0927`, with latest snapshot equity `$98,556.33` at `2026-08-21 23:37:58` UTC. Daily change fields remain zero and limit independent daily validation. Caps remain `$5,000/$3,700/$2,000`; source and `wrangler.toml` preserve daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and read-only reconciliation `*/10 * * * *`.

Fresh reconciliation rows through `2026-08-22 00:01:01` UTC are structured `MAINTENANCE_ONLY` skips with `ledgerPages: 1`, `ledgerPageBudget: 5`, `ledgerTruncated: false`, and `ledgerDegraded: false`. Fresh crypto rows at `23:08:04` and `23:38:04` UTC have zero errors and structured skip details. Crypto is approximately on the expected `:07/:37` cadence but shows recurring `:08/:38` jitter. Filtered `daytrading_cron` maps correctly to canonical `cron` and shows repeated `CYCLE_LEASE_HELD` skips, but no fresh successful daytrading run is proven; no fresh successful swing run is proven.

The sampled trade page exposes lifecycle fields and conservative accounting metadata, but current filled rows have `gross`, `fee`, and `net` null with `unavailable_fill_lot_exact`; exact fill/lot linkage and non-crypto strategy fee attribution remain open. Crypto edge-gate source and regression checks pass, including fail-closed fee telemetry and calibrated raw-edge requirements, but live positive `rawEdgeBps` evidence remains absent. Full local regression passed **154 tests / 488 assertions**.

The existing correction work item remains open. No code or deployment correction was applied during this control because no new reproducible trading-behavior defect was found. Exact blocker for independent release verification: `bunx wrangler whoami` reports `You are not authenticated`, leaving current Worker/source identity and control-plane schedule state unresolved despite a stored local Cloudflare credential record. Follow-up must remain read-only until authenticated, and must not alter caps or trading behavior.

## Crypto edge-gate and TIF investigation, August 21, 2026

**Disposition: documentation/observability only; trading logic unchanged.** A repository-wide source and history audit found no production producer for calibrated `rawEdgeBps`. The only concrete positive value is in regression-test input. Crypto `RiskManager` is intentionally configured with `requireCalibratedEdge: true`, while the production crypto caller supplies no `rawEdgeBps`; therefore positive-edge BUYs fail closed as `EDGE_CALIBRATION_UNAVAILABLE`. Confidence, TA, sentiment, fee telemetry, and ranking are not valid substitutes and must not be converted into basis points.

The crypto TIF mismatch is not reproducible from the current source path. `src/crypto-strategy.ts` explicitly passes `time_in_force: 'gtc'` to `AlpacaClient.submitOrder`; the client’s `day` default applies only when a caller omits the field. `Database.logOrderTrade` persists the broker-returned TIF, and `test/trade-identity.test.ts` covers crypto GTC persistence. Keep monitoring the structured skip code and reconcile any future `day` row against the originating decision/order ID, caller bundle, and broker response before considering a code change.

No caps, thresholds, sizing, schedules, order behavior, or broker authority were changed. No migration, live endpoint, broker mutation, or deployment is required for this investigation. The blocker is calibrated-edge evidence/production sourcing, not permission to weaken the gate.

## August 22, 2026 read-only trade-shape correction

The completed reliability patch normalizes legacy trade response rows so lifecycle and conservative accounting keys are always present, and adds combined strategy/status/trigger/pagination run-filter regression coverage. `/workspace/alpaca-trading-bot` is the deployable source; `/workspace/src` is stale reference material and is not a release source. No DDL, broker mutation, cap, schedule, threshold, sizing, edge-gate, TIF, or trading-behavior change was made.

Focused validation passed **24 tests / 126 assertions**; full validation passed **156 tests / 511 assertions**; TypeScript, diff-check, and Wrangler dry-run passed. Deployment is authorized only as this reliability correction, followed by separate GET-only verification. Production remains **FAIL/DEGRADED** because live source identity, fresh daytrading/swing delivery, direct cap enforcement, cadence exactness, and fill-lot accounting remain unresolved.

## August 22, 2026 Control-3 final outcome — correction not live-proven

The strict read-only control completed at **2026-08-22 05:03 UTC**. All six required GET endpoints returned HTTP 200; broker positions remained authoritative (`source: alpaca`, 29 rows); equity direction was positive by **$234.4073** versus `last_equity`; and caps remained **$5,000/$3,700/$2,000**. Reconciliation was fresh through **05:01:02 UTC** as `MAINTENANCE_ONLY`; crypto was fresh through **04:38:03 UTC** near `:07/:37` with expected fail-closed fee/confidence skips; daytrading and swing fresh-success delivery remained unproven, and trade gross/fee/net remained conservatively null.

Focused/full regressions, typecheck, diff-check, and Wrangler dry-run passed. The secure deployment retry produced no usable receipt, and separate GET-only verification still reports live release identity **1.0.0 / 2.4.0** versus local **2.6.0**. Keep production **FAIL/DEGRADED** and follow up by restoring verified Cloudflare deployment, then repeat GET-only validation; no caps or trading behavior may change.

## August 22, 2026 Control-4 strict read-only production control

Production remains **FAIL/DEGRADED**, not healthy. All six required GET endpoints returned HTTP 200, but live release identity is failed: `/health` is `1.0.0` and `/api/config` is `2.4.0` versus local deployable `2.6.0`. Positions report `positionsAvailable: true`, `source: alpaca`, and 29 broker rows; equity is `98504.50` versus `last_equity 98270.0927` (+`234.4073`), while daily direction remains unproven because daily change fields are zero.

Caps remain **$5,000 daytrading / $3,700 swing / $2,000 crypto**. Fresh reconciliation is a structured `MAINTENANCE_ONLY` delivery; crypto is delivered near `:07/:37 UTC` with observed `:08/:38` jitter; category history is populated through `2026-08-22 06:37:57`, but fresh successful daytrading and swing runs are not proven. Recent daytrading rows are repeated `CYCLE_LEASE_HELD` skips, the latest available swing row is an `2026-08-18 22:00:36` position-divergence/RISK_HALTED error, and historical crypto SQL-variable/subrequest failures remain relevant risk evidence. Sampled lifecycle fields are present, but per-trade gross/fee/net are conservatively null until deterministic fill-lot matching, and aggregate strategy accounting is not fill-lot exact. Local four-schedule wiring, broker-authoritative position projection, filtered run aliases, structured skip logging, conservative fees, unchanged caps, and fail-closed crypto edge gates pass source/tests, but live source identity, schedule identity, full run delivery, exact cadence, direct cap enforcement, and production raw-edge evidence remain open.

Correction work item: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-4.md`. Release-control disposition is **FAIL** and live operations disposition is **DEGRADED**, not healthy. Owner is Joachim; trigger is restored authenticated Cloudflare deployment access. Acceptance requires an authenticated receipt tied to the exact validated 2.6.0 source commit and all four UTC cron expressions, matching 2.6.0 across `/health`, `/api/config`, and local release markers, then separate GET-only verification of all six endpoints, filtered runs, broker position source, equity direction, fresh structured terminal records for each scheduled strategy or documented no-op/skip, lifecycle/accounting, crypto edge observability, and unchanged caps. Deployment is not claimed because source-to-Worker identity and credentials remain unresolved. Fresh canonical and alias `/api/runs` probes currently match, but older saved captures returned empty alias arrays, so alias behavior remains unresolved pending post-deploy convergence. Run-log analyzed/filtered counts remain console-only, production has no calibrated `rawEdgeBps` producer, and daily direction remains unproven because daily change/P&L fields are zero. No code, configuration, migration, trigger, or broker-mutating action was performed.

The authorized Wrangler retry at **08:02 UTC** again failed before upload with the exact non-interactive `CLOUDFLARE_API_TOKEN` error despite the stored credential being selected through the secure process path. The exact local artifact is committed as `6bbc315b8069962340ef2b338934b108ff88c3ff`; retain **FAIL/DEGRADED** and require authenticated deployment plus separate GET-only verification before closure.

## August 22, 2026 Control-5 post-attempt verification

Commit `57a4efbfc2b3e0949829d9951776e8d7115b4f1f` passed local validation but was not uploaded. Wrangler stopped before upload with `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` Separate GET-only verification at approximately **09:04 UTC** confirms all six endpoints remain HTTP 200, positions remain broker-authoritative (`source: alpaca`, 29 rows), and caps remain `$5,000/$3,700/$2,000`; live release identity remains `1.0.0/2.4.0`, and alias responses lack `trigger_alias`, so production remains **FAIL/DEGRADED**.

## August 22, 2026 Control-6 documentation correction — FAIL/DEGRADED

**Disposition: FAIL/DEGRADED, not healthy.** This strict read-only control recorded HTTP 200 for all six required GET endpoints: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. Live `/health` reports version **1.0.0** and `/api/config` reports **2.4.0**, conflicting with the local deployable **2.6.0**; live source identity remains unresolved.

Verified live facts: `/api/positions` reports `positionsAvailable: true`, `source: alpaca`, and 29 rows. Dashboard equity is **98504.50** versus `last_equity` **98504.5039**, current-vs-last direction **-0.0039**; daily fields are zero, and history fell from **98572.37 at 22:07:58** to **98504.50 at 09:37:57**. Caps are exactly **5000/3700/2000**.

Local source preserves all four schedules, broker authority, isolated leases, filtered aliases, conservative accounting, and fail-closed crypto edge gates. Fresh reconciliation is `MAINTENANCE_ONLY` around a 10-minute cadence. Crypto is near `:07/:37` but was observed at `:08/:38`; the latest observed row at **09:38:02** was a structured skip with 0 errors. No fresh daytrading or swing trigger/success is evidenced in the fetched run pages. Historical errors include crypto D1 `too-many-SQL-variables` and `too-many-subrequests`, plus stock/reconciliation errors.

Latest trade rows expose lifecycle fields, but sampled filled rows have `gross`, `fee`, and `net` null, `accounting_status: unavailable_fill_lot_exact`, and `fee_attribution: none-recorded`. Aggregate crypto fee telemetry is available but not per-trade exact. Filtered run alias behavior is source/test verified but not live-proven against 2.6.0.

Local focused validation is **89 tests / 323 assertions**; full validation is **157 tests / 520 assertions**; typecheck passed. Deployment was not attempted in this work item because the current Wrangler path lacks a usable `CLOUDFLARE_API_TOKEN` despite stored metadata, and live source identity remains unresolved. Preserve caps, schedules, thresholds, sizing, edge gates, broker authority, and trading behavior. Do not deploy, call any broker endpoint, call triggers, migrations, or mutate production.

**Follow-up owner: Joachim.** Restore authenticated reproducible Cloudflare deployment/source verification, then separately repeat GET-only checks and observe natural day/swing windows. Keep production **FAIL/DEGRADED**, not healthy. Correction work item: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-6.md`.


## August 22, 2026 Control-6 strict read-only production control

Control-6 remains **FAIL/DEGRADED**, not healthy. All six required GET endpoints returned HTTP 200 with no broker-mutating endpoint, trigger, deployment, or migration used. Live `/health` is **1.0.0** and `/api/config` is **2.4.0**, conflicting with the local deployable **2.6.0** release markers; `/api/positions` remains `positionsAvailable: true`, `source: "alpaca"`, with 29 broker positions. Live equity is **98,504.50** versus `last_equity` **98,504.5039** (delta **-0.0039**), while daily fields remain zero and recent history declined from **98,572.37 at 2026-08-21 22:07:58 UTC** to **98,504.50 at 2026-08-22 09:37:57 UTC**. Caps remain **$5,000/$3,700/$2,000**.

Reconciliation delivery is fresh and structured as `MAINTENANCE_ONLY` near ten-minute cadence; crypto delivery is near `:07/:37 UTC` with observed `:08/:38` jitter and latest zero-error structured skips. No fresh daytrading or swing trigger/success is evidenced; historical `CYCLE_LEASE_HELD`, D1 SQL-variable, and Worker subrequest errors remain relevant. Lifecycle fields are exposed, but sampled filled rows retain conservative null `gross`/`fee`/`net` under `unavailable_fill_lot_exact`; aggregate crypto accounting is internally consistent but not fill-lot exact, and fee telemetry availability conflicts with current fail-closed skips. Local source, focused/full regressions, typecheck, and dry-run pass. Deployment/source identity remains unresolved because `wrangler whoami` is unauthenticated; owner Joachim must restore authenticated deployment access before any release claim. See `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-6.md`.

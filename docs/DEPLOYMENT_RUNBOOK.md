## Monday, August 24, 2026 Control-60 targeted reliability correction - LOCAL COMPLETE / LIVE OPEN FAIL-DEGRADED

Control-60 is locally complete and production remains **OPEN FAIL/DEGRADED**. The correction is reliability-only and preserves all vital parameters: daytrading/swing/crypto caps `5000/3700/2000 USD`, confidence thresholds, max-trade limits, universes, schedules, sizing, signals, edge policy, and order semantics.

Implemented fixes: ambiguous crypto submit exceptions retain reservations fail-closed; deterministic crypto client IDs block duplicate BUYs, including terminal partial-fill retries; terminal partial fills retain reservation protection; bounded read-only reconciliation cleans only expired active reservation orphans with no linked trade/order; and all close callers store `closed_pl=NULL` when fill/lot-derived realized P&L is unavailable instead of using stale unrealized P&L or zero.

Validation passed **85 focused tests / 272 assertions** and **197 full tests / 738 assertions**. `bun run typecheck` and `git diff --check` passed. No trigger, order, close, cancel, replace, retry, migration, deployment, or other broker mutation was used.

Fresh GET-only live verification remains degraded: all required core endpoints returned HTTP 200; live `/health=1.0.0` and `/api/config.version=2.4.0` remain older than local release `2.6.0`; `/api/positions` remains broker-authoritative with 29 rows; reconciliation and crypto cadence are present; `/api/trades` still exposes null per-fill gross/fee/net and stale/ignored filtering/pagination; `/api/reservations` returns HTTP 404; fee telemetry is stale relative to current runs; account and snapshot reads are not synchronized; and swing still has prior subrequest-limit failure evidence. No production deployment verification of this local fix exists.

Deployment remains blocked by unauthenticated Wrangler: `You are not authenticated. Please run \`wrangler login\`.` The worktree contained the prior accumulated Alpaca code, test, schema, and documentation changes; this control commits the coherent project state but does not deploy it. Required follow-up is authenticated clean-artifact review, authorized deployment if desired, then immediate GET-only verification of release identity, all four schedules, trade filters/pagination, reservation observability, lifecycle correlation, broker/D1 quantities, and fee-aware gross/fee/net reporting.

See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-60.md`.

## Monday, August 24, 2026 Control-59 release-control record - OPEN FAIL/DEGRADED

Control-59 is a strict GET-only production control captured around **08:01 UTC on August 24, 2026**. All six required GET endpoints returned **HTTP 200**. Live health/config are **1.0.0/2.4.0**, versus local **2.6.0** at HEAD **e805da1a4d83a8fa816ebe09c500a57fed5c9c24**; active artifact provenance and live deployment are not proven.

Positions are broker-authoritative (`source=alpaca`, 29 rows). Equity is `98485.98`, latest snapshot `98493.96`, below `last_equity=98504.5039`; broker daily fields are zero. Caps remain **5000/3700/2000**. Local four-schedule dispatch is unchanged: daytrading `*/5 13-21 * * 1-5` → `cron`, swing `0 22 * * 1-5` → `swing_cron`, crypto `7-59/30 * * * *` → `crypto_cron`, reconciliation `*/10 * * * *` → `reconcile_cron`.

Fresh crypto runs were near **07:07:54** and **07:38:11 UTC**; reconciliation was **08:01:06 UTC**, `MAINTENANCE_ONLY`. Current daytrading and successful swing freshness are not proven; historical swing **3182** errored with Cloudflare subrequest exhaustion. Structured skip observability exists and no current `CYCLE_LEASE_HELD` row was observed, but live run aliases/candidate counters/filters and trade status/pagination remain absent, ignored, or unproven.

Lifecycle fields exist, but sampled filled rows have `gross=null`, `fee=null`, and `net=null` under `unavailable_fill_lot_exact` / `none-recorded`; exact historical fee artifacts are not current per-fill truth. Local crypto fail-closed edge-gate behavior and regressions pass, but live deployment is not proven. Control-57 receipts remain discrepant (**189/705** documented vs **184/678** saved).

**No deployment or mutation occurred.** Exact Wrangler blocker: **`You are not authenticated. Please run \`wrangler login\`.`** The worktree is dirty. Disposition is documentation/status only; no additional runtime fix is justified and no runtime, cap, schedule, threshold, sizing, edge-gate, order, or trading-behavior change was made. Follow-up: authenticate Wrangler, isolate a clean immutable artifact, deploy only if authorized under the standing reliability-maintenance rule, then separate GET-only verification and natural weekday swing observation.

## Monday, August 24, 2026 Control-58 release-control record - OPEN FAIL/DEGRADED

Control-58 remains a GET-only production control and documentation/status correction. Live `/health` is `1.0.0` and `/api/config.version` is `2.4.0`, versus local release `2.6.0` at HEAD `e805da1`; `/api/positions` remains broker-authoritative with 29 Alpaca-sourced rows; caps remain `$5,000/$3,700/$2,000`.

The local artifact retains the four required UTC cron bindings: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`. Live crypto cadence is observed near `:07/:37` through `06:37:55 UTC`, and reconciliation near ten minutes through `07:00:56 UTC`; daytrading and successful swing freshness remain unproven.

Live status filters fail, lease-held filtering is unverifiable, and exact per-fill gross/fee/net remain unavailable under the conservative accounting contract. Local focused validation passed **46 tests / 261 assertions** and full validation passed **189 tests / 705 assertions**; typecheck and diff-check passed. Control-57 also has an unresolved receipt discrepancy: its documentation says `189/705`, while `/workspace/alpaca_control_57_full.txt` says `184/678`. No deployment was attempted because `bunx wrangler whoami` returns **`You are not authenticated. Please run \`wrangler login\`.`** and the worktree is dirty. Do not deploy until authenticated provenance, a clean immutable artifact, four-schedule binding, and separate GET-only post-release verification are available. See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-58.md`.

## Monday, August 24, 2026 Control-57 strict read-only production control and correction - OPEN FAIL/DEGRADED

Control-57 is **OPEN FAIL/DEGRADED**, not a release approval. The six required production GET checks all returned HTTP 200, but live identity remains `/health=1.0.0` and `/api/config.version=2.4.0` versus local tested release **2.6.0** at HEAD `e805da1`. Live positions are available and explicitly broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows). Account equity is `98470.34` versus `last_equity=98504.5039`, with broker daily fields zero; caps remain **5000/3700/2000 USD**.

The local correction is reliability-only. Crypto broker ledger/order reconciliation is deferred to the dedicated lease-protected `reconcile_cron` maintenance lane to remove duplicate Worker fan-out. Daytrading, swing, and crypto restore the last 20 persisted account-equity observations before adding the current broker equity, making rolling drawdown durable across Worker invocations. Existing thresholds, caps, four schedules, sizing, signals, order semantics, crypto fee fail-closed behavior, calibrated-edge requirements, and broker authority are unchanged.

Local schedule/dispatch regression coverage passes for daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37 UTC`, and reconciliation `*/10 * * * *`. Separate GET-only live verification observed reconciliation run `3248` at `06:10:49 UTC` and crypto run `3247` at `06:07:54 UTC`, confirming current delivery cadence on the old artifact; current daytrading freshness is not proven beyond market-closed rows, and swing run `3182` remains a historical live error with Cloudflare subrequest exhaustion and incomplete accepted exits.

Blocking live evidence remains: run code/search/alias/candidate filters are absent or ignored; trade status filtering and trade offset/page pagination are ignored; exact per-fill gross/fee/net remain conservatively unavailable; position timestamps/protective levels are stale or null; and active Worker/source/schedule provenance is unresolved. Aggregate fee/gross/net arithmetic is not exact fill-lot accounting and must not be fabricated.

Validation: focused **88 tests / 391 assertions**, full **189 tests / 705 assertions**, `bun run typecheck` passed, and `git diff --check` passed. Deployment was not performed. `bunx wrangler whoami` is blocked by **`You are not authenticated. Please run \`wrangler login\`.`** and the worktree is dirty, so do not deploy it. Required next steps are authenticated provenance, clean immutable artifact review, separately authorized deployment only if still required, then separate GET-only verification of all six endpoints and the complete control matrix. See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-57.md`.


Control-56 is a documentation/status correction based on the saved GET-only audit in `/workspace/audit-2026-08-24`. All six required GET checks (`/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`) returned HTTP 200, but production remains **OPEN FAIL/DEGRADED**: live health/config are **1.0.0/2.4.0** versus local release **2.6.0** at `e805da1`. Positions remain broker-authoritative (`source=alpaca`, 29 rows); equity is below `last_equity=98504.5039` on the saved account/snapshot comparisons, while daily change fields are zero. Caps remain **5000/3700/2000 USD** and all four local schedules are unchanged.

Live crypto delivery remains near **:07/:37 UTC** with recurring fail-closed `FEE_DATA_UNAVAILABLE` skips; reconciliation remains near **10-minute** cadence as `MAINTENANCE_ONLY`. Daytrading freshness is limited by the latest carried-forward `MARKET_CLOSED` row, and the latest swing run **3182** errored with 8 errors including **Too many subrequests by single Worker invocation** plus broker-authoritative sync absence evidence. Lifecycle fields exist, but sampled `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact` / `none-recorded`. Live filters, pagination, candidate fields, and provenance remain unproven or ignored. No missing current-source reliability fix was established; no runtime, trading, cap, schedule, or broker change was made.

Validation receipts: focused Alpaca regressions, full `bun test`, `bun run typecheck`, and `git diff --check` are saved under `/workspace` with the `alpaca_control_56_` prefix. Deployment remains blocked by exact Wrangler error **`You are not authenticated. Please run \`wrangler login\`.`** Safe follow-up is authenticated provenance, clean immutable artifact review, separately authorized deployment only if required, then separate GET-only post-release verification and a legitimate weekday swing run. See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-56.md`.

## Monday, August 24, 2026 Control-55 release gate - OPEN FAIL/DEGRADED

Do not declare production healthy. The 04:00 UTC strict control used only GET requests. Live `/health` is `1.0.0` and `/api/config` is `2.4.0`, while the locally tested release is `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.

Acceptance evidence: broker-authoritative positions are available (`positionsAvailable=true`, `source=alpaca`, 29 rows); final equity comparison is down (`98471.10` versus `98504.5039`); caps remain `5000/3700/2000 USD`; local source declares four UTC crons and separate leases. Reconciliation and crypto cadence are observable, but daytrading/swing freshness, current lease-held delivery, active four-schedule provenance, complete cap enforcement, live filtered observability, stable pagination, exact per-fill accounting, and deployed crypto edge-gate wiring are not fully proven.

Blocking evidence: swing run `3182` failed with Cloudflare subrequest exhaustion; live run filters/aliases/candidate fields are missing or ignored; trade status/pagination probes are ignored; sampled gross/fee/net are conservatively unavailable; and live release identity is older than the tested local artifact. Local correction validation passed **75 tests / 337 assertions focused**, **184 tests / 678 assertions full**, typecheck, and diff-check.

Deployment is blocked by unauthenticated Wrangler: `bunx wrangler whoami` returns **You are not authenticated. Please run wrangler login.** Do not deploy the dirty worktree or use a temporary preview. Follow the clean immutable artifact, authenticated provenance, four-schedule binding, authorized reliability deployment, and separate GET-only post-release verification procedure in `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-55.md`.

## Monday, August 24, 2026 Control-55 release gate - OPEN FAIL/DEGRADED

**Release disposition:** do not declare production healthy and do not deploy from the dirty worktree. Control-55 is strict read-only. All six required GET endpoints returned HTTP 200, but live health/config are `1.0.0`/`2.4.0` versus local tested `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.

**Blocking evidence:** live positions are available from Alpaca (`positionsAvailable=true`, `source=alpaca`, 29 rows) and caps remain `5000/3700/2000 USD`, but the recent runs page only proves reconciliation/crypto skips; daytrading and swing freshness, active four-schedule provenance, lease-held absence, live run/trade filters and pagination, exact per-fill accounting, and live crypto edge-gate behavior are not proven. Historical swing run `3182` failed with Cloudflare subrequest exhaustion. The local source retains the four UTC schedules, broker-authoritative positions, read-only API behavior, conservative accounting, and fail-closed crypto gate; local tests are not live proof.

**Safety boundary:** no trigger, submit, cancel, close, replace, retry, migrate, deployment, or broker-state mutation is permitted for this follow-up. Do not change caps, schedules, sizing, thresholds, edge-gate policy, order semantics, or trading behavior. `bunx wrangler whoami` remains blocked by `You are not authenticated. Please run \\`wrangler login\\`.` See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-55.md` for exact evidence, local source references, test receipts, and follow-ups.

## Monday, August 24, 2026 Control-54 release gate - OPEN FAIL/DEGRADED

**Release disposition:** do not declare production healthy. The 2026-08-24 approximately 03:00 UTC control used only GET requests. All six required endpoints returned HTTP 200, but live release identity is **1.0.0 / 2.4.0** versus local tested **2.6.0** at HEAD **e805da1a4d83a8fa816ebe09c500a57fed5c9c24**.

**Acceptance evidence:** `/api/positions` remains broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows); equity comparison is positive at **98527.48 - 98504.5039**, while daily fields are zero; caps remain **5000/3700/2000 USD**. Local `wrangler.toml` and dispatch map preserve all four UTC crons: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, reconciliation `*/10 * * * *`. Live reconciliation is fresh and bounded, crypto cadence is near `:07/:37`, and daytrading market-closed delivery is visible.

**Blocking evidence:** swing run **3182** ended in error with Cloudflare subrequest exhaustion and incomplete accepted exits; live run aliases/candidate counters and code/search filtering are absent or ignored; trade status and pagination probes are ignored; exact per-fill gross/fee/net remain conservatively unavailable; lease-held absence and full cap enforcement are not proven; and saved schedule artifacts conflict over whether reconciliation is active.

**Local correction status:** the repository already contains the reliability-only fixes for bounded swing fan-out, broker-authoritative positions, read-only reconciliation, filtered observability, stable pagination, lifecycle preservation, conservative accounting, and fail-closed crypto fee/calibrated-edge wiring. Focused validation passed **95/413 across 9 files**; full validation passed **184/678 across 26 files**; typecheck and diff-check passed. No vital caps or trading behavior changed.

**Deployment gate:** `bunx wrangler whoami` at **2026-08-24 03:03:45 UTC** returned **You are not authenticated. Please run wrangler login.** Do not use temporary preview deployment, do not deploy the dirty worktree, and do not call triggers or broker-mutating endpoints for validation. Next release requires authenticated provenance, a clean immutable commit, explicit four-schedule binding, authorized deployment under the standing reliability-maintenance rule, and an immediate separate GET-only post-release verification.

## August 24, 2026 Control-53 documentation/status correction - OPEN FAIL/DEGRADED

Control-53 is the current control after Control-52. Keep production **OPEN FAIL/DEGRADED**: all six required GET endpoints previously returned HTTP 200, but live health/config are `1.0.0`/`2.4.0` versus local `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; positions are broker-authoritative (`source=alpaca`, 29 rows), and equity direction is ambiguous (`98497.23-98499.29` versus `last_equity=98504.5039`, `change_today=0`). Caps remain `5000/3700/2000`; local schedules remain daytrading `*/5 13-21`, swing `0 22`, crypto `7-59/30` at `:07/:37` UTC, and reconciliation `*/10`.

Crypto was fresh around `01:07:55`/`01:37:55`, reconciliation remained near ten-minute cadence, daytrading `3180` was `MARKET_CLOSED`, and swing `3182` errored with 8 errors including Cloudflare subrequest exhaustion. Lease-held is not proven. Live rows omit aliases/candidate counts, ignore run code/search and trade status filters, and repeat IDs `645/644/643` across offset/page probes. Lifecycle gross/fee/net remain null under `unavailable_fill_lot_exact`/`none-recorded`; local crypto fail-closed wiring passes but is not live-proven. A live schedule artifact lists only three crons and omits reconciliation, conflicting with the local/post-release four-schedule capture; historical daytrading exposure `5679.8784` versus `5000` remains an open reconciliation question.

This is documentation/status-only: no runtime code, tests, schema, caps, schedules, sizing, thresholds, trading behavior, deployment configuration, deployment, or broker state changed. Current validation receipt: focused **87 passed/388 assertions across 9 files**, full **184 passed/678 assertions across 26 files**, typecheck passed, Alpaca-repo diff-check passed; broader workspace diff-check has unrelated pre-existing `data/qdrant/**/LOG` trailing whitespace. Exact blocker: `bunx wrangler whoami` → **`You are not authenticated. Please run \`wrangler login\``**. The worktree is dirty; never deploy uncommitted files. Follow-up: authenticated provenance, four-schedule reconciliation, clean immutable commit, separately authorized deployment only if required, separate GET-only verification, natural weekday swing run, and historical cap-exposure reconciliation. See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-53.md`.

## August 24, 2026 Control-52 strict read-only production control - OPEN FAIL/DEGRADED

The capture around `2026-08-24T02:00Z` is **OPEN FAIL/DEGRADED**, not healthy. It was strictly GET-only: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` all returned HTTP 200. Live `/health` reported `status=ok`, `version=1.0.0`; live `/api/config` reported `version=2.4.0`; local release is `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Do not treat HTTP 200 or those live versions as proof of the local release being deployed.

Positions reported `positionsAvailable=true`, `source=alpaca`, 29 rows. Observed equity was approximately `98497.23-98499.29` versus `last_equity=98504.5039` with `change_today=0`, so direction is ambiguous/degraded. Caps remain exactly `max=5000`, `swing=3700`, `crypto=2000` USD. Local schedule declarations remain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at `:07/:37` UTC, and reconciliation `*/10 * * * *`. Fresh crypto runs were at `01:07:55` and `01:37:55`, reconciliation was around every ten minutes, daytrading run `3180` was `MARKET_CLOSED`, and swing run `3182` errored with 8 errors including Cloudflare subrequest exhaustion.

Live run rows omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; run code/search filters were ignored; trade `status=filled` was ignored; and offset/page repeated IDs `645`, `644`, and `643`. Structured skip/error history exists but current lease-held is not proven. Lifecycle fields exist, while sampled gross/fee/net remain null under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Local crypto fee/calibrated-edge fail-closed wiring and regressions pass, but are not live-proven.

No additional runtime fix is justified. Local source already contains the filter, pagination, broker-authority, lifecycle/accounting, reconciliation-boundary, and crypto edge-gate corrections. Record the local validation receipt as focused **87 passed/388 assertions across 9 files**, full **184 passed/678 assertions across 26 files**, typecheck passed, and diff-check passed. This work item changes documentation/status only; no runtime code, caps, schedules, sizing, thresholds, trading behavior, schema, deployment configuration, deployment, or broker state changed.

The exact deployment blocker is `bunx wrangler whoami` → **`You are not authenticated. Please run \\`wrangler login\\``**. The worktree is dirty, so never deploy uncommitted files. Follow-up requires authenticated provenance, a clean immutable commit, separate deployment authorization only if still required, then separate GET-only verification and a natural weekday swing run. No deployment or broker mutation occurred. See `CORRECTION_WORK_ITEM_2026-08-24_CONTROL-52.md`.

## August 23, 2026 Control-50 strict read-only correction - OPEN FAIL/DEGRADED

Control-50 used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. Live `/health=1.0.0` and `/api/config.version=2.4.0` remain behind the local `2.6.0` source; swing run `3182` at `2026-08-23 22:01:16 UTC` failed with eight errors including `Too many subrequests by single Worker invocation`; live filtered run counters/aliases and stable trade pagination remain absent; and exact per-fill `gross`/`fee`/`net` remain null under `unavailable_fill_lot_exact`. Positions remain `source=alpaca`, caps remain `$5000/$3700/$2000`, crypto delivery remains near `:07/:37`, and reconciliation/daytrading delivery remains visible with structured skips.

The contained correction is documentation-only. The obsolete runbook baseline of 85 tests/257 assertions is historical, not current. The current validated baseline is **184 tests passed, 0 failed, 666 assertions across 26 files**, with typecheck and diff-check passed (`/workspace/alpaca_control_49_full_retry.txt`, `/workspace/alpaca_control_49_typecheck_retry.txt`). Local source still contains the reliability-only fixes for deferred swing reconciliation, filtered run observability, bounded trade pagination, broker-authoritative positions, conservative accounting, and fail-closed crypto fee/raw-edge gates; no rawEdgeBps producer is proven. No cap, schedule, sizing, threshold, order, trading, deployment, or broker-state change was made.

Wrangler/deployment provenance remains blocked or unverified, and the current dirty worktree is not a deployable release receipt. Do not call production healthy until a clean exact artifact is authenticated, deployed only when authorized under the standing maintenance rule, and separately verified through all six GET endpoints, filters, pagination, caps, schedules, accounting, and a natural weekday swing run. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-50.md`.

## August 23, 2026 Control-49 release gate - OPEN FAIL/DEGRADED

Before any release is called complete, bind the deployed Worker to the exact validated local commit and release. This control found live `health=1.0.0` and config `version=2.4.0` versus local `2.6.0` at `e805da1`, plus a fresh swing subrequest-limit failure, missing filtered-run fields, repeated trade pagination slices, and unavailable exact per-fill accounting. The local candidate already contains the reliability-only swing containment, broker-authoritative position path, filtered observability, pagination, conservative accounting, and crypto fee/calibrated-edge gate corrections; do not make unrelated runtime changes or alter caps `$5,000/$3,700/$2,000` or the four schedules.

Deployment is permitted only through authenticated Wrangler under the standing maintenance rule. If Wrangler or Cloudflare credentials are unavailable, stop before upload, record the exact blocker, and leave explicit follow-up for authenticated provenance, authorized deployment, separate GET-only verification, and a natural post-release swing run. A successful upload is not sufficient: verify `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` separately, including filters, pagination, lifecycle/accounting fields, caps, schedule evidence, and crypto edge/fee observability.

## Sunday, August 23, 2026 Control-48 swing subrequest-limit correction - OPEN FAIL/DEGRADED

A fresh GET-only recheck observed swing run `3182` at `2026-08-23 22:01:16 UTC` ending `error` with 8 errors, including multiple swing sell failures and a fatal `Too many subrequests by single Worker invocation`. Root cause was duplicated swing ledger/order reconciliation plus synchronous `getOrder` polling after each exit submission, on top of scanner, market-data, refresh, and final-sync calls.

The local reliability correction removes duplicated `syncBrokerLedger` and `reconcileBrokerOrders` work from the swing lane, keeps bounded read-only reconciliation in the dedicated `reconcile_cron` schedule, and adds structured `RECONCILIATION_DEFERRED_TO_MAINTENANCE` evidence. Swing exits now support `waitForFill=false`, persist accepted/partial exits, and emit `EXIT_PENDING_RECONCILIATION` until later bounded reconciliation confirms the broker state. Normal order semantics, broker-authoritative positions, four schedules, risk gates, sizing, and caps `$5,000/$3,700/$2,000` are preserved; only synchronous confirmation fan-out is removed to fail safely under the Worker budget.

Focused validation passed **34 tests / 109 assertions** across the swing authority, order reconciliation, audit, and Alpaca order suites. Full validation passed **184 tests / 666 assertions across 26 files**; typecheck, diff-check, and scoped secret scan passed. A normal deployment attempt stopped before upload because Wrangler requires `CLOUDFLARE_API_TOKEN`; `wrangler whoami` reports `You are not authenticated. Please run \`wrangler login\`.` No deployment, preview, or broker mutation occurred. Separate GET-only postcheck returned HTTP 200 for all required endpoints and probes, but live remains the pre-correction 1.0.0/2.4.0 release with swing run 3182 subrequest failures, missing filtered fields, and repeated trade pagination IDs. Production remains **OPEN FAIL/DEGRADED** until authenticated provenance, deployment, and separate post-release verification succeed.

## Sunday, August 23, 2026 Control-47 strict read-only production control - OPEN FAIL/DEGRADED

**Audit capture: 2026-08-23T22:00:47Z.** All six required GET endpoints returned HTTP 200, but production is not healthy or release-verifiable. Live `/health.version` is `1.0.0`, live `/api/config.config.version` is `2.4.0`, while the local release is `2.6.0`; active Worker/source provenance is unresolved and authenticated Wrangler access is unavailable.

Positions are available and explicitly broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 long positions, and no crypto positions. Dashboard/account equity is `$98,504.50`, `last_equity=98504.5039`, `change_today=0`; the current-day delta is effectively flat, while captured history declined to the current level. Capital caps remain exactly `$5,000/$3,700/$2,000` for daytrading/swing/crypto.

Local source retains the four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at `:07/:37`, and reconciliation `*/10 * * * *`. Live delivery shows fresh daytrading `MARKET_CLOSED`, crypto runs near `:07/:37` through `21:37:55 UTC`, and reconciliation `MAINTENANCE_ONLY` at `22:00:50 UTC` with 3 ledger activities and no degradation. Sunday has no legitimate fresh swing window; the latest dedicated `swing_cron` run is stale at `2026-08-18 22:00:36`, ended `error`, and recorded position divergence plus `RISK_HALTED`. Lease-held, provider-error, and structured skip history remains auditable, but no current lease-held row is visible in the returned page.

Live filtered-run responses omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`. Live trade pagination is broken or ignored because `offset=0`, `offset=10`, and `page=2` repeat IDs `642,641,640`. Filled trades expose broker/client IDs, filled quantities, and lifecycle timestamps; sampled `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact` with `none-recorded` attribution. Dashboard aggregate fees are `$272.32016882811` total, `$269.11016882811` crypto, and `$3.21` regulatory/account-level; aggregate gross/net arithmetic reconciles where reported but does not prove exact per-fill economics.

The local repository already contains reliability-only fixes and regression coverage for canonical release reporting, broker-authoritative position failure behavior, filtered-run fields, stable offset pagination, conservative accounting, and fail-closed crypto fee/calibrated-edge gating. No additional runtime fix is justified from this evidence. Control-47 is therefore a documentation/status correction; production remains **OPEN FAIL/DEGRADED**, deployment is not attempted, and the exact deployment blocker is `You are not authenticated. Please run wrangler login.` Follow up with authenticated provenance binding, separately authorized deployment if still required, a post-release GET-only verification, and the next legitimate weekday swing-window check.

## Sunday, August 23, 2026 Control-46 daytrading risk-rejection observability correction - OPEN FAIL/DEGRADED

**Deployment status: NOT DEPLOYED.** This contained local correction adds structured daytrading `RiskManager` rejection recording at the existing rejection point in `src/index.ts`. `SkipReasonCollector` receives stable `NO_ENTRY_RISK`/`CAPITAL_CAP` details with strategy, symbol, decision ID, action, and the original risk reason; the existing decision status update, console log, rejection flow, caps, sizing, schedules, broker authority, and trading behavior remain unchanged. Focused tests: **18 passed / 0 failed, 59 assertions**. Full `bun test`: **182 passed / 0 failed, 657 assertions across 26 files**. Typecheck passed; `git diff --check` passed. Validation logs: `/workspace/alpaca_control_46_focused.txt`, `/workspace/alpaca_control_46_full.txt`, `/workspace/alpaca_control_46_typecheck.txt`, `/workspace/alpaca_control_46_diff_check.txt`. No rawEdgeBps producer, vital-cap modification, deployment, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used. Do not treat local validation as production proof. Production remains **OPEN FAIL/DEGRADED** pending authenticated provenance binding and separately authorized deployment/GET-only verification; Wrangler remains blocked by `You are not authenticated. Please run wrangler login.` / `wrangler: command not found`. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-46.md`.

## Sunday, August 23, 2026 Control-45 strict read-only production control - OPEN FAIL/DEGRADED

**Audit capture: `2026-08-23T21:01:21Z`.** All six required GET endpoints returned HTTP 200, but production is not healthy. Live `/health` reports `1.0.0` and `/api/config.version` reports `2.4.0`, while local HEAD is `e805da1a4d83a8fa816ebe09c500a57fed5c9c24` with release `2.6.0`; active Worker/source provenance is unresolved.

Live positions pass the availability contract as broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows. Equity is `98504.50` versus `last_equity=98504.5039`, with `change_today=0`; the current-day delta is flat, but the observed history fell from `98556.33` at `2026-08-21 23:37:58` to `98504.50` by `2026-08-22 02:37:58` and remained flat through `2026-08-23 20:37:48`, so the broader observed equity direction is downward. Caps remain exactly `5000/3700/2000` USD. Local source retains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for `:07/:37`, and reconciliation `*/10 * * * *`; active deployed schedule provenance is not bound.

Fresh live daytrading delivery is structured `MARKET_CLOSED`, crypto delivery is present at `20:07:55` and `20:37:55 UTC` with zero trades and structured skips, and reconciliation is fresh at `20:50:48 UTC` as `MAINTENANCE_ONLY`. Sunday swing absence is inconclusive because its local schedule is weekday-only. Current structured skip details are visible, but no lease-held row is visible in the fetched page.

Live filtered runs omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; trade pagination remains unresolved because prior filtered/disjoint probes repeat IDs across offsets. Filled trades expose lifecycle timestamps and broker IDs, but exact `gross`/`fee`/`net` remain null under `unavailable_fill_lot_exact` with `none-recorded` attribution. Local filtered observability, conservative accounting, and crypto fail-closed calibrated-edge wiring are regression-tested but not live-proven.

This is a documentation/status-only correction recorded in `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-45.md`; no runtime code, caps, schedules, trading behavior, deployment, or broker state changed. Focused/full regressions, typecheck, and diff-check are rerun after this update. Deployment remains blocked by unavailable authenticated Wrangler tooling, so separate authorized deployment and GET-only post-release verification remain follow-ups.

## Sunday, August 23, 2026 Control-44 reconciliation observability correction - OPEN FAIL/DEGRADED

**Exact defect and fix:** `runScheduledMaintenance` now persists `pendingLookups` and `lookupFailures` in durable `MAINTENANCE_ONLY` context, records `BROKER_ORDER_LOOKUP_DEGRADED` for nonzero lookup failures, and marks the maintenance run `degraded` unless an independent error makes it `error`. The existing bounded read-only reconciliation path, caps, schedules, sizing, broker authority, and trading behavior are unchanged.

Focused coverage in `test/maintenance-reconciliation.test.ts` proves a read-only `getOrder` failure is visible in durable run details with `status=degraded`, `errors=0`, and no mutation calls. Production remains OPEN FAIL/DEGRADED because live release/source provenance and the prior filtered-run, pagination, swing-delivery, fee-telemetry, and exact per-fill accounting gaps remain unresolved. Wrangler is unauthenticated, so no deployment was attempted. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-44.md`.

## Sunday, August 23, 2026 Control-43 strict read-only production control - OPEN FAIL/DEGRADED

**Audit capture: 2026-08-23 19:55:49Z.** All six required GET endpoints returned HTTP 200. Live `/health` observed version `1.0.0` and `/api/config` observed version `2.4.0`; these are not treated as release identity, while local HEAD is `e805da1` / release `2.6.0`, so active bundle/source provenance remains unresolved. Positions are broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows); equity is `98504.50` versus `last_equity=98504.5039` with `change_today=0`, leaving material current-day direction unverified; caps remain `5000/3700/2000` USD.

The live schedule artifact records all four expected crons: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` (`:07/:37`), and reconciliation `*/10 * * * *`, but it is not bound to the active Worker. Fresh runs include daytrading `MARKET_CLOSED` at `19:55:49Z`, crypto at `19:37:54Z` and around `:07/:37` with zero trades and structured skips, and reconciliation `MAINTENANCE_ONLY` at `19:50:48Z`; Sunday has no expected weekday swing delivery, and the absence of `swing_cron` in one inspected page is inconclusive. No current lease-held row is visible.

Live filtered runs omit local `trigger_alias` and candidate counters, trade offsets repeat IDs `642,641,640`, and filled trades expose lifecycle fields but retain null exact `gross`/`fee`/`net` under `unavailable_fill_lot_exact`; aggregate dashboard arithmetic is consistent but not auditable per fill. Dashboard fee availability versus run-level `FEE_DATA_UNAVAILABLE` remains unresolved by scope, and calculated crypto edge is not exposed. Local reliability fixes remain not live-proven. This is a documentation/status-only correction with no runtime, cap, schedule, trading, deployment, or broker mutation. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-43.md`.

## Sunday, August 23, 2026 Control-43 strict read-only production control - OPEN FAIL/DEGRADED

**Audit capture: 2026-08-23 19:00:49Z.** This control was strict read-only and documentation/status-only. All six required GET endpoints returned HTTP 200. Live `/health` version `1.0.0` and `/api/config` version `2.4.0` are observations, not release identity; local HEAD is `e805da1` and local release is `2.6.0`. Wrangler authentication is blocked by `You are not authenticated. Please run wrangler login.` No deployment, preview, or mutating endpoint was used.

Do not infer release identity from the live version fields. Live positions show `positionsAvailable=true`, `source=alpaca`, and 29 positions. Equity is `98504.50` versus `last_equity=98504.5039`, with `change_today=0`; the current-day delta is flat, but the observed history fell from `98556.33` at `2026-08-21 23:37:58` to `98504.50` by `2026-08-22 02:37:58` and remained flat through `2026-08-23 20:37:48`, so the broader observed equity direction is downward. Caps are exactly `5000/3700/2000`. Local schedules remain daytrading `*/5 13-21` weekdays, swing `0 22` weekdays, crypto `7-59/30` hourly at `:07/:37`, and reconciliation `*/10`; deployed schedule identity is not proven.

Fresh live runs show daytrading `MARKET_CLOSED`, crypto near `:07/:37` with zero trades and structured skips, and reconciliation `MAINTENANCE_ONLY`. Missing `swing_cron` in one visible page is inconclusive. Lease-held is not currently visible. Filtered run contract and pagination drift remain live observations: `trigger_alias` and candidate counters are missing, and trade IDs repeat at offsets. Lifecycle timestamps exist, while `gross`/`fee`/`net` are null under `unavailable_fill_lot_exact`. Dashboard fee availability versus run-level `FEE_DATA_UNAVAILABLE` is unresolved scope-dependent telemetry, not an asserted contradiction.

The local broker-authority, filtered observability, pagination, conservative accounting, symbol-less CFEE, and crypto edge-gate fixes remain not live-proven. Keep production **OPEN FAIL/DEGRADED**. Required follow-up is deployed identity/API schema reconciliation, deeper paginated swing history, fee telemetry semantics, Wrangler authentication, then only if explicitly authorized a deployment and a separate GET-only verification. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-43.md`.

## Sunday, August 23, 2026 Control-42 strict read-only production control — OPEN FAIL/DEGRADED

**Audit capture: 2026-08-23 19:00:49Z.** This is a documentation/status-only control. Only GET requests were used for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, and read-only probes; all six required endpoints returned HTTP 200. Production remains **OPEN FAIL/DEGRADED**: live health `1.0.0` and `config.version=2.4.0` do not match local `2.6.0` at HEAD `e805da1`, and active source/SHA plus deployed schedule provenance are unresolved.

**Deployment gate:** Wrangler is blocked by the exact message `You are not authenticated. Please run wrangler login.` No deployment, preview, migration, trigger, order, cancel, close, replace, retry, or other mutating action was attempted. Do not treat local fixes as deployed. No extra runtime fix is justified while the evidence is a release/provenance and live-observability gap.

**Live evidence:** positions are broker-authoritative with `positionsAvailable=true`, `source=alpaca`, 29 rows; equity is `98504.50` versus `last_equity=98504.5039`, `change_today=0`, with earlier `2026-08-21 21:37:58Z` equity `98542.39`; caps are `5000/3700/2000`. Live runs through `18:55:49Z` show daytrading `cron` `MARKET_CLOSED`, crypto at `18:37:55Z` and `18:07:53Z` with zero trades, and reconciliation `MAINTENANCE_ONLY` at `18:50:48Z`. No `swing_cron` appears in the fetched page; do not claim swing schedule failure from that limited page. Lease-held is not currently visible.

**Local-only evidence and unresolved live checks:** local schedules are daytrading `*/5 13-21` weekdays, swing `0 22` weekdays, crypto `7-59/30` hourly (`:07/:37`), and reconciliation `*/10`. Observed dashboard filter parameters were ignored; because filter support is not documented as supported here, record the observation without calling it a broken feature. Filtered runs omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; trade offsets `0` and `30` repeat IDs `642,641,640`. Lifecycle fields are present, but sampled exact `gross`/`fee`/`net` are null under `unavailable_fill_lot_exact`. Dashboard aggregate net arithmetic is internally consistent but not auditable per fill. Dashboard crypto fee telemetry says available while live crypto runs report `FEE_DATA_UNAVAILABLE`; threshold `8` is visible, but calculated edge is not exposed. Keep the disposition OPEN FAIL/DEGRADED pending authenticated provenance, any explicitly authorized deployment decision, and separate GET-only verification.

## Sunday, August 23, 2026 Control-41 audit addendum - OPEN FAIL/DEGRADED

Release provenance remains incomplete: no exact active deployed source SHA is proven, and saved live schedule artifacts conflict because one omits reconciliation. Before any authorized deployment, reconcile the active four-schedule control-plane state and investigate the historical `$5679.8784` daytrading exposure against the unchanged `$5000` cap. Local crypto admission remains correctly fail-closed on missing fee telemetry or calibrated `rawEdgeBps`, but no calibrated edge producer is proven. Do not call production healthy until provenance, schedule identity, cap enforcement, filtered observability, and separate GET-only verification are complete.

## Sunday, August 23, 2026 Control-41 strict read-only production control - OPEN FAIL/DEGRADED

Control-41 confirmed the required GET-only production control remains degraded, not healthy. Live release identity is `1.0.0/2.4.0` versus validated local `2.6.0` at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; Wrangler authentication is blocked before mutation. Positions remain `source=alpaca` with 29 available rows, caps remain `$5000/$3700/$2000`, local four-schedule definitions remain unchanged, crypto runs continue near `:07/:37` with structured zero-trade skips, reconciliation is fresh maintenance-only, and fresh Sunday daytrading/swing delivery is not proven.

Live dashboard filters are ignored, filtered run aliases/candidate counters and trade offset corrections are not live-proven, and exact per-fill accounting remains conservatively unavailable despite aggregate fee evidence. No additional runtime correction was justified; the existing bounded reliability release and its fail-closed crypto fee/raw-edge controls remain locally validated. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-41.md`; restore auth, deploy only the validated artifact under the standing maintenance rule, bind source/SHA/bundle/schedule provenance, then perform separate GET-only verification.

## Sunday, August 23, 2026 Control-40 fee-ledger reliability correction - OPEN FAIL/DEGRADED

Control-40 prepared a reliability-only source correction for the confirmed crypto fee telemetry defect. The broker ledger is populated: `/workspace/alpaca-fee-live-query.json` records **46 fees**, **52 fills**, **$48.31 total fees**, and **$47.45 crypto fees**. Do not describe this as missing broker fee data. The defect is query scope: symbol-less USD CFEE rows with valid derived `usd_value` were excluded from recent crypto sum/sample/freshness calculations, producing `FEE_DATA_UNAVAILABLE`.

The correction changes only the recent CFEE aggregate predicates in `src/database.ts`; it preserves the 7-day window, minimum three samples, 60-second freshness gate, fail-closed crypto fee admission, calibrated raw-edge requirement, caps `$5000/$3700/$2000`, schedules, sizing, leases, broker-authoritative positions, and all order behavior. It also preserves conservative trade accounting: filled rows continue to expose `gross=null`, `fee=null` or only deterministically linked fee values, `net=null`, and `accounting_status=unavailable_fill_lot_exact` when exact fill-lot attribution is unproven. Aggregate `$47.45` crypto fees are not exact per-trade economics. Filtered run aliases/candidate counters and crypto edge-gate wiring must remain present in local regression checks and must be verified after any authorized deployment.

No deployment, preview, trigger, cycle, migration, or broker-mutating request was performed. The deployment blocker is exact: Wrangler returns `You are not authenticated. Please run wrangler login.` and no usable `CLOUDFLARE_API_TOKEN` is available; active Worker/source provenance is unresolved. After authentication and explicit authorization, deploy only the validated artifact if required, capture a receipt/source binding, and run separate GET-only verification of release identity, caps, positions source, filtered run fields, pagination, crypto fee/edge skip context, and conservative accounting fields. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-40.md`.

## Sunday, August 23, 2026 Control-40 fee telemetry reliability correction - OPEN FAIL/DEGRADED

Control-40 locally validated the fee telemetry correction that includes valid symbol-less USD CFEE rows in recent aggregate crypto metrics while preserving the existing fail-closed freshness and sample gates. Broker ledger evidence is present at 46 fee rows and 52 fills, `$48.31` total and `$47.45` crypto; this must not be interpreted as exact per-trade attribution, and `gross`/`fee`/`net` remain conservatively null when fill-lot linkage is not proven. Focused validation passed **60/60** with **295 assertions**; full validation passed **179/179** with **636 assertions**; typecheck and diff-check passed. No deployment occurred because Wrangler authentication is unavailable. Any future deployment must bind source SHA, release, artifact, deployment/version, traffic, and all four schedules, then use a separate GET-only verification of the six endpoints, filtered runs, distinct trade pages, fee/edge context, broker-authoritative positions, lifecycle fields, and unchanged caps.

## Sunday, August 23, 2026 Control-39 validation completion - OPEN FAIL/DEGRADED

Control-39 validation is complete: focused suites passed **72/72** with **331 assertions**, full `bun test` passed **178/178** with **632 assertions**, standalone typecheck passed with no diagnostics, and standalone `git diff --check` passed. Logs: `/workspace/alpaca_control_39_focused.txt`, `/workspace/alpaca_control_39_full.txt`, `/workspace/alpaca_control_39_typecheck.txt`, and `/workspace/alpaca_control_39_diffcheck.txt`. The stale crypto-edge bundle remains non-authoritative, live `1.0.0/2.4.0` provenance is unresolved, and no deployment, runtime change, cap/schedule change, trading action, or broker mutation occurred. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-39.md`.

## Sunday, August 23, 2026 Control-39 release-evidence correction - OPEN FAIL/DEGRADED

Control-39 found no new runtime defect. The crypto-edge bundle generated `2026-08-21T07:57:40.258Z` is stale evidence: it contains the earlier missing-edge guard but not the later filtered-run aliases or durable candidate counters. Separate deployment/schedule metadata does not bind the active Worker to the validated local `2.6.0` source, and dated deployment entries are historical rather than current provenance. Control-37 live failures remain: `1.0.0/2.4.0` identity drift, stale swing delivery with divergence/RISK_HALTED, old filtered-run/pagination behavior, and unavailable exact per-fill accounting. No runtime, cap, schedule, trading-behavior, deployment, or broker mutation changed. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-39.md`.

## Sunday, August 23, 2026 Control-38 documentation evidence correction - OPEN FAIL/DEGRADED

Control-38 found no new runtime defect. Current leading status remains correctly OPEN FAIL/DEGRADED, but dated historical deployment entries must not be read as current provenance, and Control-37 has no standalone typecheck/diff-check log or deployment receipt. Direct evidence remains `/workspace/alpaca_control_37_focused.txt` with 72 pass/331 assertions and `/workspace/alpaca_control_37_full.txt` with 178 pass/632 assertions; no code, caps, schedules, trading behavior, deployment, or broker mutation changed. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-38.md`.

## Sunday, August 23, 2026 Control-37 strict read-only production control - OPEN FAIL/DEGRADED

Control-37 used only GET requests against the six required production endpoints plus filtered run and disjoint trade-page probes. All six returned HTTP 200, but production is not healthy: live `/health` is `1.0.0` and `/api/config.version` is `2.4.0`, versus local validated release `2.6.0`; Wrangler is unauthenticated and active Worker/source provenance is unresolved. Positions remain broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows), equity is `98504.50` versus `last_equity=98504.5039` with `change_today=0`, and caps remain exactly `$5000/$3700/$2000`.

Local source retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for `:07/:37`, and reconciliation `*/10 * * * *`. Fresh Sunday daytrading runs are `MARKET_CLOSED` skips through `15:00:58 UTC`; swing has no fresh weekday delivery, with the latest filtered row at `2026-08-18 22:00:36` carrying position divergence and `RISK_HALTED`; crypto is fresh at `14:07:57` and `14:37:56 UTC`; reconciliation is fresh through `15:00:59 UTC` with `MAINTENANCE_ONLY`, 18 ledger activities, and non-degraded ledger context.

Filled rows expose lifecycle/full-fill fields, but exact per-fill `gross`, `fee`, and `net` remain conservatively null under `unavailable_fill_lot_exact`; aggregate gross/fee/net arithmetic reconciles where reported. Filtered runs omit local `trigger_alias` and candidate counters, and trade offsets `0`, `3`, and `30` all return IDs `642,641,640`, confirming stale live pagination and observability behavior. Local broker-authority, conservative accounting, filtered observability, bounded pagination, and calibrated crypto edge-gate wiring are present and regression-tested but not live-proven; no positive-edge crypto BUY path is proven.

This is a documentation/status-only correction because no safe new runtime fix is justified. Focused validation passed **72 tests / 331 assertions across 7 files**; full `bun test` passed **178 tests / 632 assertions**; typecheck and diff-check passed. Deployment is blocked by `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`; no deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-37.md`.

## Sunday, August 23, 2026 Control-36 release-control disposition - OPEN FAIL/DEGRADED

Control-36 used only GET requests against the six required production endpoints plus filtered run and disjoint trade-page probes. All six returned HTTP 200, but production is not healthy: live `/health` is `1.0.0` and `/api/config.version` is `2.4.0`, while local validated release `2.6.0` is not live-proven; Wrangler is unauthenticated. Positions remain broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows), equity has declined from `$98560.32` on August 21, 2026 at `15:37:56 UTC` to `$98504.50` on August 23, 2026 at `13:37:51 UTC`, and current `change_today=0` leaves same-day direction uninformative; caps remain exactly `$5000/$3700/$2000`.

Local source retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for the expected `:07/:37` cadence, and reconciliation `*/10 * * * *`. Sunday daytrading runs are fresh `MARKET_CLOSED` skips, swing has no expected Sunday weekday delivery, crypto is fresh near `13:07:57` and `13:37:58 UTC`, and reconciliation is fresh through `14:01:02 UTC` with `MAINTENANCE_ONLY`, 18 ledger activities, and non-degraded ledger context. Historical lease-held, risk-halt, divergence, provider, D1, and subrequest errors remain observable.

Filled trades expose lifecycle and full-fill fields, but exact per-fill `gross`, `fee`, and `net` remain conservatively null under `unavailable_fill_lot_exact`; aggregate crypto gross/fee/net arithmetic reconciles where reported. Live filtered runs omit local `trigger_alias` and candidate-count fields, and trade offsets `0`, `3`, and `30` repeat IDs `642,641,640`. Local pagination, filtered observability, broker-authority, conservative accounting, and calibrated crypto edge-gate fixes are present and regression-tested but not live-proven; no positive-edge crypto BUY path is proven because ordinary calibrated raw-edge production is absent and the gate correctly fails closed.

Control-36 is documentation/status-only because no new runtime fix is justified and deployment is blocked by `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`. Focused affected-area regressions passed **46/46**; full `bun test` passed **178/178** with **632 assertions**; `bunx tsc --noEmit --pretty false` passed with no diagnostics; and repository-scoped `git diff --check` passed. No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-36.md`.

## Sunday, August 23, 2026 Control-35 strict read-only production control - OPEN FAIL/DEGRADED

Control-35 found a confirmed live release/provenance gap. Required GET endpoints all returned HTTP 200, but live `/health` reports `1.0.0`, `/api/config` reports `2.4.0` without `release_version`, and live `/api/trades` returns the same IDs `642,641,640` for offsets `0`, `3`, and `30`; filtered `/api/runs` also omits local `trigger_alias` and candidate counters. The local validated `2.6.0` source already contains the safe pagination and observability fixes, so do not alter caps, schedules, sizing, accounting, broker authority, or crypto edge-gate behavior to compensate.

Live read-only evidence: positions are broker-authoritative (`source=alpaca`, 29 rows); caps are `$5,000/$3,700/$2,000`; daytrading run `3001` is fresh at `13:01:00 UTC` with `MARKET_CLOSED`; crypto run `2998` is fresh at `12:37:57 UTC`; reconciliation run `3002` is fresh at `13:01:00 UTC` with `MAINTENANCE_ONLY`; swing has no expected Sunday cron delivery. Filled lifecycle fields are present, but exact per-fill gross/fee/net remain unavailable and explicitly unattributed.

Deployment is blocked by `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`. After authentication and explicit authorization, follow the existing release gate: validate source and migrations without mutating the broker, deploy the exact validated artifact, verify the new Worker version and all four schedules, then perform a separate GET-only live check. Require distinct trade offset slices, filtered aliases/candidate counts, fresh natural strategy/reconciliation runs, lifecycle ordering, conservative fee status, unchanged caps, broker position source, and crypto edge-gate skip/compare evidence before changing the health disposition.

## Sunday, August 23, 2026 Control-34 strict read-only production control - OPEN FAIL/DEGRADED

Control-34 verified production with GET-only requests. All six required endpoints returned HTTP 200, but live root/`/health=1.0.0`, `/api/config.version=2.4.0`, and the missing `/api/config.release_version` do not match the locally validated `2.6.0` release at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`, whose source returns `release_version`. `bunx wrangler whoami` at `2026-08-23 12:00:57 UTC` returned `You are not authenticated. Please run wrangler login.` and no `CLOUDFLARE_API_TOKEN` is available.

Do not deploy, preview, migrate, trigger, submit, cancel, close, replace, retry, or otherwise mutate production while provenance/authentication is unresolved. If authenticated deployment becomes available and the standing maintenance rule authorizes it, deploy only the already-validated reliability artifact without changing caps, schedules, sizing, thresholds, accounting semantics, broker authority, leases, edge-gate admission, or trading behavior. Record the deployment receipt and then perform a separate GET-only verification.

The required post-deployment verification must confirm release identity, broker-authoritative positions (`source=alpaca`), equity direction, caps `$5000/$3700/$2000` and direct live cap enforcement, all four UTC schedules, crypto `:07/:37`, reconciliation cadence, structured lease/error skips, lifecycle fields, conservative fee/gross/net status, filtered run aliases/candidate counts, distinct trade pagination, and dashboard trade-count coverage. The separate Control-34 verification observed reconciliation run `2993` at `12:00:58 UTC`, but current live evidence still shows stale identity, absent filtered aliases/candidate counts, repeated trade pages `642..640`, null exact per-fill accounting under `unavailable_fill_lot_exact`, and strategy trade totals 553 versus top-level 642; production is OPEN FAIL/DEGRADED, not healthy. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-34.md`.

## Sunday, August 23, 2026 Control-33 strict read-only production control - OPEN FAIL/DEGRADED

Control-33 used only GET requests against the six required production endpoints plus filtered run and paginated trade probes. All six returned HTTP 200, but production is not healthy: live `/health` is `1.0.0` and `/api/config.version` is `2.4.0`, versus local validated release `2.6.0` at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; Wrangler is unauthenticated, so active Worker/source provenance and deployed cron identity remain unresolved.

Positions remain broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows). Equity is `$98504.50` versus `last_equity=$98504.5039`, with direct delta about `-$0.0039` but `change_today=0`, so material current-day direction is unverified. Caps remain exactly `$5000/$3700/$2000` for daytrading/swing/crypto; no vital parameter changed, while a prior `$5679.8784` daytrading snapshot remains an explicit historical cap-enforcement follow-up.

Local source retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` (`:07/:37`), and reconciliation `*/10 * * * *`. Live crypto delivery is fresh around `10:07:56` and `10:37:55` UTC, and reconciliation is fresh through `11:00:54` with structured `MAINTENANCE_ONLY` skips. Sunday, August 23, 2026 has no expected weekday daytrading/swing delivery; filtered daytrading is stale at run `2556` with `CYCLE_LEASE_HELD`, and swing is stale/error-prone with run `2200` carrying `RISK_HALTED` and position divergence.

Filled trades expose lifecycle fields, but exact per-fill `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact`; aggregate gross/fee/net arithmetic is internally consistent. Trade `597` retains an unexplained timestamp-order anomaly. Live filtered run responses omit local `trigger_alias` and candidate-count annotations, and trade offsets `0`, `3`, and `30` repeat IDs `642..640`, so local observability/pagination corrections are not live-proven. Local crypto calibrated-edge fail-closed wiring and the other reliability fixes are present and regression-tested, but no live positive-edge BUY path is proven.

Control-33 is a documentation/status correction only. Focused/full regressions, typecheck, and diff-check are required after the update. Deployment is blocked by missing Wrangler authentication and unresolved provenance; no deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker mutation occurred. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-33.md`.

## Sunday, August 23, 2026 Control-32 strict read-only production control - OPEN FAIL/DEGRADED

Control-32 used only GET requests against the six required production endpoints plus filtered run and paginated trade probes. All six required endpoints returned HTTP 200, but production is not healthy: live `/health` reports `1.0.0` and `/api/config.version` reports `2.4.0`, versus the locally validated `2.6.0` release at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; active Worker/source provenance remains unresolved and Wrangler is unauthenticated.

Positions remain broker-authoritative with `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `98504.50` versus `last_equity=98504.5039`, with displayed delta approximately `-0.0039` but `change_today=0`, so material current-day direction is not independently verifiable. Capital caps remain exactly `5000/3700/2000` USD; observed daytrading, swing, and crypto values are below their strategy caps.

The local release retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` (`:07/:37`), and reconciliation `*/10 * * * *`. Live crypto delivery is fresh at `09:07:55` and `09:37:56` UTC, and reconciliation is fresh through `10:01:02` with explicit `MAINTENANCE_ONLY` skips. Sunday, August 23, 2026 has no expected weekday daytrading or swing delivery; filtered daytrading remains stale at run `2556` with `CYCLE_LEASE_HELD`, and swing remains stale/error-prone with run `2200` carrying `RISK_HALTED` and position divergence. Historical provider and D1 errors remain observable.

Live filled trades expose lifecycle identifiers and timestamps, but exact per-fill `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact`; aggregate crypto and total gross/fee/net arithmetic is internally consistent. Imported trade `597` has an unexplained timestamp ordering anomaly: `created_at` is later than submitted, filled, and broker-updated timestamps. Live filtered runs omit the local `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` annotations, and trade offsets repeat IDs `642..640`, so the local observability and pagination corrections remain unproven in production. Local crypto calibrated-edge wiring is present and tested, but no production positive-edge BUY path is proven.

The correction is documentation/status-only. No cap, schedule, lease, broker-authority, accounting, edge-gate, sizing, or trading-behavior change was made. Focused validation passed **67 tests / 321 assertions** across 6 files; full `bun test` passed **178 tests / 632 assertions** across 25 files; `bunx tsc --noEmit` and `git diff --check` passed. Separate post-correction GET-only verification returned all six endpoints HTTP 200 and reproduced live `1.0.0/2.4.0`, absent filtered alias/candidate fields, and repeated trade IDs `642..640` at offsets `0` and `30`; production remains degraded. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-32.md`; restore authenticated Wrangler provenance and obtain deployment authorization before any release action. No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used.

Additional Control-32 evidence confirms two further unresolved production gaps. A stored live schedule artifact exposes only three schedules, conflicting with the source/metadata four-schedule declaration; reconciliation runs do show approximately ten-minute delivery, but the authoritative active schedule set is still unverified. A prior stored daytrading snapshot showed market value `5679.8784` against the unchanged `$5000` cap, so historical cap enforcement is not fully cleared even though the current observed daytrading value is below cap. These findings do not justify changing caps, sizing, schedules, or trading behavior without authoritative deployment and exposure evidence.


## Sunday, August 23, 2026 Control-31 final validation - OPEN FAIL/DEGRADED

Control-31 final validation completed locally after correcting the edge-context field contract. Focused suites passed **68 tests / 316 assertions** across 6 files; full `bun test` passed **178 tests / 632 assertions** across 25 files; `bunx tsc --noEmit` and `git diff --check` passed.


Control-31 corrected the local dashboard run-history presentation defect: durable `analyzed_candidates` and `filtered_candidates` are now rendered, and filtered `trigger_alias` values are shown when supplied by the read-only API. The patch is presentation/observability-only and does not change broker authority, leases, schedules, caps, order sizing, accounting, edge-gate admission, or trading behavior.

The local API also exposes broker-versus-D1 freshness context and crypto risk skip context only when supported by actual inputs. Missing calibrated edge and uncertain fill-lot economics remain fail-closed/unattributed; no values are inferred from confidence or fabricated from incomplete fees.

Final focused validation passed **68 tests / 316 assertions** across 6 files; full validation passed **178 tests / 632 assertions** across 25 files; `bunx tsc --noEmit` and `git diff --check` passed. Separate live GET-only verification still shows health `1.0.0` / config `2.4.0`, repeated trade pages, and absent live alias/candidate fields, so production remains **OPEN FAIL/DEGRADED, not healthy** because deployment provenance is unresolved and authenticated Wrangler access is unavailable.

Separate post-correction GET-only verification at approximately `09:07 UTC` observed live run `2970` (`crypto_cron`, `09:07:55`) and snapshot `755` (`09:07:51`), while `/api/trades?limit=3&offset=0` and `offset=3` still both returned IDs `642..640`; `/api/runs?trigger=daytrading_cron` still returned canonical `cron` without `trigger_alias`. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-31.md`. No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used.

## Sunday, August 23, 2026 Control-30 correction update - OPEN FAIL/DEGRADED

The independent read-only audit found no new run-filtering defect: filtered `/api/runs` preserves trigger/status filters and offsets. It did confirm unresolved reliability gaps requiring follow-up: live filled rows expose lifecycle identifiers and timestamps but exact `gross`, `fee`, and `net` remain unavailable under `unavailable_fill_lot_exact`; live crypto runs show fail-closed fee/confidence skips but no numeric edge-after-costs inputs or comparison; broker position metadata is stale relative to current reconciliation activity, with all live stop/take fields null; and cap scope for aggregate versus strategy-specific and unattributed exposure is not documented.

The correction remains documentation/status-only because the local 2.6.0 release already contains the safe pagination, alias/candidate-count, broker-authority, conservative accounting, and calibrated-edge wiring changes, while the live Worker still serves `1.0.0`/`2.4.0`. No safe code change can restore missing broker fill-lot evidence or infer edge values without changing accounting semantics or trading behavior. Production remains **OPEN FAIL/DEGRADED, not healthy** pending authenticated provenance, authorized deployment of the validated artifact, and separate GET-only verification.

## Sunday, August 23, 2026 Control-30 strict read-only production control - OPEN FAIL/DEGRADED

Control-30 used only GET requests against the six required production endpoints plus filtered and paginated GET probes. All returned HTTP 200, but production is not healthy: live `/health` is `1.0.0` and `/api/config` is `2.4.0`, versus the locally validated `2.6.0` release at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; active Worker provenance remains unresolved.

Positions remain broker-authoritative with `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `98504.50` versus `last_equity=98504.5039`, `total_pl≈-0.0039`, and `change_today=0`, so material current-day direction is not independently verifiable. Caps remain exactly `5000/3700/2000` USD; broker-derived strategy values are approximately daytrading `3355.5983`, swing `3249.2831`, and unattributed `1866.2625`, with no cap breach asserted without strategy-specific attribution.

Local UTC schedules remain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` (`:07/:37`), and reconciliation `*/10 * * * *`. Live crypto runs arrived at `07:07:57`, `07:37:56`, `08:07:57`, and `08:37:57` UTC; reconciliation is fresh through run `2968` at `08:50:51`. Sunday, August 23, 2026 has no expected weekday daytrading/swing delivery; filtered daytrading is stale at run `2556` with `CYCLE_LEASE_HELD`, and filtered swing is stale at run `1236`, with historical divergence/`RISK_HALTED` and Alpaca/D1/subrequest errors still observable.

Live lifecycle fields are present, but sampled filled rows retain conservative null `gross`, `fee`, and `net` under `unavailable_fill_lot_exact`; aggregate crypto accounting is internally consistent. Live filtered run responses omit the local `trigger_alias` annotation, and `/api/trades` offsets `0`, `10`, and `20` repeat IDs `642..633`. Local 2.6.0 contains the bounded pagination, alias/candidate-count, broker-authority, conservative accounting, and crypto calibrated-edge fixes; focused validation passed `64/282`, full validation passed `173/603`, typecheck and diff-check passed.

No new runtime correction is justified. The status/documentation correction is recorded in `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-30.md`. Deployment is blocked by Wrangler authentication: `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`; no deployment, preview, or broker mutation occurred. Restore authenticated provenance and obtain deployment authorization, then deploy only if required and repeat separate GET-only verification.

## Sunday, August 23, 2026 Control-29 strict read-only production control - OPEN FAIL/DEGRADED

Control-29 used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; every required endpoint returned HTTP 200. Production is not healthy: live `/health` reports version `1.0.0` and `/api/config` reports `2.4.0`, while the checked-out validated release is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Active Worker provenance and deployed schedule identity remain unresolved.

Live positions remain broker-authoritative: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard account equity is `98504.50` versus `last_equity=98504.5039`; the direct difference is approximately `-0.0039`, but `change_today=0`, so material current-day equity direction is not independently verifiable. Capital caps remain unchanged at `5000` USD daytrading, `3700` USD swing, and `2000` USD crypto.

The local release configuration retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for the expected `:07/:37` cadence, and reconciliation `*/10 * * * *`. Live `/api/runs?limit=100` confirms recurring crypto runs at `:07/:37` and reconciliation runs at ten-minute intervals, including crypto run `2958` at `2026-08-23 07:37:56` and reconciliation run `2961` at `08:01:05`; the live response does not prove the complete deployed cron declaration.

Fresh crypto and reconciliation delivery is present, with structured skip-only observability. Sunday, August 23, 2026 has no expected weekday daytrading or swing cron delivery, so fresh Sunday strategy delivery for those schedules is not applicable/proven. The latest filtered daytrading evidence is stale at run `2556` on August 20 with `CYCLE_LEASE_HELD`; filtered swing evidence is stale at run `1236` on August 11, with prior swing divergence/`RISK_HALTED` evidence. Historical errors remain visible, including Alpaca 503 failures at runs `2802` and `2803` and D1 `too many SQL variables` at run `2678`.

Live filled trades expose lifecycle identifiers, quantities, statuses, and submitted/filled timestamps, but sampled exact per-fill `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; this is conservative and not an arithmetic defect. Dashboard aggregate crypto accounting is internally consistent: `grossTotalPl=-56.616426000004` minus `feesUsd=269.11016882811` equals `netTotalPl=-325.726594828114` within rounding of the reported `-325.72659482810997`, and `feesUsd + accountLevelFeesUsd = 272.32016882811` exactly.

Post-release regression evidence remains local only. The current source contains filtered-run alias/candidate-count observability and crypto calibrated-edge fail-closed wiring, but live filtered responses still omit `trigger_alias` and durable candidate counters, and live trade offsets `0`, `30`, and `60` all repeat IDs `642..613`. Local focused coverage and the full suite pass; these corrections are not live-proven while production remains on the unresolved `1.0.0`/`2.4.0` identity.

No code defect requiring a new runtime correction was isolated. No caps, schedules, migrations, configuration, broker authority, accounting semantics, edge gates, or trading behavior were changed. Wrangler remains blocked by `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`, so no deployment or preview is authorized or possible. Follow-up: restore authenticated Wrangler access, reconcile exact source/deployment provenance and schedules, obtain deployment authorization, deploy only the already-validated reliability artifact if still required, then perform a separate GET-only verification and natural weekday delivery check. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was used.

See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-29.md`.

## Sunday, August 23, 2026 Control-28 strict read-only production control — OPEN FAIL/DEGRADED

Control-28 used only GET evidence. All six required endpoints returned HTTP 200: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. Live identity remains stale/unresolved at health `1.0.0` and config `2.4.0` versus validated local `2.6.0` (`e805da1a4d83a8fa816ebe09c500a57fed5c9c24`). Positions remain broker-authoritative (`source=alpaca`, `positionsAvailable=true`, 29 rows); dashboard equity is `98504.50` versus `last_equity=98504.5039`, with `change_today=0`, so material direction is unverified. Caps remain `5000/3700/2000`. Local `wrangler.toml` retains four UTC crons: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; live schedule identity remains unresolved.

Fresh reconciliation is `MAINTENANCE_ONLY` through run `2945` at `2026-08-23 06:00:56 UTC`; crypto is fresh near `:07/:37` through runs `2942` at `05:37:56` and `2938` at `05:07:55`. Sunday has no weekday daytrading/swing delivery proof: filtered latest daytrading is stale at run `2556` from August 20 with `CYCLE_LEASE_HELD`, and swing is stale at run `1236` from August 11 (with run `2200` from August 18 retaining divergence/`RISK_HALTED` evidence). Historical lease/error skips remain observable, including Alpaca 503s and D1 `too many SQL variables`.

Live filtered aliases/candidate counters remain old/unproven; trade pagination probes at offsets `0/30/60` repeat IDs `642..613`. Filled lifecycle fields exist, but sampled exact `gross`/`fee`/`net` remain null under `unavailable_fill_lot_exact`. Local crypto edge-gate wiring and filtered observability corrections are present and tested, but not live-proven. Deployment is blocked by Wrangler authentication (`You are not authenticated` / missing `CLOUDFLARE_API_TOKEN`). No runtime, cap, schedule, migration, configuration, or trading-behavior change is justified; no broker mutation or deployment occurred. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-28.md`.

## Sunday, August 23, 2026 Control-27 bounded trade-table presentation correction — LOCAL COMPLETE / NOT DEPLOYED

Control-27 is a presentation-only dashboard correction. The trade tables label `estimated_value` as an **order-time estimate** and show `filled_notional` plus `estimated_vs_filled_delta` when available from the existing read-only response. Do not interpret these fields as a change to fee, gross, net, fill-lot accounting, broker authority, or trading behavior. No order submission, sizing, cap, schedule, reconciliation, or runtime path was changed.

Validation passed: focused `bun test test/dashboard-readonly.test.ts test/order-reconciliation.test.ts` — **28 tests / 164 expect() calls**; full `bun test` — **173 tests / 603 expect() calls across 25 files**; `bunx tsc --noEmit` — **PASS (exit 0)**; `git diff --check` — **PASS (exit 0)**. This work item must not be deployed or smoke-tested with production actions. No deployment, production endpoint, mutating endpoint, trigger, order, close, cancel, replace, retry, migration, or preview was used. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-27.md`; any future release requires separate authorization and GET-only verification of source identity.

## Sunday, August 23, 2026 Control-26 deployment and verification record — OPEN FAIL/DEGRADED

The strict control found the active Worker is still the older `1.0.0`/`2.4.0` release, while the validated local artifact is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. The bounded reliability corrections are already present locally, including crypto calibrated-edge wiring, durable candidate counters, filtered-run aliases, corrected trade pagination, broker-authoritative position failure handling, and preserved fee/lease semantics. No cap, schedule, sizing, threshold, or trading-behavior change is included.

The standing maintenance rule permits deploying this reliability-only correction, but the normal deployment attempt stopped before mutation because Wrangler requires `CLOUDFLARE_API_TOKEN` in the non-interactive environment; the authenticated form is `You are not authenticated. Please run wrangler login.` No deployment receipt or temporary preview was produced. Final separate GET-only verification still shows live `1.0.0/2.4.0`, stale daytrading/swing delivery, and no live proof of corrected edge wiring, filtered observability, or pagination. The observed AMZN estimate difference is consistent with `estimated_value` being an order-time estimate rather than realized fill accounting; do not change trading behavior for it. After authentication, deploy only the validated artifact, record the Cloudflare deployment/version receipt, traffic and all four schedules, then perform separate GET-only checks of `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, including filtered runs, pagination, natural weekday delivery, crypto `:07/:37` cadence, reconciliation, caps, position source, and lifecycle/accounting fields. Never use trigger, order, close, cancel, replace, retry, migration, or other broker-mutating actions as smoke tests.

## Sunday, August 23, 2026 Control-25 crypto insufficient-TA candidate-count observability correction — OPEN FAIL/DEGRADED

Control-25 corrected the confirmed local observability defect in `src/crypto-strategy.ts`: when fewer than three crypto candidates have valid technical analysis, the early-return `logRun` now preserves `analyzed_candidates: validTA.length` and `filtered_candidates: 0`. The return remains before signal generation, AI refinement, decision persistence, and order/close activity. No trading behavior, caps, schedules, leases, broker authority, risk gates, or order behavior changed.

Focused regression coverage asserts both durable candidate counts and the absence of downstream decision/order activity in the insufficient-TA early-return block. Validation passes: `bun test test/audit-regressions.test.ts` — **9 tests / 32 assertions**; full `bun test` — **172 tests / 597 assertions** across 25 files; `bunx tsc --noEmit` — pass; `git diff --check` — pass. Deployment remains blocked unless authenticated; no deployment, preview, trigger, submit, cancel, close, replace, retry, migrate, or broker-mutating endpoint was used.

## Sunday, August 23, 2026 Control-24 deployment and verification record — OPEN FAIL/DEGRADED

Validated local release `2.6.0` and its read-only reliability/observability corrections with focused 63/297 and full 171/592 tests, typecheck, and diff-check. A normal standing-rule deployment attempt was made without preview or broker action, but Wrangler stopped before deployment with the exact blocker: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` Do not use `--temporary`; restore authenticated credentials through the secure credential flow, then deploy only the validated artifact and record the Cloudflare receipt, version, traffic, and schedule identity. Until that happens, live `1.0.0/2.4.0` identity, old trade pagination, missing live alias/candidate observability, and fresh weekday strategy delivery remain unresolved. Perform a separate GET-only verification after deployment; never use trigger, order, close, cancel, replace, retry, migration, or other broker-mutating actions as smoke tests.

## Sunday, August 23, 2026 Control-23 crypto calibrated-edge wiring correction — OPEN FAIL/DEGRADED

Control-23 confirmed and corrected a local crypto strategy wiring defect: the shared `TASignal` contract lacked an explicit optional `rawEdgeBps` field, so the crypto path could not carry a calibrated positive edge into its required `RiskManager` gate. The bounded correction preserves only finite, explicitly supplied calibrated edge metadata through crypto decision preparation. It does not infer edge from confidence or any other signal; missing edge still fails closed as `EDGE_CALIBRATION_UNAVAILABLE`, and positive edge is checked after estimated costs. Caps, schedules, thresholds, budgets, sizing, TIF, broker authority, and broker action behavior are unchanged.

Read-only release control rules are explicit: D1 configuration is a controlled deployment/release input, not arbitrary request-time runtime mutation; `GET /api/config` is diagnostic only. POST trigger and close routes are mutating operational actions and are excluded from strict read-only control, deployment smoke tests, and release verification. Never call them to validate this correction.

Release identity must be proven, not inferred: record the exact validated source commit; build a fresh explicit bundle; record Cloudflare deployment ID, Worker version ID, and 100% traffic; verify the complete four-schedule list; then perform GET-only checks of `/health`, `/api/config.release_version`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. A local version, historical receipt, or successful dry-run is insufficient proof of the active Worker.

Focused Control-23 control validation passes **63 tests / 297 assertions**. The current full `bun test` passes **171 tests / 592 assertions** across 25 files; typecheck and diff-check pass, and the fresh Wrangler dry-run passes without deployment. Exact results are recorded in `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-23.md`. Deployment is blocked because Wrangler reports **`You are not authenticated`**; production remains **OPEN FAIL/DEGRADED, not healthy** with live `1.0.0/2.4.0` versus local deployable `2.6.0`. No deployment, trigger, close, order, cancel, replace, retry, migration, or broker-mutating endpoint was used.


This control used only GET requests and remains **OPEN FAIL/DEGRADED, not healthy**. All six required endpoints returned HTTP 200, but live `/health=1.0.0` and `/api/config.version=2.4.0` conflict with local deployable version `2.6.0` at `e805da1`; active Worker/source provenance and deployed schedule identity remain unresolved.

- Positions are broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows. The latest two snapshots at `01:07:51` and `01:37:51 UTC` are flat at `98504.50`; displayed history rose from `98369.21` on August 20 to `98504.50`, while `change_today=0`, so the current-day direction field is not independently usable.
- Caps remain exactly `$5000/$3700/$2000` for daytrading, swing, and crypto. Local UTC schedules remain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; live schedule identity is not exposed and is unresolved.
- Reconciliation is fresh through run `2912` at `2026-08-23 01:50:50` as `MAINTENANCE_ONLY`; crypto is fresh through run `2910` at `01:37:57`, near the expected `:07/:37` cadence, with structured no-position, fee-telemetry, confidence, and hold skips. Sunday has no expected weekday daytrading/swing cron delivery, and no fresh strategy-run delivery is proven for either.
- Historical production errors remain visible: Alpaca 503s on August 22 at `12:07:40` and `12:10:40 UTC`, D1 `too many SQL variables`, and Worker `Too many subrequests by single Worker invocation`. Lease-held skips and explicit crypto edge-gate wiring are **not verifiable** from the permitted GET responses.
- Live filtered-run responses omit the local response-only `trigger_alias` and durable analyzed/filtered candidate counts. Confirmed old-live pagination defect: offsets `0`, `30`, and `60` all repeat trade IDs `642..613`; local 2.6.0 contains the correction and tests, but it is not deployed/proven live.
- Filled trades expose lifecycle fields, but exact per-fill `gross`/`fee`/`net` remain null under `unavailable_fill_lot_exact`; aggregate crypto arithmetic is consistent, with fee telemetry marked available but last dated `2026-08-18`. Local crypto fee/calibrated-edge gating remains fail-closed and locally tested.

No runtime, capital, schedule, or trading-behavior correction was justified. Focused validation passed **76 tests / 307 assertions**; full `bun test` passed **168 tests / 584 assertions**, typecheck and diff-check passed. Wrangler remains blocked by **`You are not authenticated. Please run wrangler login.`** No deployment or broker mutation was used. See `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-22.md`; restore authenticated provenance, obtain deployment authorization, and then repeat separate GET-only verification.

## August 23, 2026 Control-21 lease-contract correction — documentation-only

The `cycle_leases` contract is clarified: source uses separate keys for `maintenance`, `daytrading`, `swing`, and `crypto`; each key prevents same-key overlap, with no cross-key blocking. Existing tests assert this isolation, preserving intended behavior. No runtime code, tests, trading behavior, caps, schedules, deployment configuration, deployment, or broker mutation changed or occurred.

## Sunday, August 23, 2026 Control-20 read-only production control — OPEN FAIL/DEGRADED

This current Sunday, **August 23, 2026**, control is documentation/status-only and remains **OPEN FAIL/DEGRADED, not healthy**. The evidence is GET-only; no trading code, vital caps, schedules, broker behavior, or deployment configuration was changed, and no deployment or broker-mutating endpoint was used.

- All six required GET endpoints — `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` — returned **HTTP 200**.
- Release identity is unresolved: live health reports **1.0.0**, live config reports **2.4.0**, and the local deployable is **2.6.0**. Do not treat the version mismatch as healthy or as proof that the local artifact is live.
- Broker-authoritative positions report `positionsAvailable=true`, `source=alpaca`, and **29 rows**. Dashboard equity is **98504.50** versus `last_equity=98504.5039`, with `change_today=0`; material current-day equity direction remains unverified.
- Caps remain **5000 / 3700 / 2000** for daytrading, swing, and crypto. Local source/tests retain four UTC schedules — daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *` — while live schedule identity remains unresolved.
- Fresh reconciliation evidence is `MAINTENANCE_ONLY`. Crypto activity is around **:07/:37 UTC** and includes structured skips; this does not establish complete strategy delivery.
- There is **no fresh Saturday daytrading or swing proof**. Filtered-run evidence has a live/local `trigger_alias` mismatch, and durable analyzed/filtered candidate counts remain absent, leaving a durable count gap.
- Live trade lifecycle fields include identifiers, quantities, status, and timestamps, but per-fill `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact`; exact fill-lot attribution is unavailable. The known live `/api/trades` pagination defect remains: later offsets repeat page one.
- Local validation already passes (including the recorded focused `52` tests / `256` assertions, full `168` tests / `584` assertions, typecheck, and diff checks). Wrangler authentication/deployment remains blocked by **`You are not authenticated`**; no deployment was attempted.

Keep the production disposition **OPEN FAIL/DEGRADED, not healthy**. This Control-20 record preserves Control-19 history and records live evidence only; it does not authorize deployment or justify changing trading, caps, schedules, broker behavior, or fail-closed gates.

## Control-19 date integrity correction

The server-clock payloads labeled **August 23, 2026** are future-dated relative to the required control date of **Saturday, August 22, 2026**. Retain them for traceability, but do not count them as August 22 current-day run delivery or use them to close the August 22 control; the valid disposition remains **OPEN FAIL/DEGRADED**.

The server-clock evidence bundle is timestamped **August 23, 2026**, which is after the required control date of **Saturday, August 22, 2026**. It is retained for traceability, but must not be represented as an August 22 current-day run or used to close that control; the valid August 22 disposition remains **OPEN FAIL/DEGRADED**.

## August 23, 2026 Control-19 live pagination defect confirmation - FAIL/DEGRADED

A separate GET-only verification confirmed that the live old deployment repeats the first trade page: `/api/trades?limit=30&offset=0`, `offset=30`, and `offset=60` all returned 30 rows with IDs `642..613`. This is a live release/provenance gap because the checked-out version `2.6.0` already contains the offset/page correction and regression coverage proving distinct slices, but live `/health=1.0.0` and `/api/config.version=2.4.0` remain old.

No new trading or broker-reliability code change is justified. Keep production **OPEN FAIL/DEGRADED, not healthy**; restore authenticated Wrangler access, obtain separate deployment authorization, deploy only the already-validated read-only artifact if required, then repeat GET-only pagination, endpoint, provenance, schedule, position, cap, lifecycle, and natural-run checks. No deployment, preview, migration, trigger, submit, cancel, close, replace, retry, or broker mutation was used.

## August 23, 2026 Control-19 strict read-only production control - FAIL/DEGRADED

At the captured server window beginning **2026-08-23 00:00:18 UTC**, the control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; all six returned HTTP 200. Production remains **OPEN FAIL/DEGRADED, not healthy**: live `/health=1.0.0` and `/api/config.version=2.4.0` conflict with local deployable version `2.6.0` at `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`, so active Worker/source provenance is unresolved.

Positions are broker-authoritative with `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `98504.50` versus `last_equity=98504.5039`, approximately `-0.0039`; `change_today=0`, so material direction is unverified. Live caps remain exactly `$5,000/$3,700/$2,000`; local source/tests retain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`, but active deployed schedule identity is not exposed by `/api/config` and remains unresolved.

Reconciliation is fresh through run `2897` at `2026-08-23 00:00:56`, recorded as structured `MAINTENANCE_ONLY`. Crypto delivery is fresh around `:07/:37` through runs `2894` at `23:37:57`, `2890` at `23:07:56`, and `2886` at `22:37:56`, with structured no-position, fee-telemetry, and confidence skips. No fresh Saturday daytrading or swing delivery is proven: filtered daytrading ends at run `2556` (`CYCLE_LEASE_HELD`, August 20) and filtered swing at run `2200` (position divergence plus `RISK_HALTED`, August 18); historical provider/Alpaca error skips remain auditable.

The live filtered-run response returns canonical rows and pagination but omits local response-only `trigger_alias`, while `run_log` still lacks durable analyzed/filtered counts. The 50-row filled trade sample exposes broker/client identifiers, quantities, status, and submitted/filled timestamps, but per-fill `gross`, `fee`, and `net` are null under `unavailable_fill_lot_exact` with `none-recorded` attribution; crypto dashboard aggregate arithmetic is consistent, not exact fill-lot proof. Local focused regressions pass 52 tests / 256 assertions, full tests/typecheck/diff-check pass, and crypto entry remains fail-closed without fresh fee telemetry or calibrated `rawEdgeBps`.

No code defect was isolated, so this is a documentation/status-only correction recorded in `CORRECTION_WORK_ITEM_2026-08-23_CONTROL-19.md`. Wrangler remains blocked by **`You are not authenticated`**; restore authentication, inspect provenance, obtain separate deployment authorization, deploy only if required, then perform separate GET-only verification. No deployment, preview, migration, trigger, submit, cancel, close, replace, retry, or broker mutation was used.

## August 22, 2026 Control-18 strict read-only production control - FAIL/DEGRADED

The **2026-08-22 23:00:16-23:00:17 UTC** control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; all six returned HTTP 200. Acceptance remains **FAIL/DEGRADED**, not healthy: live `/health=1.0.0`, `/api/config.version=2.4.0`, local HEAD `131898b9e4cab3544ae9b793123c1c86d5763cdc`, and deployable version `2.6.0` do not establish active Worker/source identity.

Read-only evidence: positions `positionsAvailable=true`, `source=alpaca`, count `29`; equity `98504.50` versus `last_equity=98504.5039`, delta about `-0.0039`, with `change_today=0`, so material direction cannot be verified; caps exactly `5000/3700/2000`. Local UTC schedules are daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; active deployed four-schedule identity is unresolved.

Fresh reconciliation runs `2888` at `22:50:50` and `2887` at `22:40:49` are `MAINTENANCE_ONLY`; fresh crypto runs `2886` at `22:37:56`, `2882` at `22:07:57`, `2878` at `21:37:56`, and `2874` at `21:07:57` are around `:07/:37` with structured skips. Saturday has no fresh daytrading/swing proof and historical lease/error/risk skips remain. `/api/trades` returns 50 filled rows with `submitted_at`/`filled_at`, null inapplicable terminal fields, null gross/fee/net, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`; aggregate arithmetic is not exact fill-lot proof. The live old response omits `trigger_alias`, and `run_log` lacks durable analyzed/filtered counts.

No code defect was isolated. Do not change trading/reliability code, configuration, caps, schedules, or edge gates. Local filtered-alias and crypto fee/`rawEdgeBps` fail-closed wiring/tests pass, while live positive calibrated-edge producer evidence is unavailable. Wrangler is blocked by **`You are not authenticated`**. Restore authenticated Wrangler, inspect active provenance/schedules, obtain separate deployment authorization, deploy only if required, then perform separate GET-only verification. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker mutation was used. See `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-18.md`.

## August 22, 2026 Control-17 strict read-only production control - FAIL/DEGRADED

At **2026-08-22 22:00:07-22:00:09 UTC**, all six required production GET endpoints returned HTTP 200. Acceptance is **FAIL/DEGRADED**, not healthy, because live release identity is unresolved (`/health=1.0.0`, persisted `/api/config.version=2.4.0`) versus deployable source HEAD `1013f3dc979fd9b56a7cae1b843177bb3ab5f21f`, version `2.6.0`.

The live position response is broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows). Equity is `98,504.50` versus `last_equity=98,504.5039`, approximately `-0.0039`; `change_today=0` means material direction is not established. Caps are unchanged at `$5,000/$3,700/$2,000`.

Local source and saved release metadata specify all four UTC crons: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, reconciliation `*/10 * * * *`. Captured schedule responses disagree, so active deployed schedule identity must be rechecked after authenticated provenance is restored. Reconciliation delivery is fresh as `MAINTENANCE_ONLY` near ten-minute cadence; crypto delivery is fresh near `:07/:37`; Saturday has no fresh weekday daytrading or swing evidence.

Filtered run aliases return canonical rows but live output lacks local `trigger_alias`; candidate analyzed/filtered counts are not persisted in `run_log`. Lifecycle fields are exposed, while exact per-fill gross/fee/net remains unavailable by design when deterministic lot attribution cannot be proven. Crypto BUY admission remains fail-closed on unavailable fee telemetry or missing calibrated raw edge.

Focused regressions passed **50 tests / 243 assertions**; the full `bun test` passed **168 tests / 584 assertions**; typecheck and diff checks passed. No deployment or broker mutation is authorized or attempted in this control. Required follow-up is authenticated provenance inspection, separate deployment authorization if promotion is still required, and a separate GET-only release verification plus natural weekday strategy observation.

## August 22, 2026 Control-16 strict read-only production control - FAIL/DEGRADED

At **2026-08-22 21:00:23-21:01:42 UTC**, the production control used only GET requests and all six required endpoints returned HTTP 200. Evidence is preserved under `/workspace/alpaca-control-16-live-20260822T2100Z/`, including response headers, bodies, filtered run queries, and checksums. Production is **FAIL/DEGRADED**, not healthy, because live `/health=1.0.0` and persisted `/api/config.version=2.4.0` do not identify checked-out deployable source HEAD `4cc5df6c1cb7979ffefc7ddb751fdc8e1331d3cd`, version `2.6.0`.

Read-only acceptance evidence: positions remain broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows); equity is `98,504.50` versus `last_equity=98,504.5039` with `change_today=0`, so material current-day direction is not proven; caps remain `$5,000/$3,700/$2,000`; and local `wrangler.toml` retains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`.

Reconciliation delivery is fresh `MAINTENANCE_ONLY` near ten-minute cadence, and crypto delivery is fresh near `:07/:37` at `20:07:59` and `20:37:59`. Saturday provides no fresh weekday daytrading/swing proof. Filtered alias requests return canonical rows without live `trigger_alias`; sampled filled trades contain lifecycle timestamps but conservative null per-fill gross/fee/net under `unavailable_fill_lot_exact`; local crypto edge gates remain fail-closed, while live positive-edge evidence is unavailable. Historical lease-held, risk-halted, and provider-error skips remain visible.

Correction record: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-16.md`. No source or configuration change is justified. Do not alter caps, schedules, broker authority, leases, accounting, edge gates, or trading behavior. Focused regressions passed 54 tests / 263 assertions; full `bun test` passed 168 tests / 584 assertions; `bun run typecheck`, `git diff --check`, and documentation synchronization checks passed after this update.

Deployment gate: `bunx wrangler whoami` returns **`You are not authenticated`**. Do not use a temporary preview. Restore authenticated access, inspect provenance, obtain separate deployment authorization, and deploy only the validated artifact if required. Then perform a separate GET-only acceptance pass, including natural weekday daytrading/swing observation; if acceptance fails, roll back to the last known-good authenticated deployment and repeat read-only verification. No trigger, order, cancellation, close, replace, retry, migration, or broker-mutating endpoint was used.

## August 22, 2026 Control-15 strict read-only production control - FAIL/DEGRADED

At **2026-08-22 20:00:26-20:00:28 UTC**, all six required production endpoints returned HTTP 200 through GET-only requests. Production remains **FAIL/DEGRADED, not healthy**: live `/health=1.0.0` and persisted `/api/config.version=2.4.0` conflict with checked-out deployable source `2.6.0`, so active Worker/source identity and the locally validated correction set remain unproven.

Current live evidence: `/api/positions` is broker-authoritative with `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `98,504.50` versus `last_equity=98,504.5039`, a `-0.0039` delta; `change_today=0`, so material equity direction is **CANNOT VERIFY** from this snapshot. Live config caps remain exactly `$5,000/$3,700/$2,000`. Source retains the four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and read-only reconciliation `*/10 * * * *`.

Reconciliation is fresh and structured as `MAINTENANCE_ONLY` near the ten-minute cadence, while crypto runs are fresh near `:07/:37` with minute-level jitter. Saturday provides no fresh weekday daytrading or swing proof. Lease-held and error skips remain auditable, including reconciliation Alpaca 503 at `12:10:40 UTC` and retained SQL-variable/subrequest failures. Filtered-run outputs are constrained, but live responses omit the locally validated response-only `trigger_alias` field. Sampled filled trades expose lifecycle fields, while exact per-fill accounting remains conservatively unavailable with `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`. Local crypto gates remain fail-closed on missing fee telemetry or calibrated `rawEdgeBps`; live positive-edge evidence is unavailable.

No new code defect was isolated. Control-15 is a documentation/status-only correction work item: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-15.md`. Local source/tests preserve broker-authoritative positions, all four schedules, filtered-run wiring, lifecycle/accounting semantics, leases, unchanged caps, and crypto edge-gate behavior. Wrangler remains blocked by **`You are not authenticated`**; no deployment or temporary preview was attempted. Focused/full regressions, typecheck, diff-check, and synchronized documentation updates passed for this work item: focused 54 tests/263 assertions, full 168 tests/584 assertions, typecheck passed, and diff-check passed.

Required follow-up: restore authenticated Wrangler access, inspect deployment provenance, obtain separate deployment authorization, deploy only the validated artifact if still required, then perform separate GET-only release and endpoint verification plus natural weekday strategy observation. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used.

## Control-14 follow-up and deployment gate - August 22, 2026

The latest strict production control remains **FAIL/DEGRADED**. All six required endpoints were read with GET only and returned HTTP 200, but active release identity is unresolved (`/health=1.0.0`, persisted `/api/config=2.4.0`, local deployable source `2.6.0`). Live positions are broker-authoritative (`positionsAvailable=true`, `source=alpaca`, 29 rows), caps remain `$5,000/$3,700/$2,000`, reconciliation and crypto delivery are present, and the local four-schedule, filtered-run, lifecycle, conservative-accounting, and crypto fail-closed regressions remain validated. Saturday does not prove weekday daytrading/swing delivery; live filled rows still show conservative unavailable exact accounting.

**Deployment gate:** `bunx wrangler whoami` returns **`You are not authenticated`**. Do not use `wrangler deploy --temporary`. Restore authenticated Wrangler access and obtain separate deployment authorization before deploying any artifact. If deployment becomes authorized, use only the validated repository commit, record the receipt, and then run a separate GET-only acceptance pass covering release identity, all six endpoints, alias/canonical run filters, broker source, equity direction, all four schedules, caps, natural weekday strategy delivery, crypto `:07/:37` cadence, lease/error skips, lifecycle fields, and conservative gross/fee/net semantics. If acceptance fails, roll back to the last known-good authenticated deployment and repeat the same read-only checks.

Correction record: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-14.md`.

## Control-13 observability contract: `trades_executed` means full fills

For release checks and run-history interpretation, `run_log.trades_executed` counts only broker-confirmed full fills. The implementation requires broker status `filled` and filled quantity at least 99.9% of requested quantity before incrementing the metric. An order being submitted or accepted is not a fill; pending, rejected, canceled, and partially filled orders contribute zero to `trades_executed` and are not fully filled trades.

`trades` remains the order-lifecycle record and may contain submitted, accepted, pending, or partially filled orders with broker status and quantity fields; only fully filled trades contribute to the run count. Reconcile those rows using `status`, `filled_qty`, `leaves_qty`, and lifecycle timestamps; do not sum all `trades` rows or treat accepted/submitted rows as filled executions. This is a documentation/observability correction only. Do not alter caps, schedules, broker authority, edge gates, order behavior, or mutation boundaries.

## August 22, 2026 GET `/api/trades` pagination correction — locally validated, not deployed

The contained read-only correction makes `GET /api/trades?limit=30&offset=30` and `offset=60` return their requested slices instead of repeating the `offset=0` leading records, and adds `limit`, `offset`, and `page` response metadata. Existing strategy filtering, the 500-record cap, broker authority, `$5,000/$3,700/$2,000` caps, schedules, edge gates, and mutation boundaries are preserved.

Focused validation passed **28 tests / 157 assertions**; full `bun test` passed **163 tests / 560 assertions**; `bun run typecheck` and `git diff --check` passed. Do not deploy this correction from this validation pass; no deployment or broker-mutating endpoint was used.

## August 22, 2026 Control-10 release decision — FAIL/DEGRADED

The strict production control was **GET-only**; do not infer deployment or authorize broker mutation from it. Live `/health=1.0.0` and `/api/config=2.4.0` remain inconsistent with repository deployable `2.6.0`, and `/workspace/src` is stale reference material rather than the deployable source. Fresh crypto/reconciliation skips, crypto approximately `:08/:38`, provider 503 errors at `12:00:46`, `12:07:40`, and `12:10:40 UTC`, and the absence of fresh weekday daytrading/swing proof on Saturday keep the release **FAIL/DEGRADED**.

Read-only evidence still shows broker-authoritative positions (`source=alpaca`) and slightly down equity direction (`98,504.50` versus `last_equity 98,504.5039`). Filtered run observability works; lifecycle fields exist, but sampled `gross`/`fee`/`net` remain null under `unavailable_fill_lot_exact`. Preserve caps `$5,000/$3,700/$2,000`, the four local schedules, and correct fail-closed crypto edge-gate wiring; do not change trading behavior.

Deployment is blocked by the exact Wrangler response **`You are not authenticated`**. The local correction adds read-only `/api/trades` offset/page pagination with stable ordering and estimate-basis, filled-notional, and estimate-delta fields. Final focused validation passed **69 tests / 282 assertions**; full `bun test` passed **164 tests / 562 assertions**; TypeScript, diff-check, and Wrangler dry-run passed with a **282.79 KiB** upload preview. Historical D1-variable/subrequest failures remain documented risk evidence, and `estimated_value` must be interpreted as a pre-fill estimate rather than fill accounting. Final separate GET-only verification still shows the old live identity and old pagination contract. Restore auth, deploy the exact validated artifact only if authorized, then perform separate GET-only verification and natural weekday checks. No deployment or broker-mutating endpoint was used. Correction record: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-10.md`.

## August 22, 2026 Control-9 release decision — FAIL/DEGRADED

A strict GET-only control found a local reliability defect in the broker-authoritative positions failure path. The corrected source attempts the broker snapshot before reading D1 positions metadata, and the failure path returns `503`, `positionsAvailable: false`, `source: alpaca`, with no D1 fallback or DDL. Focused validation passed **61 tests / 246 assertions**, full validation passed **161 tests / 537 assertions**, typecheck and diff-check passed, and Wrangler dry-run passed.

Live verification recovered `/api/positions` to 200 with `source: alpaca` and 29 rows, but `/health=1.0.0` and `/api/config=2.4.0` still conflict with local `2.6.0`; recent Alpaca 503 run errors, absent fresh daytrading/swing success, crypto `:08/:38` jitter, and null per-trade gross/fee/net remain unresolved. Preserve caps `$5,000/$3,700/$2,000`, all four UTC schedules, broker authority, isolated leases, and fail-closed crypto fee/edge gates.

Deployment is blocked until `bunx wrangler whoami` no longer reports `You are not authenticated`. Do not use `wrangler deploy --temporary`. After authorized normal deployment, tie the receipt to the validated artifact and perform separate GET-only verification of all six endpoints, filtered run observability, caps, source, positions, equity direction, schedules, natural strategy delivery, lifecycle fields, and conservative accounting.

Correction record: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-9.md`.

## August 22, 2026 Control-6 source and observability audit update — FAIL/DEGRADED

Historical Control-6 audit note (superseded by Control-23): filtered/analyzed counts remain a separate observability gap, while the then-current source had no production caller path for calibrated `rawEdgeBps`. Control-23 now supplies only the missing explicit signal/decision wiring; crypto positive-edge admission remains fail-closed when edge is absent. Historical live crypto `time_in_force: "day"` still requires source-to-Worker reconciliation and does not justify changing TIF. Do not change caps, schedules, edge gates, TIF, sizing, or trading behavior to make evidence appear consistent.

## August 22, 2026 Control-6 saved-artifact evidence update — FAIL/DEGRADED

Saved artifacts do not close release acceptance: the complete post-release schedule capture has four crons, the older live schedule capture has only three and omits reconciliation, alias-filter captures are empty while canonical captures contain rows, and the requested limited reconciliation capture is missing. Saved daytrading and swing records remain stale or halted, current positions include unattributed MSTR exposure, and sampled trade accounting remains null under `unavailable_fill_lot_exact`. Do not deploy or trigger from these artifacts; restore authenticated source verification first.

## August 22, 2026 Control-6 strict read-only production control — FAIL/DEGRADED

Do not claim this release healthy. The six required GET endpoints returned HTTP 200 at approximately 11:00 UTC, but live `/health`=`1.0.0` and `/api/config`=`2.4.0` conflict with the validated local deployable `2.6.0`. Live positions remain broker-authoritative (`source: "alpaca"`, 29 rows), caps remain `$5,000/$3,700/$2,000`, and current equity is `98,504.50` versus `last_equity` `98,504.5039`.

The local correction includes response-only run alias annotations, conservative accounting, broker-authoritative projection, four UTC schedules, bounded reconciliation, isolated leases, and fail-closed crypto edge gates. Local focused/full validation, typecheck, diff check, and dry-run passed. Live alias queries still omit `trigger_alias`, and no fresh successful daytrading or swing run is evidenced; crypto is near `:07/:37` but commonly records `:08/:38`, with UTC labeling unproven because timestamps lack a timezone suffix. Filled rows expose lifecycle fields, but gross/fee/net remain null until deterministic fill-lot attribution exists, and live numeric edge-gate wiring is not exposed.

Deployment is required only after restoring authenticated Wrangler access and tying the upload to the exact validated artifact. `bunx wrangler whoami` currently reports `You are not authenticated`; do not use `wrangler deploy --temporary`. No deployment or broker-mutating endpoint was used. After authorized deployment, perform a separate GET-only verification of release identity, all six endpoints, alias filters, broker-authoritative positions, caps, equity direction, schedules, natural run delivery, lifecycle/accounting fields, fee freshness, and crypto edge-gate observability.

## August 22, 2026 Control-5 correction: explicit filtered-run aliases — FAIL/DEGRADED

Live defect: strict GET-only captures showed alias-filtered `/api/runs` requests for `daytrading_cron` and `reconciliation_cron` returning empty rows while canonical `cron` and `reconcile_cron` filters returned rows; responses also lacked an explicit stable alias indicator. Exact correction scope is `src/api.ts` only: retain the existing SQL alias filtering, annotate alias-filtered rows with response-only `trigger_alias`, and leave canonical stored/returned `trigger` values and canonical-request responses unchanged. No deployment artifact, schema, DDL, schedule, cap, broker authority, broker call, or trading behavior was changed.

Release validation required and completed locally: focused `test/dashboard-readonly.test.ts` alias/canonical/no-broker/no-DDL regression (**11 tests / 101 assertions passed**), full `bun test` (**157 tests / 520 assertions passed**), `bunx tsc --noEmit` passed, and `git diff --check` passed. Deployment was not performed because Wrangler is blocked by the missing `CLOUDFLARE_API_TOKEN` with the exact error `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` Production remains **FAIL/DEGRADED**, not healthy; after credentials are restored, require authenticated deployment and separate GET-only verification of canonical and alias run filters. No broker-mutating endpoint was used.

## August 22, 2026 Control-3 correction: filtered runs, release identity, and evidence gaps

Additional release evidence is contradictory on schedule metadata: one saved live API artifact omits reconciliation, while the post-release artifact and current source retain all four UTC schedules. Run-level filtered/analyzed counts are not durable `run_log` fields, and aggregate strategy gross/net are not fill/lot exact; deployment verification must therefore include schedule metadata reconciliation and must not claim per-trade accounting from aggregate P&L. Source-level gates pass for broker authority, skip logging, caps, filtered-run predicates, and fail-closed crypto edge handling, but release acceptance still fails on active source identity, fresh daytrading/swing delivery, exact cadence, lifecycle coverage, direct cap proof, production `rawEdgeBps`, and exact fill/lot accounting. Production remains **FAIL/DEGRADED** with no trading-behavior or cap change authorized.

## August 22, 2026 Control-3 correction: filtered runs and release identity

Production control found a release/version mismatch: live `/health` reports `1.0.0` and live `/api/config` reports `2.4.0`, while the deployable source reports `2.6.0`. An earlier capture also showed `/api/runs` filter loss; fresh post-attempt GET probes now return correctly filtered rows, but the corrected source is still not live-proven. The local reliability-only correction is present in `src/api.ts`, `src/database.ts`, and `src/version.ts`; it preserves broker-authoritative positions, all four schedules, caps of **$5,000/$3,700/$2,000**, crypto calibrated-edge fail-closed behavior, and trading semantics.

The required correction work item is `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-3.md`; production remains **FAIL/DEGRADED** until deployment and separate GET-only verification succeed. Deployment evidence is contradictory: `final-deployments.json` records `f181f9c3...` at `2026-08-21T21:03:38Z`, while `direct-upload-5bb8153-20260822.json` records deployment `b6293793...` modified at `2026-08-22T01:14:22Z`; neither reconciles with live `1.0.0/2.4.0`. Treat both as historical artifacts and require an authenticated receipt tied to the exact source commit before claiming the Worker is live.

## August 22, 2026 release-version observability correction — source-to-Worker identity unresolved

The canonical local release version is **`2.6.0`**, established by the deployable source's `schema.sql` `bot_config.version` seed and the existing dashboard footer. Local metadata and tests agree on `2.6.0`, but live `/health` remains `1.0.0` and live `/api/config` remains `2.4.0`. Historical receipts claim successful deployments, including `f181f9c3...`, while a later direct-upload artifact records `b6293793...`; these records conflict with live identity and do not establish the active source/version. Treat deployment status as **unresolved**, not as verified live, until an authenticated receipt can be matched to the live Worker. This is reliability-only observability work: no trading behavior, schedules, caps, edge gates, broker calls, D1 mutation semantics, or endpoint methods changed.

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

## August 22, 2026 Control-11 release gate and rollback disposition

The strict production control was GET-only and returned HTTP 200 for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. Do not call triggers or broker-mutating routes to manufacture missing weekday evidence. Production remains **FAIL/DEGRADED** because live identity is still `/health=1.0.0` and persisted config `2.4.0` versus validated local source `2.6.0`; fresh daytrading/swing delivery is unverified; crypto commonly records one minute after the `:07/:37` target; and exact per-fill gross/fee/net attribution remains unavailable. Positions are still broker-authoritative, caps remain `$5,000/$3,700/$2,000`, and local four-schedule and fail-closed crypto-edge tests pass.

The validated correction is commit `b229eb3255097d5c6c13684a351ed2d867731021`. Focused validation passed 42 tests / 204 assertions, full `bun test` passed 164 tests / 562 assertions, TypeScript and `git diff --check` passed, and no schedule, cap, threshold, sizing, edge-gate, TIF, or trading-behavior changes are included. `bunx wrangler whoami` currently returns `You are not authenticated`, so no deployment or temporary preview is permitted from this control.

**Authorized release sequence when credentials are restored:** deploy only the exact validated artifact through the normal authenticated path; capture the deployment/version and schedule receipt; then separately GET-check release identity, all six endpoints, canonical and alias run filters, broker position source, equity direction, all four schedules, lifecycle fields, conservative accounting, and unchanged caps. Observe the next natural weekday daytrading and swing windows before closing the control. **Rollback:** if any post-deploy read-only acceptance check fails or source identity cannot be tied to the artifact, restore traffic to the last known-good authenticated deployment using the Cloudflare release-control procedure, record the receipt, and repeat the GET-only checks. Do not use `--temporary`, triggers, submit, cancel, close, replace, retry, migration, or any broker-mutating endpoint for validation.

## August 22, 2026 Control-12 release gate - FAIL/DEGRADED

The approximately 18:00 UTC control was strictly GET-only and returned HTTP 200 for all six required endpoints. Live `/health=1.0.0` and persisted `/api/config=2.4.0` still conflict with validated local source `2.6.0`; live `/api/trades` still exposes the old pagination/enrichment shape, so the correction is not live-proven. `/api/positions` remains broker-authoritative with 29 rows, equity is down only `0.0039` against `last_equity`, and caps remain `$5,000/$3,700/$2,000`.

Fresh reconciliation skips continue near ten-minute cadence and crypto skips appear around `:07/:37 UTC`; Saturday still cannot prove weekday daytrading or swing delivery. Local tests preserve all four schedules, filtered aliases, broker authority, lifecycle/accounting safeguards, and fail-closed crypto edge gates without changing trading behavior. Wrangler reports `You are not authenticated`, so do not deploy or use a temporary preview from this control.

When authenticated and separately authorized, deploy only the exact validated commit `b229eb3255097d5c6c13684a351ed2d867731021`, capture the release receipt, then perform a separate GET-only check of release identity, all six endpoints, canonical and alias filters, source, equity direction, schedules, lifecycle/accounting fields, and caps. Observe natural weekday daytrading and swing windows; if any acceptance check fails, roll back to the last known-good authenticated deployment and repeat the same GET-only checks. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating route is valid as a smoke test.

## August 21, 2026 additive trade observability correction - deployed and GET-only verified

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

# Deployment Runbook

## Control-51 release boundary, August 24, 2026

The current production control is **OPEN FAIL/DEGRADED**. The live Worker reports health/config versions `1.0.0`/`2.4.0`, while the checked-out deployable artifact is release `2.6.0`; do not treat the live endpoints as proof that the validated source is deployed. The required caps remain daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`, and the four local UTC schedules remain unchanged.

Control-51 was GET-only. It verified broker-authoritative positions (`source=alpaca`, 29 rows), fresh crypto `:07/:37` and reconciliation delivery, structured daytrading/swing/crypto skip/error evidence, and lifecycle fields. It did not clear production because swing run `3182` still recorded eight Cloudflare subrequest-limit errors, live filtered-run aliases/candidate counters remain absent, trade pagination probes repeat IDs, run `code`/`search` filters and trade `status` filtering were ignored, and exact per-fill gross/fee/net remain unavailable under conservative accounting. The local API now enforces those read-only filters; aggregate fee math remains unchanged because account-level regulatory fees are subtracted exactly once. Local filtered observability, pagination, broker-authority, fee, and crypto calibrated-edge regressions remain local-only until authenticated provenance and a post-release GET-only verification bind them to production.

The local filter correction passed focused **98/98 tests, 427 assertions**, full **184/184 tests, 678 assertions**, typecheck, and diff-check. No deployment, trigger, order, cancellation, close, replace, retry, migration, or broker mutation was performed for Control-51 because Wrangler is unauthenticated (`You are not authenticated. Please run \`wrangler login\`.`) and the worktree is not a clean release artifact. If deployment is later separately authorized, deploy only the exact validated artifact, capture the active version/source and cron provenance, and immediately run a separate GET-only verification of all six endpoints, filtered runs, trade pagination, caps, positions, crypto cadence, and a natural weekday swing run.


## August 22, 2026 Control-9 release decision

Control-9 is a reliability-only correction. `GET /api/positions` must obtain the broker-authoritative snapshot before any D1 metadata read; on an Alpaca 503 it must return HTTP 503 with an empty position list and issue zero D1 statements. `/api/config.release_version` identifies the active Worker artifact, while `config.version` remains persisted D1 diagnostic data. Scheduled reconciliation 503/error handling remains fail-closed and read-only, with errors persisted in run details and no broker mutation.

Local validation for the correction passed focused **26 tests / 153 assertions**, full **161 tests / 537 assertions**, TypeScript, diff-check, and Wrangler dry-run (**281.69 KiB** upload preview, **63.97 KiB** gzip). Deployment is required to make the correction live but is not authorized through the current environment because `bunx wrangler whoami` reports unauthenticated; do not use `wrangler deploy --temporary`.

After authenticated deployment, tie the receipt to this exact checkout and repeat only GET-only verification of `/health`, `/api/config` and `release_version`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, including filtered runs, broker-authoritative position availability, all four schedules, unchanged caps, and reconciliation recovery. Keep production **FAIL/DEGRADED** until those checks pass. Follow-up record: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-9.md`.

## August 22, 2026 Control-7 release decision

Control-7 is **FAIL/DEGRADED**. The live Worker returned Alpaca HTTP 503 failures from account/positions reads while correctly failing closed; live release identity remains unresolved (`/health` 1.0.0 and `/api/config` 2.4.0 versus local deployable 2.6.0). This work item includes a reliability-only source fix in `src/swing-strategy.ts` plus focused regression coverage and documentation updates. Deployment is blocked until authenticated Wrangler access is restored; no temporary preview is permitted.

Before any future deployment, restore authenticated Wrangler access, prove the bundle-to-Worker identity, run the focused and full regression matrix, and perform a separate GET-only live verification. Do not use triggers or broker-mutating endpoints to validate a release. Keep caps at $5,000/$3,700/$2,000 and preserve all four UTC schedules and fail-closed crypto edge gates.

The reliability-only correction in `src/swing-strategy.ts` now records the actual kill-state reason in swing `RISK_HALTED` context and logs; it never records the boolean halt flag. Focused regression coverage proves the reason remains a string. Preserve the four schedules, caps `$5,000/$3,700/$2,000`, broker-authoritative positions, edge gates, TIF, sizing, and mutation boundaries. The related crypto fee-telemetry timing mismatch (observed around `:08/:38` versus configured `:07/:37`) is deferred, and fee/calibrated-edge checks must remain fail-closed when data is unavailable.

Follow-up record: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-7.md`.

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

Historical August 10 baseline (not current):

- TypeScript check passes.
- 85 tests passed, 0 failed, 257 assertions in the historical August 10 release; this is not the current validation baseline. The current validation baseline is recorded in Control-50 as 184 tests / 666 assertions across 26 files.
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

## August 22, 2026 Control-4 deployment and verification status

Keep production **FAIL/DEGRADED**. The read-only control confirmed HTTP 200 on all six required endpoints, broker-authoritative positions (`source: alpaca`), upward current equity versus `last_equity`, and unchanged caps of `$5,000/$3,700/$2,000`; these do not prove release health. Live `/health` remains `1.0.0` and `/api/config` remains `2.4.0`, while the exact local deployable source is `2.6.0`.

The local Worker has four configured UTC crons, but active schedule identity is not independently proven from the live Worker; saved live schedule artifacts conflict between three schedules and four schedules. Reconciliation is delivering `MAINTENANCE_ONLY`; crypto is near `:07/:37` with minute jitter; category history is populated through `2026-08-22 06:37:57`, but fresh successful daytrading and swing delivery fails evidence requirements. Recent daytrading rows are repeated `CYCLE_LEASE_HELD` skips, the latest available swing row is an `2026-08-18 22:00:36` position-divergence/RISK_HALTED error, and historical crypto SQL-variable/subrequest failures remain relevant risk evidence. Per-trade gross/fee/net remain null under `unavailable_fill_lot_exact`, and production positive `rawEdgeBps` evidence is absent.

Correction work item: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-4.md`. Release-control disposition is **FAIL**; live operations disposition is **DEGRADED**, not healthy. Owner: Joachim. Trigger: restored authenticated Cloudflare deployment access. Acceptance: tie an authenticated receipt to the exact validated 2.6.0 source commit and all four UTC cron expressions, verify matching 2.6.0 release identity, then perform separate GET-only checks for all six endpoints, filtered runs, broker position source, equity direction, fresh structured terminal records for each scheduled strategy or documented no-op/skip, lifecycle/fees/accounting, crypto edge observability, and unchanged caps. If credentials remain unavailable, record the exact blocker and leave follow-up. Fresh canonical and alias `/api/runs` probes currently match, but older saved captures returned empty alias arrays; require post-deploy convergence before marking alias observability passed. Also require an explicit disposition for run-log analyzed/filtered counts, absent production `rawEdgeBps` producer evidence, and zero daily direction fields before closing the control. Never use trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating endpoints for this control.

The authorized deployment retry at **08:02 UTC on August 22, 2026** again stopped before upload with: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` The checked artifact is commit `6bbc315b8069962340ef2b338934b108ff88c3ff`; do not use `--temporary`, do not claim deployment, and keep the explicit follow-up for a Wrangler-compatible authenticated path.

## August 22, 2026 Control-5 post-attempt verification

The exact tested commit `57a4efbfc2b3e0949829d9951776e8d7115b4f1f` was not deployed. The authorized Wrangler attempt stopped before upload because the non-interactive process lacked `CLOUDFLARE_API_TOKEN`. Separate GET-only verification at approximately **09:04 UTC** returned HTTP 200 for all six endpoints; live `/health` remains `1.0.0`, `/api/config` `2.4.0`, `/api/positions` remains `source: alpaca` with 29 rows, caps remain `$5,000/$3,700/$2,000`, and alias responses do not expose `trigger_alias`. Restore Wrangler authentication, deploy only the tested commit, and repeat the separate GET-only acceptance checks.

## August 22, 2026 Control-6 documentation correction — FAIL/DEGRADED

**Disposition: FAIL/DEGRADED, not healthy.** This strict read-only control recorded HTTP 200 for all six required GET endpoints: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. Live `/health` reports version **1.0.0** and `/api/config` reports **2.4.0**, conflicting with the local deployable **2.6.0**; live source identity remains unresolved.

Verified live facts: `/api/positions` reports `positionsAvailable: true`, `source: alpaca`, and 29 rows. Dashboard equity is **98504.50** versus `last_equity` **98504.5039**, current-vs-last direction **-0.0039**; daily fields are zero, and history fell from **98572.37 at 22:07:58** to **98504.50 at 09:37:57**. Caps are exactly **5000/3700/2000**.

Local source preserves all four schedules, broker authority, isolated leases, filtered aliases, conservative accounting, and fail-closed crypto edge gates. Fresh reconciliation is `MAINTENANCE_ONLY` around a 10-minute cadence. Crypto is near `:07/:37` but was observed at `:08/:38`; the latest observed row at **09:38:02** was a structured skip with 0 errors. No fresh daytrading or swing trigger/success is evidenced in the fetched run pages. Historical errors include crypto D1 `too-many-SQL-variables` and `too-many-subrequests`, plus stock/reconciliation errors.

Latest trade rows expose lifecycle fields, but sampled filled rows have `gross`, `fee`, and `net` null, `accounting_status: unavailable_fill_lot_exact`, and `fee_attribution: none-recorded`. Aggregate crypto fee telemetry is available but not per-trade exact. Filtered run alias behavior is source/test verified but not live-proven against 2.6.0.

Local focused validation is **89 tests / 323 assertions**; full validation is **157 tests / 520 assertions**; typecheck passed. Deployment was not attempted in this work item because the current Wrangler path lacks a usable `CLOUDFLARE_API_TOKEN` despite stored metadata, and live source identity remains unresolved. Preserve caps, schedules, thresholds, sizing, edge gates, broker authority, and trading behavior. Do not deploy, call any broker endpoint, call triggers, migrations, or mutate production.

**Follow-up owner: Joachim.** Restore authenticated reproducible Cloudflare deployment/source verification, then separately repeat GET-only checks and observe natural day/swing windows. Keep production **FAIL/DEGRADED**, not healthy. Correction work item: `CORRECTION_WORK_ITEM_2026-08-22_CONTROL-6.md`.


## August 22, 2026 Control-6 strict read-only production control

**Status: FAIL/DEGRADED, not healthy.** The six required GET endpoints all returned HTTP 200. Live release identity is inconsistent: `/health` **1.0.0**, `/api/config` **2.4.0**, local deployable source **2.6.0**. Positions remain broker-authoritative (`positionsAvailable: true`, `source: "alpaca"`, 29 rows); caps remain **$5,000/$3,700/$2,000**; current equity is **98,504.50** versus `last_equity` **98,504.5039** (delta **-0.0039**), with zero daily fields and a recent history decline from **98,572.37 at 2026-08-21 22:07:58 UTC** to **98,504.50 at 2026-08-22 09:37:57 UTC**.

Fresh reconciliation is `MAINTENANCE_ONLY` near ten-minute cadence. Crypto runs appear near the expected `:07/:37 UTC` schedule but record approximately `:08/:38`; the latest observed run at **09:38:02 UTC** is a structured zero-error skip. No fresh daytrading or swing trigger/success is evidenced. Historical lease-held, D1 variable-overflow, and Worker subrequest errors remain open evidence. Trade lifecycle fields are exposed, but sampled filled rows have null `gross`, `fee`, and `net` with `unavailable_fill_lot_exact`; aggregate gross/fee/net consistency does not establish fill-lot accounting. Local source/tests cover four schedules, broker authority, filtered aliases, conservative accounting, unchanged caps, and fail-closed crypto edge gates.

Control-6 local gates passed: focused **89/323**, full **157/520**, TypeScript, and Wrangler dry-run. No deployment was performed because `bunx wrangler whoami` reports **You are not authenticated**, so the stored credential metadata did not establish a usable non-interactive `CLOUDFLARE_API_TOKEN` path. Historical deployment receipts do not prove active source identity. Follow-up owner Joachim: restore authenticated deployment, tie any release receipt to the exact validated artifact and four schedules, then perform separate GET-only verification and natural daytrading/swing observation. Never use triggers or broker-mutating endpoints as validation.

Additional unresolved live gaps: trade 642 estimated versus filled notional differs by $0.068715; trades 597 and 568 lack strategy/decision attribution; cap-utilization decision telemetry is absent.

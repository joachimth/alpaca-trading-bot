# CORRECTION WORK ITEM: Control-54

Date: Monday, August 24, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only production control failed live verification**.

## Scope and safety boundary

This correction used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, and GET-only filter/pagination probes. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called. No capital cap, schedule, sizing, threshold, edge gate, TIF, broker authority, or trading behavior was changed.

## Live evidence captured 2026-08-24 around 03:00 UTC

- All six required endpoints returned HTTP 200. `/health` returned `status=ok` but version `1.0.0`; `/api/config` returned version `2.4.0`. Local deployable source is release `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. Active Worker/source provenance is therefore unresolved.
- `/api/positions` returned `positionsAvailable=true`, `source=alpaca`, and 29 broker-backed positions. Dashboard latest snapshot was `2026-08-24 02:37:51`, equity `98527.50`, with account equity `98527.48` versus `last_equity=98504.5039`, a positive comparison delta of approximately `$22.9761`; daily change fields remain zero.
- Current displayed caps remain exactly daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`. Read-only surfaces do not expose reserved/pending allocation or prove the complete enforcement calculation.
- Local source declares and dispatches all four schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37`, and reconciliation `*/10 * * * *`. Live reconciliation delivered approximately every ten minutes through `02:50:48` as structured `MAINTENANCE_ONLY` with `ledgerPages=1`, `ledgerPageBudget=5`, `ledgerTruncated=false`, and `ledgerDegraded=false`.
- Daytrading delivered five-minute `cron` runs through `2026-08-23 21:55:47`, each market-closed; fresh current-session execution cannot be verified from this read-only window. Crypto delivered at `00:07:55`, `00:37:57`, `01:07:55`, `01:37:55`, `02:07:57`, and `02:37:57` with zero errors and structured fee/confidence/position skips. The API timestamps have no timezone suffix, so the UTC label is based on schedule/source evidence rather than independently encoded timestamps.
- Latest swing run `3182` at `2026-08-23 22:01:16` ended `error` with 8 errors, including Cloudflare `Too many subrequests by single Worker invocation`, accepted incomplete exits for ABBV/COIN, and broker-authoritative stale-row handling. This is a material live reliability defect, though the local source contains the bounded/deferred reconciliation correction.
- Lease-held absence is not proven from the returned windows. Structured skip/error details are present, including `MAINTENANCE_ONLY`, `MARKET_CLOSED`, `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, `NO_POSITION_TO_EXIT`, `DECISION_HOLD`, `HELD_NO_SCORE`, `HELD_NO_SCORE_EXIT`, and `BROKER_AUTHORITATIVE_SYNC_ABSENT`.
- Live run rows omit `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`. `code` and `search` probes returned the unfiltered recent page. Live trade status filtering was not reflected, and `offset=10` and `page=2` repeated the first page IDs `645` through `636`.
- Trade lifecycle columns are present and sampled filled rows are coherent (`filled_qty`, `leaves_qty`, `submitted_at`, `filled_at`, terminal fields). Recent accepted orders remain stale/nonterminal, including trade `645` with `filled_qty=0`, `leaves_qty=1`, and no terminal timestamp. Sampled gross/fee/net values are null under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact arithmetic is therefore not verifiable and must not be fabricated.
- One saved schedule artifact still lists only three crons and omits reconciliation, conflicting with the local and other captured four-schedule evidence. Active deployed schedule identity is unresolved.

## Correction disposition

Repository inspection confirms the local source already contains the reliability-only fixes for broker-authoritative positions, isolated/read-only reconciliation, bounded swing broker fan-out, filtered run observability, stable pagination, lifecycle preservation, conservative fee accounting, and fail-closed crypto fee/calibrated-edge gating. Focused validation passed **95 tests / 413 assertions across 9 files**; full validation passed **184 tests / 678 assertions across 26 files**; typecheck passed; `git diff --check` passed before this status update.

The code correction is therefore not expanded: changing runtime logic now would be unjustified and could alter trading behavior. This work item corrects the current release evidence and operational status to **OPEN FAIL/DEGRADED**, with the known live defects and evidence limits explicit.

## Deployment gate and follow-up

Deployment is not performed. `bunx wrangler whoami` at 2026-08-24 03:03:45 UTC reports: `You are not authenticated. Please run wrangler login.` The worktree is also dirty with prior reliability and documentation changes, so deploying it would violate the clean-artifact requirement. Do not use temporary preview deployment as production correction.

Required next steps:

1. Restore authenticated Wrangler access and establish a clean immutable commit containing only the tested reliability/documentation work.
2. Bind the deployed Worker identity and active schedule set to that commit, proving all four cron expressions.
3. Deploy only under the standing reliability-maintenance authorization and only after the clean artifact is verified.
4. Immediately perform a separate GET-only post-release check of versions, broker position source, equity direction, caps, all four run lanes, filters/aliases/candidate counts, pagination, lifecycle/accounting, and crypto edge-gate evidence.
5. Observe the next natural weekday swing window and reconcile the historical daytrading exposure question (`5679.8784` versus `$5,000`) without mutating broker state.

Until those conditions are met, production remains **OPEN FAIL/DEGRADED**, not healthy.

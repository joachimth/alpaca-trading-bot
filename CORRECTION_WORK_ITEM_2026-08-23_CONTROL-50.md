# CORRECTION WORK ITEM: Control-50

Date: Sunday, August 23, 2026. The execution environment reported 2026-08-24 timestamps while the declared control date is August 23; this is recorded as an unexplained timestamp-integrity gap, not accepted as current-date proof. Disposition: **OPEN FAIL/DEGRADED - live release drift, swing failure, and stale documentation baseline**.

## Trigger and strict read-only evidence

This control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was called.

- All six live endpoints returned HTTP 200. The live payload included timestamps on 2026-08-24 (for example run 3198 at 00:00:51), which is future-dated relative to the declared August 23 control date and therefore remains an unexplained telemetry-date gap.
- Live release identity remains unresolved: `/health` reports `1.0.0`, `/api/config.config.version` reports `2.4.0`, while the local deployable source reports release `2.6.0` at HEAD `e805da1` with uncommitted changes.
- `/api/positions` remains broker-authoritative: `positionsAvailable=true`, `source=alpaca`, with 29 broker-present rows.
- Equity direction is not a clean PASS: current account equity was approximately `$98,548.89`, `last_equity=98504.5039`, while the latest snapshot was `98504.50` with a near-zero negative total P/L and daily fields equal to zero; the fields do not provide one unambiguous direction.
- Local four-schedule definitions remain unchanged: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`.
- Live daytrading delivery is fresh but skips `MARKET_CLOSED`; crypto delivery is regular near `:07/:37` UTC; reconciliation delivery is fresh and records `MAINTENANCE_ONLY`; no current `LEASE_HELD` row was visible in the returned history and that absence is not proof of global absence.
- Swing run `3182` at `2026-08-23 22:01:16 UTC` ended `status=error` with 8 errors, including `Too many subrequests by single Worker invocation`; swing delivery therefore fails the control.
- Sampled lifecycle fields are present for filled and accepted orders, but accepted rows remain unresolved and some strategy/decision attribution is null.
- Sampled `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact per-fill consistency cannot be proven conservatively.
- Live run responses omit locally implemented `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; prior live trade offset/page probes repeat IDs, so the local pagination/observability correction is not live-proven.
- Live configured caps remain exactly daytrading `$5000`, swing `$3700`, and crypto `$2000`.

## Correction assessment

The current local tree already contains the smallest reliability-only runtime corrections relevant to the live defects: swing reconciliation is deferred to bounded maintenance, swing exits avoid synchronous fill polling, filtered run counters and trigger aliases are persisted/exposed, trade pagination is bounded and ordered, broker-authoritative position projection fails closed, and crypto fee/calibrated-edge admission remains fail-closed. Local source confirms no rawEdgeBps producer exists in `technical-analysis.ts`; the crypto gate is wired correctly but no positive calibrated edge producer is proven.

No additional runtime change is justified by this control. The newly identified local defect is documentation drift: `docs/DEPLOYMENT_RUNBOOK.md` still labels an obsolete 85-test/257-assertion result as the expected current baseline, while the latest validated Control-49 result is 184 tests/666 assertions. That baseline is corrected below without changing trading behavior, caps, schedules, sizing, thresholds, or order semantics.

## Validation and deployment state

- Focused prior validation remains **73 tests passed, 0 failed, 346 assertions** (`/workspace/alpaca_control_49_focused.txt`).
- Full prior validation remains **184 tests passed, 0 failed, 666 assertions across 26 files** (`/workspace/alpaca_control_49_full_retry.txt`).
- Typecheck passed (`/workspace/alpaca_control_49_typecheck_retry.txt`); prior `git diff --check` passed.
- Control-50 focused validation: **64 tests passed, 0 failed, 327 assertions across 6 files** (`/workspace/alpaca_control_50_focused_final.txt`). Full validation: **184 tests passed, 0 failed, 666 assertions across 26 files** (`/workspace/alpaca_control_50_full_final.txt`). Typecheck passed (`/workspace/alpaca_control_50_typecheck_final.txt`); `git diff --check` passed (`/workspace/alpaca_control_50_diff_check_final.txt`).
- Wrangler deployment is blocked before upload: `bunx wrangler whoami` reports `You are not authenticated. Please run \`wrangler login\`.` The repository-local `npx` command is unavailable, and the worktree is dirty. No deployment, preview, upload, or production mutation is claimed.
- Production remains **OPEN FAIL/DEGRADED** until the exact validated artifact is cleanly bound to the active Worker, deployed through authenticated Wrangler if authorized and available, and separately verified with GET-only checks plus a natural weekday swing run.

## Final live recheck

The separate final GET-only recheck returned HTTP 200 for all six required endpoints. It reconfirmed `health.version=1.0.0`, `config.version=2.4.0`, positions `source=alpaca`/available with 29 rows, caps `5000/3700/2000`, fresh `reconcile_cron` and `crypto_cron` delivery, `MARKET_CLOSED` daytrading skips, swing run `3182` subrequest exhaustion, missing live filtered-run counters/aliases, repeated legacy pagination behavior, and null exact per-fill `gross`/`fee`/`net`. It also captured future-dated live timestamps such as `2026-08-24 00:00:51` relative to the current date `2026-08-23`; this timestamp-integrity gap remains unresolved.

## Acceptance criteria

Production cannot be labeled healthy until canonical release identity, broker-authoritative positions, equity semantics, all four schedules and fresh delivery, structured lease/error/skip observability, crypto cadence, lifecycle/accounting fields, unchanged caps, filtered run observability, stable trade pagination, crypto fee/raw-edge gate behavior, and a post-release swing run without subrequest exhaustion are independently evidenced.

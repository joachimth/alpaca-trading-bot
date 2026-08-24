# CORRECTION WORK ITEM: Control-45

Date: Sunday, August 23, 2026. Audit capture: `2026-08-23T21:01:21Z`. Disposition: **OPEN FAIL/DEGRADED - production release alignment and observability gap; documentation/status correction only**.

## Scope and safety

This control used only GET requests against:

- `/health`
- `/api/config`
- `/api/dashboard`
- `/api/positions`
- `/api/runs`
- `/api/trades`

Evidence is preserved under `/workspace/live-control-2026-08-23-current/`. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live control results

### PASS

- All six required endpoints returned HTTP 200.
- `/health` returned `status=ok`, service `alpaca-trading-bot`, observed version `1.0.0`.
- `/api/positions` returned `positionsAvailable=true`, `source=alpaca`, and 29 rows. The broker is authoritative for the currently available position set.
- `/api/config` retained the required capital caps exactly: `max_capital_usd=5000`, `swing_max_capital_usd=3700`, `crypto_max_capital_usd=2000`.
- Local source retains all four intended UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for approximately `:07/:37`, and reconciliation `*/10 * * * *`; active deployed schedule provenance is not bound to the checked-out source.
- Fresh live delivery is present for daytrading as structured `MARKET_CLOSED` skips, crypto at `20:07:55` and `20:37:55 UTC` with zero trades and structured decision skips, and reconciliation at `20:50:48 UTC` as `MAINTENANCE_ONLY` with read-only ledger context. Sunday has no expected weekday swing delivery, so swing absence is inconclusive rather than a failure by itself.
- Live skip/error observability exposes structured `MARKET_CLOSED`, `NO_POSITION_TO_EXIT`, `DECISION_HOLD`, and `MAINTENANCE_ONLY` details. No current lease-held row was visible in the fetched page; historical lease/error evidence remains documented in prior control artifacts.
- Local implementation and tests retain broker-read position projection, explicit schedule routing, bounded read-only reconciliation, filtered run observability, conservative fee handling, and crypto fail-closed edge-gate wiring.

### FAIL / CANNOT VERIFY

- **Release identity drift:** live `/health` is `1.0.0` and live `/api/config.version` is `2.4.0`, while local package/source release is `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. The active Worker bundle and source SHA are not proven to match the validated tree.
- **Equity direction:** the current-day delta is flat because `change_today=0`, but observed history fell from `98556.33` at `2026-08-21 23:37:58` to `98504.50` by `2026-08-22 02:37:58` and stayed flat through `2026-08-23 20:37:48`; broader observed direction is downward.
- **Filtered run observability:** live `/api/runs` rows omit the locally validated `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` fields. This prevents live proof of the post-release filtered-run contract.
- **Trade pagination:** the live trade endpoint has previously returned repeated IDs across offsets, and the current response exposes only the first page contract (`limit=50`) without a reliable disjoint-page proof. Live pagination remains unresolved.
- **Trade/fill economics:** lifecycle timestamps and broker order IDs are present, but sampled filled rows retain `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Aggregate arithmetic cannot substitute for deterministic per-fill lot attribution.
- **Crypto edge-gate live proof:** the local crypto gate is fail-closed and regression-tested, but the live API does not expose calculated edge or prove that the validated edge-gate wiring is deployed. Live crypto runs currently show structured zero-trade skips, not a positive calibrated-edge admission.
- **Deployment provenance:** local Wrangler cannot be used to bind or deploy the source because the environment lacks the authenticated Wrangler command/session. The exact previously recorded blocker is `You are not authenticated. Please run wrangler login.`; the current environment also reports `wrangler: command not found` when invoked directly.

## Correction disposition

No new runtime defect is justified by this control. The safe correction is to preserve the evidence and keep production explicitly **OPEN FAIL/DEGRADED**, rather than claiming health from endpoint reachability alone. No caps, schedules, sizing, broker authority, leases, accounting semantics, edge thresholds, trading behavior, or broker state were changed.

## Validation and evidence

- Fresh live payloads and headers: `/workspace/live-control-2026-08-23-current/`.
- Local release identity: `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`, package/source release `2.6.0`.
- Prior Control-44 evidence: `/workspace/alpaca_control_44_focused_tests_complete.txt`, 72 pass, 0 fail, 324 assertions across 9 files; `/workspace/alpaca_control_44_full_tests_complete.txt`, 180 pass, 0 fail, 643 assertions across 26 files.
- Final Control-45 focused rerun: `/workspace/alpaca_control_45_focused_tests_complete.txt`, 77 pass, 0 fail, 317 assertions across 8 files.
- Final Control-45 full rerun: `/workspace/alpaca_control_45_full_tests_complete.txt`, 180 pass, 0 fail, 643 assertions across 26 files.
- Focused coverage includes durable candidate counts/aliases, filtered run combinations/aliases, distinct trade pagination, conservative accounting, crypto fail-closed behavior, and calibrated-edge tests.
- Final typecheck: `/workspace/alpaca_control_45_typecheck_complete.txt`, passed. Final diff check: `/workspace/alpaca_control_45_diff_check_complete.txt`, passed.

## Follow-up

1. Restore authenticated deployment tooling and bind active Worker, version, source SHA, traffic, and schedule provenance without changing caps or trading behavior.
2. If deployment is later required, obtain/confirm explicit deployment authorization, deploy only the validated artifact, record rollback identity, and do not use a temporary preview as production proof.
3. Perform a separate read-only live verification of all six endpoints plus filtered run combinations and disjoint trade pages; verify aliases, candidate counts, pagination, lifecycle fields, conservative fee semantics, and crypto edge-gate observability.
4. Keep production OPEN FAIL/DEGRADED until the validated release is live-proven and all unexplained schema/pagination/accounting gaps are resolved or explicitly accepted.

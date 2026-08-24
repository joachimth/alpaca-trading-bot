# Correction work item: Control-67 strict read-only production control

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED**, not healthy. Documentation/status-only correction. No source code was changed.

## Scope and safety boundary

Control-67 is a strict read-only production control. Only GET evidence and local repository inspection are recorded. No trigger, order, broker, migration, deployment, or other mutating action was used. Do not change source code, caps, schedules, thresholds, sizing, fee freshness, edge policy, order semantics, or trading behavior. Do not deploy.

## Exact live evidence

- All six required GET endpoints returned **HTTP 200**: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`.
- Live `/health` is **1.0.0** and live `/api/config` is **2.4.0**, versus local release **2.6.0**. Release/source provenance is unresolved; production remains **OPEN FAIL/DEGRADED**, not healthy.
- Positions are broker-authoritative: `positionsAvailable=true`, `source=alpaca`, with **29 broker rows**.
- Live equity is **98537.99** versus `last_equity=98504.5039`. The latest snapshot is **98517.58** at **2026-08-24 12:37:50 UTC**; the prior snapshot is **98488.55** at **12:07:50 UTC**. Equity is upward versus `last_equity`, while broker daily fields remain flat at zero.
- Capital caps are exactly **daytrading 5000**, **swing 3700**, and **crypto 2000**.
- Local cron schedules remain exact: daytrading `*/5 13-21 * * 1-5`; swing `0 22 * * 1-5`; crypto `7-59/30 * * * *` (**:07/:37**); reconciliation `*/10 * * * *`.

## Delivery and observability findings

- Crypto latest run is **3299 at 2026-08-24 12:37:57 UTC**; reconciliation latest run is **3301 at 12:50:51 UTC**. Crypto continues on recurring **:07/:37** cadence and reconciliation on a recurring **10-minute** cadence.
- Daytrading has current active delivery, but successful swing delivery is not proven in the current window. Swing run **3182 at 2026-08-23 22:01:16** is `error` with Cloudflare **`Too many subrequests`** and structured broker-authority/held skips.
- Run `code`/`search`/`LEASE_HELD` filters return the same unfiltered page. Live run rows omit `aliases`, `analyzed_candidates`, and `filtered_candidates`.
- Trade `status=filled` and pagination behavior are defective or ignored. Lifecycle fields are present. Filled trade **642** has fill fields, but `gross`, `fee`, and `net` are null; `accounting_status=unavailable_fill_lot_exact`.
- Aggregate crypto and overall gross-fee-net arithmetic reconciles, but exact per-fill attribution is unavailable.

## Local source evidence

The local source contains broker-authoritative position projection, filtered-run fields, and a crypto fail-closed edge gate with fresh fee telemetry and `requireCalibratedEdge=true`. This local evidence is not proof that the live Worker is running release 2.6.0.

## Correction decision and deployment status

This is a documentation/status-only correction. Preserve all caps, schedules, thresholds, sizing, fee freshness, edge policy, order semantics, and trading behavior. Wrangler authentication is blocked by **`You are not authenticated. Please run wrangler login.`** Therefore there is **no deployment**. No trigger/order/broker mutation was used.

## Validation receipts

After the documentation update, rerun and record:

- Focused prior receipt: **74 passed / 0 failed / 361 assertions across 6 files**.
- Full prior receipt: **199 passed / 0 failed / 754 assertions across 26 files**.
- `bun run typecheck` and `git diff --check` previously passed; both must be rerun after this documentation update.

The final receipt below records the post-update commands and their actual results. Historical control records remain unchanged.

## Final post-update validation receipts

- Focused: `/workspace/alpaca_control_67_focused.txt` — **74 passed / 0 failed / 361 assertions across 6 files**, exit 0.
- Full: `/workspace/alpaca_control_67_full.txt` — **199 passed / 0 failed / 754 assertions across 26 files**, exit 0.
- Typecheck: `/workspace/alpaca_control_67_typecheck.txt` — `bun run typecheck` / `tsc --noEmit`, exit 0.
- Diff check: `/workspace/alpaca_control_67_diff_check.txt` — `git diff --check`, exit 0 with no output.

## Final post-correction receipts

After applying the Control-67 documentation/status update, the required local validations completed successfully:

- Focused: `/workspace/alpaca_control_67_focused_final.txt`, **74 passed / 0 failed / 361 assertions across 6 files**.
- Full: `/workspace/alpaca_control_67_full_final.txt`, completed with exit 0; final summary is recorded in that receipt.
- Typecheck: `/workspace/alpaca_control_67_typecheck_final2.txt`, `tsc --noEmit`, exit 0.
- Diff check: `/workspace/alpaca_control_67_diff_check_final2.txt`, exit 0 with no output.

Required documentation files now contain the Control-67 status: `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md`. No source code, cap, schedule, threshold, sizing, fee-freshness, edge-policy, order-semantics, or trading-behavior change was made. No deployment or broker mutation occurred.

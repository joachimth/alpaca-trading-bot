# Correction work item: Control-69 strict read-only production control

**Date:** Monday, August 24, 2026, live capture approximately 15:00 UTC  
**Disposition:** **OPEN FAIL/DEGRADED**, not healthy. Documentation/status correction completed locally; no deployment or broker mutation performed.

## Scope and safety boundary

This control used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus safe GET filter/pagination probes and local repository inspection. No trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating operation was called.

## Live evidence

- All six required endpoints returned HTTP 200 JSON.
- `/health` reports `status=ok`, service `alpaca-trading-bot`, version **1.0.0**. `/api/config` reports version **2.4.0**. The local validated repository release is **2.6.0**, so active source-to-Worker provenance remains unresolved and production cannot be called healthy.
- `/api/positions` and the dashboard report broker-authoritative current state: `positionsAvailable=true`, `source=alpaca`, and **21** broker rows in the capture. D1 metadata is not treated as a broker-state fallback.
- Captured dashboard account equity was **98,435.77 USD** versus `last_equity=98,504.5039 USD`, therefore current equity direction is **down** by the configured comparison. The latest stored snapshot was **98,457.30 USD** at `2026-08-24 13:46:02 UTC`; broker `change_today` fields were zero and were not substituted for the current-vs-last direction.
- Capital caps remain unchanged at **5,000 USD daytrading**, **3,700 USD swing**, and **2,000 USD crypto** in live `/api/config` and dashboard `capitalCaps`.
- Local `wrangler.toml` preserves all four schedules and dispatch mappings: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron` at expected `:07/:37 UTC`; reconciliation `*/10 * * * *` → `reconcile_cron`.
- Fresh run delivery is visible in the live artifact: crypto run **3315** at `13:38:00 UTC`, reconciliation run **3316** at `13:40:58 UTC`, and daytrading run **3317** at `13:41:16 UTC`. Crypto cadence examples remain near `:07/:37` (`13:07:54`, `13:38:00`, `12:37:57`, `12:07:55`, `11:37:56 UTC`). Successful swing delivery is not proven in this capture window.
- Run 3316 is an explicit `MAINTENANCE_ONLY` skip with healthy reconciliation context (`brokerOrders=4`, `imported=0`, `ledgerActivities=9`, `ledgerTruncated=false`, `ledgerDegraded=false`), not an unexplained failure. Run 3315 is an explicit `DECISION_HOLD` skip for `LTCUSD`, also not an unexplained scheduler failure. No `CYCLE_LEASE_HELD`/lease error appears in the exact sampled records, so lease-held behavior remains unproven rather than passed by absence.
- Run 3317 is `status=error`, with one broker-confirmed trade and error details containing auto-reconciliation of `MSTR`, `INTC`, and `NOW` plus a `DECISION_HOLD` for `WBD`. A prior run 3313 explicitly failed with Cloudflare **“Too many subrequests by single Worker invocation”**, and run 3314 recorded broker/internal quantity mismatch protection. These are production defects/degraded signals; the current evidence does not establish a new safe local patch distinct from the already-present bounded/reliability implementations.
- Trade lifecycle fields are present. The newest trade **651** (`F` BUY) is `pending_new`, `qty=70`, `filled_qty=0`, `leaves_qty=70`, with submitted timestamp `2026-08-24T13:46:06.042505005Z`; filled trades such as **650** (`SOFI` SELL) carry submitted and filled timestamps. Sampled trades expose `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Exact per-fill gross/fee/net consistency is therefore unavailable and must not be inferred.
- Safe live filter/pagination probes remain failed or unproven on the old artifact: run rows do not expose the local `trigger_alias`, `analyzed_candidates`, or `filtered_candidates` fields; code/search/status behavior is not proven; trade status filtering and pagination are not proven on the deployed artifact. Local implementation and tests cover these contracts.

## Local implementation and regression evidence

The local tree already contains the safe reliability behavior: broker-first positions with no D1 fallback on broker failure, bounded read-only reconciliation, structured skip/error details, four-lane schedule dispatch, stable run/trade filtering and pagination, lifecycle fields, conservative fee/gross/net accounting, and fail-closed crypto fee/calibrated-edge gates. The crypto edge path is wired to preserve an explicit calibrated edge only; missing calibrated edge is rejected, and no uncalibrated edge is invented. The requested `crypto-runtime.test.ts` path is absent; the relevant edge tests are in `test/risk-fee-aware.test.ts` and `crypto-runtime.test.ts` at repository root.

No new code/config change is justified by this capture without changing trading behavior or weakening safety. The correction is therefore documentation/status-only, while the live release drift and prior Cloudflare/subrequest failure remain open follow-ups.

## Validation and deployment blocker

- Focused regression suite: **91 passed / 0 failed / 447 assertions across 7 files**.
- Full `bun test`: run on the current tree; receipt retained at `/workspace/alpaca_control_2026-08-24/control69_full.txt`.
- `bun run typecheck`: run on the current tree; receipt retained at `/workspace/alpaca_control_2026-08-24/control69_typecheck.txt`.
- `git diff --check`: run on the current tree; receipt retained at `/workspace/alpaca_control_2026-08-24/control69_diffcheck.txt`.
- `wrangler whoami` is blocked by the exact error: **`You are not authenticated. Please run \`wrangler login\`.`** No dirty or temporary deployment is permitted.

Authenticate Wrangler through the secure credential flow, isolate a clean immutable release artifact, and deploy only if still required and authorized under the standing reliability-maintenance rule. After any authorized deployment, perform a separate GET-only verification of the six endpoints plus filters/pagination, release identity, broker-authoritative positions, equity direction, four schedules, natural strategy delivery, lifecycle/accounting fields, and crypto edge-gate wiring. Keep production **OPEN FAIL/DEGRADED** until that verification passes.

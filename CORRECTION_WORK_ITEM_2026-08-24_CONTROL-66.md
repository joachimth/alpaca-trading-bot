# Correction work item: Control-66 strict read-only production control

**Date:** Monday, August 24, 2026, approximately 12:00 UTC  
**Disposition:** **OPEN FAIL/DEGRADED**, not healthy. Documentation/status correction only. No trading code was modified for Control-66.

## Scope and safety boundary

Control-66 records a strict read-only production control. The supplied live evidence covers only GET requests to `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filter/pagination probes and local repository inspection. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating command was used for this correction. Capital caps, schedules, thresholds, sizing, fee freshness, edge policy, order semantics, and trading behavior are unchanged.

## Exact live evidence

- All six required GET endpoints returned **HTTP 200**.
- Live `/health` version is **1.0.0**; live `/api/config` version is **2.4.0**; local release is **2.6.0**. Active release/source provenance is unresolved, so the control cannot be marked healthy.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and **29 rows**. The broker is authoritative. One sampled `MSTR` row is **unattributed** (`strategy=unattributed`), and sampled position metadata is stale (updated timestamps from August 20, 2026). D1 fallback is not treated as live broker state.
- `/api/dashboard` reports equity **98511.32** versus `last_equity=98504.5039`; latest snapshot equity is **98515.57**. Broker daily fields are zero (`change_today=0`, `change_today_pct=0`, snapshot `daily_pl=0`, `daily_plpc=0`). No synthetic daily or fill-lot economics are inferred.
- Caps remain exactly **5000 USD daytrading / 3700 USD swing / 2000 USD crypto**.
- Local schedules remain exact: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron` at **:07/:37 UTC**; reconciliation `*/10 * * * *` → `reconcile_cron`.
- Crypto is fresh through run **3291**, `2026-08-24 11:37:56 UTC`, with prior cadence at `11:07:57`, `10:37:55`, `10:07:56`, `09:37:58`, and `09:07:56`. Current structured crypto skips include `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, and confidence-below-threshold skips; no trade admission is inferred.
- Reconciliation is fresh through run **3294**, `2026-08-24 12:01:00 UTC`, with recent runs `3293` at `11:50:52`, `3292` at `11:40:49`, `3290` at `11:31:00`, `3289` at `11:20:50`, and `3288` at `11:10:51`. These are `MAINTENANCE_ONLY` skips with broker reconciliation context. The current window does not prove fresh daytrading execution or successful swing delivery.
- Historical swing run **3182**, `2026-08-23 22:01:16 UTC`, is `error` and includes **`Too many subrequests by single Worker invocation`** / Cloudflare subrequest exhaustion, with incomplete accepted exits. This is historical evidence only.

## Live filtered observability and pagination

- Strategy-filtered run slices are distinguishable: crypto begins at run **3291**, daytrading returns the older `cron`/market-closed slice beginning at **3180**, and swing returns run **3182** plus historical swing rows.
- Run `status=skipped` returns the current skipped window. `code=LEASE_HELD` and `search=LEASE` return the same current/unfiltered page and do not prove a lease-held row. Run pagination probes are non-repeating in the saved evidence: offset 10 begins at run **3284** and page 2 begins at run **3264**.
- Trade filtering/pagination remains defective or ignored on the active artifact: `status=filled` returns the same mixed statuses (`accepted`, `filled`, `new`) as the unfiltered page; strategy slices are distinguishable (`crypto` is filled-only and `swing` returns its slice), but `offset=10` and `page=2` both return the first-page IDs **645, 644, 643, 642, 641, 640, 639, 638, 637, 636, …** and no reliable pagination metadata.

## Lifecycle/accounting and local evidence

Lifecycle columns are present, including status, order/lifecycle identifiers, quantities, fill prices, order type, time-in-force, and timestamps. Sampled filled rows retain `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact fill-lot economics remain unavailable and are not inferred.

Local filtered-run observability and crypto fail-closed calibrated-edge regressions are present. The local crypto path keeps calibrated edge unavailable and rejects configured positive BUY admission closed-loop. This is local regression evidence only; the live Worker remains on the older/unproven artifact.

## Correction decision

No new necessary reliability code fix is established by Control-66. The correction is documentation/status-only. Preserve caps, four schedules, thresholds, sizing, fee freshness, edge policy, order semantics, broker-authority rules, and trading behavior. Keep production **OPEN FAIL/DEGRADED** until authenticated Wrangler access, clean immutable source/artifact provenance, separate GET-only verification, and natural schedule observations establish the deployed release and resolve the live gaps.

## Deployment blocker

The verified Wrangler blocker is: **`You are not authenticated. Please run \`wrangler login\`.`** No deployment was attempted.

## Validation receipts

Validation was run locally after the documentation update, with no deployment or production endpoint access:

- Focused: `bun test test/dashboard-readonly.test.ts test/release-version.test.ts test/entry-position-authority.test.ts test/order-reconciliation.test.ts test/risk-fee-aware.test.ts crypto-runtime.test.ts`
- Full: `bun test`
- Typecheck: `bun run typecheck`
- Diff check: `git diff --check`

The exact command results are recorded in `/workspace/alpaca_control_66_focused.txt`, `/workspace/alpaca_control_66_full.txt`, `/workspace/alpaca_control_66_typecheck.txt`, and `/workspace/alpaca_control_66_diff_check.txt`:

- Focused command: **74 passed / 0 failed / 361 assertions across 6 files**; exit 0.
- Full `bun test`: **199 passed / 0 failed / 754 assertions across 26 files**; exit 0.
- `bun run typecheck`: exit 0 (`tsc --noEmit`).
- `git diff --check`: exit 0 with no output.

These validations completed locally against the current tree; no deployment or production endpoint access occurred.

# Correction work item: Control-71 strict read-only production control

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED**

## Scope and safety boundary

This work item follows a strict GET-only production control against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. All six endpoints returned HTTP 200 JSON. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called. Capital caps remain unchanged at **5000 / 3700 / 2000 USD** for daytrading/swing/crypto; schedules, thresholds, sizing intent, fee freshness policy, crypto edge policy, order semantics, broker authority, and trading behavior remain unchanged except for the narrow reliability preflight under review.

## Exact live evidence

- `/health`: `status=ok`, `service=alpaca-trading-bot`, `version=1.0.0`.
- `/api/config`: HTTP 200; persisted config version `2.4.0`; caps `max_capital_usd=5000`, `swing_max_capital_usd=3700`, `crypto_max_capital_usd=2000`; crypto minimum edge after costs `8` bps.
- `/api/positions`: HTTP 200; `positionsAvailable=true`, `source=alpaca`; 26 broker positions returned. Broker state is authoritative; D1 is metadata only in the checked-out source.
- `/api/dashboard`: latest account equity approximately **98,401.66 USD** versus `last_equity=98,504.5039` (down by comparison); latest snapshot is approximately **98,416.82 USD**. The account/snapshot difference and `change_today=0` are unexplained sampling/observability inconsistencies.
- Dashboard capital caps are `daytrading=5000`, `swing=3700`, `crypto=2000`. Daytrading category market value is approximately **3004.05 USD**; swing category market value is approximately **4805.85 USD**, above the displayed 3700 USD cap. The source documents these as display-only cap summaries while runtime admission uses the strategy cap; conflicting live aggregates prevent certifying cap enforcement from read-only evidence.

## Delivery, schedules, skips, and errors

Checked-out `wrangler.toml` and `src/index.ts` retain all four routes: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron` near `:07/:37 UTC`; reconciliation `*/10 * * * *` → `reconcile_cron`. Live delivery confirms fresh daytrading run **3331** at `2026-08-24 16:26:14` with one full fill and no errors, reconciliation run **3329** at `16:20:54` with structured `MAINTENANCE_ONLY`, and crypto run **3325** at `16:08:06`; observed crypto timestamps include `07:07:54`, `07:38:11`, `09:07:56`, `09:37:58`, `10:37:55`, `11:37:56`, `12:37:57`, `13:07:54`, and `16:08:06`. The naive API timestamps do not independently prove UTC. No fresh August 24 swing strategy run is present in the inspected history, and no `CYCLE_LEASE_HELD` record is exposed, so swing freshness and lease-held delivery remain unproven.

Confirmed live errors/gaps include run **3328** PLUG broker rejection (`403`, cost basis below minimum order 1), run **3313** Cloudflare `Too many subrequests by single Worker invocation`, and broker/internal position mismatch evidence in runs **3314/3317**. Filled trades expose lifecycle IDs, statuses, quantities, and timestamps, but sampled filled rows have `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`; some filled sells also show `estimated_value=0` despite nonzero filled notional. Aggregate crypto gross/fee/net arithmetic is internally consistent, but exact fill-lot attribution is unavailable. Dashboard fee telemetry is labeled `available` with `cryptoFeeAsOf=2026-08-18T09:37:52.56276Z`, while August 24 crypto runs repeatedly record `FEE_DATA_UNAVAILABLE`. The live crypto edge-after-costs calculation and gate result are not exposed, so wiring cannot be independently verified.

Filtered run observability, aliases, candidate counters, and complete live run/trade filtering/pagination remain unproven or defective on the older live artifact. Local source contains the intended filtered observability and fail-closed crypto edge-gate behavior.

## Local source and correction decision

Checked-out source is release `2.6.0` at commit `e742f7589b9f7cb1e2da776d5564dcd9ef4cdd10`; live health/config identify `1.0.0/2.4.0`, so source-to-Worker provenance is unresolved. Local source already implements broker-authoritative position projection, bounded read-only reconciliation, structured skip/error observability, lifecycle fields, conservative accounting, four schedules, and fail-closed crypto fee/calibrated-edge gates.

The live PLUG rejection reproduced a narrow missing reliability preflight in the daytrading BUY submission path. Control-71 implemented only a broker-minimum-order preflight with structured `MIN_ORDER_SIZE` skip observability and focused regression coverage. It does not alter SELL/CLOSE/protective exits, strategy decisions, caps, schedules, sizing policy, fee attribution, crypto edge-gate wiring, or broker authority. No code change was made for null exact per-fill economics, stale fee telemetry, swing exposure semantics, timestamps, or live filter/provenance gaps because those require separate design/deployment decisions and remain explicitly unresolved.

## Deployment status and follow-up

`bunx wrangler whoami` is blocked by the exact message: `You are not authenticated. Please run wrangler login.` No deployment or temporary preview is permitted. After the local correction and validation gates pass, deploy only a clean immutable reliability-only artifact if authorized by the standing maintenance rule and credentials are restored; then perform a separate GET-only live verification. Until then production remains **OPEN FAIL/DEGRADED**, not healthy.

## Final post-update validation receipts

- Focused regressions: **86 passed / 0 failed / 416 assertions across 8 files**; `/workspace/alpaca_control_71_focused.txt`.
- Full `bun test`: **204 passed / 0 failed / 775 assertions across 26 files**; `/workspace/alpaca_control_71_full.txt`.
- `bun run typecheck`: exit 0; `/workspace/alpaca_control_71_typecheck_final2.txt`.
- `git diff --check`: exit 0; `/workspace/alpaca_control_71_diffcheck.txt`.
- Narrow builder verification also passed **29/29 tests / 120 assertions**, typecheck, and diff-check without external calls.
- Updated files are limited to the Control-71 work item, `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, `NOW.md`, `src/index.ts`, and `test/audit-regressions.test.ts`; caps, schedules, crypto edge wiring, and trading behavior are unchanged.

## Separate post-correction live verification

A separate GET-only verification was performed after the local correction. All six endpoints again returned HTTP 200 JSON, but production remains the older unrepaired artifact: `/health.version=1.0.0`, `/api/config.config.version=2.4.0`, positions `positionsAvailable=true` with `source=alpaca` and 26 rows, account equity **98412.43 USD** versus `last_equity=98504.5039` (down), and caps **5000/3700/2000 USD**. Live run 3328 still contains the PLUG minimum-order 403; filled rows still expose lifecycle fields with null exact `gross`/`fee`/`net`; the stale fee signal, conflicting swing exposure, missing fresh swing/lease proof, and unexposed crypto edge/filter/provenance gaps remain open. The post-check receipt is `/workspace/alpaca_control_71_post_live.txt`, with raw responses under `/workspace/alpaca-control-live-2026-08-24-post71/`.

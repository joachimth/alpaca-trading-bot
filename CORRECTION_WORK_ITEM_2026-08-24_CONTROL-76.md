# Correction work item: Control-76 strict read-only production control

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED** for live production; **LOCAL VALIDATED**  
**Scope:** strict GET-only production control and documentation/status correction

## Safety boundary

This control called only GET requests to `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. No trigger, submit, cancel, close, replace, retry, migration, deployment, external write, or broker-mutating endpoint was called. Capital caps remain exactly **5000 / 3700 / 2000 USD** for daytrading, swing, and crypto; no cap, schedule, threshold, sizing, fee-policy, edge-policy, order-semantic, or trading-behavior change was made.

## Exact live evidence

Capture time was **2026-08-24 23:00-23:02 UTC**. All six approved endpoints returned HTTP 200 JSON. `/health` reported service `alpaca-trading-bot`, version **1.0.0**. `/api/config` reported persisted version **2.4.0** and the exact caps `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`.

`/api/positions` reported `positionsAvailable=true`, `source=alpaca`, and **21** rows. Broker positions are therefore authoritative for the observed current position set; D1 metadata is not treated as live state. The first `/api/dashboard` capture reported equity **98400.47 USD**, `last_equity=98504.5039 USD`, a calculated direction of **-104.0339 USD**, and `capitalCaps={daytrading:5000,swing:3700,crypto:2000}`. The separate post-update GET-only recheck reported equity **98396.24 USD**, down **108.2639 USD** versus the same `last_equity`; its latest snapshot remained `2026-08-24 22:38:12` with equity `98392.04`.

The approved live artifacts are saved under `/workspace/strict-control-20260824T-live/` as `health.json`, `api_config.json`, `api_dashboard.json`, `api_positions.json`, `api_runs.json`, and `api_trades.json`, with matching response headers.

## Delivery, skips, and observability

The checked-out four-schedule contract remains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for approximately **:07/:37 UTC**, and reconciliation `*/10 * * * *`.

Live delivery evidence includes daytrading run **3407** at `2026-08-24 21:55:47` with structured `MARKET_CLOSED` skip, crypto run **3414** at `2026-08-24 22:38:16` with structured `FEE_DATA_UNAVAILABLE` and `CONFIDENCE_BELOW_THRESHOLD` skips, and reconciliation run **3416** at `2026-08-24 22:51:09` followed by post-update run **3417** at `2026-08-24 23:01:13`, both with structured `MAINTENANCE_ONLY` skip and bounded ledger context. The latest swing run is **3409** at `2026-08-24 22:01:37`, status `error`, with four errors including Cloudflare subrequest exhaustion; fresh successful swing delivery is not proven. The observed crypto timestamps support the :07/:37 cadence, but the live page does not establish successful order delivery.

The live runs page exposes structured status/error details, and trigger filters work for the observed strategy slices. However, safe probes show `code=LEASE_HELD` and `search=LEASE` return the same page, and no fresh explicit `CYCLE_LEASE_HELD` record or lease identifier is exposed. The checked-out source contains the corresponding read-only filters/pagination, trigger-alias translation, and durable `analyzed_candidates`/`filtered_candidates` contracts, so the live mismatch is deployment-drift evidence rather than a justified source edit.

The dashboard currently attributes **$8,943.86301** to 21 open swing positions against the configured **$3,700** swing cap. This is a live cap-control **FAIL** if the cap is intended to govern total current gross swing exposure. Local `SwingRiskManager` entry checks fail closed when current broker-backed exposure plus planned entries exhaust the cap, but no read-only control may close or resize the existing broker positions, and changing cap semantics would change trading behavior.

## Trade and accounting findings

`/api/trades` returned 50 rows: **47 filled** and **3 accepted**. Lifecycle fields are present, including broker order IDs, submitted/filled timestamps, filled and remaining quantities, reconciliation timestamps, and terminal timestamps. All 50 rows conservatively report `gross=null`, `fee=null`, and `net=null`, with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; therefore exact per-fill gross/fee/net economics are unavailable and must not be invented. The dashboard aggregate remains internally expressible as gross minus attributable fees, but live exact fill-level consistency is **DEGRADED**, not proven.

Safe live filter probes further show `status=accepted` and `status=filled` return the same mixed 50-row page, and `offset=0&limit=3` and `offset=3&limit=3` both return IDs `703,702,701`. The local source and tests implement distinct status filtering and offset pagination; the live behavior therefore reinforces unresolved deployment drift.

The checked-out crypto path contains fail-closed fee and calibrated-edge admission wiring, and live crypto skips provide evidence of fee-data and confidence gates. Deployed source identity and complete live edge-gate wiring remain unverified because the Worker reports older release surfaces.

## Repository and release provenance

The deployable repository is `/workspace/alpaca-trading-bot`, directed by `/workspace/src/README.md`; `/workspace/src` is stale reference material and is not the deployable source. The deployable tree is on branch `fix/remove-premature-position-upsert-entryside` at exact HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`, release **2.6.0** from `src/version.ts`. The root `/workspace` repository is a separate stale repository and is not used as release provenance.

The active Worker cannot be source-tied from this environment because `bunx wrangler whoami` is blocked by the exact message: `You are not authenticated. Please run wrangler login.` Live `/health` `1.0.0` and `/api/config` `2.4.0` also conflict with local release `2.6.0`. Production therefore remains **OPEN FAIL/DEGRADED**, not healthy.

## Correction decision and follow-up

No source or configuration correction was justified by this read-only evidence. The required reliability surfaces already exist locally: broker-first position projection with no D1 fallback, bounded read-only reconciliation, structured skips/errors, lifecycle persistence, conservative accounting, run filters/pagination, candidate counters, and crypto fail-closed edge/fee gates. Only this work item, `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` were updated.

The existing enabled hourly schedule `864e3971-0655-4d0f-ac81-95ba66595335` remains the explicit follow-up. It must recheck natural swing delivery, live filter/candidate observability, accounting, and release identity. Restore Wrangler authentication through the secure credential flow, establish exact Worker/source provenance and deployment authorization, deploy only the already-validated reliability artifact if separately authorized, then perform a separate GET-only post-release verification. Until those proofs exist, retain **OPEN FAIL/DEGRADED**.

## Final post-update validation receipts

- Focused regressions: **41 pass / 0 fail / 275 expect() calls** across 3 files; `/workspace/alpaca_control_76_focused.txt`.
- Full `bun test`: **204 pass / 0 fail / 775 expect() calls** across 26 files; `/workspace/alpaca_control_76_full.txt`.
- Typecheck: `bun run typecheck` exited 0; `/workspace/alpaca_control_76_typecheck.txt`.
- Patch check: `git diff --check` exited 0; `/workspace/alpaca_control_76_diff_check.txt`.
- Final documentation identity: all four required repository documents name Control-76 and exact HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`; `NOW.md` is 10 lines.
- Final repository scope: `NOW.md`, `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and this Control-76 work item are the intended Alpaca changes; no source/config diff exists. The workspace-level `/workspace/NOW.md` was also refreshed because the control request explicitly requires that status note.
- No deployment, broker mutation, or prohibited endpoint call occurred.

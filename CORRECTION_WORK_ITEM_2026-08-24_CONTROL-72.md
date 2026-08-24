# Correction work item: Control-72 strict read-only production control

**Date:** Monday, August 24, 2026  
**Disposition:** **OPEN FAIL/DEGRADED**  
**Scope:** documentation/status correction; no code, cap, schedule, or trading-behavior change

## Safety boundary

The control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus safe run/trade filter and pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, or other broker-mutating endpoint was called.

## Current live evidence

- All six required endpoints returned HTTP 200 JSON.
- `/health`: `status=ok`, service `alpaca-trading-bot`, live health version `1.0.0`.
- `/api/config`: persisted config version `2.4.0`; caps are `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`.
- Checked-out source release: `2.6.0`, commit `0b7a6e5fa1e58a301c751c637e5d272a6aa5c6e6`.
- `/api/positions`: `positionsAvailable=true`, `source=alpaca`, 26 broker rows. Broker state is authoritative; D1 remains metadata only.
- `/api/dashboard`: account equity `98391.48 USD` versus `last_equity=98504.5039`, a downward difference of `113.0239 USD`; dashboard caps remain `5000/3700/2000`.
- Fresh delivery: daytrading run `3346` at `2026-08-24 18:01:37`, reconciliation run `3345` at `18:01:19` with structured `MAINTENANCE_ONLY`, and crypto run `3338` at `17:38:15`. Crypto history contains runs near the expected `:07/:37 UTC` cadence, but cadence is not continuous proof of every tick.
- Swing: no fresh August 24 swing strategy run is present in the returned history. No explicit `CYCLE_LEASE_HELD` event is proven.
- Lease/filter probes: `code=LEASE_HELD` and `search=LEASE` returned the same unfiltered current page. Live run rows expose no `analyzed_candidates` or `filtered_candidates` values, although local source and tests implement them.
- Live run defect: run `3344` at `17:56:27` remains `status=error` with Alpaca `40310000`, `cost basis must be >= minimal amount of order 1`, for NIO. Historical swing run `3182` records Cloudflare `Too many subrequests by single Worker invocation`.
- Trade lifecycle: sampled rows contain broker order IDs, client IDs, quantities, fill prices, statuses, and lifecycle timestamps. Exact per-fill `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; this is conservative because the schema has no fill-lot/order key to link closed P&L. Crypto aggregate values remain internally consistent: gross `-56.616426`, fees `269.110169`, net `-325.726595`.
- Trade filters/pagination: current `status=filled` sample is filled-only, but the response omits filter metadata; `offset=10` and `page=2` repeat the first-page IDs `682` through `673`. Complete live filter/pagination behavior is therefore not certified.

## Local inspection and correction decision

The repository confirms:

- Four exact schedules in `wrangler.toml`: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`.
- Exact dispatch mapping in `src/index.ts` to `cron`, `swing_cron`, `crypto_cron`, and `reconcile_cron`.
- Broker-authoritative position projection with no D1 fallback on broker failure.
- Daytrading BUY minimum-notional preflight with structured `MIN_ORDER_SIZE` observability immediately before submit.
- Crypto minimum notional at `$10`, fee freshness gating, and calibrated-edge fail-closed admission. Normal `generateSignal` has no calibrated `rawEdgeBps` producer, so missing edge is rejected rather than invented. Tests cover both missing-edge rejection and explicit calibrated-edge admission.
- Conservative per-trade accounting: gross/net remain unavailable when fill-lot attribution cannot be established; known linked fees are not forced into weak matches.
- Run strategy/status/trigger/code/search filtering, aliases, pagination, and durable candidate counters in local source/tests.

No additional runtime fix is justified from this control because the principal defect is that production is still serving the older `1.0.0/2.4.0` artifact. The correction is documentation/status-only and preserves caps **5000/3700/2000 USD**, all schedules, thresholds, sizing, fee freshness, edge policy, order semantics, broker authority, and trading behavior.

## Validation receipts

- Focused regressions: **90 passed / 0 failed / 461 assertions**, covering schedule dispatch, broker authority, equity direction, cap aliases, minimum-order preflight, filtered observability, lifecycle/accounting, maintenance degradation, and crypto edge gates. Receipt: `/workspace/alpaca_control_72_focused.txt`.
- Full `bun test`: **204 passed / 0 failed / 775 assertions** across 26 files. Receipt: `/workspace/alpaca_control_72_full.txt`.
- `bun run typecheck`: exit 0. Receipt: `/workspace/alpaca_control_72_typecheck.txt`.
- `git diff --check`: exit 0. Receipt: `/workspace/alpaca_control_72_diffcheck.txt`.
- Fresh GET-only response archive: `/workspace/alpaca-control-live-2026-08-24-control72/`.

## Deployment blocker and explicit follow-up

`bunx wrangler whoami` returns `You are not authenticated. Please run wrangler login.`; `wrangler deployments list` also cannot run without `CLOUDFLARE_API_TOKEN`. No temporary preview deployment is permitted. Restore Wrangler credentials through the secure credential flow, identify the active production deployment and its source/version, and deploy only a clean authorized reliability artifact under the standing maintenance rule if Joachim authorizes or the rule clearly covers it. After any authorized deployment, perform a separate GET-only verification and then re-check natural scheduled delivery, including swing freshness and explicit lease-held observability; do not manufacture either from absent evidence.

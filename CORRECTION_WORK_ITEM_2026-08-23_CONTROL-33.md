# CORRECTION WORK ITEM: Control-33

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only; deployment blocked**.

## Scope and safety

This control used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, plus filtered `/api/runs` and paginated `/api/trades` probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live evidence

- All six required endpoints returned HTTP 200.
- Live identity is unresolved/stale: `/health` reports `1.0.0` and `/api/config.version` reports `2.4.0`; the checked-out local release is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`. `bunx wrangler whoami` returns `You are not authenticated. Please run wrangler login.` and no `CLOUDFLARE_API_TOKEN` is available.
- Positions are explicitly broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 broker rows. Current strategy grouping is daytrading `$3355.5983` across 4 rows, swing `$3249.2831` across 24 rows, and unattributed `$1866.2625` across 1 row; no crypto position is present.
- Account equity is `$98504.50`, `last_equity=$98504.5039`, and the direct difference is approximately `-$0.0039`; `change_today=0` and `change_today_pct=0`, so material current-day equity direction is not independently verifiable.
- Caps remain exactly `$5000` daytrading, `$3700` swing, and `$2000` crypto. No cap parameter was changed. A prior stored snapshot showing daytrading market value `$5679.8784` remains an unresolved historical enforcement gap and is not corrected by changing caps or trading behavior.
- Local source retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for `:07/:37`, and reconciliation `*/10 * * * *`. Live crypto delivery is fresh at `10:07:56` and `10:37:55` UTC, consistent with `:07/:37`; live reconciliation is fresh through `11:00:54` at approximately ten-minute cadence. The authoritative deployed cron declaration remains unverified because deployment provenance is unavailable and saved schedule artifacts conflict.
- Sunday, August 23, 2026 has no expected weekday daytrading or swing cron delivery. Filtered daytrading returns stale run `2556` from August 20, stored as canonical `cron`, skipped with `CYCLE_LEASE_HELD`. Filtered swing returns run `2200` from August 18 with `RISK_HALTED` and position divergence, plus older errors. Fresh daytrading/swing strategy delivery is therefore not proven.
- Reconciliation runs are structured `MAINTENANCE_ONLY` skips with `brokerOrders=0`, `imported=0`, `ledgerActivities=18`, `ledgerPages=1`, `ledgerTruncated=false`, and `ledgerDegraded=false`. Crypto runs show structured `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, and `CONFIDENCE_BELOW_THRESHOLD` skips. No lease-held crypto skip was observed in the current filtered sample; daytrading lease-held evidence is present.
- Filled trades expose order IDs, quantities, statuses, TIF, submission/fill/broker timestamps, and terminal lifecycle fields. Exact per-fill `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact`; this is conservative but means exact per-fill fee/gross/net consistency cannot be verified. Aggregate crypto and total gross/fee/net arithmetic is internally consistent within rounding. Imported trade `id=597` retains an unexplained `created_at` ordering anomaly.
- Live filtered run responses omit the local response-only `trigger_alias` and candidate-count annotations; live trade pages at offsets `0`, `3`, and `30` repeat IDs `642..640`, so local filtered-run and pagination corrections are not live-proven.

## Local source and regression evidence

- `src/position-projection.ts` keeps broker positions authoritative and D1 metadata-only; D1-only symbols are not emitted.
- `src/capital-caps.ts` retains defaults and aliases for exactly 5000/3700/2000 USD without deriving caps from account equity or cash.
- `src/index.ts` and `wrangler.toml` retain all four schedule declarations and dispatch mappings.
- `src/order-reconciliation.ts` is bounded/read-only; `src/broker-ledger.ts` imports fills/fees with degraded/truncated signaling; `src/skip-reasons.ts` persists structured skip/error/degraded status.
- `src/crypto-runtime.ts` fails closed for unavailable/insufficient/stale fee telemetry and ranks using calibrated edge/fee status; crypto edge-gate wiring is covered locally, but no live positive-edge BUY path is proven.
- Existing local reliability corrections for broker authority, filtered run observability, candidate counts, conservative accounting, and crypto edge gating are present in the checked-out `2.6.0` source but are not served by the live `1.0.0`/`2.4.0` identity.

## Correction and blocker

The correction is documentation/status-only. README, operations, deployment runbook, this work item, and `/workspace/NOW.md` are updated to record the current evidence and explicit follow-ups. No runtime code, schedule, cap, lease, broker authority, accounting semantics, edge gate, sizing, or trading behavior was changed.

Deployment is not performed because Wrangler authentication is unavailable and no deployment authorization/provenance is established. Required follow-up: restore authenticated Wrangler access, reconcile active Worker/source and cron provenance, obtain deployment authorization, deploy only the already-validated reliability artifact if still required, then run a separate GET-only live verification and a natural weekday daytrading/swing delivery check.

## Validation

Focused and full regressions, typecheck, and diff-check are run after this documentation correction. Final separate GET-only verification must confirm the six endpoints, broker position source, equity direction, caps, four schedules, fresh run delivery, filtered aliases/candidate counts, disjoint trade pagination, lifecycle ordering, and aggregate accounting. Production remains **OPEN FAIL/DEGRADED, not healthy**.

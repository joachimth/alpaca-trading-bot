# CORRECTION WORK ITEM: Control-34

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - strict read-only control; documentation/status correction only; deployment blocked**.

## Scope and safety

This control used only HTTP GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, plus filtered `/api/runs` and paginated `/api/trades` probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was called.

## Live evidence

- All six required endpoints returned HTTP 200.
- Live identity remains stale/unresolved: root `/` and `/health` report `1.0.0`, `/api/config.version` reports `2.4.0`, and `/api/config` omits `release_version`; local validated release is `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`, while source returns `{config, release_version}`. This confirms deployment/version drift rather than a query-only issue.
- Deployment provenance is blocked: `bunx wrangler whoami` at `2026-08-23 12:00:57 UTC` returned `You are not authenticated. Please run wrangler login.`; no `CLOUDFLARE_API_TOKEN` is present.
- Positions remain broker-authoritative: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `$98504.50` versus `last_equity=$98504.5039`; the direct difference is approximately `-$0.0039`, while `change_today=0` and `change_today_pct=0`, so material current-day equity direction is not independently verifiable.
- Capital caps remain exactly `$5000` daytrading, `$3700` swing, and `$2000` crypto. Local configuration and runtime sizing enforcement pass, but direct live cap enforcement cannot be verified while the serving release/provenance is unresolved. No vital risk parameter was changed. A prior `$5679.8784` daytrading market-value snapshot remains an explicit historical cap-enforcement follow-up.
- Local `wrangler.toml` retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` for `:07/:37`, and reconciliation `*/10 * * * *`. The deployed cron declaration cannot be authoritative without authenticated provenance.
- Fresh crypto delivery is present at `2026-08-23 11:07:56` and `11:37:57 UTC`, consistent with the expected `:07/:37` cadence. Fresh reconciliation delivery is present through `11:50:53 UTC` at approximately ten-minute cadence, with structured `MAINTENANCE_ONLY` skips (`brokerOrders=0`, `imported=0`, `ledgerActivities=18`, `ledgerTruncated=false`, `ledgerDegraded=false`).
- Sunday, August 23, 2026 has no expected weekday daytrading or swing cron delivery. Filtered daytrading is stale at run `2556` from August 20 and is skipped with `CYCLE_LEASE_HELD`. Filtered swing is stale at run `2200` from August 18 and carries `RISK_HALTED` plus broker/D1 position divergence; older swing errors remain observable. Current fresh daytrading/swing delivery is therefore not proven.
- Crypto run observability includes structured `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, and `DECISION_HOLD` skips. No lease-held crypto skip appeared in the current filtered sample.
- Filled trades expose order IDs, quantities, full-fill status, TIF, submitted/filled/broker-updated/reconciled timestamps, and terminal lifecycle fields. Live rows retain null exact per-fill `gross`, `fee`, and `net` under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Broker fee/fill telemetry exists in local artifacts but is not attributed to the live trade rows; aggregate gross/fee/net arithmetic remains internally consistent where reported. Imported trade `597` retains an unexplained timestamp-order anomaly.
- Live filtered run responses omit the local `trigger_alias` and durable candidate-count annotations. `/api/trades?limit=3&offset=0`, `offset=3`, and `offset=30` all repeat IDs `642..640`, so local pagination and filtered observability corrections are not live-proven.
- Dashboard accounting/coverage has an additional reconciliation gap: strategy comparison trade counts sum to 553 (`40 + 263 + 0 + 250`) while top-level `totalTrades` and `executedTrades` are 642, leaving 89 trades outside the strategy breakdown. Strategy decision totals reconcile to the top-level decision total, so this is a trade-coverage observability gap, not evidence to infer missing strategy attribution.

## Local source and regression evidence

- Broker-authoritative position projection, no D1 fallback on broker failure, bounded read-only reconciliation, and structured skip/error/degraded persistence remain implemented.
- `src/index.ts` maps all four cron expressions to the intended daytrading, swing, crypto, and reconciliation handlers.
- `src/capital-caps.ts` retains exactly 5000/3700/2000 USD defaults and aliases.
- `src/crypto-runtime.ts`, `src/crypto-strategy.ts`, and risk tests retain fail-closed calibrated-edge and fee-telemetry gates; no confidence-derived edge is invented.
- Local filtered-run alias/candidate-count and disjoint pagination behavior is covered by tests, but the live Worker is not serving that validated release.
- Focused validation passed **71 tests / 323 assertions across 9 files**. Full `bun test` passed **178 tests / 632 assertions across 25 files**. `bunx tsc --noEmit` and `git diff --check` passed.

## Correction, deployment decision, and follow-up

No new runtime code, config, cap, schedule, lease, broker-authority, accounting semantic, edge-gate, sizing, or trading-behavior correction is justified by this evidence. The safe correction is to record the degraded status and exact follow-up: restore authenticated Wrangler access, reconcile active Worker/source and cron provenance, obtain deployment authorization, deploy only the already-validated reliability artifact if still required under the standing maintenance rule, then perform a separate GET-only verification and a natural weekday daytrading/swing delivery check.

The live fee gap cannot be repaired by inferring values from aggregate telemetry without changing conservative accounting semantics. The live pagination/alias gap cannot be proven or corrected until the validated release is deployed. No deployment was attempted beyond the read-only authentication check, and no broker mutation occurred.

## Required next verification

Repeat `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, `/api/trades`, filtered run queries, and disjoint trade-page probes after any authorized deployment. Confirm live release identity, broker position source, equity direction, all four schedules, crypto `:07/:37`, reconciliation cadence, lease/error skips, lifecycle ordering, fee/gross/net status, caps, filtered aliases/candidate counts, and distinct pagination slices.

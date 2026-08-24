# CORRECTION WORK ITEM: Control-24

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED**, local correction validated, production deployment blocked by Wrangler authentication.

## Trigger and strict read-only boundary

The control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filtered-run and trade-pagination probes. All six required endpoints returned HTTP 200. No trigger, submit, cancel, close, replace, retry, migration, preview, or broker-mutating endpoint was used.

## Live evidence

- Release identity is unresolved: `/health` reports `1.0.0`, `/api/config.version` reports `2.4.0`, while the local deployable is version `2.6.0`; active Worker/source provenance is not proven.
- Positions are broker-authoritative: `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard broker state is available with equity `98504.50`, `last_equity=98504.5039`, and current-minus-last approximately `-0.0039`; `change_today=0`, so material current-day equity direction remains unverified.
- Live caps are unchanged at `5000 / 3700 / 2000` USD for daytrading, swing, and crypto. Local `wrangler.toml` retains the four exact UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; live schedule identity is not exposed and remains unresolved.
- Reconciliation is fresh through run `2929` at `2026-08-23 04:00:53`, recorded as structured `MAINTENANCE_ONLY` with bounded ledger context. Crypto is fresh through run `2926` at `03:37:56`, with the prior run `2922` at `03:07:58`, matching the expected `:07/:37` cadence with minute-level jitter. Sunday has no expected weekday daytrading or swing cron delivery.
- Lease/error observability is present in history: daytrading filtered evidence includes `CYCLE_LEASE_HELD`; swing includes position divergence and `RISK_HALTED`; crypto/reconciliation include structured no-position, fee-telemetry, confidence, and maintenance skips. No fresh weekday daytrading/swing strategy delivery is proven from this Sunday window.
- Live filtered responses remain old: alias requests return canonical rows but omit response-only `trigger_alias`, and `analyzed_candidates`/`filtered_candidates` are null because the old production run rows do not contain the new durable fields.
- Confirmed live pagination defect: `/api/trades?limit=30&offset=0`, `offset=30`, and `offset=60` each return 30 rows with IDs `642..613`.
- Sampled filled trades expose broker/client IDs, quantities, status, TIF, submitted/filled timestamps, and terminal lifecycle fields. `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; conservative nulls are correct where exact fill-lot attribution is unavailable. Aggregate arithmetic is not exact per-fill proof.

## Local correction and regression result

The checked-out tree already contains the bounded reliability correction: explicit finite calibrated `rawEdgeBps` propagation into crypto risk with missing/invalid edge fail-closed, durable run candidate counters, filtered-run alias serialization, corrected trade offset pagination, broker-authoritative position failure handling, and preserved isolated leases and fee semantics. No caps, schedules, strategy thresholds, sizing, TIF, broker authority, or trading behavior were changed.

Focused regressions passed **63 tests / 297 assertions**. Full `bun test` passed **171 tests / 592 assertions**. `bunx tsc --noEmit` and `git diff --check` passed. The repository contains regression coverage for four schedules and dispatch, broker-authoritative positions, caps, lifecycle/full-fill semantics, filtered aliases and durable candidate fields, distinct trade pages, and crypto calibrated-edge fail-closed behavior.

## Deployment attempt and blocker

The standing maintenance rule permits deployment of this reliability/observability correction because vital caps and trading behavior are unchanged. A normal deployment attempt is allowed, but Wrangler authentication is required. `bunx wrangler whoami` returns exactly: **`You are not authenticated. Please run wrangler login.`** No temporary preview is permitted or useful for production proof. Deployment therefore remains blocked, and live verification cannot be upgraded from the current old `1.0.0/2.4.0` release.

## Required follow-up

Restore authenticated Wrangler access, deploy only the validated 2.6.0 artifact, record the deployment/version receipt and 100% traffic, then perform a separate GET-only verification of release identity, all six endpoints, four schedules, broker-authoritative positions, equity direction, fresh natural weekday daytrading/swing delivery, crypto `:07/:37` cadence and edge-gate evidence, reconciliation freshness, lease/error skips, filtered aliases and candidate counts, trade pagination, lifecycle/accounting fields, and unchanged caps. If deployment remains blocked, retain this explicit follow-up and keep production **OPEN FAIL/DEGRADED, not healthy**.

## Mutation boundary

This control and work item used GET-only production access. No broker-mutating endpoint, trigger, order, migration, preview, or successful deployment was used.

# CORRECTION WORK ITEM: Control-19

Date label: server-clock evidence dated 2026-08-23 UTC; control date is Saturday, August 22, 2026.
Disposition: OPEN FAIL/DEGRADED. Documentation/status-only correction.

## Trigger

The server returned a GET-only evidence bundle for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`. All six returned HTTP 200 in the server-clock window beginning **2026-08-23 00:00:18 UTC**. Because **August 23, 2026 is after the control date of August 22, 2026**, this bundle is preserved as future-dated/pending evidence and is not treated as a completed current-day control. Production remains **OPEN FAIL/DEGRADED, not healthy** because live `/health` reports version `1.0.0` and `/api/config.version` is `2.4.0`, while the checked-out deployable source is version `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; active Worker/source provenance is unresolved.

## Evidence

- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and `29` rows. Broker positions remain authoritative; D1 contributes metadata only and must not provide live quantities or exposure when broker data is unavailable.
- Dashboard equity is `98504.50` versus `last_equity=98504.5039`, current-minus-last approximately `-0.0039`; `change_today=0`, so material current-day equity direction cannot be verified.
- Live capital caps are unchanged at `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto. Local cap defaults and tests preserve those values.
- The local source and regression tests retain all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`. The live config does not expose schedules and active deployed four-schedule identity remains unresolved.
- Future-dated server-clock reconciliation evidence includes run `2897` at `2026-08-23 00:00:56` and prior runs `2896`/`2895` are structured `MAINTENANCE_ONLY` skips with bounded ledger context.
- Fresh crypto delivery is present around the expected `:07/:37 UTC` cadence: run `2894` at `23:37:57`, run `2890` at `23:07:56`, and prior run `2886` at `22:37:56`; skips include `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, and `CONFIDENCE_BELOW_THRESHOLD`.
- No fresh Saturday daytrading or swing delivery is proven by the valid August 22 evidence; future-dated August 23 payloads are not counted as August 22 delivery. Filtered daytrading evidence ends at run `2556` on `2026-08-20 21:55:24` with `CYCLE_LEASE_HELD`; filtered swing evidence ends at run `2200` on `2026-08-18 22:00:36` with position divergence and `RISK_HALTED`. Historical provider and Alpaca error skips remain visible, including crypto and reconciliation 503 evidence.
- Filtered `/api/runs` requests return canonical rows and pagination metadata, but the live old response omits the locally validated response-only `trigger_alias`; durable analyzed/filtered candidate counts are not persisted in `run_log`.
- **Confirmed live pagination defect:** GET `/api/trades?limit=30&offset=30` and `offset=60` both returned the same IDs `642..613` as `offset=0`; the local source already contains the validated offset fix and regression coverage, but the fix is not live-proven.
- The live `/api/trades` sample contains `50` filled rows with broker/client order identifiers, quantities, status, submission/fill timestamps, and conservative lifecycle/accounting fields. Per-fill `gross`, `fee`, and `net` are null under `accounting_status=unavailable_fill_lot_exact` with `fee_attribution=none-recorded`; dashboard crypto aggregate arithmetic is internally consistent (`net = gross - fees`), but this is not exact per-fill lot attribution and account-level fees are not assigned to stock/swing strategies.
- The already-completed local focused post-release regressions passed `52` tests / `256` assertions across schedules, filtered runs, broker authority, caps, lifecycle semantics, and crypto edge gates. The full suite passed `168` tests / `584` assertions; typecheck and diff checks pass. Local crypto BUY admission remains fail-closed without fresh fee telemetry or calibrated `rawEdgeBps`.
- The live pagination defect is a release/provenance gap, not an unvalidated local code gap: `test/dashboard-readonly.test.ts` covers distinct offset slices, while local `src/api.ts`/database pagination wiring is present.
- Wrangler is blocked by the exact response **`You are not authenticated`**. No deployment, preview, migration, trigger, submit, cancel, close, replace, retry, or broker-mutating endpoint was used.

## Scope and correction

The live old deployment served the known pagination defect in the captured future-dated server-clock probe, but the checked-out source already contains the bounded read-only correction and regression coverage. Do not introduce a second code change or alter trading/reliability behavior; record the deployment/provenance gap and observability gaps as degraded status only; do not change broker authority, leases, schedules, caps, lifecycle/accounting semantics, crypto fee/raw-edge gates, or trading behavior.

## Required follow-up

Restore authenticated Wrangler access, inspect active Worker provenance and deployed schedule identity, obtain separate deployment authorization, and deploy only if the already-validated artifact is required. Then perform a separate GET-only verification of release identity, all six endpoints, broker-authoritative positions, equity direction, all four schedules, natural weekday daytrading/swing delivery, crypto cadence and edge evidence, reconciliation freshness, filtered aliases, trade pagination, durable analyzed/filtered observability, lifecycle/accounting fields, and caps. If acceptance fails, stop and preserve the last known-good deployment rather than using a mutating smoke test.

## Validation

- Focused: `52` tests / `256` assertions passed.
- Full `bun test`: passed; exact suite summary recorded in the control validation output.
- `bun run typecheck`: passed.
- `git diff --check`: passed after synchronized documentation updates.

## Mutation boundary

This work item and control used GET-only production access. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker mutation was used.

## Final read-only disposition

Keep production **OPEN FAIL/DEGRADED, not healthy**. Do not close the August 22 control from future-dated server-clock evidence; require authenticated provenance and separately authorized deployment, if required, are followed by independent GET-only verification. The crypto fail-closed state is a safety-preserving gap, not permission to relax the edge gate.

## Date integrity

The captured payload timestamps on August 23, 2026 are later than the required control date of Saturday, August 22, 2026. They are retained as future-dated server-clock evidence only and must not be represented as current-day August 22 execution proof.

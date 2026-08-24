# Correction work item: Control-63 crypto calibrated-edge fail-closed regression

**Date:** Monday, August 24, 2026  
**Disposition:** LOCAL PASS / LIVE PROVENANCE DEGRADED. Smallest safe correction is regression coverage and operational documentation only; no deployment or broker mutation was performed.

## Confirmed defect and safety boundary

The crypto technical-analysis signal generator does not produce a calibrated `rawEdgeBps`. The safe correction is to prove that contract end to end: `generateSignal` returns no `rawEdgeBps`; crypto decision preparation keeps the edge unavailable rather than deriving one from confidence, TA scores, fees, or any other proxy; and `RiskManager` with `requireCalibratedEdge=true` and `minEdgeAfterCosts=8` rejects a BUY with the exact reason **`Calibrated raw edge unavailable`**. Existing injected-edge pass/reject coverage remains intact: an explicitly injected edge can pass when it clears costs, and an injected edge below the configured minimum remains rejected.

No raw-edge producer was added. Caps, schedules, thresholds, sizing, fee freshness, order semantics, and trading behavior were not changed. The correction is intentionally fail-closed while a separately versioned, out-of-sample calibrated producer remains a future decision.

### Deferred candidate-edge wiring issue

The current crypto candidate preparation names a candidate-level field `rawEdgeBps` from `candidate.signal.rawEdgeBps`, but the later decision loop consumes the separately named `signal` object when constructing `taDecision`; it does not consume the candidate-level `rawEdgeBps` property. This candidate-level `rawEdgeBps` versus `signal.rawEdgeBps` naming/consumption mismatch is explicitly deferred wiring work, not a request to infer or produce an edge. Until a reviewed producer and wiring change exist, the edge remains unavailable and the fail-closed BUY rejection is preserved.

Any future calibration artifact must arrive with exact, immutable metadata before wiring is considered: **model** identifier, architecture/algorithm, immutable model version and artifact checksum; **horizon** target definition, forecast horizon, bar interval, and timezone; **dataset** identifier/version, source/universe, feature/schema version, train/calibration/validation date ranges, cutoff timestamp, and sample counts; and **validation** protocol with leakage controls, out-of-sample split boundaries, calibration method, metrics and confidence intervals, realized gross and net edge after stated spread/slippage/fee assumptions, acceptance thresholds, and reproducible run/producer version. The artifact must also define the exact mapping from candidate-level `rawEdgeBps` to decision-level `rawEdgeBps`, plus regression evidence that missing, stale, malformed, or mismatched artifacts remain rejected. No such artifact or producer exists in this correction.

## Control-63 evidence and live disposition

- Local cron wiring is intact: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron`; reconciliation `*/10 * * * *` → `reconcile_cron`.
- On Monday, August 24, 2026, daytrading is not due before **13:00 UTC** and swing is not due before **22:00 UTC**. Absence of earlier current-session rows is therefore not evidence of a missed scheduled run.
- Historical swing run **3182** failed with the recorded Cloudflare **subrequest exhaustion** (`Too many subrequests by single Worker invocation`) and incomplete accepted exits; this remains historical evidence, not a reason to loosen controls here.
- Live release identity remains drifted: `/health=1.0.0` and `/api/config=2.4.0` versus local validated release **2.6.0**. The active Worker is not proven to contain the local correction.
- `POST /api/trigger` is a no-op for this control and was not called. It is excluded from validation because trigger routes are mutation-capable operational surfaces and cannot establish scheduled delivery or source provenance.
- Exact per-fill gross/net remain unavailable by current schema and lot identity: the schema does not persist authoritative fill-lot linkage, so gross is not inferred and fee/net values are not fabricated. Existing unavailable markers remain conservative.
- There is **no calibrated edge producer** in the local or proven live path. The local signal/risk contract therefore preserves edge as unavailable and rejects positive-configured crypto BUY admission closed-loop.
- Fee freshness remains **60 seconds** while maintenance runs on a **10-minute** cadence. That mismatch is suppressive (`FEE_DATA_UNAVAILABLE`) and must **not** be loosened as part of this correction.

No live endpoint was called by this correction. In particular, no trigger, submit, cancel, close, replace, retry, migration, deployment, or other mutating action was performed.

## Files and correction

- Added the end-to-end regression in `crypto-runtime.test.ts`.
- Updated `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` with the Control-63 disposition and safety facts.
- No runtime producer, configuration, schema, schedule, cap, threshold, sizing, fee-freshness, order, or trading-behavior change was made.

## Validation receipts

- Focused: `bun test crypto-runtime.test.ts test/risk-fee-aware.test.ts` — **34 passed / 0 failed / 126 assertions** across 2 files.
- Full: `bun test` — **198 passed / 0 failed / 743 assertions** across 26 files. Receipt: `/workspace/alpaca_control_63_full.txt`.
- Typecheck: `bun run typecheck` — **exit 0**. Receipt: `/workspace/alpaca_control_63_typecheck.txt`.
- Diff check: `git diff --check` — **exit 0**. Receipt: `/workspace/alpaca_control_63_diff_check.txt`.

## Release decision

Keep production **OPEN FAIL/DEGRADED** until authenticated source-to-Worker provenance is restored and a later GET-only verification proves the exact validated artifact. Do not add a raw-edge producer or weaken fee freshness, and do not use `POST /api/trigger` as a smoke test. A separately versioned, out-of-sample calibrated producer requires a distinct design and approval decision.

# CORRECTION WORK ITEM: Control-23

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED**, local reliability correction validated, deployment blocked.

> Workspace note: concurrent user changes were already present in this checkout before Control-23. This record does not reset or claim unrelated edits. The final validation below is the verified post-correction result in the current shared workspace.

## Confirmed defect and bounded correction

The source audit confirmed a real crypto strategy-level wiring defect. Crypto config sets `requireCalibratedEdge: true` with a positive `minEdgeAfterCosts`, and `RiskManager` correctly fails BUY admission closed when no calibrated `rawEdgeBps` is present. However, the shared `TASignal` contract did not expose an optional calibrated edge and the crypto strategy did not carry an explicit edge through its decision path into the risk check. Consequently, a production caller had no supported strategy-level path for a positive calibrated edge to reach crypto risk admission; positive-edge BUYs could only reject as `EDGE_CALIBRATION_UNAVAILABLE`.

The correction is intentionally bounded:

- `TASignal` and `AIDecision` now support optional `rawEdgeBps` metadata.
- Crypto decision preparation carries only an explicitly supplied finite calibrated edge into `RiskManager`.
- AI refinement preserves that edge metadata; it does not create or infer an edge.
- `RiskManager` consumes the decision edge when finite, retaining its existing configured fallback for existing callers.
- Missing edge remains fail-closed; confidence, TA score, sentiment, fee telemetry, ranking, or any other uncalibrated value is never converted into basis points.
- No caps, schedules, thresholds, budgets, sizing, TIF, broker authority, order/close behavior, leases, or trading strategy logic changed.

This correction provides the wiring seam; it does not invent a calibrated edge producer. A future producer must supply a genuinely calibrated value and remain separately reviewed.

## Focused tests

Added strategy-level coverage in the repository-root `crypto-runtime.test.ts`:

- positive calibrated `rawEdgeBps` reaches crypto risk admission and is evaluated after costs;
- missing calibrated edge remains rejected with the calibrated-edge fail-closed reason.

Focused command and result:

```bash
bun test crypto-runtime.test.ts test/risk-fee-aware.test.ts test/dashboard-readonly.test.ts test/audit-regressions.test.ts test/capital-caps.test.ts test/release-version.test.ts test/trades-executed-semantics.test.ts
# 63 pass, 0 fail, 297 expect() calls
```

## Documentation/control correction

Updated `README.md`, `docs/OPERATIONS.md`, and `docs/DEPLOYMENT_RUNBOOK.md` to state that:

- D1 configuration is a controlled release/deployment input, not an arbitrary request-time runtime mutation surface;
- `GET /api/config` is diagnostic only;
- trigger and close POST routes are mutating operational actions outside strict read-only control and are never release smoke tests;
- release identity requires the exact validated source commit, fresh bundle, Cloudflare deployment/version receipt at 100% traffic, complete four-schedule verification, and GET-only endpoint checks;
- local version, historical receipt, or Wrangler dry-run is not proof of the active Worker.

Updated workspace `/workspace/NOW.md` with the current defect, safety boundary, validation state, and deployment blocker.

## Validation

Final required local validation:

```bash
bun test crypto-runtime.test.ts test/risk-fee-aware.test.ts test/dashboard-readonly.test.ts test/audit-regressions.test.ts test/capital-caps.test.ts test/release-version.test.ts test/trades-executed-semantics.test.ts
# 63 pass, 0 fail, 297 expect() calls

bun test
# 171 pass, 0 fail, 592 expect() calls across 25 files

bunx tsc --noEmit
# passed

git diff --check
# passed

rm -rf /tmp/alpaca-control-23-dry-run-final
bunx wrangler deploy --dry-run --outdir /tmp/alpaca-control-23-dry-run-final
# passed; Total Upload: 286.46 KiB / gzip: 64.84 KiB; no deployment
```

Focused Control-23 result: **63 tests / 297 assertions passed**. The final full regression result is **171 passed, 0 failed, 592 assertions across 25 files**. TypeScript and diff checks passed. The final fresh Wrangler dry-run passed with a 286.22 KiB upload preview (64.81 KiB gzip) and did not deploy. No broker-mutating or trigger endpoint is permitted for validation.

The final full-suite result after the fixture-safe run-log schema guard is **171 passed, 0 failed, 592 assertions across 25 files**. The write-side initializer returns cleanly for unit fixtures that intentionally omit `run_log`; no production table is created by this guard.

## Separate post-correction live verification

Canonical GET-only evidence is preserved under `/workspace/alpaca-control-23-live-verification-20260823-final/`, including all six endpoint bodies and headers plus filtered run and trade pagination probes. The live service still returns health `1.0.0`, persisted config `2.4.0` with no `release_version`, broker-authoritative positions (`positionsAvailable=true`, `source=alpaca`, 29 rows), equity `98504.50` versus `last_equity=98504.5039` with `change_today=0`, crypto at `03:07:58` near the configured `:07/:37` cadence, reconciliation at `03:10:49` as `MAINTENANCE_ONLY`, missing durable candidate counters/alias in the old response, and repeated trade IDs `642..593` at offsets 0/30/60.

Disposition is **local correction complete, production unresolved**.

## Release and deployment blocker

No deployment was performed. `bunx wrangler whoami` remains blocked by the exact authentication failure **`You are not authenticated. Please run wrangler login.`** Live release identity remains unresolved: live `/health` is `1.0.0` and live persisted `/api/config.version` is `2.4.0`, versus local deployable version `2.6.0`.

After authenticated, separately authorized deployment, tie the receipt to the exact validated source commit and fresh bundle; verify 100% traffic, the four schedules (`*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, `*/10 * * * *`), `/health`, `/api/config.release_version`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` using GET only. Then observe natural scheduled behavior. Do not call `/api/trigger`, `/api/trigger-swing`, `/api/trigger-crypto`, close routes, order routes, cancel, replace, retry, or any broker-mutating endpoint as smoke tests.

## Final disposition

The local crypto edge gate is safer and now correctly wired for a future explicit calibrated-edge producer while remaining fail-closed when absent. Production remains **OPEN FAIL/DEGRADED, not healthy** until source-to-Worker identity and deployment are independently proven. No broker action, deployment, migration, or trigger was used.

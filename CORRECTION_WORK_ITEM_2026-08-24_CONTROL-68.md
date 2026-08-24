# Monday, August 24, 2026 Control-68 correction work item - LOCAL COMPLETE / LIVE OPEN FAIL-DEGRADED

## Trigger

Control-68 follows the strict read-only production control captured around **14:00 UTC on August 24, 2026**. All six required GET endpoints returned HTTP 200, but production is not healthy: live `/health` reports **1.0.0** and `/api/config.config.version` reports **2.4.0**, while the validated local repository release is **2.6.0**. Active deployment/source provenance is unresolved.

The live run history also contains reliability failures, including Cloudflare **Too many subrequests by single Worker invocation** and broker/internal position mismatches. The latest current samples show run **3317** (`cron`) with `status=error`, reconciliation run **3316** as `MAINTENANCE_ONLY`, and crypto run **3315** as a structured `DECISION_HOLD` skip. The production artifact therefore remains **OPEN FAIL/DEGRADED**, not healthy.

## Scope and correction

The repository already contains the necessary reliability and observability changes: broker-authoritative position projection with no D1 fallback on broker failure, bounded read-only reconciliation, structured skip/error details, filtered run/trade query implementation, lifecycle fields, conservative fee/gross/net handling, and fail-closed crypto calibrated-edge and fee gates. No additional safe runtime defect was established that could be corrected without changing trading behavior.

This work item therefore corrects and records the release/status documentation only. It does **not** change caps, schedules, thresholds, universes, sizing, signals, fee freshness, edge policy, order semantics, or trading behavior. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used.

## Control evidence

- Six required endpoints: HTTP 200 for `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`.
- Positions: `positionsAvailable=true`, `source=alpaca`; the current `/api/positions` response contains **21 broker rows**, and broker data remains authoritative. Earlier records showing 29 rows are historical and are not reused as current state.
- Equity: dashboard account equity **98461.50** versus `last_equity=98504.5039`, therefore down by **43.0039** at capture; broker daily fields are zero. Latest snapshot was **98457.30** at **2026-08-24 13:46:02 UTC**.
- Caps: `/api/config` retains `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`; dashboard resolves **5000/3700/2000 USD**.
- Local schedules and dispatch remain unchanged: daytrading `*/5 13-21 * * 1-5` → `cron`; swing `0 22 * * 1-5` → `swing_cron`; crypto `7-59/30 * * * *` → `crypto_cron`; reconciliation `*/10 * * * *` → `reconcile_cron`.
- Fresh delivery: crypto run **3315 at 2026-08-24 13:38:00 UTC**, reconciliation run **3316 at 13:40:58 UTC**, and daytrading run **3317 at 13:41:16 UTC**. Crypto delivery is close to the expected `:07/:37` cadence; reconciliation is near ten minutes. Successful swing delivery is not proven in the current returned window.
- Skip/error observability: structured `DECISION_HOLD`, `MAINTENANCE_ONLY`, `MARKET_CLOSED`, `POSITION_QTY_MISMATCH`, and error details are present. The latest daytrading errors include broker/internal mismatches and prior subrequest exhaustion. No current `CYCLE_LEASE_HELD` row is proven by the live old artifact.
- Trade lifecycle: lifecycle timestamps and broker order identifiers are present. Sampled filled trades have `gross`, `fee`, and `net` unavailable under `accounting_status=unavailable_fill_lot_exact` / `fee_attribution=none-recorded`; aggregate crypto gross/fee/net remains conservative, but exact per-fill attribution is unavailable.
- Live run aliases/candidate counters and live filtered run/trade behavior are not proven on the old artifact. Local tests cover filtered run observability, pagination, lifecycle shape, conservative accounting, broker-authoritative positions, and crypto edge-gate wiring.

## Validation

Local validation is run on the current repository tree after this work item:

- `bun test`
- `bun run typecheck`
- `git diff --check`

Expected acceptance is zero failing tests, typecheck exit 0, and diff-check exit 0. The focused regression set previously passed **74 tests / 361 assertions** and the full suite previously passed **199 tests / 754 assertions**; fresh receipts are recorded after this documentation update.

## Deployment and follow-up

Deployment is required to remediate the live release drift and expose the local reliability fixes, but it is not performed here because `bunx wrangler whoami` returns:

```text
You are not authenticated. Please run `wrangler login`.
```

A temporary preview deployment is explicitly not an acceptable production correction. After authenticated clean-artifact review and authorized deployment under the standing maintenance rule, perform a separate GET-only verification of release identity, all four schedules, broker-authoritative positions, natural weekday daytrading and swing delivery, crypto `:07/:37` cadence, lease/error skips, run filters, trade filters/pagination, lifecycle correlation, and conservative gross/fee/net reporting. Keep production **OPEN FAIL/DEGRADED** until those checks pass.

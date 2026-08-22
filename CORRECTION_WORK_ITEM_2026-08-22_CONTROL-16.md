# Correction work item: Control-16 strict read-only production control

- Date: August 22, 2026
- Control capture: 2026-08-22 21:00:23-21:01:42 UTC
- Status: **OPEN - FAIL/DEGRADED**
- Scope: read-only production evidence, release identity, and deployment follow-up
- Repository: `alpaca-trading-bot`
- Remote: `https://github.com/joachimth/alpaca-trading-bot.git`
- Branch: `fix/remove-premature-position-upsert-entryside`
- HEAD: `4cc5df6c1cb7979ffefc7ddb751fdc8e1331d3cd`
- Local deployable version: `2.6.0`

## Read-only boundary

The control used only GET requests against the required endpoints and GET-only filtered `/api/runs` requests. No trigger, submit, cancel, close, replace, retry, migration, deployment, temporary preview, or other broker-mutating operation was called.

## Live findings

1. **Endpoint availability: PASS.** `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades` all returned HTTP 200. Fresh response headers and bodies are preserved under `/workspace/alpaca-control-16-live-20260822T2100Z/`, with SHA-256 checksums in `SHA256SUMS.txt`.
2. **Release identity: FAIL/CANNOT VERIFY.** Live `/health` reports version `1.0.0`; persisted `/api/config.config.version` reports `2.4.0`; local deployable source at HEAD `4cc5df6c1cb7979ffefc7ddb751fdc8e1331d3cd` reports `2.6.0`. The active Worker/source identity and deployment provenance remain unresolved.
3. **Positions: PASS for current broker availability.** `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 long positions. Local source remains broker-first and fails closed on broker failure rather than treating D1 positions as current broker state.
4. **Equity direction: CANNOT VERIFY materially from the current snapshot.** Dashboard account and latest snapshot equity are `98,504.50`; `last_equity=98,504.5039`, giving a current-minus-last delta of `-0.0039`, while `change_today=0` and daily P/L fields are zero. The retained history is non-monotonic but moved from `98,500.18` at `2026-08-20 05:07:33` to `98,504.50` latest, an overall `+4.32`; this does not establish a material current-day direction.
5. **Capital caps: PASS and unchanged.** Live config and dashboard expose daytrading `$5,000`, swing `$3,700`, and crypto `$2,000`. No vital risk parameter was changed.
6. **Schedules: LOCAL PASS, live provenance unresolved.** Checked-out `wrangler.toml` retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at `:07/:37`, and read-only reconciliation `*/10 * * * *`. Saturday cannot prove weekday daytrading or swing delivery for the current day.
7. **Capital caps: PASS and unchanged.** The three USD caps remain exactly `5000/3700/2000` for daytrading/swing/crypto; no vital risk parameter was changed.
7. **Run delivery: PARTIAL/DEGRADED.** Reconciliation is fresh at `2026-08-22 21:00:54` (run `2873`) and repeatedly near the ten-minute cadence, with structured `MAINTENANCE_ONLY`, `errors=0`, `ledgerTruncated=false`, and `ledgerDegraded=false`. Crypto is fresh at `20:07:59` (run `2866`) and `20:37:59` (run `2870`), matching the expected `:07/:37` cadence with seconds-level jitter. No fresh Saturday daytrading or swing row is present; the latest daytrading alias-filter result is `2026-08-20 21:55:24` (run `2556`) with `CYCLE_LEASE_HELD`, and the latest swing evidence remains `2026-08-18 22:00:36` (run `2200`) with position divergence and `RISK_HALTED`.
8. **Errors and skips: auditable but unresolved history remains.** Live crypto history includes run `2802` at `2026-08-22 12:07:40` with ledger/recent-orders provider 503 errors, followed by successful structured skips. Current run records expose skip details including `MAINTENANCE_ONLY`, `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, and lease-held states.
9. **Filtered run observability: LOCAL PASS, LIVE PROVENANCE GAP.** GET alias filters return constrained canonical rows: `daytrading_cron -> cron` and `reconciliation_cron -> reconcile_cron`. The live old response omits the locally validated response-only `trigger_alias` field, while the local source and regression tests preserve alias annotations without rewriting canonical history. Invalid `strategy=reconciliation` correctly returns HTTP 400 because only daytrading, swing, and crypto are valid strategy filters.
10. **Trade/fill lifecycle: PARTIAL PASS.** Sampled filled trade `id=642` exposes broker order ID, client order ID, status, requested and filled quantities, `leaves_qty=0`, fill and average-fill prices, submission/fill/broker-update/reconciliation timestamps, and null terminal timestamps where no cancel/expire/fail/replace occurred.
11. **Fees and gross/net: conservative, exact per-fill consistency CANNOT VERIFY.** Sampled filled trades retain `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`. Aggregate crypto arithmetic is internally consistent (`grossTotalPl=-56.616426`, `feesUsd=269.11016882811`, `netTotalPl=-325.72659482810997`), but aggregate values do not prove deterministic fill-lot attribution. The dashboard reports broker-attributed crypto fee telemetry available as of `2026-08-18T09:37:52.56276Z`; no fabricated per-fill allocation is present.
12. **Crypto edge gate: LOCAL PASS, LIVE positive-edge evidence unavailable.** Local crypto admission remains fail-closed when fee telemetry or calibrated `rawEdgeBps` is unavailable, and source wiring is covered by the existing crypto runtime/risk regressions. Live `FEE_DATA_UNAVAILABLE` skips support the fail-closed behavior, but the live API does not expose positive-edge producer/branch evidence.

## Correction decision

No new code, configuration, schema, schedule, cap, broker-authority, lease, accounting, or trading-behavior defect was isolated. The necessary correction is documentation/status synchronization only. Production must remain **FAIL/DEGRADED**, not healthy, until authenticated deployment provenance and the locally validated release identity can be independently verified.

## Validation completed

- Focused read-only/regression tests covering dashboard filters, release identity, risk-fee gates, crypto schema/runtime, full-fill semantics, broker-authoritative positions, reconciliation, and trade identity: **54 passed, 0 failed, 263 assertions**.
- Full `bun test`: **168 passed, 0 failed, 584 assertions**.
- `bun run typecheck`: **passed**.
- `git diff --check`: **passed**.
- Documentation-only diff scope: **PASS**, limited to this work item, `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` for the requested status update.
- Synchronized status surfaces retain the same Control-16 timestamp, FAIL/DEGRADED verdict, caps, live identity gap, and deployment blocker.

## Deployment blocker and follow-up

`bunx wrangler whoami` returned the exact blocker **`You are not authenticated`**. Do not use `wrangler deploy --temporary`. Restore authenticated Wrangler access, inspect deployment provenance, and obtain separate deployment authorization before deploying any artifact. If authorized, deploy only the validated source, record the receipt, then perform a separate GET-only acceptance pass covering release identity, all six endpoints, canonical/alias run filters, broker position source, equity direction, all four schedules, caps, natural weekday daytrading/swing delivery, crypto `:07/:37` cadence, lease/error skips, lifecycle fields, conservative gross/fee/net semantics, and crypto edge-gate evidence. If acceptance fails, roll back to the last known-good authenticated deployment and repeat the same read-only checks.

No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.

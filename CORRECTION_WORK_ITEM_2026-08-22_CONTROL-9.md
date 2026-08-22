# Alpaca Control-9 correction work item

Date: 2026-08-22
Disposition: local reliability correction validated; production deployment blocked; live status remains FAIL/DEGRADED

## Trigger

The strict read-only control found a repository regression in the broker-authoritative positions failure path: `/api/positions` attempted a D1 `positions` read before returning the broker-unavailable response. That violated the no-D1-fallback contract and could make a broker outage look like an internal-state fallback. The live Worker also remains unproven as the checked-in release: `/health` reports `1.0.0` and `/api/config` reports `2.4.0`, while the validated local source is `2.6.0`.

## Exact correction

- `src/api.ts`: fetch broker positions before constructing/reading D1 metadata; a broker failure now returns `503`, `positions: []`, `positionsAvailable: false`, `source: "alpaca"`, and performs no D1 positions query.
- `test/dashboard-readonly.test.ts`: regression proves broker failure does not query D1 positions and performs no DDL.

This is a reliability and observability correction only. Capital caps remain exactly `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto. Four schedules, broker authority, leases, edge gates, TIF, sizing, and trading behavior are unchanged.

## Validation

- Focused control regressions: **61 tests passed, 0 failed, 246 assertions**.
- Full repository: **161 tests passed, 0 failed, 537 assertions**.
- `bunx tsc --noEmit`: passed.
- `git diff --check`: passed.
- `bunx wrangler deploy --dry-run --outdir /workspace/alpaca-trading-bot/.dry-run-control-9`: passed; 281.69 KiB upload, 63.97 KiB gzip.
- Temporary dry-run output was removed after validation.

## Separate live GET-only verification

The required endpoints were read without any trigger or broker mutation. Final pass observed:

- `/health`: HTTP 200, `version: 1.0.0`.
- `/api/config`: HTTP 200, persisted `version: 2.4.0`; caps remain `max_capital_usd=5000`, `swing_max_capital_usd=3700`, `crypto_max_capital_usd=2000`.
- `/api/dashboard`: HTTP 200; broker account and 29 positions readable, equity `98504.50`, `last_equity 98504.5039`, current-minus-last `-0.0039`.
- `/api/positions`: HTTP 200, `positionsAvailable: true`, `source: alpaca`, 29 broker-authoritative rows.
- `/api/runs`: fresh reconciliation `MAINTENANCE_ONLY` at `2026-08-22 13:01:05`; crypto skip at `12:38:03`; recent provider errors at `12:00:46`, `12:07:40`, and `12:10:40` with Alpaca 503 responses. Daytrading evidence remains stale at `2026-08-20 21:55:24` and `CYCLE_LEASE_HELD`; swing evidence remains stale at `2026-08-18 22:00:36` with divergence and `RISK_HALTED`. Crypto delivery is approximately `:08/:38` rather than exact configured `:07/:37`.
- `/api/trades`: filled samples expose broker order, fill, lifecycle, and reconciliation fields; `gross`, `fee`, and `net` remain null with `accounting_status: unavailable_fill_lot_exact` and `fee_attribution: none-recorded`.

## Deployment blocker and follow-up

`bunx wrangler whoami` reports `You are not authenticated`; normal deployment was not attempted and temporary preview deployment was not used. The local correction is therefore not live-proven, and the active Worker/source identity remains unresolved. Restore authenticated Wrangler access, tie a normal deployment receipt to this exact validated artifact, then perform a separate GET-only verification and wait for natural weekday daytrading and swing windows. Preserve fail-closed crypto fee and calibrated-edge behavior until fee timing and live calibrated `rawEdgeBps` evidence are resolved.

No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.

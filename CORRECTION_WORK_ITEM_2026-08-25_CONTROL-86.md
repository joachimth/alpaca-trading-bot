# Control-86 strict read-only Alpaca production control

Date: 2026-08-25 UTC
Verdict: OPEN FAIL/DEGRADED
Scope: read-only control and documentation correction only

## Safety boundary

Only GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, including same-endpoint filter and pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, external write, or broker-mutating endpoint was called.

## Live evidence

- `/health`: HTTP 200, service `alpaca-trading-bot`, version `1.0.0`.
- `/api/config`: HTTP 200, persisted version `2.4.0`; caps exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, `crypto_max_capital_usd=2000`; crypto minimum edge after costs `8` bps.
- `/api/dashboard`: HTTP 200; final recheck equity `$98,462.83`, `last_equity=$98,386.6243`, positive direction delta `$76.2057`; latest snapshot `$98,463.06` at `2026-08-25 08:08:13 UTC`.
- `/api/positions`: HTTP 200; `positionsAvailable=true`, `source=alpaca`, 21 broker rows. D1 may supply metadata only, not live position quantity/prices/value/P&L.
- `/api/runs`: HTTP 200; final recheck shows reconciliation runs `3462-3464` through `08:01:15 UTC` and crypto run `3465` at `08:08:18 UTC`; structured maintenance, fee-data, decision-hold, no-position, and other skip evidence is present. Completions are around `:08/:38`, so exact `:07/:37` event delivery is not proven. Fresh successful daytrading and swing delivery are not proven; the latest known swing failure is Cloudflare subrequest exhaustion.
- `/api/trades`: HTTP 200; lifecycle fields are present, including broker order IDs, submitted/filled timestamps, filled and remaining quantities, and terminal fields. The page contains 47 filled and 3 accepted rows; sampled per-fill `gross`, `fee`, and `net` remain null with `accounting_status=unavailable_fill_lot_exact`, conservatively avoiding unsupported lot matching.
- Filter probes: live `code=LEASE_HELD`, `search=LEASE`, and `status=skipped` run probes return the same broad page; `strategy=crypto` narrows; trade `status=filled` is ignored and `offset=3` repeats IDs `703-701`. Filtered observability is therefore not production-equivalent.

## Local source evidence

- Exact checkout: branch `fix/remove-premature-position-upsert-entryside`, HEAD `9f09b145d922597d1e0b7c80bb827a768c147706`, release `2.6.0`.
- Runtime-bearing reliability commit: `20d80ac87e08271fb0d9c1c7ea1027b72eebd48d`; subsequent commits in the current branch are documentation/status records.
- `wrangler.toml` defines four UTC crons: `*/5 13-21 * * 1-5`, `0 22 * * 1-5`, `7-59/30 * * * *`, and `*/10 * * * *`; `src/index.ts` dispatches them to daytrading, swing, crypto, and reconciliation paths.
- Broker-first positions are enforced in `src/api.ts` and `src/position-projection.ts`; broker failure returns unavailable/503 rather than a D1 live-state fallback.
- Lease-held and structured skip/error persistence exists for daytrading, swing, crypto, and maintenance/reconciliation, with tests for the individual paths but no end-to-end all-four schedule delivery test.
- Crypto risk wiring requires fresh fee telemetry and calibrated raw edge. `technical-analysis.ts` declares optional `rawEdgeBps` but no normal producer was found; AI refinement only propagates an existing TA edge. BUY admission therefore fails closed when no calibrated edge is supplied. No strategy behavior was changed.

## Correction and validation

Reliability-only corrections were made locally: API account/dashboard responses now apply the existing equity-direction fallback; maintenance lease release is protected if run-log persistence fails; schema-gated strategy runs persist a structured `REQUIRED_SCHEMA_MISSING` skip; the dashboard now exposes conservative gross/fee/net and accounting status; and position reconciliation normalizes known crypto punctuation without changing broker authority or order behavior. No caps, schedules, thresholds, sizing, fee policy, edge policy, order semantics, deployment, migration, or broker state was changed.

Focused validation passed **32 tests / 209 assertions**; the full suite passed **215 tests / 807 assertions**; TypeScript, `git diff --check`, and `bunx wrangler deploy --dry-run` passed. Deployment remains blocked by missing Wrangler authentication and unproven source provenance. Maintain the explicit follow-up for secure authentication, separately authorized deployment if required, and separate GET-only post-release verification.

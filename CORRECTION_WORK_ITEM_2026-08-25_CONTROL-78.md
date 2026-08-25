# Control-78 correction work item - August 25, 2026

## Status

Production remains **OPEN FAIL/DEGRADED**, not healthy. This control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filter and pagination probes on those endpoints. No trigger, submit, cancel, close, replace, retry, migration, deployment, external-write, or broker-mutating endpoint was called.

## Exact evidence

- Local repository: `/workspace/alpaca-trading-bot`, branch `fix/remove-premature-position-upsert-entryside`, exact HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`, release `2.6.0`.
- Live `/health`: HTTP 200, service `alpaca-trading-bot`, version `1.0.0`.
- Live `/api/config`: HTTP 200, persisted config version `2.4.0`; caps are exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD; `crypto_min_edge_after_costs=8`.
- Live `/api/positions`: HTTP 200, `positionsAvailable=true`, `source=alpaca`, 21 rows. Broker is authoritative for current positions; no D1 fallback is inferred.
- Live dashboard equity is `98390.96 USD` versus `last_equity=98504.5039`, a downward difference of `113.5439 USD`. Latest snapshot is `98390.96 USD` at `2026-08-25 00:08:11 UTC`.
- Local cron contract remains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37 UTC`, and reconciliation `*/10 * * * *`.
- Fresh daytrading delivery is present through run `3407` at `2026-08-24 21:55:47 UTC` with structured `MARKET_CLOSED` skip; fresh crypto delivery is present through run `3426` at `2026-08-25 00:08:18 UTC`; fresh reconciliation delivery is present through run `3430` at `2026-08-25 00:50:37 UTC` with structured `CYCLE_LEASE_HELD` skip and prior `MAINTENANCE_ONLY` rows. Crypto history shows the `:07/:37` cadence with seconds-level jitter, including runs at `23:38:18`, `00:08:18`, and earlier `:07/:37` samples.
- Fresh successful swing delivery is not proven. Latest swing run `3409` at `2026-08-24 22:01:37 UTC` is `error` with Cloudflare `Too many subrequests by single Worker invocation`, plus accepted exits.
- Live run filter probes are defective: `code=LEASE_HELD` and `search=LEASE` return the same first page as the unfiltered request. Live rows omit the newer candidate counters/aliases even though local source implements them. Lease/error skip behavior is present in the unfiltered live data, including `CYCLE_LEASE_HELD`, `MAINTENANCE_ONLY`, `FEE_DATA_UNAVAILABLE`, and `CONFIDENCE_BELOW_THRESHOLD`.
- Live trade lifecycle fields exist, but the sampled 100-row page contains 97 `filled` and 3 `accepted` rows; all sampled rows conservatively retain `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`. Exact per-fill economics are unavailable. `status=filled` returns the same mixed page, and `offset=0` and `offset=3` both return IDs `703,702,701`.
- Aggregate dashboard arithmetic remains internally consistent: crypto gross `-56.616426` minus crypto fees `269.11016882811` equals crypto net `-325.72659482811`; total gross `-245.772598` minus total fees `272.32016882811` equals dashboard net `-518.09290682811`. This is not exact per-fill proof. Dashboard fee attribution is contradictory because `unattributedUsd` equals all fees while crypto is separately labeled broker-attributed.
- Dashboard reports `8938.576216 USD` swing market value against the unchanged `3700 USD` swing cap. This is a live cap-control **FAIL** if current total gross exposure is the governed quantity; it must not be repaired by changing the cap or closing positions during this read-only control.
- Dashboard decisions show an unexplained semantic mismatch: recent crypto decisions use `executed=2` while their run reports `trades_executed=0` and the execution reason is a skip such as `FEE_DATA_UNAVAILABLE` or `CONFIDENCE_BELOW_THRESHOLD`.
- Local source already contains broker-authoritative position projection, bounded lease-protected reconciliation, durable run filters/pagination and candidate counters, lifecycle persistence, conservative accounting, and fail-closed crypto calibrated-edge/fee gating. No source or config correction is justified without changing behavior or acting on unresolved deployment provenance.

## Correction and validation

The correction is documentation/status alignment only. README.md, docs/OPERATIONS.md, docs/DEPLOYMENT_RUNBOOK.md, and `/workspace/NOW.md` are updated with this exact control, the exact current HEAD, live-versus-local release drift, failures, caps, schedules, and follow-up. No caps, schedules, thresholds, sizing, order semantics, edge policy, fee policy, or trading behavior changed.

Local validation: run focused reliability tests, full `bun test`, typecheck, and `git diff --check`. Deployment is not attempted because `bunx wrangler whoami` returns the exact blocker `You are not authenticated. Please run \`wrangler login\`.` The enabled hourly follow-up `864e3971-0655-4d0f-ac81-95ba66595335` remains active. Restore secure Wrangler authentication, establish active source-to-Worker provenance, deploy only the already-validated reliability artifact if authorized by the standing maintenance rule, then perform separate GET-only post-release verification.

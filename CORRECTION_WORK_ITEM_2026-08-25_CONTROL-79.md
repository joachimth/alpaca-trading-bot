# Control-79 strict read-only production control

**Date:** Tuesday, August 25, 2026  
**Disposition:** **OPEN FAIL/DEGRADED** for live production; **LOCAL VALIDATED**  
**Scope:** strict GET-only production control, repository inspection, and documentation/status alignment

## Safety boundary

Only GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, and `/api/runs`, `/api/trades`, plus GET-only filter and pagination probes on those same endpoints. No trigger, submit, cancel, close, replace, retry, migration, deployment, external-write, or broker-mutating endpoint was called. No cap, schedule, threshold, sizing, fee policy, edge policy, order semantic, or trading behavior was changed.

## Exact source and live identity

The deployable repository is `/workspace/alpaca-trading-bot` on branch `fix/remove-premature-position-upsert-entryside` at exact HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de`, release **2.6.0** from `package.json` and `src/version.ts`. The required release documents identify this same HEAD. The live Worker is not source-tied: `/health` reports **1.0.0**, `/api/config` reports **2.4.0**, and `bunx wrangler whoami` returns `You are not authenticated. Please run `wrangler login.`

Because the active artifact cannot be mapped to the checked-out source, live failures are treated as real production defects and not as evidence that the local implementation is defective. Restore secure Wrangler authentication, establish exact Worker/source provenance and deployment authorization, deploy only the already-validated reliability artifact if separately authorized by the standing maintenance rule, then perform a separate GET-only post-release verification.

## Live endpoint and position/equity evidence

All six approved endpoints returned HTTP 200 JSON. `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and **21** rows. Broker positions remain authoritative; D1 metadata is not treated as live state when the broker position read succeeds. `/api/dashboard` reports account equity **98394.57 USD** versus `last_equity=98504.5039 USD`, a downward difference of **109.9339 USD**; the latest snapshot is **98390.96 USD** at `2026-08-25 00:08:11 UTC` with `total_pl=-113.54389999998966`.

## Caps and schedules

The live configuration exposes unchanged caps: daytrading **5000 USD**, swing **3700 USD**, and crypto **2000 USD**. The checked-out `wrangler.toml` defines the unchanged four UTC schedules, and `src/index.ts` dispatches them exactly:

- Daytrading: `*/5 13-21 * * 1-5`
- Swing: `0 22 * * 1-5`
- Crypto: `7-59/30 * * * *`, intended `:07/:37 UTC` cadence
- Reconciliation: `*/10 * * * *`

## Delivery, skips, errors, and cadence

Fresh daytrading delivery is present, including run **3407** at `2026-08-24 21:55:47 UTC` with structured `MARKET_CLOSED`. Fresh crypto delivery is present, including run **3426** at `2026-08-25 00:08:18 UTC` with `CONFIDENCE_BELOW_THRESHOLD` and `NO_POSITION_TO_EXIT`, and run **3422** with `FEE_DATA_UNAVAILABLE`. Fresh reconciliation delivery is present with `MAINTENANCE_ONLY` runs and current `CYCLE_LEASE_HELD` skips, including runs **3430**, **3431**, and **3432** at `00:50:37`, `01:10:37`, and `01:40:37 UTC`. Crypto history clusters at the configured half-hour cadence with seconds-level completion jitter, but exact scheduler start timestamps are not exposed.

Fresh successful swing delivery is not proven. The latest swing run **3409** at `2026-08-24 22:01:37 UTC` is `error`, including Cloudflare `Too many subrequests` and `BROKER_AUTHORITATIVE_SYNC_ABSENT` structured reconciliation detail. This remains a live reliability failure.

## Observability and filtering

Local source and regressions confirm broker-first position projection, bounded read-only reconciliation, per-lane leases and structured skip/error logging, durable `analyzed_candidates` and `filtered_candidates`, trigger-alias translation, run/trade filtering, and stable pagination. The crypto gate is intentionally fail-closed, but no raw-edge producer assignment was found in the checked-out technical-analysis/AI path, so positive calibrated-edge admission remains unproven. Live evidence is older or defective:

- `/api/runs?trigger=...` and strategy filters work for observed slices.
- `/api/runs?code=LEASE_HELD` and `/api/runs?search=LEASE` return the same first page as the unfiltered request, despite the page containing lease-held records.
- Live run rows omit newer candidate counters and aliases.
- `/api/trades?strategy=crypto` returns crypto records, but `/api/trades?status=filled` returns accepted IDs **703/702/701** before filled ID **700**, so status filtering fails.
- Trade `offset=3` and `page=2` repeat IDs **703/702/701**, so live pagination fails.

These live mismatches are deployment-drift evidence because the checked-out source implements the intended read-only behavior and the focused tests pass.

## Trade lifecycle and accounting

The live trade page contains **47 filled** and **3 accepted** rows. Lifecycle fields are present, including Alpaca order IDs, submitted/filled/broker-updated timestamps, fill quantities, remaining quantities, reconciliation timestamps, and terminal fields. Filled crypto history also contains lifecycle-complete records, while accepted rows 701-703 have no fill and retain remaining quantity.

All sampled rows conservatively expose `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. This correctly avoids inventing FIFO/lot-level economics, but exact per-fill gross/fee/net consistency is **UNVERIFIED/DEGRADED**, not a production pass. Aggregate gross/fee/net arithmetic may be internally consistent, but it does not prove exact fill-level accounting. The live dashboard also retains unexplained decision/trade-count and fee-attribution inconsistencies from the older artifact.

## Crypto edge-gate wiring

The checked-out source wires crypto calibrated raw edge and fresh broker fee telemetry through the crypto risk gate; missing, stale, or insufficient telemetry fails closed, and no edge is inferred from confidence. Local tests cover unavailable/stale fee telemetry, calibrated edge admission, reservations, and lifecycle persistence. Live runs provide fail-closed evidence through `FEE_DATA_UNAVAILABLE` and confidence skips, but live computed-edge proof remains absent because no raw-edge producer assignment was found in the checked-out signal/AI path; fresh fee telemetry is also absent or stale because the Worker is not source-tied.

## Cap-control finding

The dashboard reports approximately **8938.576216 USD** of swing exposure against the unchanged **3700 USD** swing cap. This is a live cap-control **FAIL** if the cap governs current gross exposure. The read-only control cannot close, resize, or otherwise alter those positions, and the cap must not be changed without Joachim's explicit decision. The exact semantics and source provenance of the aggregate require follow-up after authenticated deployment verification.

## Local validation and correction decision

No source or runtime configuration correction is justified by this capture. The checked-out source already contains the requested reliability behavior and tests:

- focused regressions: **100 pass, 0 fail, 449 assertions**;
- typecheck: passed;
- `git diff --check`: passed.

The full suite must be run after this documentation update. Documentation/status alignment is the only correction in this work item. Required `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` are updated with the exact current HEAD, live-versus-local identity, observed failures, unchanged caps/schedules, and explicit follow-up.

## Explicit follow-up

Keep production **OPEN FAIL/DEGRADED**. The enabled follow-up `864e3971-0655-4d0f-ac81-95ba66595335` must continue to track:

1. secure Wrangler authentication and exact Worker/source provenance;
2. authorized deployment of the already-validated reliability artifact and separate GET-only verification;
3. fresh successful swing delivery and Cloudflare subrequest-budget remediation;
4. live run code/search filters, candidate counters, aliases, and pagination;
5. exact fill-level FIFO/lot accounting and attributable gross/fee/net values;
6. swing cap semantics and the observed exposure mismatch;
7. fresh crypto fee telemetry and positive calibrated-edge evidence.

Until those proofs exist, production is not healthy and must not be closed.

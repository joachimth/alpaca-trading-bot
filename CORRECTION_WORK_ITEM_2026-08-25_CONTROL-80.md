# Control-80 strict read-only production control

**Date:** Tuesday, August 25, 2026  
**Disposition:** **OPEN FAIL/DEGRADED** for live production; **LOCAL VALIDATED**  
**Scope:** six approved GET endpoints, same-endpoint GET filter/pagination probes, repository/release-doc inspection, and documentation-only correction

## Safety boundary

Only GET requests were used against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filter and pagination probes on those same endpoints. No trigger, submit, cancel, close, replace, retry, migration, deployment, external-write, or broker-mutating endpoint was called. No cap, schedule, threshold, sizing, fee policy, edge policy, order semantic, or trading behavior was changed.

## Exact source identity and provenance

The Alpaca project under control is `/workspace/alpaca-trading-bot`, currently checked out at exact HEAD `1c6914d1766e420fc3cfa3be2f1e2914c5e197de` on branch `fix/remove-premature-position-upsert-entryside`, release **2.6.0**. The workspace root is a separate Git tree at exact HEAD `d145a98321cb928a334f8d3685ece6076c0eacd1` (detached). The Alpaca checkout HEAD, not the workspace-root HEAD, is the source identity for this release control. The live Worker cannot be source-tied: `/health` reports **1.0.0**, `/api/config` reports **2.4.0**, and `bunx wrangler whoami` reports `You are not authenticated. Please run `wrangler login`.`

## Live endpoint results

All six approved endpoints returned HTTP 200 JSON around **2026-08-25 03:00 UTC**. `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and **21** rows, so current positions are broker-authoritative and D1 is not used as live state when the broker read succeeds. Dashboard account equity is **98,389.56 USD** versus `last_equity=98,504.5039 USD`, a downward difference of **114.9439 USD**; `change_today=0` and `change_today_pct=0`, so daily change direction is not independently verifiable from the broker fields.

## Caps and four schedules

Live config exposes unchanged caps: daytrading **5000 USD**, swing **3700 USD**, and crypto **2000 USD**. Checked-out source and `wrangler.toml` retain the four schedules exactly:

- Daytrading: `*/5 13-21 * * 1-5`
- Swing: `0 22 * * 1-5`
- Crypto: `7-59/30 * * * *`, intended `:07/:37 UTC`
- Reconciliation: `*/10 * * * *`

The configured caps pass as configuration only. Live read-only data does not prove historical cap compliance, and the dashboard still reports approximately **8938.576216 USD** swing exposure against the unchanged **3700 USD** cap; cap semantics/provenance remain unresolved and no corrective trading action is authorized.

## Delivery, skips, errors, and cadence

- **Daytrading:** fresh successful delivery is not proven. The latest observed `cron` run is **3407** at **2026-08-24 21:55:47 UTC**, `MARKET_CLOSED`, with no decisions; the latest active run is older.
- **Swing:** **FAIL**. Run **3409** at **2026-08-24 22:01:37 UTC** errored with repeated `Too many subrequests by single Worker invocation` and accepted, not-fully-filled exits.
- **Crypto:** run delivery is present. Run **3426** at **2026-08-25 00:08:18 UTC** had decisions but no executed trades and structured confidence/no-position skips; fee-unavailable skips are also present.
- **Reconciliation:** delivery is present but operationally degraded. Latest run **3433** at **2026-08-25 02:10:37 UTC** is skipped with `CYCLE_LEASE_HELD`; earlier runs record `MAINTENANCE_ONLY` and lease contention.
- **Lease/error observability:** structured skip/error details expose `CYCLE_LEASE_HELD`, `MAINTENANCE_ONLY`, `FEE_DATA_UNAVAILABLE`, `CONFIDENCE_BELOW_THRESHOLD`, `NO_POSITION_TO_EXIT`, and `MARKET_CLOSED`; runtime health remains degraded because of subrequest exhaustion and lease contention.
- **Crypto cadence:** **FAIL against the requested cadence on observed timestamps**. Crypto completions occurred around `21:08`, `21:38`, `22:08`, `22:38`, `23:08`, `23:38`, and `00:08 UTC`, consistently :08/:38 rather than :07/:37. The API does not expose an explicit scheduler-start timezone, so the exact cause is not proven.

## Filtering and observability

Local source and focused tests validate broker-first projection, bounded read-only reconciliation, per-lane leases, structured skips/errors, durable candidate counts, aliases, filtering, and stable pagination. The live artifact is stale or defective: run `code=LEASE_HELD` and `search=LEASE` probes return the same unfiltered first page, live rows omit newer candidate/alias fields, trade `status=filled` returns accepted IDs **703/702/701**, and trade offsets/page 2 repeat IDs **703/702/701**. This is not treated as a local source failure because live version/provenance is unresolved.

## Trade/fill lifecycle and accounting

The live trade page contains **47 filled** and **3 accepted** rows. Filled records expose lifecycle fields including submitted/filled timestamps, fill quantities, and zero leaves quantity; accepted trades **701-703** remain unfilled with zero filled quantity and nonzero leaves quantity. However, sampled rows expose `gross=null`, `fee=null`, and `net=null` under `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact conservative fill-level gross/fee/net consistency is therefore **FAIL/CANNOT VERIFY**, not a pass. Crypto `FEE_DATA_UNAVAILABLE` skips reinforce that fresh fee evidence is absent.

## Crypto edge-gate wiring

Checked-out source retains a fail-closed crypto gate with `crypto_min_edge_after_costs=8`, requiring calibrated raw edge and fresh fee telemetry and never inferring edge from confidence. Local regressions cover unavailable/stale fees and calibrated-edge admission. Live numerical edge-after-costs calculation is not exposed, and positive live edge admission is not proven, so this remains **CANNOT VERIFY** rather than an authorization to loosen the gate.

## Local validation and correction decision

The checked-out reliability implementation is locally validated; no source or runtime configuration change is justified by this capture. Focused regressions passed **86 tests / 432 assertions**. Typecheck passed, `git diff --check` passed, and `bunx wrangler deploy --dry-run` produced a **300.45 KiB** preview without deploying. The correction in this work item is documentation/status alignment only, including explicit separation of live evidence from local behavior and exact source identity.

## Required follow-up

Keep production **OPEN FAIL/DEGRADED**. The required follow-up `864e3971-0655-4d0f-ac81-95ba66595335` is not verified as enabled; `assistant watchers list` returned `No watchers found` for: secure Wrangler authentication and source-to-Worker provenance; authorized deployment of the already-validated reliability artifact; fresh successful daytrading/swing delivery; Cloudflare subrequest remediation; exact :07/:37 cadence verification; working live filters/pagination; exact fill-level accounting; cap semantics; fresh fee telemetry; and live computed-edge proof. Closure requires a separate GET-only post-release control; no cap changes or trading-behavior changes are permitted under this correction.

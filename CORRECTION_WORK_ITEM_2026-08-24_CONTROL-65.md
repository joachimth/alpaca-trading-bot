# Correction work item: Control-65 daytrading broker-position ownership

**Date:** Monday, August 24, 2026  
**Disposition:** **LOCAL CORRECTION COMPLETE / LIVE OPEN FAIL-DEGRADED**

## Confirmed source defect and smallest correction

The final daytrading broker-position synchronization write in `src/index.ts` previously omitted `strategy: 'daytrading'`, allowing a newly synchronized stock row to remain unattributed in D1/category projection. The smallest correction adds that explicit strategy tag at the existing final broker sync write only. Broker values remain authoritative; existing D1 protective metadata fallback is unchanged. Swing and crypto sync paths, the auto-reconciliation path, caps, schedules, thresholds, sizing, fee freshness, edge policy, order semantics, and trading behavior are unchanged.

## Live control evidence

- All six required GET endpoints returned HTTP 200.
- Live `/health` reports **1.0.0** and `/api/config` reports persisted version **2.4.0** with no `release_version`; local canonical release is **2.6.0** at HEAD `1a27dc845746a82ce0ef7a9b30a31ede5bfeaf84`. Source-to-Worker provenance is unresolved.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and **29** broker rows. Some position timestamps are stale and the prior live MSTR row was unattributed; the local correction is not deployed or live-proven.
- Dashboard equity is below `last_equity=98504.5039`; broker daily fields remain zero. Caps remain exactly **5000/3700/2000 USD**.
- Local schedules remain daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` near `:07/:37 UTC`, and reconciliation `*/10 * * * *`. Live crypto and reconciliation delivery is fresh; the inspected `/api/runs` window does not establish current Monday daytrading/swing execution. Historical swing run **3182** recorded subrequest exhaustion.
- Live run aliases/candidate counts and run code/search filters remain unproven or ignored; trade status filtering and offset/page pagination remain unproven or ignored. Lease-held evidence remains unavailable.
- Lifecycle fields are present. Crypto aggregate gross/fee/net reconciles, while sampled stock `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact` / `none-recorded`; exact stock fill-lot economics remain unavailable and are not inferred.
- Local crypto calibrated-edge admission remains fail-closed and regression-tested, but deployment is not live-proven. Wrangler remains blocked by **`You are not authenticated. Please run \`wrangler login\`.`**

## Documentation correction

The August 10 runbook section formerly titled “Current candidate validation” is explicitly labeled **Historical/superseded**. Its facts remain preserved for audit history and must not be interpreted as current production provenance.

## Safety boundary and release decision

No endpoint mutation, deployment, trigger, order action, migration, or broker mutation was performed for Control-65. Keep production **OPEN FAIL/DEGRADED** until authenticated source provenance, a clean immutable artifact, authorized deployment, and separate GET-only post-release verification prove the corrected release and full control matrix.


## Final separate GET-only post-correction verification

Captured after the local correction on Monday, August 24, 2026, approximately 11:20 UTC. All six required endpoints returned HTTP 200. The active Worker remains unchanged and uncorrected: `/health.version=1.0.0`, `/api/config.config.version=2.4.0`, and no `release_version`; local source remains release 2.6.0 and was not deployed. `/api/positions` remains `positionsAvailable=true`, `source=alpaca`, with 29 rows. Dashboard equity is 98477.43 versus `last_equity=98504.5039`, latest snapshot equity is 98456.97, and caps remain 5000/3700/2000 USD. `/api/runs` is fresh through 11:20:50 UTC with reconciliation and crypto delivery, while current daytrading/swing execution is not proven in the returned window; `code=LEASE_*` and `search=LEASE` probes return the same recent page, and `/api/trades?status=filled`, `offset=10`, and `page=2` return the same first-page IDs with no pagination metadata. Wrangler still reports `You are not authenticated. Please run \`wrangler login\`.` Production therefore remains **OPEN FAIL/DEGRADED**, not healthy; no deployment or broker mutation occurred.

## Validation receipts

Authoritative sequential receipts are saved under `/workspace/alpaca_control_65_*.txt` and are updated by the final validation run:

- Focused tests: **89 passed / 0 failed / 447 assertions across 8 files**.
- Full tests: **199 passed / 0 failed / 754 assertions across 26 files**.
- Typecheck: `bun run typecheck` passed.
- Diff check: `git diff --check` passed.

# Control-83 correction work item - strict read-only status and source identity

Date: 2026-08-25
Status: **OPEN FAIL/DEGRADED**

## Exact local source

- Repository: `/workspace/alpaca-trading-bot`
- Branch: `fix/remove-premature-position-upsert-entryside`
- HEAD: `2fd04d6b416eee03fa56987c6627b83bc180ba7f`
- Release: `2.6.0`
- This HEAD is the current source identity. Older hashes in historical Control-82 and earlier entries are not current.

## Live read-only evidence

At approximately **2026-08-25 05:00 UTC**, only GET requests were used against the six approved endpoints and same-endpoint filter/pagination probes. All six returned HTTP 200. No trading, migration, deployment, external-write, or broker-mutating endpoint was called.

- `/health`: version `1.0.0`.
- `/api/config`: version `2.4.0`; caps `5000 / 3700 / 2000 USD`; crypto minimum edge after costs `8`.
- `/api/positions`: `positionsAvailable=true`, `source=alpaca`, 21 broker rows.
- `/api/dashboard`: equity `$98,408.17` versus `last_equity=$98,504.5039`, down `$96.3339`; latest snapshot `$98,408.19` at `2026-08-25 04:38:12 UTC`.
- `/api/runs`: crypto run 3437 at `04:38:17 UTC`; reconciliation 3439 at `04:51:08 UTC` and a later latest reconciliation at `05:01:14 UTC`; recurring `CYCLE_LEASE_HELD`; structured fee/confidence/maintenance skips; daytrading run 19:16:31 had one trade, followed by an error at 19:51:29 and skip at 19:56:30; swing run 3409 at 22:01:37 errored on subrequest exhaustion.
- `/api/trades`: accepted trades 701-703 have zero fills and leaves quantity; prior filled rows have broker fill timestamps, but sampled gross/fee/net are null under `unavailable_fill_lot_exact`.
- GET probes: status filtering is ignored, offsets repeat the first page, and lease code/search probes return the unfiltered page. Live swing market value is approximately `$8,955.81`, above both the `$3,700` swing cap and `$5,000` global cap; position timestamps are stale versus the latest snapshot.

## Decision and follow-up

No runtime correction is justified by this capture without deployment provenance. Keep production OPEN FAIL/DEGRADED. Do not change caps, schedules, thresholds, sizing, edge policy, order behavior, or broker state.

`bunx wrangler whoami` is blocked by `You are not authenticated. Please run \`wrangler login\`.` Do not deploy until authentication is restored and deployment is separately authorized under the standing maintenance rule. After any authorized deployment, perform a separate GET-only live verification proving canonical version identity, broker-authoritative positions, schedule delivery/skip observability, filter/pagination behavior, lifecycle/accounting surfaces, caps, and crypto edge-gate evidence.

## Validation required

Run focused and full regressions, TypeScript, and `git diff --check`. Verify the resulting diff contains only the four required status documents, this work item, and `/workspace/NOW.md`; no runtime or configuration files may change.

# CORRECTION WORK ITEM: Control-22

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED**, documentation/status-only correction.

## Trigger and mutation boundary

The strict control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filtered and paginated probes. All required endpoints returned HTTP 200. No trigger, submit, cancel, close, replace, retry, migration, deployment, preview, or broker-mutating endpoint was used.

## Live evidence

- Release identity is unresolved: live `/health` reports `1.0.0`, live persisted `/api/config.version` reports `2.4.0`, while local deployable source is version `2.6.0` at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.
- Positions remain broker-authoritative: `/api/positions` returned `positionsAvailable=true`, `source=alpaca`, and 29 rows. A broker failure path must remain HTTP 503 with an empty list and no D1 live-state fallback.
- The latest two dashboard snapshots at `2026-08-23 01:07:51` and `01:37:51 UTC` are flat at equity `98504.50`; displayed history rose from `98369.21` on August 20 to `98504.50`, while `change_today=0` means the current-day direction field is not independently usable.
- Caps are unchanged at `$5,000` daytrading, `$3,700` swing, and `$2,000` crypto. Local source retains daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`; live schedule identity remains unresolved because the API does not expose the active Worker cron configuration.
- Fresh reconciliation delivery is visible through run `2913` at `2026-08-23 02:00:56` as structured `MAINTENANCE_ONLY`, with `ledgerPages=1`, `ledgerPageBudget=5`, `ledgerTruncated=false`, and `ledgerDegraded=false`.
- Crypto delivery is visible around the expected `:07/:37 UTC` cadence, including run `2910` at `2026-08-23 01:37:57`; structured skips include `NO_POSITION_TO_EXIT`, `FEE_DATA_UNAVAILABLE`, and `CONFIDENCE_BELOW_THRESHOLD`. Sunday has no expected weekday daytrading or swing cron delivery; the latest filtered daytrading evidence is run `2556` on August 20 with `CYCLE_LEASE_HELD`, and the latest filtered swing evidence is run `2200` on August 18 with position divergence and `RISK_HALTED`.
- Historical production errors remain visible, including Alpaca 503s on August 22 at `12:07:40` and `12:10:40 UTC`, D1 `too many SQL variables`, and Worker `Too many subrequests by single Worker invocation`. Lease-held skips and explicit crypto edge-gate wiring are not verifiable from the permitted GET responses. The live old run response also omits the current source’s response-only `trigger_alias`, and durable analyzed/filtered candidate counts remain absent from the stored run shape.
- Confirmed live pagination defect: `/api/trades?limit=30&offset=0`, `offset=30`, and `offset=60` all returned the same IDs `642..613`. Local 2.6.0 source and regression tests already contain the bounded offset correction, but it is not live-proven.
- Filled trades expose broker/client identifiers, quantities, status, TIF, submission/fill/reconciliation timestamps, and terminal lifecycle fields. Sampled filled rows retain `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; dashboard aggregate arithmetic is internally consistent, but exact fill-lot economics are unavailable. Crypto aggregate net equals gross minus broker-attributed crypto fees, while account-level regulatory fees remain unattributed to stock/swing strategies.
- Local source wiring keeps crypto BUY admission fail-closed when fee telemetry or calibrated `rawEdgeBps` is unavailable; confidence is not converted to basis points. This wiring is locally tested but not explicitly observable in the permitted live responses. Crypto GTC and deterministic client-order identity remain covered locally.

## Correction scope

No new runtime defect was isolated locally. The live pagination and filtered-observability gaps are release/provenance gaps because the checked-out 2.6.0 artifact already contains the read-only fixes and regression coverage. Update status and release documentation only; do not change trading behavior, broker authority, leases, schedules, caps, lifecycle/accounting semantics, or crypto edge gates.

## Validation

- Focused control regressions: **76 tests / 307 assertions passed**.
- Full `bun test`: **168 tests / 584 assertions passed** across 25 files.
- `bun run typecheck`: passed.
- `git diff --check`: passed.

## Required follow-up and blocker

Restore authenticated Wrangler access, inspect active Worker provenance and cron identity, and obtain separate deployment authorization. `bunx wrangler whoami` reports **`You are not authenticated. Please run wrangler login.`** Do not deploy or use a mutating smoke test until that blocker is resolved; if the validated 2.6.0 artifact is promoted, perform a separate GET-only verification of all endpoints, release identity, filtered aliases, pagination, schedules, natural weekday strategy delivery, caps, lifecycle/accounting, and crypto edge observability.

## Final disposition

Production remains **OPEN FAIL/DEGRADED, not healthy**. The crypto fail-closed state is safety-preserving and is not permission to relax the gate; the missing live release proof and confirmed old pagination behavior remain open follow-up items.

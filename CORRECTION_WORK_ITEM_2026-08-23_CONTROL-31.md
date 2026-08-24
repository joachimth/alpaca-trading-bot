# CORRECTION WORK ITEM: Control-31

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - local observability correction validated, production deployment blocked**.

## Defect

The final Control-30 audit confirmed a local dashboard defect: the read-only API and durable run log carry `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`, but `dashboard/index.html` did not render those fields. This reduced operator visibility into filtered run delivery and candidate flow.

## Correction

- Updated the dashboard run table to render trigger aliases, analyzed candidate counts, and filtered candidate counts, preserving `-` for unavailable legacy values.
- Kept broker-authoritative position projection, isolated leases, all four UTC schedules, caps `$5000/$3700/$2000`, conservative fill accounting, and fail-closed calibrated crypto edge admission unchanged.
- Retained explicit freshness and crypto edge-context fields only when backed by actual broker/D1 timestamps or risk-check results; no fees, P&L, edge, or stop/target values are inferred.
- Added focused regression coverage for dashboard rendering, structured decision-skip parsing, crypto edge evidence, and broker/D1 freshness response semantics.

## Validation

Final focused validation completed: **68 tests / 316 assertions passed** across 6 files, including dashboard, audit, crypto runtime, risk/fees, caps, authority, reconciliation, projection, and skip-reason coverage. Full suite completed: **178 tests / 632 assertions passed** across 25 files. `bunx tsc --noEmit` passed and `git diff --check` passed.

## Live disposition

Live read-only evidence remains degraded: `/health=1.0.0`, `/api/config.version=2.4.0` versus local validated release `2.6.0`; positions are `source=alpaca`, `positionsAvailable=true`, 29 rows; caps remain unchanged; crypto and reconciliation delivery are fresh; exact fill `gross`/`fee`/`net` remain unavailable under `unavailable_fill_lot_exact`; and deployment provenance is unresolved. Wrangler reports `You are not authenticated. Please run wrangler login.` / missing `CLOUDFLARE_API_TOKEN`.

Separate post-correction GET-only verification (performed before this local-only patch) completed at approximately `09:07 UTC`: all six required endpoints returned HTTP 200; live health remained `1.0.0`, config remained `2.4.0`, positions remained `source=alpaca` / `positionsAvailable=true` with 29 rows, caps remained `$5000/$3700/$2000`, and fresh crypto/reconciliation delivery continued. Live run `2970` was `crypto_cron` at `09:07:55` with 2 decisions and 0 fills; live snapshot `755` was at `09:07:51`. The old live artifact still omitted `trigger_alias` on the filtered daytrading response and returned the same trade IDs `642..640` for offsets `0` and `3`, so the local correction is not live-proven.

No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used. After authenticated deployment authorization, perform separate GET-only verification of release identity, six required endpoints, filtered aliases/counts, disjoint trade pagination, freshness context, caps, schedules, and crypto edge evidence.

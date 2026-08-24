# CORRECTION WORK ITEM: Control-25

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED**, local correction validated, production deployment remains blocked by authentication.

## Confirmed defect and bounded correction

The crypto strategy's insufficient-data early return (`validTA.length < 3`) logged a run without explicitly persisting `analyzed_candidates` and `filtered_candidates`, unlike the normal and fatal paths. The correction adds `analyzed_candidates: validTA.length` and `filtered_candidates: 0` to that existing `logRun` call. The return remains before signal generation, AI refinement, decision persistence, order submission, or close activity.

No trading behavior, capital caps, schedules, leases, broker authority, risk gates, sizing, TIF, or fee semantics changed.

## Regression coverage and validation

Added focused audit coverage asserting that the early return preserves both candidate counts and performs no downstream signal, AI, decision, submit, or close work.

- Focused: `bun test test/audit-regressions.test.ts` — **9 tests / 32 assertions passed**.
- Full: `bun test` — **172 tests / 597 assertions passed across 25 files**.
- `bunx tsc --noEmit` — passed.
- `git diff --check` — passed.

## Separate post-correction live verification

A separate GET-only verification was captured under `/workspace/alpaca-control-25-live-20260823/`. All six required endpoints returned HTTP 200, but production remains degraded and the correction is not live-proven: `/health=1.0.0`, `/api/config.version=2.4.0`, positions `source=alpaca` with 29 rows, caps `5000/3700/2000`, equity `98504.50` versus `last_equity=98504.5039` with `change_today=0`, fresh reconciliation `MAINTENANCE_ONLY`, and crypto runs near `:07/:37 UTC`.

The old live release still omits filtered `trigger_alias` and durable candidate fields, and trade offsets `0`, `30`, and `60` repeat IDs `642..613`. Filled lifecycle rows retain conservative null `gross`, `fee`, and `net` under `unavailable_fill_lot_exact`; Sunday provides no fresh weekday daytrading or swing delivery proof.

## Deployment and mutation boundary

No deployment, preview, trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used for Control-25. The prior authorized reliability deployment attempt remains blocked because Wrangler requires `CLOUDFLARE_API_TOKEN` in the non-interactive environment; do not use a temporary preview.

## Required follow-up

Restore authenticated Wrangler access, deploy only the validated artifact if still required under the standing maintenance rule, record the Cloudflare deployment/version receipt and 100% traffic, then perform a separate GET-only verification of release identity, all four schedules, broker-authoritative positions, equity direction, natural weekday daytrading/swing delivery, crypto cadence and edge-gate evidence, reconciliation, filtered candidate fields/aliases, trade pagination, lifecycle/accounting, and unchanged caps.

Production remains **OPEN FAIL/DEGRADED, not healthy** until active source identity and the corrected live observability behavior are independently proven.

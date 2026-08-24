# CORRECTION WORK ITEM: Control-51

Date: Monday, August 24, 2026. Audit capture: `2026-08-24T01:00:53Z` latest observed run. Disposition: **OPEN FAIL/DEGRADED - live release drift and unresolved production verification gaps**.

## Trigger and strict read-only evidence

This control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only filtered run and trade pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was called.

- All six required live endpoints returned HTTP 200.
- Live `/health` reports `version=1.0.0`; live `/api/config.config.version` reports `2.4.0`. The checked-out deployable repository reports release `2.6.0`; active Worker/source SHA and deployed schedule provenance are not proven.
- `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. The broker is authoritative for the currently available position set.
- Live dashboard account values are `equity=98542.62`, `last_equity=98504.5039`, `change_today=0`, and `market_value=8509.263314`. The current account-minus-last-equity delta is positive `$38.1161`, and the latest snapshot reports `total_pl=20.1661`, but `change_today=0` makes intraday direction flat/ambiguous; this is not a clean directional health pass.
- Live caps remain exactly `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000` USD. The live crypto minimum edge setting is `8` bps.
- Local `wrangler.toml` retains all four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *` at approximately `:07/:37`, and reconciliation `*/10 * * * *`. Live delivery proves recurring crypto and reconciliation runs, but the complete deployed cron declaration remains unbound to the checked-out source.
- Fresh delivery is visible: reconciliation run `3206` at `2026-08-24 01:00:53` is structured `MAINTENANCE_ONLY`; crypto runs `3199` at `00:07:55` and `3203` at `00:37:57` are near the expected cadence; daytrading run `3180` at `2026-08-23 21:55:47` is a structured `MARKET_CLOSED` skip; and the latest swing run `3182` at `2026-08-23 22:01:16` is `status=error`, `errors=8`, including Cloudflare `Too many subrequests by single Worker invocation` failures.
- Structured skip/error observability is present in the old live run payload, including `MAINTENANCE_ONLY`, `MARKET_CLOSED`, `NO_POSITION_TO_EXIT`, `CONFIDENCE_BELOW_THRESHOLD`, `DECISION_HOLD`, `BROKER_AUTHORITATIVE_SYNC_ABSENT`, and `HELD_NO_SCORE`. No current lease-held row appeared in the returned page, so current lease-held delivery is not proven absent.
- Filtered live run responses return the expected strategy/trigger subsets but omit local contract fields `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`. This leaves the post-release filtered-run observability correction unproven live.
- Trade probes return the same newest IDs for `offset=0`, `offset=10`, and `page=2`, while the response reports null offset/page values. Stable pagination is therefore not live-proven.
- Additional live filter defects were confirmed: `/api/runs` `code=LEASE_HELD`, `code=LEASE_ERROR`, `code=HELD_POSITION`, and `search=LEASE` returned the unfiltered newest-run shape; `/api/trades?status=filled` returned accepted trades. These filters were not enforced by the active old artifact.
- Trade lifecycle fields are exposed, including broker/client order IDs, quantities, fill quantities, submission/fill/terminal timestamps, and intent prices. Recent accepted swing sells `643` ABBV, `644` COIN, and `645` DUK remain unfilled. Sampled rows expose `gross=null`, `fee=null`, and `net=null` with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`; exact per-fill gross/fee/net consistency cannot be established conservatively.
- Crypto runs report zero trades and fee telemetry unavailable. Local crypto fee and calibrated-edge gating is fail-closed and regression-tested, but the corrected live edge-gate wiring and any positive calibrated raw-edge producer are not proven by the API.

## Correction assessment

Repository review confirms the reliability-only implementation already exists locally:

- broker-authoritative position projection and no-D1-fallback failure behavior;
- canonical release metadata at `2.6.0`;
- all four schedule declarations and dispatch mappings;
- structured run skip/degraded/error serialization;
- durable analyzed/filtered candidate counters and trigger alias mapping;
- stable bounded run/trade pagination;
- lifecycle-aware, conservative trade accounting;
- fail-closed crypto fee telemetry and calibrated `rawEdgeBps` gating.

The confirmed local defect is read-only observability filter enforcement: the API accepted run `code`/`search` and trade `status` parameters but ignored them. The narrow correction adds SQL predicates for those filters and regression coverage; it changes no broker calls, order semantics, caps, schedules, sizing, thresholds, or trading behavior. Aggregate fee arithmetic was independently reviewed and is correct under the existing contract: account-level regulatory fees are subtracted exactly once at aggregate level, while per-strategy fees remain attributable-only. Live release/source drift, absent live filtered fields, repeated live pagination, and unproven live edge-gate wiring remain separate deployment/provenance blockers.

## Validation and deployment state

- Required focused and full regressions, typecheck, and diff-check were rerun after the filter correction; results are recorded below.
- Deployment is not required for a documentation-only correction and is not attempted. Authenticated production provenance remains unresolved; if deployment of the already-validated reliability artifact is later authorized, it must be a separate operation followed by separate GET-only verification.
- Exact follow-up: restore authenticated Wrangler/Cloudflare provenance, bind the active Worker to the exact validated source artifact, deploy only if separately authorized and still required, then repeat all six GET checks plus filtered run/trade probes and observe a natural weekday swing run without subrequest exhaustion.

## Validation receipt

- Focused tests: **98 passed, 0 failed, 427 assertions across 9 files** (`/workspace/alpaca_control_51_filter_focused.txt`).
- Full `bun test`: **184 passed, 0 failed, 678 assertions across 26 files** (`/workspace/alpaca_control_51_filter_full.txt`).
- `bun run typecheck`: **passed** (`/workspace/alpaca_control_51_filter_typecheck.txt`).
- `git diff --check`: **passed** (`/workspace/alpaca_control_51_filter_diff_check.txt`).
- Final separate GET-only live verification: all six required endpoints returned HTTP 200; live remained health `1.0.0`, config `2.4.0`, positions `source=alpaca`/29 rows, caps `5000/3700/2000`, crypto cadence near `:07/:37`, reconciliation `MAINTENANCE_ONLY`, swing run `3182` with eight subrequest-limit errors, missing candidate/alias fields, ignored run code/search filters, ignored trade status filter, repeated trade pages, and null exact per-fill accounting.
- Wrangler authentication/provenance: unresolved; exact blocker is `You are not authenticated. Please run \`wrangler login\`.` No production mutation or deployment was performed.

## Acceptance criteria

Production cannot be labeled healthy until canonical release identity, broker-authoritative positions, unambiguous equity-direction semantics, all four schedule identities and fresh delivery, structured lease/error/skip observability, crypto cadence, lifecycle/accounting fields, unchanged caps, filtered run observability, stable trade pagination, live crypto fee/raw-edge gate behavior, and a post-release swing run without subrequest exhaustion are independently evidenced.

# CORRECTION WORK ITEM: Control-49

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - live release drift and unresolved production regressions**.

## Trigger and read-only evidence

This control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`; no trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was called.

- All six endpoints returned HTTP 200.
- Live release identity is unresolved: `/health` reports `1.0.0`, `/api/config.config.version` reports `2.4.0`, while the reviewed local deployable tree is release `2.6.0` at HEAD `e805da1`.
- `/api/positions` is available and explicitly broker-authoritative: `positionsAvailable=true`, `source=alpaca`, 29 rows.
- Dashboard equity arithmetic is directionally consistent: equity `98504.5`, last equity `98504.5039`, latest snapshot `total_pl=-0.0039` approximately; observed history is not a clean positive-direction proof.
- Configured cap values remain exactly daytrading `$5000`, swing `$3700`, and crypto `$2000`.
- Daytrading delivery is fresh with explicit `MARKET_CLOSED` skips; reconciliation is fresh at approximately ten-minute cadence with `MAINTENANCE_ONLY`; crypto runs repeatedly arrive near `:07/:37` UTC at approximately thirty-minute cadence.
- A fresh swing run at `2026-08-23 22:01:16 UTC` (`id=3182`) ended `status=error`, `errors=8`, including `Too many subrequests by single Worker invocation` and accepted/nonterminal exits.
- No current `LEASE_HELD` row was visible in the returned history; lease-held behavior is therefore not currently verifiable from this page.
- Trade lifecycle fields are present and filled/accepted quantity invariants hold in samples, but the latest DUK row has a `created_at` later than its submitted/broker-updated timestamps and requires follow-up.
- Sampled filled and accepted trades expose `gross`, `fee`, and `net` as null with `accounting_status=unavailable_fill_lot_exact`; exact per-fill consistency cannot be established conservatively.
- Live run responses omit locally implemented `trigger_alias`, `analyzed_candidates`, and `filtered_candidates`; trade pagination probes repeat the same IDs across offsets/pages.

## Correction assessment

Repository review confirms the relevant reliability-only corrections already exist locally:

- swing duplicate ledger/order reconciliation was removed and swing exits use `waitForFill:false` with deferred bounded reconciliation;
- filtered run candidate fields and trigger aliases are implemented and regression-tested;
- trade pagination is implemented and regression-tested;
- broker-authoritative position projection and failure behavior are implemented and regression-tested;
- crypto fee telemetry and calibrated `rawEdgeBps` gating fail closed without confidence-derived edge inference;
- caps remain `5000/3700/2000`, and all four schedules remain unchanged.

No second runtime change is justified. The observed production defects are release/source drift and lack of deployment proof, not an unisolated local defect. Production must remain **OPEN FAIL/DEGRADED** until the tested artifact is bound to the active Worker and separately verified.

## Validation and deployment state

- Local focused and full regression suites, typecheck, and diff-check are required for this control and must be recorded after the documentation update.
- A deployment attempt is required only for the reliability correction under the standing maintenance rule and only if the exact tested artifact can be uploaded without changing caps, schedules, or trading behavior.
- The repository-local Wrangler path must be checked before declaring credentials blocked. If unavailable or unauthenticated, record the exact command output and do not mutate production.
- If deployment succeeds, capture the exact commit, Cloudflare deployment/version identity, schedule set, and immediately perform a separate GET-only verification of all six endpoints plus filtered run/trade pagination probes.
- If deployment is blocked, leave authenticated Wrangler/Cloudflare access, provenance binding, authorized deployment, post-release GET verification, and the next natural swing run as explicit follow-ups.

## Acceptance criteria

Production cannot be labeled healthy until all of the following are independently evidenced: one canonical release identity; broker-authoritative positions; correct equity direction semantics; all four schedule identities and fresh delivery; structured lease/error/skip observability; crypto `:07/:37` cadence; lifecycle fields with conservative accounting; unchanged caps; filtered run observability; stable trade pagination; live crypto fee/edge-gate wiring; and a post-release swing run without the prior subrequest exhaustion.

## Final validation and separate live verification

- Focused regression: **73 tests passed, 0 failed, 346 assertions** (`/workspace/alpaca_control_49_focused.txt`).
- Full regression: **184 tests passed, 0 failed, 666 assertions across 26 files** (`/workspace/alpaca_control_49_full_retry.txt`).
- Typecheck passed (`/workspace/alpaca_control_49_typecheck_retry.txt`); `git diff --check` passed.
- Repository-local Wrangler dry-run completed successfully, but authenticated identity is unavailable: `You are not authenticated. Please run wrangler login.` No upload, preview, deployment, migration, or broker mutation occurred.
- Separate fresh GET-only verification reconfirmed `/health`, `/api/config`, and `/api/positions` plus read-only filter probes. Live remains health `1.0.0`, config `2.4.0`, broker position source `alpaca`, caps `5000/3700/2000`, crypto runs near `:07/:37`, reconciliation every approximately ten minutes, missing live filtered candidate fields, repeated/legacy pagination behavior in prior probes, and null exact per-fill `gross`/`fee`/`net`.
- Production remains **OPEN FAIL/DEGRADED**. Required follow-up is authenticated Wrangler/Cloudflare provenance, deployment of the exact validated `2.6.0` artifact only if separately authorized and still required, then a separate GET-only post-release verification and natural post-release swing run proving no subrequest exhaustion.

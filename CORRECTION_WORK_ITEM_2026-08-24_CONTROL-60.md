# CORRECTION WORK ITEM: Control-60

Date: Monday, August 24, 2026. Read-only live verification captured through approximately 08:07 UTC. Disposition: **LOCAL FIX COMPLETE / LIVE OPEN FAIL-DEGRADED**.

## Safety boundary

The live review used GET-only requests. No trading trigger, reconciliation trigger, order submission, close, cancel, replace, retry, migration, deployment, or other broker mutation was performed. No capital cap, confidence threshold, max-trade limit, universe, schedule, sizing, signal, edge-gate, or order-semantics parameter was changed.

## Local reliability corrections

The following targeted, non-vital defects were corrected:

1. Ambiguous crypto submit failures now retain the reservation fail-closed. Only a conclusive 4xx rejection releases it; transport failures, timeouts, 408/409/429, and 5xx failures remain committed for later read-only reconciliation.
2. Crypto BUY admission now checks the deterministic client order ID before reservation/submission. Non-terminal rows and terminal rows with any broker-confirmed `filled_qty > 0` block duplicate retries; terminal zero-fill rejection rows remain retryable.
3. Terminal crypto partial fills retain their reservation instead of releasing all protection. This prevents a canceled/expired partial BUY from being retried as a duplicate full order.
4. Expired active reservation cleanup is now bounded and runs from the read-only reconciliation path. It deletes only active, expired rows with no linked local trade/order; committed and linked/unknown rows remain durable.
5. D1 position closure no longer records broker `unrealized_pl` or literal zero as realized `closed_pl`. Until deterministic fill/lot matching exists, unavailable realized P&L is stored as `NULL` while the close reason is preserved.

## Local validation

- Focused reliability suite: **85 passed / 272 assertions** across 8 files.
- Full suite: **197 passed / 738 assertions** across 26 files.
- TypeScript: `bun run typecheck` passed.
- Formatting: `git diff --check` passed.
- Vital-parameter scan: caps remain daytrading `5000`, swing `3700`, crypto `2000`; local four cron expressions remain unchanged.

## Live GET-only verification

All required endpoints remained reachable, but production is not release-verifiable:

- `/health`: HTTP 200, version `1.0.0`.
- `/api/config`: HTTP 200, version `2.4.0`, caps `5000/3700/2000`, crypto minimum edge after costs `8`.
- `/api/positions`: HTTP 200, `positionsAvailable=true`, `source=alpaca`, 29 broker-sourced rows.
- `/api/runs`: current maintenance run `3264` is `MAINTENANCE_ONLY`; crypto run `3263` is fail-closed with `FEE_DATA_UNAVAILABLE` and `NO_POSITION_TO_EXIT` skips. Reconciliation remains near ten-minute cadence and crypto near `:07/:37`.
- `/api/trades`: current leading rows include accepted/new and filled lifecycle states. Filled samples retain `gross=null`, `fee=null`, `net=null` under `unavailable_fill_lot_exact` / `none-recorded`.
- `/api/reservations`: HTTP 404, so live reservation rows and cleanup state cannot be independently inspected.

The deployable local release is `2.6.0` at the current branch tip, while live health/config identify `1.0.0/2.4.0`. Live trade status filters and offset/page pagination remain stale or ignored; account and snapshot reads are not synchronized; aggregate crypto accounting remains arithmetically consistent but fee telemetry is stale relative to current runs; and the latest swing evidence remains the prior subrequest-limit failure. These are deployment/provenance and observability blockers, not grounds to weaken local safeguards.

## Deployment state and follow-up

Deployment was not attempted. Wrangler remains unauthenticated with `You are not authenticated. Please run \`wrangler login\`.` The validated local fixes require an authenticated, clean immutable deployment followed immediately by separate GET-only verification. The live minimum-notional check is source-level and pure-helper verified; a full crypto-cycle integration test proving zero `submitOrder` calls below $10 remains a follow-up, not a reason to submit a probe order.

No vital parameter decision is requested from Joachim for this correction. Any future change to caps, thresholds, max trade limits, universe, schedules, sizing, or strategy behavior remains an explicit Joachim decision.

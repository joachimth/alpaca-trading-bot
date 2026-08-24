# CORRECTION WORK ITEM: Control-48

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED - fresh swing subrequest-limit failure**.

## Trigger and live evidence

Separate GET-only recheck captured at `2026-08-23T22:03:17Z`. All six required endpoints returned HTTP 200. The recheck exposed a fresh production failure in the latest dedicated swing run:

- Run `3182`, `swing_cron`, `2026-08-23 22:01:16 UTC`, ended `status=error`, `errors=8`, `decisions_made=24`, `trades_executed=0`.
- Error details include two accepted but not fully filled swing exits, multiple `Swing sell failed ... Too many subrequests by single Worker invocation`, and `Fatal: Too many subrequests by single Worker invocation`.
- The run also recorded broker-authoritative cleanup for two stale D1-only swing rows (`UAL`, `SEDG`) and held/no-score protections. This confirms the failure is not a stale-history-only issue.

The same recheck still shows live release drift (`health=1.0.0`, config `2.4.0`, local `2.6.0`), live filtered-run fields absent, exact per-fill `gross/fee/net` unavailable, and Wrangler unauthenticated. Caps remain `5000/3700/2000`; no mutating endpoint was used.

## Required correction scope

1. Trace the swing cycle's subrequest fan-out and identify the smallest reliability-only containment that prevents a Worker invocation from exceeding Cloudflare's subrequest budget.
2. Preserve broker-authoritative positions, all four schedules, leases, risk gates, capital caps, order semantics, and trading behavior except for necessary fail-safe suppression/bounding when the request budget is at risk.
3. Add focused regression coverage for bounded swing broker calls and explicit structured degradation/error observability; run the full suite, typecheck, diff/secret checks, and a separate GET-only live verification.
4. Update `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and `/workspace/NOW.md` with the exact defect, validation, deployment state, and follow-up.

## Deployment decision and follow-up

Deployment is not attempted from the current dirty, unauthenticated workspace. If a reliability-only fix later qualifies under the standing maintenance rule and deployment becomes possible, preserve caps `5000/3700/2000`, capture the release receipt/source binding, and perform separate GET-only verification. Until then production remains **OPEN FAIL/DEGRADED**.

## Correction completed locally

Root cause was confirmed: the swing invocation duplicated the heavy ledger/order reconciliation already owned by `reconcile_cron`, then each swing exit performed a DELETE followed by synchronous `getOrder` polling. Multiple accepted/nonterminal exits could therefore exhaust the Worker subrequest budget.

Local reliability fix:

- removed duplicated swing-lane `syncBrokerLedger` and `reconcileBrokerOrders` calls; the dedicated bounded maintenance schedule remains authoritative for read-only reconciliation;
- added structured `RECONCILIATION_DEFERRED_TO_MAINTENANCE` observability;
- added an opt-out `waitForFill:false` close-position mode used only by swing exits, so accepted/partial exits are persisted and confirmed by later bounded reconciliation;
- added `EXIT_PENDING_RECONCILIATION` structured skip details for nonterminal exits;
- preserved normal order submission, broker-authoritative position sync, all four schedules, risk controls, sizing, and caps `5000/3700/2000`.

Focused validation and full validation are being rerun after this correction. Deployment remains blocked by unauthenticated Wrangler access, so no deploy or preview is used. A separate GET-only production recheck is required and must not be interpreted as proof of deployment until live release provenance is bound.

## Final validation and deployment outcome

- Focused regression: **34 tests passed, 0 failed, 109 assertions** (`/workspace/alpaca_control_48_focused.txt`).
- Full regression: **184 tests passed, 0 failed, 666 assertions across 26 files** (`/workspace/alpaca_control_48_full.txt`).
- Typecheck passed (`/workspace/alpaca_control_48_typecheck.txt`); `git diff --check` passed (`/workspace/alpaca_control_48_diff_check.txt`); scoped source/config secret scan passed (`/workspace/alpaca_control_48_secret_scan.txt`).
- One normal deployment attempt was made under the standing maintenance rule and stopped before upload. Exact blocker: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` `wrangler whoami` also reports `You are not authenticated. Please run wrangler login.` No deployment, preview, or broker mutation occurred.
- Separate post-attempt GET-only verification at `2026-08-23T22:13:14Z` returned HTTP 200 for all six endpoints and all read-only probes. Live still reports health `1.0.0`, config `2.4.0`, no `release_version`, positions `source=alpaca`/available with 29 rows, caps `5000/3700/2000`, fresh crypto at `22:07:57`, and reconciliation `MAINTENANCE_ONLY` at `22:10:47`.
- Live still exposes the pre-correction swing run `3182` with 8 subrequest-limit errors, repeated trade IDs across offset/page probes, and missing filtered-run fields; local correction remains **not live-proven**. Keep production **OPEN FAIL/DEGRADED** until authenticated provenance, deployment, and a separate post-release GET-only verification succeed.

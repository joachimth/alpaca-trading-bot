# Alpaca Control-10 correction work item

Date: 2026-08-22 (Saturday)
Disposition: strict read-only production control recorded; FAIL/DEGRADED; deployment blocked

## Control result

- All live verification endpoints were **GET-only**. No deployment, trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating endpoint was called.
- Live release identity remains drifted: `/health` reports **1.0.0**, `/api/config` reports **2.4.0**, while the repository deployable source is **2.6.0**. `/workspace/src` is stale reference material, not the deployable source.
- Fresh `/api/runs` evidence includes crypto and reconciliation skips. Crypto delivery is approximately **:08/:38** rather than the configured minute boundary. Saturday provides no fresh weekday daytrading or swing proof.
- Positions remain broker-authoritative with `source=alpaca`. Dashboard equity direction is slightly down: approximately **98,504.50** versus `last_equity` **98,504.5039**.
- Capital caps are unchanged: **$5,000 daytrading / $3,700 swing / $2,000 crypto**. Local source retains all four schedules and correct fail-closed crypto edge-gate wiring; trading behavior was not altered.
- Filtered `/api/runs` observability works. `/api/trades` exposes lifecycle fields, but sampled `gross`, `fee`, and `net` remain null under `accounting_status=unavailable_fill_lot_exact`.
- Provider run errors were recorded at **12:00:46, 12:07:40, and 12:10:40 UTC**, each associated with a live provider HTTP 503; historical live runs also exposed D1 variable overflow and Worker subrequest exhaustion.
- A local reliability correction now makes `GET /api/trades` honor `offset` and `page`, return pagination metadata, and use deterministic `timestamp DESC, id DESC` ordering. Focused regression coverage was added without changing order behavior.
- The live `estimated_value` differences are expected: source records an order-time estimate, while realized fill fields are separate; exact gross/fee/net remains intentionally unavailable until deterministic fill-lot accounting is proven.
- Current reconciliation, activity, bars, and fee paths remain explicitly bounded; historical resource-budget errors still require post-deployment natural-cycle verification.
- Final focused validation passed **69 tests / 282 assertions** across pagination, lifecycle, accounting, broker authority, caps, edge gates, schedules, and release checks. Full `bun test` passed **164 tests / 562 assertions**; `bunx tsc --noEmit`, `git diff --check`, and Wrangler dry-run passed with a **282.79 KiB** upload preview.
- Separate final GET-only live verification still reports `/health` **1.0.0**, `/api/config` persisted `config.version`` **2.4.0** with no live `release_version`, and `/api/trades?limit=30&offset=30` still returns only `limit` and `trades`, proving the correction is not deployed.

## Blocker and follow-up

The exact deployment blocker is Wrangler's unauthenticated response: **`You are not authenticated`**. Restore Wrangler authentication, then—only if authorized—deploy the exact validated repository artifact. After that, perform a separate GET-only verification and wait for natural weekday daytrading and swing checks. Keep production marked FAIL/DEGRADED until release identity and those checks are proven.

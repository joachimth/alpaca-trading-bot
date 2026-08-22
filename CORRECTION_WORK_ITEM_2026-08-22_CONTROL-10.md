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

## Control-11 refresh and final disposition, approximately 17:00 UTC

- The six required live endpoints again returned HTTP 200 through GET-only access. `/api/positions` remains `positionsAvailable=true`, `source=alpaca`, with 29 broker rows; dashboard equity is `98,504.50` versus `last_equity=98,504.5039`, a rounding-level `-0.0039` delta.
- Live `/health=1.0.0` and `/api/config` persisted version `2.4.0` remain inconsistent with local deployable `2.6.0`. Live `/api/trades` still lacks the local pagination and estimate-vs-fill fields, confirming the correction is not deployed or live-proven.
- Reconciliation remains fresh with `MAINTENANCE_ONLY` skips near ten-minute cadence. Crypto runs are present at `16:07:57` and `16:37:58`, around the expected `:07/:37` cadence with one-minute jitter. No fresh daytrading or swing run is evidenced in the Saturday page.
- Sampled filled trades retain lifecycle/order/fill timestamps, but exact `gross`, `fee`, and `net` remain null under `unavailable_fill_lot_exact`; aggregate dashboard gross/fee/net arithmetic is not fill-lot proof. Caps remain `$5,000/$3,700/$2,000`.
- Local source preserves four schedules, broker authority, filtered run observability, and fail-closed crypto fee/calibrated-edge gates. No code change beyond the already validated reliability correction was required.
- Final disposition: **LOCAL READY; PRODUCTION DEGRADED/BLOCKED, NOT DEPLOYED OR LIVE-VERIFIED**. Focused validation passed 42 tests / 204 assertions; full `bun test` passed 164 tests / 562 assertions; TypeScript and diff-check passed. Wrangler remains blocked by `You are not authenticated`.
- Follow-up: restore authenticated Cloudflare access, deploy only the exact validated commit under separate authorization, perform the required GET-only checks, observe natural weekday daytrading/swing delivery, and roll back to the last known-good authenticated deployment if any acceptance check fails.

## Control-12 refresh, approximately 18:00 UTC

- Strict GET-only verification again returned HTTP 200 for all six required endpoints. No trigger, submit, cancel, close, replace, retry, migration, or broker-mutating endpoint was used.
- Live `/health` remains `1.0.0` and `/api/config` remains persisted `2.4.0` without live `release_version`, while the checked-in deployable source is `2.6.0`; live `/api/trades` still returns the old pagination/enrichment shape. The validated correction is therefore not live-proven.
- `/api/positions` remains broker-authoritative with `positionsAvailable=true`, `source=alpaca`, and 29 rows. Dashboard equity is `98,504.50` versus `last_equity=98,504.5039`, a `-0.0039` delta.
- Fresh reconciliation skips continue at approximately ten-minute intervals, and crypto skips continue around `:07/:37` UTC, observed at `17:07:58` and `17:37:57`. The Saturday run windows do not provide fresh weekday daytrading or swing proof; historical provider 503 and lease/error skips remain open.
- Caps remain `$5,000/$3,700/$2,000`. Local four-schedule, filtered-run alias, broker-authority, lifecycle, accounting, and fail-closed crypto edge-gate regressions remain green, with no trading behavior or vital risk parameter changes.
- The local correction remains validated on commit `b229eb3255097d5c6c13684a351ed2d867731021`; deployment is blocked by Wrangler `You are not authenticated`.

## Blocker and follow-up

The exact deployment blocker is Wrangler's unauthenticated response: **`You are not authenticated`**. Restore Wrangler authentication, then—only if authorized—deploy the exact validated repository artifact. After that, perform a separate GET-only verification and wait for natural weekday daytrading and swing checks. Keep production marked FAIL/DEGRADED until release identity and those checks are proven.

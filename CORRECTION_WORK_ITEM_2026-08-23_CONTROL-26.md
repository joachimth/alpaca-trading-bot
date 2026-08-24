# CORRECTION WORK ITEM: Control-26

Date: Sunday, August 23, 2026. Disposition: **OPEN FAIL/DEGRADED**, local correction present and validated, production release remains stale/unproven.

## Strict read-only control

The control used only GET requests against `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`, plus GET-only run-filter probes. No trigger, submit, cancel, close, replace, retry, migration, preview, deployment, or broker-mutating endpoint was used.

## Confirmed production gaps

- All six required live endpoints were reachable and returned HTTP 200.
- Live identity is stale/unresolved: `/health` reports `1.0.0` and `/api/config.version` reports `2.4.0`, while the checked-out validated source is version `2.6.0` at commit `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`.
- `/api/positions` is broker-authoritative and available: `positionsAvailable=true`, `source=alpaca`, 29 rows. The dashboard reports equity `98504.50` versus `last_equity=98504.5039`, with `change_today=0`; material current-day equity direction is therefore not independently verifiable.
- Live caps remain unchanged at daytrading `$5000`, swing `$3700`, and crypto `$2000`.
- The checked-out `wrangler.toml` declares the four UTC schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`. Live schedule identity is not exposed and cannot be proven against the active Worker.
- Reconciliation is fresh through `run 2936` at `2026-08-23 04:50:49 UTC`, structured as `MAINTENANCE_ONLY`. Crypto runs are fresh at `04:37:55` and `04:07:55 UTC`, matching the expected `:07/:37` cadence with structured no-position skips. Sunday has no expected weekday daytrading or swing cron delivery, so fresh delivery for those schedules is not proven by this control window.
- Historical `/api/runs?status=error` records remain visible, including Alpaca 503 failures on August 22 and earlier D1/Worker resource-limit failures. Lease-held and risk/error skips remain auditable in historical filtered runs.
- The live old release does not expose the locally corrected filtered `trigger_alias` or durable `analyzed_candidates`/`filtered_candidates` fields. Live `/api/trades` pagination remains unproven/corrupt on the old release, with prior read-only probes repeating IDs `642..613` at offsets `0`, `30`, and `60`.
- Filled trade rows expose broker/client identifiers, quantities, status, TIF, and submitted/filled timestamps, but sampled exact fill-lot accounting remains conservatively unavailable: `gross`, `fee`, and `net` are null with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. The AMZN `estimated_value` difference is not independently a defect: local code/tests define it as an order-time estimate, separate from realized `filled_notional`; the old live release does not expose the corrected enrichment fields, so production accounting remains unresolved rather than falsely reconciled.
- The named `alpaca-worker-bundle-crypto-edge-fix` artifact is stale: its generation README predates Controls 23 and 25 and the bundle does not contain `prepareCryptoRiskDecision`, `trigger_alias`, or durable candidate-count wiring. It cannot prove that the corrected crypto edge gate or filtered-run observability was released.

## Bounded correction status

The current source tree already contains the necessary reliability/observability corrections:

- explicit finite calibrated `rawEdgeBps` propagation into crypto risk with missing/invalid edge fail-closed;
- durable run candidate counters, including the insufficient-TA early return;
- filtered-run alias serialization;
- corrected trade offset pagination;
- broker-authoritative position failure handling; and
- isolated leases and conservative fee semantics.

No additional source, capital, schedule, sizing, threshold, broker-authority, lease, accounting, or trading-behavior change is justified by this control.

## Validation and deployment

Local validation completed before deployment attempt:

```text
focused: 64 passed, 0 failed, 302 assertions across 7 files
full: 172 passed, 0 failed, 597 assertions across 25 files
bunx tsc --noEmit: passed
git diff --check: passed
bunx wrangler deploy --dry-run: passed; 286.54 KiB upload, 64.85 KiB gzip; no deployment
```

Evidence logs are stored at `/workspace/alpaca-control-26-focused-tests.log`, `/workspace/alpaca-control-26-full-tests.log`, `/workspace/alpaca-control-26-typecheck.log`, and `/workspace/alpaca-control-26-diff-check.log`.

The standing maintenance rule permits deployment of this reliability-only correction because caps and trading behavior are unchanged. A normal deployment attempt is authorized and required to prove the corrected release, but deployment cannot proceed until Wrangler authentication is restored. The exact blocker is: `You are not authenticated. Please run wrangler login.` / non-interactive Wrangler requires `CLOUDFLARE_API_TOKEN`.

A normal deployment attempt was made after validation and stopped before mutation because Wrangler reported: `In a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN environment variable for wrangler to work.` The equivalent authenticated check remains: `You are not authenticated. Please run wrangler login.` No deployment, preview, or Cloudflare receipt was produced.

Separate final GET-only verification after the blocked attempt captured `/workspace/alpaca-control-26-live-final/`: live health remains `1.0.0`, config `2.4.0`, positions remain `source=alpaca` with 29 rows, caps remain `5000/3700/2000`, reconciliation reached run `2937` at `2026-08-23 05:00:53 UTC` as `MAINTENANCE_ONLY`, and crypto remained fresh near `:07/:37`. Daytrading remains stale at run `2556` from August 20 with `CYCLE_LEASE_HELD`; swing remains stale at run `2200` from August 18 with divergence and `RISK_HALTED`. The final live sample still has null `gross`/`fee`/`net`, and no live proof of corrected edge wiring, aliases, candidate counters, or pagination exists.

After authentication, deploy only the validated `2.6.0` artifact, record the Cloudflare deployment/version receipt, traffic and four schedules, then perform a separate GET-only live verification. Do not use trigger, order, close, cancel, replace, retry, migration, or temporary-preview paths as smoke tests.

## Final disposition

Production remains **OPEN FAIL/DEGRADED, not healthy**. Local correction work is complete and all local validation gates pass, but active source identity, corrected edge-gate wiring, filtered observability, pagination, and fresh weekday strategy delivery remain unproven in production until the authenticated deployment and separate read-only verification succeed.

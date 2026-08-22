# Correction work item: Control-15 strict read-only production control

- Date: August 22, 2026
- Control capture: 2026-08-22 20:00:26-20:00:28 UTC
- Status: **OPEN - FAIL/DEGRADED**
- Scope: read-only production evidence, release identity, and deployment follow-up
- Repository: `alpaca-trading-bot`
- Branch: `fix/remove-premature-position-upsert-entryside`
- HEAD: `4a3dd9a3bb1f940fe46017a666c8e73b2ee93130`
- Local deployable version: `2.6.0`

## Live GET-only findings

All six required endpoints returned HTTP 200 through GET-only requests: `/health`, `/api/config`, `/api/dashboard`, `/api/positions`, `/api/runs`, and `/api/trades`.

- **Release identity: FAIL/CANNOT VERIFY.** Live `/health` reports `1.0.0` and persisted `/api/config.version` reports `2.4.0`, while the checked-out deployable source is `2.6.0`. The active Worker/source identity and deployment provenance remain unresolved.
- **Positions: PASS for current broker availability.** `/api/positions` reports `positionsAvailable=true`, `source=alpaca`, and 29 rows. Local source remains broker-first and does not fall back to D1 current-position state on broker failure.
- **Equity direction: CANNOT VERIFY materially.** Dashboard equity is `98,504.50`, `last_equity=98,504.5039`, so current-minus-last is `-0.0039`; `change_today=0` and daily P/L fields are zero. This is a rounding-level snapshot delta, not independent proof of daily direction.
- **Caps: PASS in live config.** `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`; no vital risk parameter was changed.
- **Schedules: PASS in checked-out source, live identity unresolved.** The four UTC expressions are daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and read-only reconciliation `*/10 * * * *`. Saturday does not provide fresh weekday daytrading or swing delivery proof.
- **Run delivery: PARTIAL/DEGRADED.** Reconciliation is fresh and structured as `MAINTENANCE_ONLY` near the ten-minute cadence, including run `2864` at `19:50:52`. Crypto is fresh around the expected `:07/:37` cadence, including `19:07:57` and `19:37:57`, with minute-level timing jitter. Lease-held and error skips remain auditable; a reconciliation Alpaca 503 is recorded at `12:10:40`, with earlier SQL-variable and subrequest failures in the retained history.
- **Filtered run observability: LOCAL PASS, LIVE PROVENANCE GAP.** Canonical and compatibility-filter requests return constrained rows, but the live old response omits the locally validated response-only `trigger_alias` field. Historical filtered artifacts cannot establish the active Worker identity.
- **Trade/fill lifecycle: PARTIAL PASS.** Sampled filled rows expose broker order identity, status, quantities, fill price, submission/fill/reconciliation/terminal timestamps, and lifecycle fields. Exact per-fill lot accounting is not proven: sampled rows retain `gross=null`, `fee=null`, `net=null`, `accounting_status=unavailable_fill_lot_exact`, and `fee_attribution=none-recorded`. This is conservative behavior, not fabricated precision.
- **Crypto edge gate: LOCAL PASS, LIVE POSITIVE-EDGE UNVERIFIED.** Local source requires fee telemetry and calibrated `rawEdgeBps`, failing BUY admission closed when either is unavailable or edge is insufficient. Live crypto output shows `FEE_DATA_UNAVAILABLE` skips, but no live positive-edge producer/branch evidence is available.

## Correction decision

No new code defect was isolated. The narrow safe correction is documentation/status synchronization only. Do not alter schedules, caps, thresholds, sizing, TIF, edge gates, broker authority, leases, trading behavior, or mutation boundaries. Do not treat Saturday's missing weekday runs as a strategy failure; classify them as unverified until the next natural weekday windows.

## Validation

- Existing Control-14 focused regression: **54 passed, 0 failed, 263 assertions**.
- Existing Control-14 full regression: **168 passed, 0 failed, 584 assertions**.
- Existing Control-14 TypeScript check: `bun run typecheck` passed.
- Current Control-15 focused rerun: **54 passed, 0 failed, 263 assertions** (`/workspace/alpaca-control-15-focused.txt`).
- Current Control-15 full rerun: **168 passed, 0 failed, 584 assertions** (`/workspace/alpaca-control-15-full.txt`).
- Current Control-15 TypeScript check: `bun run typecheck` passed (`/workspace/alpaca-control-15-typecheck.txt`).
- Current Control-15 documentation/whitespace check: passed (`/workspace/alpaca-control-15-doc-check-final.txt`).

## Deployment blocker and follow-up

`bunx wrangler whoami` returned the exact blocker **`You are not authenticated`**. No deployment, temporary preview, trigger, submit, cancel, close, replace, retry, migration, or other broker-mutating endpoint was used.

After authenticated access is restored and separate deployment authorization is obtained, inspect deployment provenance before choosing any artifact. If deployment is authorized, deploy only the validated source, record the receipt, and perform a separate GET-only acceptance pass covering release identity, all six endpoints, canonical/alias run filters, broker source, equity direction, all four schedules, caps, natural weekday daytrading/swing delivery, crypto `:07/:37` cadence, lease/error skips, lifecycle fields, conservative gross/fee/net semantics, and crypto edge-gate evidence. If acceptance fails, roll back to the last known-good authenticated deployment and repeat the same read-only checks.

# Correction work item: Control-84 strict read-only production control

Date: 2026-08-25
Disposition: **OPEN FAIL/DEGRADED**

## Scope and safety boundary

This was a strict read-only production control for `https://alpaca-trading-bot.joachim-763.workers.dev`. Only GET requests were used against the six approved endpoints and same-endpoint filter/pagination probes. No trigger, submit, cancel, close, replace, retry, migration, deployment, external write, or broker-mutating endpoint was called. Caps, schedules, thresholds, sizing, fee freshness, edge policy, order semantics, and trading behavior were preserved.

## Exact local source identity

- Repository: `/workspace/alpaca-trading-bot`
- Branch: `fix/remove-premature-position-upsert-entryside`
- Historical runtime source recorded at Control-85 start: `786be98c5be32f1b5cdfd46dfbcb033a9f3ca44f`
- Current Control-86 checkout: branch `fix/remove-premature-position-upsert-entryside`, HEAD `9f09b145d922597d1e0b7c80bb827a768c147706`
- Last code-changing runtime commit identified in history: `20d80ac87e08271fb0d9c1c7ea1027b72eebd48d`
- Release: `2.6.0`
- Later commits are documentation/status records; live Worker identity remains unproven.

## Exact live evidence

Capture window: **2026-08-25 06:00:39-06:00:41 UTC**. All six approved endpoints returned HTTP 200.

- `/health`: `status=ok`, version `1.0.0`.
- `/api/config`: persisted config version `2.4.0`; caps `max_capital_usd=5000`, `swing_max_capital_usd=3700`, `crypto_max_capital_usd=2000`; `crypto_min_edge_after_costs=8`; no live `release_version` field.
- `/api/dashboard`: account equity `$98,441.41`, `last_equity=$98,504.5039`, delta `-$63.0939`; latest snapshot `$98,434.87` at `2026-08-25 05:38:13 UTC`; broker daily direction fields are zero. Strategy aggregates are crypto gross `-$56.616426`, fees `$269.11016882811`, net `-$325.72659482811`; swing gross/net `-$118.59362899999996`, no attributed fee; daytrading gross/net `-$20.104746`, no attributed fee.
- `/api/positions`: `positionsAvailable=true`, `source=alpaca`, 21 broker rows; captured market value totals `$8,989.034153`, all currently labeled swing; `updated_at` range `2026-08-24 19:56:25-19:56:30 UTC`.
- `/api/runs`: latest reconciliation 3447 at `05:51:11 UTC` is `MAINTENANCE_ONLY`; crypto 3445 at `05:38:19 UTC` is a structured fee/decision skip; reconciliation 3440 at `05:01:14 UTC` and crypto 3441 at `05:08:18 UTC` are also fresh; lease skips 3433-3435 are visible; swing 3409 at `2026-08-24 22:01:37 UTC` remains an error with Cloudflare subrequest exhaustion; current-day daytrading is market-closed before the session, with prior filled activity at `2026-08-24 19:16:22 UTC`.
- `/api/trades`: 47 filled and 3 accepted rows; accepted 701-703 have zero fills and remaining leaves quantity; filled rows expose broker update/fill timestamps; sampled gross/fee/net are null under `unavailable_fill_lot_exact`.

## Schedule, delivery, and observability findings

Local `wrangler.toml` contains the four schedules: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, reconciliation `*/10 * * * *`. Live crypto completions are around `:08/:38`, not exact `:07/:37`, and have a visible `00:38-04:38 UTC` gap. Reconciliation is fresh and lease/error skip reasons are structured. Swing delivery remains degraded by run 3409. Live status filters for trades, code/search/status filters for runs, and trade offset/page probes are ignored or return the first page; strategy and trigger filters narrow results. The live artifact therefore does not prove the local filtered observability implementation.

The local crypto edge path is fail-closed with `crypto_min_edge_after_costs=8`, required fresh fee telemetry, and required calibrated raw edge. The checked-out source never derives edge from confidence. Live crypto entries are held by unavailable/insufficient fee telemetry, but live computed edge is not exposed. Current swing exposure exceeds both the configured swing cap and global cap, and stale position timestamps leave live cap semantics and freshness unresolved.

## Correction decision and deployment status

Production stays **OPEN FAIL/DEGRADED**. No code correction or cap/trading-behavior change is justified while the Worker cannot be tied to the validated source. `bunx wrangler whoami` is blocked by the exact message: **`You are not authenticated. Please run \`wrangler login\`.`** No deployment was attempted. Required follow-up is secure Wrangler authentication, source-tied deployment authorization if still needed, then a separate GET-only post-release verification. Open risks remain swing subrequest exhaustion, exact crypto cadence, live filter/pagination behavior, cap/freshness semantics, and exact fill-lot accounting.

## Validation receipts

Control-84 was a historical documentation record. Its validation receipts are superseded by Control-86, which includes local reliability source/test corrections and final validation. No broker mutation or deployment occurred.

## Control-85 documentation correction addendum

- Control-85 identified and corrected the stale Control-84 source pin. The exact deployable runtime source remains HEAD `786be98c5be32f1b5cdfd46dfbcb033a9f3ca44f` on `fix/remove-premature-position-upsert-entryside`, release `2.6.0`; later control commits are documentation-only.
- Separate post-correction live GET verification at approximately `2026-08-25 07:10 UTC` again showed health `1.0.0`, config `2.4.0`, broker-authoritative positions `source=alpaca` with 21 rows, caps `5000/3700/2000`, 47 filled plus 3 accepted trades, and null per-fill gross/fee/net under `unavailable_fill_lot_exact`.
- Focused: **72 pass / 0 fail / 339 assertions** across 7 files, Bun `1.3.11`; full: **213 pass / 0 fail / 796 assertions** across 28 files, Bun `1.3.11`.
- `bun run typecheck`: exit 0; `git diff --check`: exit 0.
- Changed-file boundary before final commit: required docs, `/workspace/NOW.md`, and this correction receipt only; no source, runtime configuration, cap, schedule, migration, or trading-behavior file changed.
- No deployment or broker mutation occurred. Live status remains **OPEN FAIL/DEGRADED**. Wrangler remains blocked by `You are not authenticated. Please run \`wrangler login\`.`

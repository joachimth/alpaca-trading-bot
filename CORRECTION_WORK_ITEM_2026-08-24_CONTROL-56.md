# CORRECTION WORK ITEM: Control-56

Date: Monday, August 24, 2026. Evidence set: `/workspace/audit-2026-08-24` plus the Control-51 through Control-55 work items. Disposition: **OPEN FAIL/DEGRADED — strict read-only production control remains unresolved**.

## Scope and safety boundary

Control-56 is a documentation/status correction. The audit evidence was collected with strict GET-only observation of the six required production surfaces. This correction makes no runtime or configuration change. No trigger, submit, cancel, close, replace, retry, migration, deployment, or broker-mutating endpoint was used by this correction. Caps, schedules, sizing, thresholds, signals, order semantics, trading behavior, and broker authority are unchanged.

## Six required GET checks

The saved audit headers show HTTP 200 for each required GET check:

1. `GET /health` — HTTP 200; JSON reports `status=ok`, service `alpaca-trading-bot`, live version `1.0.0`.
2. `GET /api/config` — HTTP 200; JSON reports live config version `2.4.0` and the live risk/capital settings, including `max_capital_usd=5000`, `swing_max_capital_usd=3700`, and `crypto_max_capital_usd=2000`.
3. `GET /api/dashboard` — HTTP 200; account and snapshot data are present. Account equity is `98468.88`, `last_equity=98504.5039`, and the latest saved snapshot at `2026-08-24 04:37:50` has equity `98482.23`; both comparisons point down (`-35.6239` and `-22.2739` respectively), while `change_today=0` and `change_today_pct=0` do not provide an independent intraday direction.
4. `GET /api/positions` — HTTP 200; `positionsAvailable=true`, `source=alpaca`, and 29 rows. The available position set is broker-authoritative; no database fallback is treated as authoritative.
5. `GET /api/runs` — HTTP 200; run rows and structured skip/error details are returned. The saved response is the evidence for recurring crypto and reconciliation delivery, the stale daytrading freshness limitation, and the prior swing failure.
6. `GET /api/trades` — HTTP 200; trade rows include lifecycle and accounting fields. The saved response also preserves the live filter/pagination gaps described below.

HTTP 200 reachability does not clear the control. Release identity, behavior, freshness, observability, and provenance remain incomplete or contradictory.

## Current live evidence

### Swing reliability and broker-authoritative synchronization

The latest live swing run carried forward by the audit history is run **3182**, timestamped **2026-08-23 22:01:16**. It ended `status=error` with **8 errors**, including Cloudflare **`Too many subrequests by single Worker invocation`**. Its structured evidence also includes accepted/incomplete exits and **`BROKER_AUTHORITATIVE_SYNC_ABSENT`** / held-score synchronization evidence. This is a live reliability failure and an absence of proven broker-authoritative synchronization for that run, not a reason to invent a new runtime patch in this documentation control. The local bounded/deferred reconciliation correction is already present but is not live-proven.

### Crypto cadence and recurring fee skips

The local schedule remains `7-59/30 * * * *`, approximately **`:07/:37 UTC`**. The saved live runs show crypto delivery at `03:07:57`, `03:37:54`, `04:07:55`, and `04:37:56` UTC, with earlier `01:37:55` and `02:37:57` runs also present. Crypto repeatedly records structured **`FEE_DATA_UNAVAILABLE`** entry skips: for example run `3211` at `01:37:55` recorded three LINKUSD fee-telemetry skips, and run `3219` at `02:37:57` recorded three DOTUSD fee-telemetry skips. These are fail-closed risk skips with zero trades, not evidence for weakening the fee gate.

### Reconciliation cadence and daytrading freshness limitation

The local reconciliation schedule remains `*/10 * * * *`. Live reconciliation runs are present at approximately ten-minute cadence through run `3238` at `2026-08-24 05:00:52`; the runs are structured `MAINTENANCE_ONLY`, with bounded ledger context and no trading strategy execution. The local daytrading schedule remains `*/5 13-21 * * 1-5`, but the returned live window does not prove current-session daytrading freshness: the latest carried-forward daytrading row is run `3180` at `2026-08-23 21:55:47`, a structured `MARKET_CLOSED` skip. A market-closed row cannot establish current-session trading-lane freshness.

### Positions, equity direction, caps, and lifecycle

Positions remain explicitly `source=alpaca` with 29 rows. The live dashboard account and snapshot show equity below `last_equity=98504.5039` by the comparisons recorded above, so the available comparison evidence points downward. However, both daily change fields are zero; this makes intraday direction semantically limited and prevents a clean healthy-direction claim.

The unchanged capital caps are exactly **$5,000 daytrading (`max_capital_usd`), $3,700 swing (`swing_max_capital_usd`), and $2,000 crypto (`crypto_max_capital_usd`)**. The read-only surfaces do not prove every reservation or historical enforcement calculation, but no cap was changed.

Trade rows expose lifecycle fields including broker and client order IDs, submitted/broker-updated timestamps, filled quantity and fill price, `filled_at`, `canceled_at`, `expired_at`, `failed_at`, `replaced_at`, `leaves_qty`, and intent stop/take-profit prices. Accepted orders remain nonterminal where the broker has not filled or terminated them; filled rows retain fill timestamps and zero leaves quantity.

Sampled trade accounting is conservatively **`gross=null`, `fee=null`, `net=null`**, with `accounting_status=unavailable_fill_lot_exact` and `fee_attribution=none-recorded`. Exact per-fill lot gross/fee/net cannot be verified from this evidence and must not be fabricated. Dashboard aggregate fee arithmetic is a separate aggregate concern and does not establish exact per-fill attribution.

## Live observability and provenance gaps

The active live artifact still does not prove the local 2.6.0 observability contract:

- Live run rows omit locally implemented `trigger_alias`, `analyzed_candidates`, and `filtered_candidates` fields.
- Run `code` and `search` probes returned the unfiltered recent-run shape rather than enforcing the requested filters.
- Trade `status=filled` filtering was not honored; accepted trades remained in the response.
- Trade offset/page probes repeated the first-page IDs rather than proving stable pagination.
- Current lease-held delivery is not proven absent merely because no such row appeared in the returned window.
- The saved schedule/provenance evidence remains conflicted: local source retains four schedules, while an older live schedule artifact omitted reconciliation. Active Worker identity, source SHA, and complete deployed schedule binding are unresolved.
- Local fail-closed crypto fee/calibrated-edge wiring and reliability fixes are tested locally, but their deployment is not live-proven.

The local release is **2.6.0** at HEAD `e805da1a4d83a8fa816ebe09c500a57fed5c9c24`; live health/config remain **1.0.0 / 2.4.0**. This release skew alone prevents treating the local corrections as the active production artifact.

## Correction assessment

Exact current source evidence does not establish a missing reliability fix that should be added under Control-56. The repository already contains the relevant reliability-only work from Controls 51–55: broker-authoritative position projection, bounded/deferred reconciliation, separate lane leases, structured run observability, filtered run/trade handling, stable pagination, lifecycle preservation, conservative accounting, and fail-closed crypto fee/calibrated-edge gating. Control-56 therefore corrects the status record only and preserves all trading behavior.

Production remains **OPEN FAIL/DEGRADED**, not healthy. The live evidence is sufficient to record delivery and risk skips, but insufficient to claim release identity, complete schedule provenance, current daytrading freshness, post-correction swing reliability, live filter/pagination behavior, exact per-fill accounting, or live crypto gate deployment.

## Deployment blocker and safe follow-up

Deployment was not attempted. The exact Wrangler authentication blocker recorded by the preceding controls is:

> `You are not authenticated. Please run \`wrangler login\`.`

The worktree is dirty, so uncommitted files must not be deployed. Safe follow-up is:

1. Restore authenticated Wrangler access and establish reproducible active Worker/source provenance.
2. Reconcile the active schedule set against the local four-schedule declaration: daytrading `*/5 13-21 * * 1-5`, swing `0 22 * * 1-5`, crypto `7-59/30 * * * *`, and reconciliation `*/10 * * * *`.
3. Create a clean immutable artifact containing only separately reviewed and authorized changes; do not deploy a dirty worktree.
4. Obtain separate deployment authorization and deploy only if still required; do not use a preview deployment as a production correction.
5. Perform a separate GET-only post-release verification of all six checks, release identity, broker-authoritative positions, equity semantics, caps, all lanes, lease/error/skip evidence, filters/aliases/candidate fields, pagination, lifecycle/accounting, and crypto fee/calibrated-edge behavior.
6. Observe a legitimate weekday swing window and verify that run 3182-style subrequest exhaustion and broker-authoritative synchronization absence do not recur.

No deployment, migration, trigger, order action, or broker mutation is part of Control-56.

## Validation receipt

Validation is run after this documentation edit and saved under `/workspace`:

- Focused Alpaca/reliability regression tests: `/workspace/alpaca_control_56_focused.txt`.
- Full `bun test`: `/workspace/alpaca_control_56_full.txt`.
- `bun run typecheck`: `/workspace/alpaca_control_56_typecheck.txt`.
- `git diff --check`: `/workspace/alpaca_control_56_diff_check.txt`.

The exact pass/fail totals are reported with the completed correction.

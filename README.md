# Alpaca AI Trading Bot

Autonomous AI-assisted trading bot running on a Cloudflare Worker with D1 persistence, Alpaca paper trading, and a GitHub Pages dashboard.

## Live deployment and current worktree

The crypto-hardening release is deployed to the Alpaca paper-trading Worker. No manual trading trigger, order, cancellation, close, replace, retry, or broker mutation was used during validation.

- **Repository:** `joachimth/alpaca-trading-bot`
- **Worker:** `alpaca-trading-bot.joachim-763.workers.dev`
- **Dashboard:** `joachimth.github.io/alpaca-trading-bot/`
- **Release source:** commit `4261009` (`Bound dashboard reads and remove GET schema mutations`), including crypto hardening `8280696`
- **Last documented Worker version:** `d304d14c-c6ea-45ca-97ce-47fd6d350c33`, recorded at 100% traffic on August 10, 2026
- **Last documented deployment:** `24b7df43-a710-479a-96f8-46b879fc9171`
- **Account mode:** Alpaca paper trading
- **Source mapping note:** Cloudflare does not embed the Git SHA in the deployment artifact; the bundle-to-commit mapping is recorded by the release process.

The dashboard is a static GitHub Pages frontend. It calls the Cloudflare Worker API only. It never calls Alpaca directly and never contains Alpaca credentials.

### Dashboard read-only hotfix (August 10, 2026)

`GET` API paths construct `Database` in explicit `readOnly` mode. That mode skips all runtime schema-repair DDL, `ALTER TABLE`, index creation, and schema checks; trading and write paths retain the existing schema-readiness behavior. The Worker fetch path contains no unconditional `ALTER TABLE positions` repair. `/api/dashboard` also uses bounded 90-row chart/category windows and no longer issues duplicate per-strategy history queries. Alpaca remains authoritative for current positions: if the broker position request fails, the response reports `positionsAvailable: false` and does not substitute D1 positions.

Validation for the deployed release: 85 Bun tests passed with 257 assertions, TypeScript typecheck passed, `git diff --check` passed, and the Wrangler dry-run passed. The explicit reservations migration was applied and verified in remote D1; the direct Cloudflare upload was used because Wrangler deploy can be false-positive in this proxy environment.

Last documented live verification recorded deployment `24b7df43-a710-479a-96f8-46b879fc9171` serving version `d304d14c-c6ea-45ca-97ce-47fd6d350c33` at 100%; `/health`, `/api/dashboard`, `/api/trades`, `/api/runs`, `/api/positions`, and `/api/config` returned HTTP 200; dashboard history is bounded to 90 performance rows and 90 rows per category; all four schedules are unchanged. A later captured Cloudflare artifact reports deployment `5088dbe0-31f9-4892-a149-a74702bbad4e` and version `cb88271c-8712-42a8-88a9-de58c841d3ec` at 100%, but fresh revalidation was unavailable on August 10 because `CLOUDFLARE_API_TOKEN` was absent.

### Capital-cap release evidence

The earlier read-only capital-cap release remains the historical baseline for the current live cap values. The August 10, 2026 hardening release supersedes it with bounded dashboard reads, explicit read-only GET behavior, crypto lifecycle classification, and persistent reservations; the live `/api/dashboard` response still returns `capitalCaps.daytrading = 5000`, `capitalCaps.swing = 3700`, and `capitalCaps.crypto = 2000`.

## Architecture

```text
Alpaca API <---- server-side calls ---- Cloudflare Worker
                                         |
                                         +-- Trading cycles
                                         +-- REST API for dashboard
                                         +-- D1 decisions, trades, positions, snapshots

GitHub Pages dashboard ---- HTTPS REST calls ----> Worker API
```

### Source of truth for positions

Alpaca is authoritative for **current broker state**:

- symbol and side
- quantity
- average entry price
- current price
- market value
- unrealized P&L
- intraday P&L fields

D1 is authoritative only for application metadata and history:

- strategy ownership when it can be determined
- stop-loss and take-profit metadata
- timestamps and lifecycle history
- decisions, orders/trades, runs, snapshots, and realized P&L history

A D1-only row is not an open current position. The API projection emits only symbols currently present at Alpaca. A broker-present symbol without reliable D1 ownership is returned as `strategy: "unattributed"`, never silently assigned to daytrading.

If the Worker cannot fetch Alpaca positions, it does **not** fall back to D1 rows. The dashboard receives an unavailable state, and `/api/positions` returns HTTP 503 with an error payload.

- The August 10 hardening release includes the crypto correctness patch: protective exits run before discretionary halts, entries are limited to one per cycle by default, discretionary exits have a separate two-exit budget, pending entries reserve capital and position capacity, recent D1 orders provide persistent entry-rate protection, fee telemetry is scoped to the curated crypto universe and a seven-day window, reopened positions receive a fresh `opened_at`, and schema version correction is explicit. Historical realized P&L remains model/gross-style until fill-lot matching is implemented.

## Trading strategies and schedules

- **Daytrading:** every 5 minutes during the configured UTC window, `*/5 13-21 * * 1-5`; Alpaca's market clock remains authoritative.
- **Swing:** once daily after market close, `0 22 * * 1-5`.
- **Crypto:** every 30 minutes at approximately `:07` and `:37` UTC, `7-59/30 * * * *`; crypto is intentionally kept at this cadence pending telemetry.
- **Maintenance/reconciliation:** every 10 minutes, `*/10 * * * *`; read-only broker/order reconciliation under a separate maintenance lease, so it cannot block daytrading, swing, or crypto. Strategy leases are isolated and expire after 10 minutes for bounded recovery.

The strategies use explicit asset and strategy isolation. A strategy may use D1 ownership and risk metadata, but current broker quantity and valuation must come from Alpaca.

## Features

- Autonomous paper trading with separate daytrading, swing, and crypto paths
- Technical analysis: RSI, MACD, EMA, ATR, Stochastic, Bollinger Bands, ADX, and OBV
- Optional LLM refinement of technical signals
- Risk controls: account block checks, daily loss limits, position limits, sizing, stops, take-profits, trailing stops, cooldowns, order-rate limits, quantity-aware cost gates, and discretionary exit protection
- Fee-aware P&L: strategy tabs expose gross P&L, recorded attributable fees, and net P&L; CFEE is attributed only to crypto, while orderless/account-level fees remain explicitly unattributed
- Exit policy: only signal-driven discretionary SELL/CLOSE actions may be held when estimated costs consume a small positive gross gain; protective, EOD, and manual closes bypass that gate
- Swing edge policy: spread/slippage/fee costs are logged with explicit bps units; BUY rejection is disabled until a calibrated `expectedEdgeBps` is configured
- Universe scanner for liquid US equities
- D1 logging for decisions, trades, runs, snapshots, and position metadata
- GitHub Pages dashboard with bounded equity history, broker-backed positions, decisions, trades, and run history
- Isolated D1 leases per strategy plus a separate maintenance lease, scheduled read-only broker/order reconciliation, bounded broker requests, and pre-cycle status refresh

## Setup and development

### Prerequisites

- Cloudflare account with Workers and D1
- Alpaca paper-trading account
- Alpaca API credentials
- GitHub account if hosting the dashboard on GitHub Pages
- Bun or Node.js with Wrangler

### Install

```bash
cd alpaca-trading-bot
bun install
```

### Create or configure D1

```bash
bunx wrangler d1 create alpaca-trading-bot
bunx wrangler d1 execute alpaca-trading-bot --remote --file=schema.sql
```

Before deploying crypto BUY code, apply the explicit reservation migration once. It is idempotent and must be run by an authorized release operator, not by the Worker:

```bash
bun run db:migrate:crypto-reservations:remote
bun run db:verify:crypto-reservations:remote
```

The verification command is read-only and must show both `crypto_entry_reservations` and `idx_crypto_entry_reservations_expiry`. A missing table or index is a release blocker; runtime self-healing is intentionally not relied on for this safety-critical gate.

Update `wrangler.toml` with the returned database ID when creating a new environment. The production Worker uses the D1 binding named `DB`.

### Configure secrets

Use Wrangler or the platform's encrypted secret store. Never put secrets in source files, the dashboard, commits, or chat messages.

```bash
bunx wrangler secret put ALPACA_API_KEY
bunx wrangler secret put ALPACA_API_SECRET
bunx wrangler secret put ALPACA_BASE_URL
bunx wrangler secret put LLM_API_KEY
```

`ALPACA_BASE_URL` is normally `https://paper-api.alpaca.markets` for this project.

## Current configuration defaults

The runtime fallback defaults are strategy-specific and can be overridden through D1 configuration:

The dashboard's **Capital cap** cards are read-only. `/api/dashboard` returns a server-resolved `capitalCaps` object using the exact runtime-compatible configuration keys and fallback defaults: `maxCapitalUsd` = `$5,000`, `swing_maxCapitalUsd` = `$3,700`, and `crypto_maxCapitalUsd` = `$2,000`. The runtime accepts both camelCase and snake_case aliases, with the documented resolver precedence; `/api/config` remains raw diagnostic configuration and is not used by the frontend for cap inference. The frontend never derives a cap from Alpaca buying power, cash, equity, portfolio value, positions, or any other account metric. Missing runtime-compatible D1 overrides use the documented fallback; malformed or negative overrides, and invalid or unavailable `capitalCaps` API payloads, render as `Unavailable`.

| Setting | Daytrading | Swing | Crypto |
|---------|------------|-------|--------|
| Minimum confidence / entry score | `0.7` | `0.5` composite z-score | `0.7` |
| Max positions | `15` | `30` | `5` |
| Max capital | `$5,000` | `$3,700` | `$2,000` |
| Max order rate | `10/min` | `15/min` | `5/min` persistent entry guard |
| Max new entries / cycle | strategy-specific | strategy-specific | `1` default |
| Max discretionary exits / cycle | strategy-specific | strategy-specific | `2` default |
| Minimum hold | `15 min` | strategy-specific | `30 min` |
| Re-entry cooldown | `30 min` | strategy-specific | `60 min` |
| EOD flatten | `true` | not applicable | `false` |

ATR-scaled stop-loss/take-profit settings are used by the trading paths. Margin is enabled for daytrading by default, disabled for swing, and disabled for crypto. These are fallback values only; inspect `/api/config` and D1 before assuming a live value.

### Run tests and build checks

```bash
bun test
bun run typecheck
bunx wrangler deploy --dry-run
```

The deployed release passed 85 tests with 257 assertions. Migration coverage includes fresh-schema apply and idempotent reapply for the crypto reservation table and index; dashboard coverage includes read-only/no-DDL and bounded-payload tests. `bunx tsc --noEmit`, `bun test`, `git diff --check`, and `bunx wrangler deploy --dry-run` passed before the direct Cloudflare upload.

### Deploy

Use [`docs/DEPLOYMENT_RUNBOOK.md`](docs/DEPLOYMENT_RUNBOOK.md). In this proxy environment, `bunx wrangler deploy` can return exit code 0 without creating a new Worker version, so the canonical path is:

1. Pass typecheck, tests, dry-run, and `git diff --check`.
2. Commit and push to `origin/main`, then verify the remote hash.
3. Build a fresh explicit bundle with `bunx wrangler deploy --dry-run --outdir <new-directory>`.
4. Upload that exact bundle through the direct Cloudflare multipart API using the encrypted credential store.
5. Verify a new Cloudflare version at 100% traffic, all four cron schedules, and read-only HTTP 200 smoke tests.

Never put `CLOUDFLARE_API_TOKEN` in source, documentation, chat, or commits. Never use trigger, cycle, order, or close endpoints as deployment tests.

The dashboard is the static file `dashboard/index.html`. It uses the Worker URL in `API_BASE` and must never be changed to call Alpaca directly.

## API contract

All Alpaca access is server-side inside the Worker.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` or `/health` | GET | Worker health response |
| `/api/dashboard` | GET | Combined account, broker-backed positions, decisions, trades, runs, bounded snapshots, strategy comparison, and server-resolved `capitalCaps`; returns `positionsAvailable`, `positionsError`, and `strategyComparison: null` when the broker position fetch fails |
| `/api/account` | GET | Account data fetched server-side from Alpaca, returned as `{ account }` |
| `/api/positions` | GET | Current broker positions projected with D1 metadata; includes `positionsAvailable` and `source: "alpaca"`; returns HTTP 503 when broker positions are unavailable |
| `/api/decisions` | GET | Recent decisions from D1, returned as `{ decisions }` |
| `/api/trades` | GET | Recent trades from D1, returned as `{ trades }`; broker reconciliation runs only on scheduled/cycle paths |
| `/api/performance` | GET | Performance snapshots from D1, returned as `{ performance }` |
| `/api/runs` | GET | Run history from D1, returned as `{ runs }` |
| `/api/stats` | GET | Aggregate statistics from D1 |
| `/api/strategy-comparison` | GET | Historical strategy metrics plus broker-backed current exposure; returns an unavailable state if positions cannot be fetched |
| `/api/config` | GET | Raw bot configuration from D1 for diagnostics; the dashboard does not infer capital caps from this raw response |
| `/api/trigger` | POST | Requests the daytrading path to run on its scheduled path; treat as an operational action |
| `/api/trigger-swing` | POST | Runs a swing cycle immediately; treat as an operational action |
| `/api/trigger-crypto` | POST | Runs a crypto cycle immediately; treat as an operational action |
| `/api/positions/close?symbol=X` | POST | Submits a close order for one symbol |
| `/api/positions/close-all` | POST | Submits close orders for all broker positions |
| `/api/debug` | GET | Operational/debug data |
| `/api/debug-crypto` | GET | Crypto operational/debug data |

### `/api/dashboard` position fields

When `positionsAvailable` is `true`, `positions` contains only broker-present symbols. Broker values such as `qty`, `current_price`, `market_value`, and unrealized P&L come from Alpaca. D1 metadata fields such as `strategy`, stops, and timestamps are carried only when a matching D1 row exists.

When `positionsAvailable` is `false`, `positions` is empty and `positionsError` explains the failure. The frontend must display the unavailable state rather than reconstructing positions from D1.

## Risk management

The risk manager enforces hard rules that override AI and technical-analysis decisions:

- account blocked and trading halt checks
- daily loss and rolling drawdown limits
- confidence threshold
- position count and capital limits
- position sizing
- stop-loss and take-profit calculation
- trailing-stop handling
- order-rate limits
- minimum hold and re-entry cooldowns
- broker/D1 divergence checks where applicable

Run history labels `trades_executed` as **Orders submitted**. A submitted order may be pending, rejected, canceled, partially filled, or filled; persisted trade status and broker fill records are the authoritative execution evidence.

## Operational verification checklist

Before declaring a deployment complete:

1. Update the documentation for every source, configuration, schema, migration, test, or operational change.
2. Run `git diff --check`, `bunx tsc --noEmit`, `bun test`, and a Wrangler dry-run.
3. Commit and push the code and documentation; confirm local `HEAD` equals `origin/main`.
4. Build and upload a fresh explicit Worker bundle through the documented direct Cloudflare multipart API.
5. Confirm the newest Cloudflare version is receiving 100% traffic and all four schedules are present.
6. Fetch `/health`, `/api/dashboard`, `/api/trades`, `/api/runs`, and `/api/positions` through the Worker URL.
7. Confirm broker availability fields and that symbols match the broker account.
8. Confirm the GitHub Pages HTML contains the Worker API URL and no direct Alpaca URL.
9. Record the release result and open next steps in `README.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT_RUNBOOK.md`, and the workspace status note.
10. Do not use trigger, cycle, order, or close endpoints as deployment tests.

## Documentation rule

Documentation is part of the implementation, not a follow-up task. Every future change must update the relevant README, operations/runbook, release receipt, and next-step status in the same work item. A change is not complete until the documented behavior, validation results, deployment state, known risks, and remaining follow-ups match reality.

## Known risks and follow-up work

- Partial-fill/retry/cancel handling has a confirmed lifecycle defect: August 6 live evidence showed repeated partial-filled exits and subsequent quantity mismatches. Daytrading and swing have no pending-exit guard, and a failed/partial close can be submitted again on a later cycle.
- Daytrading and swing BUY paths also create a full D1 position immediately after order submission using requested quantity/decision price instead of broker fill quantity. A partial or pending BUY can therefore inflate internal quantity before reconciliation; August 6 live evidence showed this pattern alongside partial exits. Client IDs using `Date.now()` are not deterministic across retries, so duplicate-submit protection is incomplete. Crypto has a pending-exit guard and deterministic client IDs, but it still lacks a complete broker retry/cancel/replace lifecycle.
- Order-to-decision correlation is incomplete: swing BUYs use time-based client IDs with `decision_id: null`, and swing exits omit the originating decision ID. Historical swing rows therefore cannot reliably support deterministic lifecycle attribution.
- Strategy `grossTotalPl` and `netTotalPl` are model values: closed P&L still comes from broker-position/unrealized snapshots, not matched fills. The fee ledger currently imports a bounded three-day overlap, so net figures mean gross model P&L less fees currently present in the ledger.
- Regulatory/account-level fees are intentionally not assigned to daytrading or swing; unmatched broker positions are shown as `Unattributed` rather than hidden from the overview.
- A true swing trailing stop still needs persisted peak-price state; the current swing protective path uses the hard stop and explicit data-integrity protection.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; they must not be bulk-attributed without deterministic evidence.
- The swing production path has been verified with bounded batch-bar handling and degraded-data safeguards; trigger attribution and decision-row accounting remain follow-up consistency work.
- Some position upsert/reconciliation paths still need stronger strategy attribution and lifecycle correlation.
- Scheduled reconciliation is intentionally read-only and does not replace a future explicit retry/cancel lifecycle design.
- Automated coverage is improving but does not yet provide full live-broker integration coverage for every partial-fill and retry edge case.
- D1-only historical rows may remain open in storage until a separate, complete reconciliation policy is implemented. GET handlers do not close or synthesize positions.

## Prior-release natural reconciliation evidence

The prior-release natural reconciliation check completed on August 8, 2026 using only GET requests to the live Worker. The `/api/runs` response recorded 23 `reconcile_cron` entries from `2026-08-08 06:40:53` through `2026-08-08 10:30:51` UTC; 16 completed with the `MAINTENANCE_ONLY` marker and 7 were explicitly skipped because the global cycle lease was held. The live `/api/trades` response contained 19 rows with `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at`; reconciliation timestamps ranged from `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC. Maintenance logs reported `trades_executed: 0`, `imported: 0`, and no order submission, cancel, replace, retry, or close action. Source inspection confirms the maintenance reconciler only reads recent/individual broker orders and writes D1 lifecycle state.

This confirms prior-release scheduled execution and lifecycle population without broker-side mutation evidence. It does not establish post-August 10 behavior. The latest post-release `reconcile_cron` records observed on August 10 at 07:10, 07:30, and 07:50 UTC were skipped with `CYCLE_LEASE_HELD`, so recent completed reconciliation is not confirmed. A strict broker order before/after comparison remains unavailable because the supported Worker API has no read-only `/api/orders` route and no same-window order snapshot pair was captured; the result is therefore “no mutation observed or indicated,” not a categorical broker audit assertion.

A verified weekly read-only follow-up job, `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`), runs Mondays at 10:00 Europe/Copenhagen and reviews the remaining accounting, lifecycle, attribution, swing-state, and live-integration risks.

## Next steps

1. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
2. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
3. Add targeted live-broker integration checks without using trading actions as smoke tests.
4. Finish swing trigger attribution and decision-row accounting consistency work.

## License

Private project.

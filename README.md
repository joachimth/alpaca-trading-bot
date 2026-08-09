# Alpaca AI Trading Bot

Autonomous AI-assisted trading bot running on a Cloudflare Worker with D1 persistence, Alpaca paper trading, and a GitHub Pages dashboard.

## Live deployment

- **Repository:** `joachimth/alpaca-trading-bot`
- **Worker:** `alpaca-trading-bot.joachim-763.workers.dev`
- **Dashboard:** `joachimth.github.io/alpaca-trading-bot/`
- **Current implementation commit:** `fd8be3be647e0a4cdae8f79de89206f9a65172bb` (`Add read-only strategy capital cap cards`)
- **Active Worker version:** Cloudflare version `cb88271c-8712-42a8-88a9-de58c841d3ec`, deployed at 100% traffic on August 9, 2026
- **Current deployment:** Cloudflare deployment `5088dbe0-31f9-4892-a149-a74702bbad4e`
- **Account mode:** Alpaca paper trading

The dashboard is a static GitHub Pages frontend. It calls the Cloudflare Worker API only. It never calls Alpaca directly and never contains Alpaca credentials.

### Capital-cap release evidence

The read-only capital-cap dashboard change is deployed from source commit `fd8be3be647e0a4cdae8f79de89206f9a65172bb`. The live `/api/dashboard` response returned `capitalCaps.daytrading = 5000`, `capitalCaps.swing = 3700`, and `capitalCaps.crypto = 2000`, with `positionsAvailable: true`; the three Pages strategy tabs contain exactly three **Capital cap** cards. The Worker deployment is `5088dbe0-31f9-4892-a149-a74702bbad4e`, version `cb88271c-8712-42a8-88a9-de58c841d3ec`, at 100% traffic. Validation passed with 58 tests and 171 assertions, TypeScript, diff-check, fresh Wrangler dry-run, and inline dashboard-JavaScript syntax validation. No trading, order, close, cancel, replace, retry, or reconciliation trigger was used.

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

The current deployed release adds read-only Capital cap cards for Daytrading, Swing, and Crypto, while preserving broker-authoritative positions, fee-aware P&L presentation, conservative fee attribution, scheduled read-only reconciliation, and the existing trading cadence. Historical realized P&L remains model/gross-style until fill-lot matching is implemented. Source commit: `fd8be3be647e0a4cdae8f79de89206f9a65172bb`; active Worker version: `cb88271c-8712-42a8-88a9-de58c841d3ec` at 100% traffic.

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
- GitHub Pages dashboard with equity history, strategy history, broker-backed positions, decisions, trades, and run history
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

The dashboard's **Capital cap** cards are read-only. `/api/dashboard` returns a server-resolved `capitalCaps` object using the exact runtime-compatible configuration keys and fallback defaults: `maxCapitalUsd` = `$5,000`, `swing_maxCapitalUsd` = `$3,700`, and `crypto_maxCapitalUsd` = `$2,000`. Raw snake_case values from `/api/config` are diagnostic only because the current loaders do not consume them. The frontend never derives a cap from Alpaca buying power, cash, equity, portfolio value, positions, or any other account metric. Missing runtime-compatible D1 overrides use the documented fallback; malformed or negative overrides, and invalid or unavailable `capitalCaps` API payloads, render as `Unavailable`.

| Setting | Daytrading | Swing | Crypto |
|---------|------------|-------|--------|
| Minimum confidence / entry score | `0.7` | `0.5` composite z-score | `0.7` |
| Max positions | `15` | `30` | `5` |
| Max capital | `$5,000` | `$3,700` | `$2,000` |
| Max order rate | `10/min` | `15/min` | `5/min` |
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

The test suite currently passes with 53 tests and 151 assertions. Fee-aware regression coverage lives in `test/risk-fee-aware.test.ts` and `test/category-performance.test.ts`; broker-position and read-only reconciliation coverage remains in `test/position-projection.test.ts` and `test/order-reconciliation.test.ts`. `bunx tsc --noEmit`, `bun test`, `git diff --check`, and `bunx wrangler deploy --dry-run` are release gates and must pass before deployment.

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
| `/api/dashboard` | GET | Combined account, broker-backed positions, decisions, trades, runs, snapshots, strategy comparison, strategy history, and server-resolved `capitalCaps`; returns `positionsAvailable`, `positionsError`, and `strategyComparison: null` when the broker position fetch fails |
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

- Partial-fill retry/cancel handling needs a fuller lifecycle model and more automated coverage.
- Strategy `grossTotalPl` and `netTotalPl` are model values: closed P&L still comes from broker-position/unrealized snapshots, not matched fills. The fee ledger currently imports a bounded three-day overlap, so net figures mean gross model P&L less fees currently present in the ledger.
- Regulatory/account-level fees are intentionally not assigned to daytrading or swing; unmatched broker positions are shown as `Unattributed` rather than hidden from the overview.
- A true swing trailing stop still needs persisted peak-price state; the current swing protective path uses the hard stop and explicit data-integrity protection.
- At the last verified D1 query on August 8, 2026, 365 trades existed and 84 had `strategy IS NULL`; they must not be bulk-attributed without deterministic evidence.
- The swing production path has been verified with bounded batch-bar handling and degraded-data safeguards; trigger attribution and decision-row accounting remain follow-up consistency work.
- Some position upsert/reconciliation paths still need stronger strategy attribution and lifecycle correlation.
- Scheduled reconciliation is intentionally read-only and does not replace a future explicit retry/cancel lifecycle design.
- Automated coverage is improving but does not yet provide full live-broker integration coverage for every partial-fill and retry edge case.
- D1-only historical rows may remain open in storage until a separate, complete reconciliation policy is implemented. GET handlers do not close or synthesize positions.

## Natural reconciliation verification

The first natural post-release check completed on August 8, 2026 using only GET requests to the live Worker. The `/api/runs` response recorded 23 `reconcile_cron` entries from `2026-08-08 06:40:53` through `2026-08-08 10:30:51` UTC; 16 completed with the `MAINTENANCE_ONLY` marker and 7 were explicitly skipped because the global cycle lease was held. The live `/api/trades` response contained 19 rows with `client_order_id`, `filled_qty`, `leaves_qty`, `broker_updated_at`, and `last_reconciled_at`; reconciliation timestamps ranged from `2026-08-07 20:09:02` through `2026-08-08 10:20:06` UTC. Maintenance logs reported `trades_executed: 0`, `imported: 0`, and no order submission, cancel, replace, retry, or close action. Source inspection confirms the maintenance reconciler only reads recent/individual broker orders and writes D1 lifecycle state.

This confirms scheduled execution and lifecycle population without broker-side mutation evidence. A strict broker order before/after comparison remains unavailable because the supported Worker API has no read-only `/api/orders` route and no same-window order snapshot pair was captured; the result is therefore “no mutation observed or indicated,” not a categorical broker audit assertion.

A verified weekly read-only follow-up job, `Alpaca deferred-risk review` (schedule ID `56199d0b-dd75-4f3b-acb6-14c58c4e055b`), runs Mondays at 10:00 Europe/Copenhagen and reviews the remaining accounting, lifecycle, attribution, swing-state, and live-integration risks.

## Next steps

1. Define and test the partial-fill, cancel, replace, and retry lifecycle separately from read-only reconciliation.
2. Strengthen deterministic strategy attribution and lifecycle correlation for historical and broker-only trades.
3. Add targeted live-broker integration checks without using trading actions as smoke tests.
4. Finish swing trigger attribution and decision-row accounting consistency work.

## License

Private project.

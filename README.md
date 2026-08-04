# Alpaca AI Trading Bot

Autonomous AI-assisted trading bot running on a Cloudflare Worker with D1 persistence, Alpaca paper trading, and a GitHub Pages dashboard.

## Live deployment

- **Repository:** `joachimth/alpaca-trading-bot`
- **Worker:** `alpaca-trading-bot.joachim-763.workers.dev`
- **Dashboard:** `joachimth.github.io/alpaca-trading-bot/`
- **Current implementation commit:** `ee17068` (`make dashboard positions broker authoritative`)
- **Active Worker version:** Cloudflare version `43`, deployed at 100% traffic on August 4, 2026
- **Account mode:** Alpaca paper trading

The dashboard is a static GitHub Pages frontend. It calls the Cloudflare Worker API only. It never calls Alpaca directly and never contains Alpaca credentials.

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

The `ee17068` change updated the API/dashboard projection and strategy comparison. It did not change order placement, scheduled cycle timing, or broker execution behavior.

## Trading strategies and schedules

- **Daytrading:** every 5 minutes during the configured UTC window, `*/5 13-21 * * 1-5`; Alpaca's market clock remains authoritative.
- **Swing:** once daily after market close, `0 22 * * 1-5`.
- **Crypto:** every 30 minutes at approximately `:07` and `:37` UTC, `7-59/30 * * * *`; crypto is intentionally kept at this cadence pending telemetry.

The strategies use explicit asset and strategy isolation. A strategy may use D1 ownership and risk metadata, but current broker quantity and valuation must come from Alpaca.

## Features

- Autonomous paper trading with separate daytrading, swing, and crypto paths
- Technical analysis: RSI, MACD, EMA, ATR, Stochastic, Bollinger Bands, ADX, and OBV
- Optional LLM refinement of technical signals
- Risk controls: account block checks, daily loss limits, position limits, sizing, stops, take-profits, trailing stops, cooldowns, and order-rate limits
- Universe scanner for liquid US equities
- D1 logging for decisions, trades, runs, snapshots, and position metadata
- GitHub Pages dashboard with equity history, strategy history, broker-backed positions, decisions, trades, and run history
- Global D1 cycle lease and pre-cycle broker/order reconciliation

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

The focused broker-position regression tests live in `test/position-projection.test.ts` and cover stale D1-only rows and broker-only unattributed positions. The repository still has pre-existing TypeScript errors and a duplicate `isTradingHalted` warning in unrelated swing/risk code; a clean typecheck is not currently a release gate.

### Deploy

```bash
CLOUDFLARE_API_TOKEN="..." bunx wrangler deploy
```

For this Worker, always verify the active Cloudflare deployment after upload. A successful upload or exit code does not by itself prove that the new version is receiving traffic. Confirm the active version in Cloudflare and verify the public API response before calling a deployment complete.

The dashboard is the static file `dashboard/index.html`. It uses the Worker URL in `API_BASE` and must never be changed to call Alpaca directly.

## API contract

All Alpaca access is server-side inside the Worker.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` or `/health` | GET | Worker health response |
| `/api/dashboard` | GET | Combined account, broker-backed positions, decisions, trades, runs, snapshots, strategy comparison, and strategy history; returns `positionsAvailable`, `positionsError`, and `strategyComparison: null` when the broker position fetch fails |
| `/api/account` | GET | Account data fetched server-side from Alpaca, returned as `{ account }` |
| `/api/positions` | GET | Current broker positions projected with D1 metadata; includes `positionsAvailable` and `source: "alpaca"`; returns HTTP 503 when broker positions are unavailable |
| `/api/decisions` | GET | Recent decisions from D1, returned as `{ decisions }` |
| `/api/trades` | GET | Recent trades from D1 with broker reconciliation where available, returned as `{ trades }` |
| `/api/performance` | GET | Performance snapshots from D1, returned as `{ performance }` |
| `/api/runs` | GET | Run history from D1, returned as `{ runs }` |
| `/api/stats` | GET | Aggregate statistics from D1 |
| `/api/strategy-comparison` | GET | Historical strategy metrics plus broker-backed current exposure; returns an unavailable state if positions cannot be fetched |
| `/api/config` | GET | Bot configuration from D1 |
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

1. Run the focused projection tests.
2. Run a Wrangler dry-run build.
3. Confirm the active Cloudflare version and traffic percentage.
4. Fetch `/api/dashboard` and `/api/positions` through the Worker URL.
5. Confirm `positionsAvailable: true`, `source: "alpaca"`, and that symbols match the broker account.
6. Confirm the GitHub Pages HTML contains the Worker API URL and no direct Alpaca URL.
7. Do not use trigger or close endpoints as deployment tests.

## Known risks and follow-up work

- Partial-fill retry/cancel handling needs a fuller lifecycle model and more automated coverage.
- There are 91 historical trades with `strategy IS NULL`; they must not be bulk-attributed without deterministic evidence.
- Swing logging still needs consistency work before the first real swing run, including trigger attribution and decision-row accounting.
- Some position upsert/reconciliation paths still need stronger strategy attribution and lifecycle correlation.
- Existing TypeScript errors remain in unrelated files, and `swing-risk.ts` has a duplicate `isTradingHalted` member warning.
- Automated test coverage is still limited; the broker projection currently has focused deterministic tests only.
- D1-only historical rows may remain open in storage until a separate, complete reconciliation policy is implemented. GET handlers do not close or synthesize positions.

## License

Private project.

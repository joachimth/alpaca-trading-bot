# Alpaca AI Trading Bot

Autonomous AI-powered daytrading bot using the Alpaca Markets API. Runs on a Cloudflare Worker with D1 database for logging and a GitHub Pages dashboard for monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Worker                   │
│                                                      │
│  Cron (every 5 min) ──► Trading Cycle               │
│                          │                           │
│    ┌─────────────────────┼──────────────────┐       │
│    │                     │                  │       │
│    ▼                     ▼                  ▼       │
│  TA Engine          AI Refinement      Risk Manager  │
│  (RSI, MACD,        (LLM refines       (position     │
│   EMA, ATR,          TA signals)        sizing,      │
│   Volume, Stoch,                        stop loss,   │
│   Bollinger, ADX)                       limits)      │
│    │                     │                  │       │
│    └─────────► Trade Executor ◄────────────┘       │
│                     │                                │
│     ┌───────────────┼───────────────┐              │
│     ▼               ▼               ▼              │
│  Alpaca API      D1 Database     Dashboard API      │
│  (orders,        (decisions,     (REST endpoints    │
│   positions,      trades,         for dashboard)    │
│   market data)    snapshots)                         │
│                                                      │
└─────────────────────────────────────────────────────┘
         │
         ▼
   GitHub Pages Dashboard (live monitoring)
```

## Features

- **Fully autonomous** daytrading on Alpaca paper trading account
- **Technical analysis engine**: RSI, MACD, EMA, ATR, Stochastic, Bollinger Bands, ADX, OBV
- **AI refinement layer**: LLM analyzes TA signals and market context to refine decisions
- **Hard risk rules**: max positions, position sizing, stop loss, take profit, trailing stop, daily loss limit
- **Universe scanner**: scans top movers + curated universe of 100+ liquid US stocks
- **Full logging**: every decision, trade, and performance snapshot stored in D1
- **Live dashboard**: equity curve, positions, AI decisions, trades, run history

## Setup

### 1. Prerequisites

- Cloudflare account (Workers + D1)
- Alpaca account with paper trading enabled
- API keys from Alpaca (paper trading keys)
- GitHub account for dashboard hosting

### 2. Install Dependencies

```bash
cd alpaca-trading-bot
npm install  # or: bun add
```

### 3. Create D1 Database

```bash
npx wrangler d1 create alpaca-trading-bot
```

Update `wrangler.toml` with the database_id returned.

### 4. Run Migration

```bash
npx wrangler d1 execute alpaca-trading-bot --remote --file=schema.sql
```

### 5. Set Secrets

```bash
npx wrangler secret put ALPACA_API_KEY
npx wrangler secret put ALPACA_API_SECRET
npx wrangler secret put ALPACA_BASE_URL   # https://paper-api.alpaca.markets
npx wrangler secret put LLM_API_KEY        # Fireworks AI key for LLM refinement
```

### 6. Deploy Worker

```bash
npx wrangler deploy
```

### 7. Dashboard

The dashboard is in `dashboard/index.html`. Deploy to GitHub Pages or host anywhere static.

Update `API_BASE` in the dashboard to point to your Worker URL.

## Configuration

All bot settings are stored in D1 (`bot_config` table) and can be changed at runtime via the API:

| Key | Default | Description |
|-----|---------|-------------|
| max_positions | 15 | Maximum concurrent positions |
| max_position_pct | 20 | Max % of portfolio per position |
| stop_loss_pct | 8 | Stop loss percentage |
| take_profit_pct | 15 | Take profit percentage |
| trailing_stop_pct | 5 | Trailing stop percentage |
| daily_loss_limit_pct | 15 | Stop trading if down this much |
| min_confidence | 0.6 | Minimum AI confidence to act |
| scan_universe_size | 100 | Number of tickers to scan |
| use_ai_refinement | true | Use LLM to refine TA signals |
| enable_margin | true | Allow margin trading |
| eod_flatten | false | Close all positions before EOD |

## Risk Management

The risk manager enforces hard rules that override all AI/TA decisions:
- Account blocked check
- Daily loss limit (stops all trading)
- Confidence threshold
- Position count limit
- Position size calculation
- Stop loss and take profit on every trade
- Trailing stop for profit protection

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard` | GET | Full dashboard data in one call |
| `/api/account` | GET | Alpaca account info |
| `/api/positions` | GET | Open positions (DB + live) |
| `/api/decisions` | GET | Recent AI decisions |
| `/api/trades` | GET | Recent trades |
| `/api/performance` | GET | Performance snapshots |
| `/api/runs` | GET | Run history |
| `/api/stats` | GET | Aggregate stats |
| `/api/config` | GET | Bot configuration |
| `/api/positions/close?symbol=X` | POST | Close single position |
| `/api/positions/close-all` | POST | Close all positions |

## License

Private project.

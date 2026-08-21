-- Alpaca AI Trading Bot — D1 Schema
-- Run: wrangler d1 execute alpaca-trading-bot --file=schema.sql

-- ============================================================
-- Decisions: every AI/TA decision the bot makes
-- ============================================================
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('BUY','SELL','HOLD','CLOSE')),
  confidence REAL NOT NULL DEFAULT 0,        -- 0.0 to 1.0
  signal_source TEXT NOT NULL DEFAULT 'ta',  -- 'ta', 'ai', 'ta+ai'
  reason TEXT,                                -- human-readable explanation
  ta_data TEXT,                               -- JSON: full technical analysis snapshot
  ai_reasoning TEXT,                          -- JSON: LLM reasoning if used
  price_at_decision REAL,
  executed INTEGER NOT NULL DEFAULT 0,        -- 0=pending, 1=executed, 2=skipped(risk), 3=failed
  execution_reason TEXT,                      -- why skipped/failed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp);
CREATE INDEX IF NOT EXISTS idx_decisions_ticker ON decisions(ticker);
CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action);
CREATE INDEX IF NOT EXISTS idx_decisions_executed ON decisions(executed);

-- ============================================================
-- Trades: executed orders
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  alpaca_order_id TEXT,
  client_order_id TEXT,
  ticker TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('buy','sell')),
  qty REAL NOT NULL,
  filled_qty REAL,
  leaves_qty REAL,
  fill_price REAL,
  avg_fill_price REAL,
  status TEXT NOT NULL DEFAULT 'submitted',   -- broker lifecycle status
  order_type TEXT NOT NULL DEFAULT 'market',  -- market, limit, stop, stop_limit
  limit_price REAL,
  stop_price REAL,
  time_in_force TEXT NOT NULL DEFAULT 'day',
  estimated_value REAL,
  decision_id INTEGER REFERENCES decisions(id),
  strategy TEXT,                              -- nullable: known strategy only
  intent_stop_loss_price REAL,
  intent_take_profit_price REAL,
  error_message TEXT,
  broker_updated_at TEXT,
  submitted_at TEXT,
  filled_at TEXT,
  canceled_at TEXT,
  expired_at TEXT,
  failed_at TEXT,
  replaced_at TEXT,
  last_reconciled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_client_order_id ON trades(client_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

-- Global account-wide lease preventing overlapping strategy cycles.
CREATE TABLE IF NOT EXISTS cycle_leases (
  lease_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Persistent crypto entry reservations make the rate window atomic across
-- competing Worker invocations and survive a retry until expiry/finalization.
-- The standalone release migration is crypto-entry-reservations-migration.sql.
CREATE TABLE IF NOT EXISTS crypto_entry_reservations (
  reservation_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  symbol TEXT NOT NULL,
  notional_usd REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','committed')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crypto_entry_reservations_expiry ON crypto_entry_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_alpaca_id ON trades(alpaca_order_id);
CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy);

-- ============================================================
-- Broker fills and fees: immutable, idempotent Alpaca activity ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS broker_fills (
  activity_id TEXT PRIMARY KEY,
  order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT,
  qty REAL,
  price REAL,
  transaction_time TEXT,
  fill_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_broker_fills_order ON broker_fills(order_id);

CREATE TABLE IF NOT EXISTS broker_fees (
  activity_id TEXT PRIMARY KEY,
  fee_type TEXT NOT NULL,
  activity_sub_type TEXT,
  created_date TEXT,
  created_at TEXT,
  symbol TEXT,
  order_id TEXT,
  asset_or_currency TEXT,
  qty REAL,
  price REAL,
  net_amount REAL,
  usd_value REAL,
  attribution_status TEXT NOT NULL DEFAULT 'unattributed',
  strategy TEXT,
  description TEXT,
  created_record_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_broker_fees_date ON broker_fees(created_date);
CREATE INDEX IF NOT EXISTS idx_broker_fees_strategy ON broker_fees(strategy);

-- ============================================================
-- Positions: current and closed positions tracked by the bot
-- ============================================================
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL UNIQUE,
  side TEXT NOT NULL CHECK(side IN ('long','short')),
  qty REAL NOT NULL,
  avg_entry_price REAL NOT NULL,
  current_price REAL,
  market_value REAL,
  unrealized_pl REAL,
  unrealized_plpc REAL,                       -- percentage
  stop_loss_price REAL,
  take_profit_price REAL,
  trailing_stop_enabled INTEGER NOT NULL DEFAULT 1,
  strategy TEXT,                              -- 'daytrading', 'swing', 'crypto'
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  closed_pl REAL,                             -- realized P&L when closed
  close_reason TEXT                           -- 'stop_loss', 'take_profit', 'signal', 'manual', 'eod'
);

CREATE INDEX IF NOT EXISTS idx_positions_ticker ON positions(ticker);
CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(closed_at);

-- ============================================================
-- Performance snapshots: taken each run cycle
-- ============================================================
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  account_id TEXT,
  equity REAL,
  cash REAL,
  buying_power REAL,
  portfolio_value REAL,
  long_market_value REAL,
  short_market_value REAL,
  positions_count INTEGER DEFAULT 0,
  daily_pl REAL,
  daily_plpc REAL,
  total_pl REAL,
  total_plpc REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON performance_snapshots(timestamp);

-- ============================================================
-- Category snapshots: per-strategy (daytrading/swing/crypto) market value
-- and P&L, taken each run cycle from broker-authoritative positions only.
-- Unlike performance_snapshots (account-wide equity/cash), these rows never
-- split account equity by strategy — market_value is the sum of current
-- broker positions attributed to that strategy. Rows only start
-- accumulating once this table exists; there is no retroactive backfill.
-- ============================================================
CREATE TABLE IF NOT EXISTS category_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  strategy TEXT NOT NULL CHECK(strategy IN ('daytrading','swing','crypto')),
  market_value REAL NOT NULL DEFAULT 0,
  unrealized_pl REAL NOT NULL DEFAULT 0,
  realized_pl_today REAL NOT NULL DEFAULT 0,   -- closed_pl summed for positions closed today (UTC)
  daily_pl REAL NOT NULL DEFAULT 0,            -- unrealized_intraday_pl (broker) + realized_pl_today
  positions_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_category_snapshots_strategy_ts ON category_snapshots(strategy, timestamp);

-- ============================================================
-- Run log: every cron invocation
-- ============================================================
CREATE TABLE IF NOT EXISTS run_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  trigger TEXT NOT NULL DEFAULT 'cron',       -- 'cron', 'manual', 'api'
  market_open INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  decisions_made INTEGER DEFAULT 0,
  trades_executed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details TEXT,                         -- JSON array of error messages
  status TEXT NOT NULL DEFAULT 'ok',          -- ok, error, skipped
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runlog_timestamp ON run_log(timestamp);

-- ============================================================
-- Config: key-value store for bot settings
-- ============================================================
CREATE TABLE IF NOT EXISTS bot_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default config values
INSERT OR IGNORE INTO bot_config (key, value) VALUES
  ('max_positions', '15'),
  ('max_position_pct', '20'),           -- max % of portfolio per position (hard cap)
  ('stop_loss_atr_multiplier', '1.5'),  -- stop loss = entry - 1.5 * ATR
  ('take_profit_atr_multiplier', '2.0'),-- take profit = entry + 2.0 * ATR
  ('trailing_stop_pct', '5'),           -- 5% trailing stop
  ('daily_loss_limit_pct', '15'),       -- stop trading if down 15% on the day
  ('rolling_drawdown_limit_pct', '10'), -- stop if 20-period drawdown exceeds 10%
  ('min_confidence', '0.6'),            -- minimum AI confidence to act
  ('min_edge_after_costs', '5'),        -- minimum expected edge after costs (bps)
  ('target_volatility_pct', '2.0'),     -- target daily portfolio vol for sizing
  ('max_order_rate_per_min', '10'),     -- kill switch: max orders per minute
  ('scan_universe_size', '100'),        -- number of tickers to scan
  ('rsi_oversold', '30'),
  ('rsi_overbought', '70'),
  ('ema_fast', '9'),
  ('ema_slow', '21'),
  ('macd_fast', '12'),
  ('macd_slow', '26'),
  ('macd_signal', '9'),
  ('atr_period', '14'),
  ('volume_avg_period', '20'),
  ('use_ai_refinement', 'true'),
  ('llm_model', 'accounts/fireworks/models/glm-5p2'),
  ('llm_temperature', '0.3'),
  ('enable_margin', 'true'),
  ('eod_flatten', 'true'),              -- daytrading: close all before EOD
  ('min_hold_minutes', '15'),           -- anti-churn: min hold time before sell
  ('reentry_cooldown_minutes', '30'),   -- anti-churn: cooldown after selling before re-buy
  ('max_trades_per_cycle', '3'),        -- anti-churn: max new trades per 5-min cycle
  ('min_confidence', '0.7'),            -- raised from 0.6 to reduce low-conviction trades
  ('max_capital_usd', '5000');          -- daytrading capital cap (~33,000 DKK)

-- ============================================================
-- Swing trading config (swing_ prefixed keys)
-- ============================================================
INSERT OR IGNORE INTO bot_config (key, value) VALUES
  ('swing_reversal_weight', '0.35'),
  ('swing_momentum_weight', '0.15'),
  ('swing_proximity_weight', '0.20'),
  ('swing_volume_weight', '0.10'),
  ('swing_quality_weight', '0.20'),
  ('swing_reversal_lookback', '5'),
  ('swing_reversal_threshold', '2.0'),
  ('swing_min_price', '5'),
  ('swing_min_dollar_volume', '2000000'),
  ('swing_min_history', '252'),
  ('swing_max_positions', '30'),
  ('swing_top_percentile', '20'),
  ('swing_bottom_percentile', '80'),
  ('swing_earnings_blackout_days', '3'),
  ('swing_max_position_pct', '5'),
  ('swing_target_position_pct', '3.33'),
  ('swing_max_gross_exposure', '100'),
  ('swing_stop_loss_pct', '15'),
  ('swing_trailing_stop_pct', '8'),
  ('swing_daily_loss_limit_pct', '5'),
  ('swing_rolling_drawdown_limit_pct', '15'),
  ('swing_min_confidence', '0.5'),
  ('swing_exit_zscore', '-0.5'),
  ('swing_enable_margin', 'false'),
  ('swing_max_turnover_pct', '30'),
  ('swing_min_trade_size', '0.25'),
  ('swing_max_order_rate_per_min', '15'),
  ('swing_scan_universe_size', '150'),
  ('swing_max_capital_usd', '3700');   -- ~25,000 DKK cap for private person use

-- ============================================================
-- Crypto trading config (crypto_ prefixed keys)
-- ============================================================
INSERT OR IGNORE INTO bot_config (key, value) VALUES
    ('crypto_max_positions', '5'),
    ('crypto_max_position_pct', '25'),
    ('crypto_stop_loss_pct', '12'),
    ('crypto_take_profit_pct', '25'),
    ('crypto_trailing_stop_pct', '8'),
    ('crypto_daily_loss_limit_pct', '15'),
    ('crypto_rolling_drawdown_limit_pct', '20'),
    ('crypto_min_confidence', '0.7'),
    ('crypto_stop_loss_atr_multiplier', '2.0'),
    ('crypto_take_profit_atr_multiplier', '3.0'),
    ('crypto_target_volatility_pct', '3.0'),
    ('crypto_max_order_rate_per_min', '5'),
    ('crypto_max_entries_per_cycle', '1'),
    ('crypto_max_discretionary_exits_per_cycle', '2'),
    ('crypto_min_edge_after_costs', '8'),
    ('crypto_enable_margin', 'false'),
    ('crypto_min_hold_minutes', '30'),
    ('crypto_reentry_cooldown_minutes', '60'),
    ('crypto_max_trades_per_cycle', '2'),
    ('crypto_max_capital_usd', '2000'),
    ('crypto_use_ai_refinement', 'true'),
    ('crypto_scan_universe_size', '15');

-- Authoritative schema/config version. This update is idempotent for existing DBs.
INSERT INTO bot_config (key, value, updated_at)
VALUES ('version', '2.6.0', datetime('now'))
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;

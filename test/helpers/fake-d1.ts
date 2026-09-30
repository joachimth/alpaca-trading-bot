// Minimal D1Database-shaped wrapper around bun:sqlite, for exercising real
// SQL (including SQLite's UTC date('now')/datetime('now')) in Database tests
// without needing a live Cloudflare D1 binding.

import { Database as Sqlite } from 'bun:sqlite';

class FakeStatement {
  private params: any[] = [];
  constructor(private sqlite: Sqlite, private sql: string) {}

  bind(...args: any[]): FakeStatement {
    this.params = args;
    return this;
  }

  async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
    const info = this.sqlite.prepare(this.sql).run(...this.params);
    return { meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
  }

  async all(): Promise<{ results: any[] }> {
    const results = this.sqlite.prepare(this.sql).all(...this.params);
    return { results };
  }

  async first(): Promise<any> {
    const row = this.sqlite.prepare(this.sql).get(...this.params);
    return row ?? null;
  }
}

export function createFakeD1(sqlite: Sqlite): any {
  return {
    prepare(sql: string) {
      return new FakeStatement(sqlite, sql);
    },
    async batch(statements: FakeStatement[]): Promise<{ meta: { changes: number; last_row_id: number } }[]> {
      const results: { meta: { changes: number; last_row_id: number } }[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };
}

const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  ticker TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  signal_source TEXT NOT NULL DEFAULT 'ta',
  reason TEXT,
  ta_data TEXT,
  ai_reasoning TEXT,
  price_at_decision REAL,
  executed INTEGER NOT NULL DEFAULT 0,
  execution_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  alpaca_order_id TEXT,
  client_order_id TEXT,
  ticker TEXT NOT NULL,
  side TEXT NOT NULL,
  qty REAL NOT NULL,
  filled_qty REAL,
  leaves_qty REAL,
  fill_price REAL,
  avg_fill_price REAL,
  status TEXT NOT NULL DEFAULT 'submitted',
  order_type TEXT NOT NULL DEFAULT 'market',
  limit_price REAL,
  stop_price REAL,
  time_in_force TEXT NOT NULL DEFAULT 'day',
  estimated_value REAL,
  decision_id INTEGER,
  strategy TEXT,
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

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT NOT NULL UNIQUE,
  side TEXT NOT NULL,
  qty REAL NOT NULL,
  avg_entry_price REAL NOT NULL,
  current_price REAL,
  market_value REAL,
  unrealized_pl REAL,
  unrealized_plpc REAL,
  stop_loss_price REAL,
  take_profit_price REAL,
  trailing_stop_enabled INTEGER NOT NULL DEFAULT 1,
  strategy TEXT,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  closed_pl REAL,
  close_reason TEXT
);

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

CREATE TABLE IF NOT EXISTS cycle_leases (
  lease_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS crypto_entry_reservations (
  reservation_key TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  symbol TEXT NOT NULL,
  notional_usd REAL NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS category_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  strategy TEXT NOT NULL,
  market_value REAL NOT NULL DEFAULT 0,
  unrealized_pl REAL NOT NULL DEFAULT 0,
  realized_pl_today REAL NOT NULL DEFAULT 0,
  daily_pl REAL NOT NULL DEFAULT 0,
  positions_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS run_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  trigger TEXT NOT NULL DEFAULT 'cron',
  market_open INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  decisions_made INTEGER DEFAULT 0,
  trades_executed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_details TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  analyzed_candidates INTEGER NOT NULL DEFAULT 0,
  filtered_candidates INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bot_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/** Creates a fresh in-memory SQLite DB with the base tables Database.ts assumes already exist. */
export function createTestDatabase(): Sqlite {
  const sqlite = new Sqlite(':memory:');
  sqlite.run(BASE_SCHEMA);
  return sqlite;
}

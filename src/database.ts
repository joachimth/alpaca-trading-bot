// Database Layer
// All D1 interactions for the trading bot

import type { D1Database } from '@cloudflare/workers-types';

export interface DecisionRecord {
  ticker: string;
  action: string;
  confidence: number;
  signal_source: string;
  reason: string;
  ta_data: string;
  ai_reasoning: string;
  price_at_decision: number;
  executed: number;
  execution_reason: string;
}

export interface TradeRecord {
  alpaca_order_id: string;
  ticker: string;
  side: string;
  qty: number;
  fill_price: number | null;
  avg_fill_price: number | null;
  status: string;
  order_type: string;
  limit_price: number | null;
  stop_price: number | null;
  estimated_value: number;
  decision_id: number | null;
  error_message: string | null;
}

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // ============================================================
  // Config
  // ============================================================

  async getConfig(): Promise<Record<string, string>> {
    const result = await this.db.prepare('SELECT key, value FROM bot_config').all();
    const config: Record<string, string> = {};
    for (const row of result.results as any[]) {
      config[row.key] = row.value;
    }
    return config;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.db.prepare(
      'INSERT INTO bot_config (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')'
    ).bind(key, value).run();
  }

  // ============================================================
  // Decisions
  // ============================================================

  async logDecision(record: DecisionRecord): Promise<number> {
    const result = await this.db.prepare(
      `INSERT INTO decisions (ticker, action, confidence, signal_source, reason, ta_data, ai_reasoning, price_at_decision, executed, execution_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      record.ticker,
      record.action,
      record.confidence,
      record.signal_source,
      record.reason,
      record.ta_data,
      record.ai_reasoning,
      record.price_at_decision,
      record.executed,
      record.execution_reason
    ).run();

    return result.meta.last_row_id as number;
  }

  async updateDecisionStatus(id: number, executed: number, reason: string): Promise<void> {
    await this.db.prepare(
      'UPDATE decisions SET executed = ?, execution_reason = ? WHERE id = ?'
    ).bind(executed, reason, id).run();
  }

  async getRecentDecisions(limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(
      'SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    return result.results as any[];
  }

  // ============================================================
  // Trades
  // ============================================================

  async logTrade(record: TradeRecord): Promise<number> {
    const result = await this.db.prepare(
      `INSERT INTO trades (alpaca_order_id, ticker, side, qty, fill_price, avg_fill_price, status, order_type, limit_price, stop_price, estimated_value, decision_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      record.alpaca_order_id,
      record.ticker,
      record.side,
      record.qty,
      record.fill_price,
      record.avg_fill_price,
      record.status,
      record.order_type,
      record.limit_price,
      record.stop_price,
      record.estimated_value,
      record.decision_id,
      record.error_message
    ).run();

    return result.meta.last_row_id as number;
  }

  async updateTradeStatus(orderId: string, status: string, fillPrice: number | null, avgFillPrice: number | null): Promise<void> {
    await this.db.prepare(
      'UPDATE trades SET status = ?, fill_price = ?, avg_fill_price = ? WHERE alpaca_order_id = ?'
    ).bind(status, fillPrice, avgFillPrice, orderId).run();
  }

  async getRecentTrades(limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(
      'SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    return result.results as any[];
  }

  // ============================================================
  // Positions
  // ============================================================

  async upsertPosition(pos: {
    ticker: string;
    side: string;
    qty: number;
    avg_entry_price: number;
    current_price: number;
    market_value: number;
    unrealized_pl: number;
    unrealized_plpc: number;
    stop_loss_price: number | null;
    take_profit_price: number | null;
  }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO positions (ticker, side, qty, avg_entry_price, current_price, market_value, unrealized_pl, unrealized_plpc, stop_loss_price, take_profit_price, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(ticker) DO UPDATE SET
         side = excluded.side,
         qty = excluded.qty,
         avg_entry_price = excluded.avg_entry_price,
         current_price = excluded.current_price,
         market_value = excluded.market_value,
         unrealized_pl = excluded.unrealized_pl,
         unrealized_plpc = excluded.unrealized_plpc,
         stop_loss_price = excluded.stop_loss_price,
         take_profit_price = excluded.take_profit_price,
         updated_at = datetime('now')`
    ).bind(
      pos.ticker,
      pos.side,
      pos.qty,
      pos.avg_entry_price,
      pos.current_price,
      pos.market_value,
      pos.unrealized_pl,
      pos.unrealized_plpc,
      pos.stop_loss_price,
      pos.take_profit_price
    ).run();
  }

  async closePosition(ticker: string, closedPl: number, reason: string): Promise<void> {
    await this.db.prepare(
      `UPDATE positions SET closed_at = datetime('now'), closed_pl = ?, close_reason = ? WHERE ticker = ? AND closed_at IS NULL`
    ).bind(closedPl, reason, ticker).run();
  }

  async getOpenPositions(): Promise<any[]> {
    const result = await this.db.prepare(
      'SELECT * FROM positions WHERE closed_at IS NULL ORDER BY market_value DESC'
    ).all();
    return result.results as any[];
  }

  // ============================================================
  // Performance snapshots
  // ============================================================

  async logSnapshot(snapshot: {
    account_id: string;
    equity: number;
    cash: number;
    buying_power: number;
    portfolio_value: number;
    long_market_value: number;
    short_market_value: number;
    positions_count: number;
    daily_pl: number;
    daily_plpc: number;
    total_pl: number;
    total_plpc: number;
  }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO performance_snapshots (account_id, equity, cash, buying_power, portfolio_value, long_market_value, short_market_value, positions_count, daily_pl, daily_plpc, total_pl, total_plpc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      snapshot.account_id,
      snapshot.equity,
      snapshot.cash,
      snapshot.buying_power,
      snapshot.portfolio_value,
      snapshot.long_market_value,
      snapshot.short_market_value,
      snapshot.positions_count,
      snapshot.daily_pl,
      snapshot.daily_plpc,
      snapshot.total_pl,
      snapshot.total_plpc
    ).run();
  }

  async getRecentSnapshots(limit: number = 100): Promise<any[]> {
    const result = await this.db.prepare(
      'SELECT * FROM performance_snapshots ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    return result.results as any[];
  }

  // ============================================================
  // Run log
  // ============================================================

  async logRun(run: {
    trigger: string;
    market_open: number;
    duration_ms: number;
    decisions_made: number;
    trades_executed: number;
    errors: number;
    error_details: string | null;
    status: string;
  }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO run_log (trigger, market_open, duration_ms, decisions_made, trades_executed, errors, error_details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      run.trigger,
      run.market_open,
      run.duration_ms,
      run.decisions_made,
      run.trades_executed,
      run.errors,
      run.error_details,
      run.status
    ).run();
  }

  async getRecentRuns(limit: number = 30): Promise<any[]> {
    const result = await this.db.prepare(
      'SELECT * FROM run_log ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    return result.results as any[];
  }

  // ============================================================
  // Analytics
  // ============================================================

  async getStats(): Promise<{
    totalDecisions: number;
    totalTrades: number;
    executedTrades: number;
    winRate: number;
    avgConfidence: number;
  }> {
    const decisionsResult = await this.db.prepare('SELECT COUNT(*) as count FROM decisions').first();
    const tradesResult = await this.db.prepare('SELECT COUNT(*) as count FROM trades').first();
    const executedResult = await this.db.prepare("SELECT COUNT(*) as count FROM trades WHERE status = 'filled'").first();
    const winsResult = await this.db.prepare("SELECT COUNT(*) as count FROM positions WHERE closed_pl > 0").first();
    const closedResult = await this.db.prepare("SELECT COUNT(*) as count FROM positions WHERE closed_at IS NOT NULL").first();
    const avgConfidenceResult = await this.db.prepare('SELECT AVG(confidence) as avg FROM decisions WHERE executed = 1').first();

    const totalTrades = (tradesResult?.count as number) || 0;
    const executedTrades = (executedResult?.count as number) || 0;
    const wins = (winsResult?.count as number) || 0;
    const closed = (closedResult?.count as number) || 0;

    return {
      totalDecisions: (decisionsResult?.count as number) || 0,
      totalTrades,
      executedTrades,
      winRate: closed > 0 ? (wins / closed) * 100 : 0,
      avgConfidence: (avgConfidenceResult?.avg as number) || 0,
    };
  }
}

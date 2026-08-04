// Database Layer
// All D1 interactions for the trading bot

import type { D1Database } from '@cloudflare/workers-types';
import type { Order } from './alpaca';

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
  strategy?: 'daytrading' | 'swing' | 'crypto' | null;
}

export class Database {
  private db: D1Database;
  private schemaReady: Promise<void>;

  constructor(db: D1Database) {
    this.db = db;
    this.schemaReady = Promise.all([
      this.ensureTradeStrategyColumn(),
      this.ensureCycleLeaseSchema(),
    ]).then(() => undefined);
  }

  private async ensureTradeStrategyColumn(): Promise<void> {
    const column = await this.db.prepare(
      `SELECT 1 FROM pragma_table_info('trades') WHERE name = 'strategy' LIMIT 1`
    ).first();
    if (!column) {
      try {
        await this.db.prepare('ALTER TABLE trades ADD COLUMN strategy TEXT').run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes('duplicate column')) throw error;
      }
    }
  }

  private async ensureCycleLeaseSchema(): Promise<void> {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS cycle_leases (
        lease_key TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        acquired_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `).run();
  }

  private async ensureTradeSchema(): Promise<void> {
    await this.schemaReady;
  }

  async acquireCycleLease(owner: string, ttlMs = 30 * 60 * 1000, leaseKey = 'global'): Promise<boolean> {
    await this.ensureTradeSchema();
    const now = Date.now();
    const result = await this.db.prepare(`
      INSERT INTO cycle_leases (lease_key, owner, acquired_at, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(lease_key) DO UPDATE SET
        owner = excluded.owner,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
      WHERE cycle_leases.expires_at <= excluded.acquired_at
    `).bind(leaseKey, owner, now, now + ttlMs).run();
    return (result.meta.changes ?? 0) > 0;
  }

  async releaseCycleLease(owner: string, leaseKey = 'global'): Promise<void> {
    await this.ensureTradeSchema();
    await this.db.prepare(
      'DELETE FROM cycle_leases WHERE lease_key = ? AND owner = ?'
    ).bind(leaseKey, owner).run();
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

  async getRecentDecisionsByStrategy(strategy: 'daytrading' | 'swing' | 'crypto', limit: number = 100): Promise<any[]> {
    const predicate = strategy === 'swing'
      ? `signal_source = 'swing'`
      : strategy === 'crypto'
        ? `signal_source LIKE 'crypto%'`
        : `signal_source != 'swing' AND signal_source NOT LIKE 'crypto%'`;
    const result = await this.db.prepare(
      `SELECT * FROM decisions WHERE ${predicate} ORDER BY timestamp DESC LIMIT ?`
    ).bind(limit).all();
    return result.results as any[];
  }

  // ============================================================
  // Trades
  // ============================================================

  async logTrade(record: TradeRecord): Promise<number> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      `INSERT INTO trades (alpaca_order_id, ticker, side, qty, fill_price, avg_fill_price, status, order_type, limit_price, stop_price, estimated_value, decision_id, error_message, strategy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      record.error_message,
      record.strategy ?? null
    ).run();

    return result.meta.last_row_id as number;
  }

  async logOrderTrade(order: Order, options: {
    decisionId?: number | null;
    estimatedValue?: number | null;
    errorMessage?: string | null;
    strategy?: 'daytrading' | 'swing' | 'crypto' | null;
  } = {}): Promise<number> {
    await this.ensureTradeSchema();
    const existing = await this.db.prepare(
      'SELECT id FROM trades WHERE alpaca_order_id = ? LIMIT 1'
    ).bind(order.id).first();
    if (existing?.id !== undefined && existing?.id !== null) {
      await this.db.prepare(
        `UPDATE trades SET status = ?, fill_price = ?, avg_fill_price = ?,
             decision_id = COALESCE(decision_id, ?), strategy = COALESCE(strategy, ?)
         WHERE alpaca_order_id = ?`
      ).bind(order.status, order.filled_avg_price, order.filled_avg_price,
        options.decisionId ?? null, options.strategy ?? null, order.id).run();
      return existing.id as number;
    }

    return this.logTrade({
      alpaca_order_id: order.id,
      ticker: order.symbol,
      side: order.side,
      qty: order.qty,
      fill_price: order.filled_avg_price,
      avg_fill_price: order.filled_avg_price,
      status: order.status,
      order_type: order.type,
      limit_price: order.limit_price,
      stop_price: order.stop_price,
      estimated_value: options.estimatedValue ?? (order.qty * (order.filled_avg_price ?? order.limit_price ?? order.stop_price ?? 0)),
      decision_id: options.decisionId ?? null,
      error_message: options.errorMessage ?? null,
      strategy: options.strategy ?? null,
    });
  }

  async updateTradeStatus(orderId: string, status: string, fillPrice: number | null, avgFillPrice: number | null): Promise<void> {
    await this.ensureTradeSchema();
    await this.db.prepare(
      'UPDATE trades SET status = ?, fill_price = ?, avg_fill_price = ? WHERE alpaca_order_id = ?'
    ).bind(status, fillPrice, avgFillPrice, orderId).run();
  }

  async reconcileOrders(orders: Order[]): Promise<number> {
    await this.ensureTradeSchema();
    let imported = 0;
    for (const order of orders) {
      if (order.side !== 'sell') continue;
      const existing = await this.db.prepare(
        'SELECT id FROM trades WHERE alpaca_order_id = ? LIMIT 1'
      ).bind(order.id).first();
      const position = await this.db.prepare('SELECT strategy FROM positions WHERE ticker = ? AND closed_at IS NULL LIMIT 1').bind(order.symbol).first();
      const strategy = (position?.strategy as TradeRecord['strategy']) ?? null;
      if (existing) {
        await this.db.prepare(
          `UPDATE trades SET status = ?, fill_price = ?, avg_fill_price = ?, strategy = COALESCE(strategy, ?) WHERE alpaca_order_id = ?`
        ).bind(order.status, order.filled_avg_price, order.filled_avg_price, strategy, order.id).run();
        continue;
      }
      await this.logOrderTrade(order, { strategy });
      imported++;
    }
    return imported;
  }

  async getTradesNeedingSync(limit: number = 200): Promise<any[]> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      `SELECT * FROM trades
       WHERE status NOT IN ('filled', 'canceled', 'cancelled', 'rejected', 'expired')
       ORDER BY timestamp DESC LIMIT ?`
    ).bind(limit).all();
    return result.results as any[];
  }

  async getRecentTrades(limit: number = 50): Promise<any[]> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      'SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    return result.results as any[];
  }

  async getRecentTradesByStrategy(strategy: 'daytrading' | 'swing' | 'crypto', limit: number = 100): Promise<any[]> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      'SELECT * FROM trades WHERE strategy = ? ORDER BY timestamp DESC LIMIT ?'
    ).bind(strategy, limit).all();
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
    strategy?: string | null;
  }): Promise<void> {
    const strategy = pos.strategy ?? null;
    await this.db.prepare(
      `INSERT INTO positions (ticker, side, qty, avg_entry_price, current_price, market_value, unrealized_pl, unrealized_plpc, stop_loss_price, take_profit_price, strategy, opened_at, updated_at, closed_at, closed_pl, close_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL, NULL, NULL)
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
         strategy = COALESCE(excluded.strategy, positions.strategy),
         opened_at = CASE WHEN positions.closed_at IS NULL THEN positions.opened_at ELSE excluded.opened_at END,
         closed_at = NULL,
         closed_pl = NULL,
         close_reason = NULL,
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
        pos.take_profit_price,
        strategy
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

  // Get tickers that were closed within the last N minutes (for re-entry cooldown)
  async getRecentlyClosedSymbols(cooldownMinutes: number): Promise<Set<string>> {
    const result = await this.db.prepare(
      `SELECT ticker FROM positions 
       WHERE closed_at IS NOT NULL 
       AND closed_at > datetime('now', ?)
       GROUP BY ticker`
    ).bind(`-${cooldownMinutes} minutes`).all();
    return new Set((result.results as any[]).map(r => r.ticker));
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
      'SELECT * FROM run_log ORDER BY timestamp DESC, id DESC LIMIT ?'
    ).bind(limit).all();
    return result.results as any[];
  }

  async getRecentRunsByStrategy(strategy: 'daytrading' | 'swing' | 'crypto', limit: number = 100): Promise<any[]> {
    const triggerPredicate = strategy === 'swing'
      ? `trigger IN ('swing_cron', 'manual_swing')`
      : strategy === 'crypto'
        ? `trigger IN ('crypto_cron', 'manual_crypto')`
        : `trigger NOT IN ('swing_cron', 'manual_swing', 'crypto_cron', 'manual_crypto')`;
    const result = await this.db.prepare(
      `SELECT * FROM run_log WHERE ${triggerPredicate} ORDER BY timestamp DESC, id DESC LIMIT ?`
    ).bind(limit).all();
    return result.results as any[];
  }

  // ============================================================
  // Strategy comparison
  // ============================================================

  async getStrategyComparison(currentPositions?: readonly {
    strategy: string | null;
    unrealized_pl: number;
    market_value: number;
  }[]): Promise<any> {
      // Current open-position exposure is broker-authoritative when supplied.
    const openRows = currentPositions
      ? currentPositions.reduce((rows, position) => {
          const strategy = position.strategy ?? 'unattributed';
          const existing = rows.get(strategy) ?? { open_positions: 0, unrealized_pl: 0, market_value: 0 };
          existing.open_positions += 1;
          existing.unrealized_pl += position.unrealized_pl;
          existing.market_value += position.market_value;
          rows.set(strategy, existing);
          return rows;
        }, new Map<string, { open_positions: number; unrealized_pl: number; market_value: number }>())
      : new Map<string, { open_positions: number; unrealized_pl: number; market_value: number }>();
    const openResult = currentPositions
      ? { results: Array.from(openRows, ([strategy, values]) => ({ strategy, ...values })) }
      : await this.db.prepare(
          `SELECT COALESCE(strategy, 'daytrading') as strategy,
                  COUNT(*) as open_positions,
                  COALESCE(SUM(unrealized_pl), 0) as unrealized_pl,
                  COALESCE(SUM(market_value), 0) as market_value
           FROM positions WHERE closed_at IS NULL
           GROUP BY COALESCE(strategy, 'daytrading')`
        ).all();

    // Closed positions: realized P&L grouped by strategy
    const closedResult = await this.db.prepare(
      `SELECT COALESCE(strategy, 'daytrading') as strategy,
              COUNT(*) as closed_positions,
              COALESCE(SUM(closed_pl), 0) as realized_pl,
              SUM(CASE WHEN closed_pl > 0 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN closed_pl <= 0 THEN 1 ELSE 0 END) as losses
       FROM positions WHERE closed_at IS NOT NULL
       GROUP BY COALESCE(strategy, 'daytrading')`
    ).all();

    // Decisions grouped by signal_source (maps to strategy)
    const decResult = await this.db.prepare(
      `SELECT
         CASE
           WHEN signal_source LIKE 'crypto%' THEN 'crypto'
           WHEN signal_source = 'swing' THEN 'swing'
           ELSE 'daytrading'
         END as strategy,
         COUNT(*) as total_decisions,
         SUM(CASE WHEN executed = 1 THEN 1 ELSE 0 END) as executed_decisions
       FROM decisions
       GROUP BY strategy`
    ).all();

    // Only explicitly attributed trades are grouped; unknown history stays NULL.
    const tradeResult = await this.db.prepare(
      `SELECT strategy, COUNT(*) as total_trades,
              SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled_trades
         FROM trades
        WHERE strategy IS NOT NULL
        GROUP BY strategy`
    ).all();

    // Closed positions time series for cumulative P&L chart
    const timeSeriesResult = await this.db.prepare(
      `SELECT COALESCE(strategy, 'daytrading') as strategy,
              closed_at,
              closed_pl
       FROM positions
       WHERE closed_at IS NOT NULL AND closed_pl IS NOT NULL
       ORDER BY closed_at ASC`
    ).all();

    // Merge all into one structure
    const strategies: Record<string, any> = {};
    const ensure = (s: string) => {
      if (!strategies[s]) {
        strategies[s] = {
          strategy: s,
          openPositions: 0,
          unrealizedPl: 0,
          marketValue: 0,
          closedPositions: 0,
          realizedPl: 0,
          wins: 0,
          losses: 0,
          totalDecisions: 0,
          executedDecisions: 0,
          totalTrades: 0,
          filledTrades: 0,
        };
      }
      return strategies[s];
    };

    for (const r of openResult.results as any[]) {
      const s = ensure(r.strategy);
      s.openPositions = r.open_positions;
      s.unrealizedPl = r.unrealized_pl;
      s.marketValue = r.market_value;
    }
    for (const r of closedResult.results as any[]) {
      const s = ensure(r.strategy);
      s.closedPositions = r.closed_positions;
      s.realizedPl = r.realized_pl;
      s.wins = r.wins;
      s.losses = r.losses;
    }
    for (const r of decResult.results as any[]) {
      const s = ensure(r.strategy);
      s.totalDecisions = r.total_decisions;
      s.executedDecisions = r.executed_decisions;
    }
    for (const r of tradeResult.results as any[]) {
      const s = ensure(r.strategy);
      s.totalTrades = r.total_trades;
      s.filledTrades = r.filled_trades;
    }

    // Compute derived fields
    const result = Object.values(strategies);
    for (const s of result) {
      s.totalPl = s.realizedPl + s.unrealizedPl;
      s.winRate = (s.wins + s.losses) > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0;
    }

    // Build cumulative P&L time series per strategy
    const timeSeries: Record<string, { timestamp: string; cumulativePl: number }[]> = {};
    const runningTotals: Record<string, number> = {};
    for (const r of timeSeriesResult.results as any[]) {
      const strat = r.strategy;
      if (!timeSeries[strat]) { timeSeries[strat] = []; runningTotals[strat] = 0; }
      runningTotals[strat] += r.closed_pl;
      timeSeries[strat].push({ timestamp: r.closed_at, cumulativePl: runningTotals[strat] });
    }

    return { strategies: result, timeSeries };
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

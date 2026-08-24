// Database Layer
// All D1 interactions for the trading bot

import type { D1Database } from '@cloudflare/workers-types';
import { TERMINAL_ORDER_STATUSES, type AccountActivity, type Order } from './alpaca';
import {
  DEFAULT_CRYPTO_UNIVERSE,
  inferCryptoSellStrategy,
  type CryptoBuyAttributionMetadata,
  type PositionAttributionMetadata,
} from './crypto-attribution';
import type { CategoryPositionSummary, CategoryStrategy } from './position-projection';
import { parseDecisionSkip, parseRunDetails } from './skip-reasons';

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
  time_in_force?: string | null;
  limit_price: number | null;
  stop_price: number | null;
  estimated_value: number;
  decision_id: number | null;
  error_message: string | null;
  strategy?: 'daytrading' | 'swing' | 'crypto' | null;
  client_order_id?: string | null;
  filled_qty?: number | null;
  leaves_qty?: number | null;
  broker_updated_at?: string | null;
  submitted_at?: string | null;
  filled_at?: string | null;
  canceled_at?: string | null;
  expired_at?: string | null;
  failed_at?: string | null;
  replaced_at?: string | null;
  intent_stop_loss_price?: number | null;
  intent_take_profit_price?: number | null;
  gross?: number | null;
  fee?: number | null;
  net?: number | null;
  accounting_status?: string | null;
  fee_attribution?: string | null;
}

// Keep the read API shape stable across databases created before lifecycle
// columns were added. These are response fields, not write/schema operations.
const TRADE_OBSERVABILITY_FIELDS = [
  'submitted_at',
  'filled_at',
  'canceled_at',
  'expired_at',
  'failed_at',
  'replaced_at',
  'gross',
  'fee',
  'net',
  'accounting_status',
  'fee_attribution',
] as const;

export const CYCLE_LEASE_TTL_MS = 10 * 60 * 1000;
const CRYPTO_COMMITTED_RESERVATION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export interface DatabaseOptions {
  /** Read paths must never attempt runtime schema repair or DDL. */
  readOnly?: boolean;
}

export class Database {
  private db: D1Database;
  private schemaReady: Promise<void>;

  constructor(db: D1Database, options: DatabaseOptions = {}) {
    this.db = db;
    this.schemaReady = options.readOnly
      ? Promise.resolve()
      : Promise.all([
          this.ensureTradeLifecycleColumns(),
          this.ensureCycleLeaseSchema(),
          this.ensureRunLogSchema(),
          this.ensureCategorySnapshotSchema(),
          this.ensureBrokerLedgerSchema(),
        ]).then(() => undefined);
  }

  private async ensureTradeLifecycleColumns(): Promise<void> {
    const columns = [
      ['strategy', 'TEXT'],
      ['client_order_id', 'TEXT'],
      ['filled_qty', 'REAL'],
      ['leaves_qty', 'REAL'],
      ['broker_updated_at', 'TEXT'],
      ['submitted_at', 'TEXT'],
      ['filled_at', 'TEXT'],
      ['canceled_at', 'TEXT'],
      ['expired_at', 'TEXT'],
      ['failed_at', 'TEXT'],
      ['replaced_at', 'TEXT'],
      ['last_reconciled_at', 'TEXT'],
      ['intent_stop_loss_price', 'REAL'],
      ['intent_take_profit_price', 'REAL'],
    ] as const;
    for (const [name, type] of columns) {
      const column = await this.db.prepare(
        `SELECT 1 FROM pragma_table_info('trades') WHERE name = ? LIMIT 1`
      ).bind(name).first();
      if (column) continue;
      try {
        await this.db.prepare(`ALTER TABLE trades ADD COLUMN ${name} ${type}`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes('duplicate column')) throw error;
      }
    }
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_trades_client_order_id ON trades(client_order_id)').run();
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)').run();
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

  private async ensureRunLogSchema(): Promise<void> {
    const table = await this.db.prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'run_log' LIMIT 1`
    ).first();
    // Some focused unit fixtures intentionally contain only trade tables. The
    // production schema always has run_log, but absent fixtures must remain
    // valid and must not receive a create-table side effect here.
    if (!table) return;
    const columns = [
      ['analyzed_candidates', 'INTEGER NOT NULL DEFAULT 0'],
      ['filtered_candidates', 'INTEGER NOT NULL DEFAULT 0'],
    ] as const;
    for (const [name, definition] of columns) {
      const column = await this.db.prepare(
        `SELECT 1 FROM pragma_table_info('run_log') WHERE name = ? LIMIT 1`
      ).bind(name).first();
      if (column) continue;
      try {
        await this.db.prepare(`ALTER TABLE run_log ADD COLUMN ${name} ${definition}`).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes('duplicate column')) throw error;
      }
    }
  }

  private async ensureCategorySnapshotSchema(): Promise<void> {
    await this.db.prepare(`
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
      )
    `).run();
    await this.db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_category_snapshots_strategy_ts ON category_snapshots(strategy, timestamp)`
    ).run();
  }

  private async ensureBrokerLedgerSchema(): Promise<void> {
    await this.db.prepare(`
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
      )
    `).run();
    await this.db.prepare(`
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
      )
    `).run();
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_broker_fills_order ON broker_fills(order_id)').run();
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_broker_fees_date ON broker_fees(created_date)').run();
    await this.db.prepare('CREATE INDEX IF NOT EXISTS idx_broker_fees_strategy ON broker_fees(strategy)').run();
  }

  private async ensureTradeSchema(): Promise<void> {
    await this.schemaReady;
  }

  /** Read-only prerequisite check for strategy ownership metadata. */
  async assertPositionsStrategySchema(): Promise<void> {
    await this.ensureTradeSchema();
    const column = await this.db.prepare(
      `SELECT 1 FROM pragma_table_info('positions') WHERE name = ? LIMIT 1`
    ).bind('strategy').first();
    if (!column) {
      throw new Error('Required schema missing: positions.strategy; apply positions-strategy-column-migration.sql before enabling strategy cycles');
    }
  }

  async upsertBrokerActivities(activities: readonly AccountActivity[]): Promise<{ activities: number; fills: number; fees: number }> {
    await this.ensureTradeSchema();
    let fills = 0;
    let fees = 0;
    for (const activity of activities) {
      if (!activity.id) continue;
      if (activity.activity_type === 'FILL') {
        const result = await this.db.prepare(`
          INSERT INTO broker_fills (activity_id, order_id, symbol, side, qty, price, transaction_time, fill_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(activity_id) DO UPDATE SET
            order_id = excluded.order_id,
            symbol = excluded.symbol,
            side = excluded.side,
            qty = excluded.qty,
            price = excluded.price,
            transaction_time = excluded.transaction_time,
            fill_type = excluded.fill_type
        `).bind(
          activity.id,
          activity.order_id ?? null,
          (activity.symbol ?? '').replace('/', '').toUpperCase(),
          activity.side ?? null,
          activity.qty ?? null,
          activity.price ?? null,
          activity.transaction_time ?? activity.created_at ?? null,
          activity.type ?? null,
        ).run();
        fills += result.meta.changes ?? 0;
      } else if (activity.activity_type === 'CFEE' || activity.activity_type === 'FEE') {
        const isCryptoFee = activity.activity_type === 'CFEE';
        const qty = activity.qty ?? null;
        const price = activity.price ?? null;
        const netAmount = activity.net_amount ?? null;
        const derivedUsd = isCryptoFee && qty !== null && price !== null && Number.isFinite(qty * price)
          ? Math.abs(qty * price)
          : (netAmount !== null ? Math.abs(netAmount) : null);
        const result = await this.db.prepare(`
          INSERT INTO broker_fees (
            activity_id, fee_type, activity_sub_type, created_date, created_at, symbol,
            order_id, asset_or_currency, qty, price, net_amount, usd_value,
            attribution_status, strategy, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unattributed', NULL, ?)
          ON CONFLICT(activity_id) DO UPDATE SET
            fee_type = excluded.fee_type,
            activity_sub_type = excluded.activity_sub_type,
            created_date = excluded.created_date,
            created_at = excluded.created_at,
            symbol = excluded.symbol,
            order_id = excluded.order_id,
            asset_or_currency = excluded.asset_or_currency,
            qty = excluded.qty,
            price = excluded.price,
            net_amount = excluded.net_amount,
            usd_value = excluded.usd_value,
            description = excluded.description
        `).bind(
          activity.id,
          activity.activity_type,
          activity.activity_sub_type ?? null,
          activity.date ?? null,
          activity.created_at ?? null,
          activity.symbol?.replace('/', '').toUpperCase() ?? null,
          activity.order_id ?? null,
          activity.currency ?? (activity.symbol ? activity.symbol.replace('/', '').toUpperCase().replace(/USD$/, '') : 'USD'),
          qty,
          price,
          netAmount,
          derivedUsd,
          activity.description ?? null,
        ).run();
        fees += result.meta.changes ?? 0;
      }
    }
    return { activities: activities.length, fills, fees };
  }

  async getBrokerFeeSummary(): Promise<{
    totalUsd: number;
    cryptoUsd: number;
    cryptoUsdRecent: number;
    regulatoryUsd: number;
    unattributedUsd: number;
    cryptoRateBps: number | null;
    cryptoFeeSampleCount: number;
    cryptoTradedNotionalUsd: number;
    cryptoFeeAsOf: string | null;
    cryptoFeeTelemetryStatus: 'available' | 'insufficient' | 'unavailable';
  }> {
    await this.ensureTradeSchema();
    const row = await this.db.prepare(`
      SELECT
        COALESCE(SUM(usd_value), 0) as total_usd,
        COALESCE(SUM(CASE WHEN fee_type = 'CFEE' AND usd_value > 0 THEN usd_value ELSE 0 END), 0) as crypto_usd,
        (SELECT COALESCE(SUM(usd_value), 0)
           FROM broker_fees
          WHERE fee_type = 'CFEE'
            AND usd_value > 0
            AND COALESCE(created_at, created_date) >= datetime('now', '-7 days')) as crypto_usd_recent,
        COALESCE(SUM(CASE WHEN fee_type = 'FEE' THEN usd_value ELSE 0 END), 0) as regulatory_usd,
        COALESCE(SUM(CASE WHEN attribution_status = 'unattributed' THEN usd_value ELSE 0 END), 0) as unattributed_usd,
        (SELECT COUNT(*)
           FROM broker_fees
          WHERE fee_type = 'CFEE'
            AND usd_value IS NOT NULL
            AND usd_value > 0
            AND COALESCE(created_at, created_date) >= datetime('now', '-7 days')) as crypto_fee_samples,
        (SELECT COALESCE(SUM(ABS(qty * price)), 0)
           FROM broker_fills
          WHERE symbol IN (${DEFAULT_CRYPTO_UNIVERSE.map(symbol => `'${symbol}'`).join(',')})
            AND qty IS NOT NULL AND qty > 0
            AND price IS NOT NULL AND price > 0
            AND transaction_time >= datetime('now', '-7 days')) as crypto_notional_usd,
        (SELECT MAX(COALESCE(created_at, created_date))
           FROM broker_fees
          WHERE fee_type = 'CFEE'
            AND usd_value IS NOT NULL
            AND usd_value > 0) as crypto_fee_as_of
      FROM broker_fees
    `).first() as any;
    const cryptoUsd = Number(row?.crypto_usd ?? 0);
    const recentCryptoUsd = Number(row?.crypto_usd_recent ?? 0);
    const notionalUsd = Number(row?.crypto_notional_usd ?? 0);
    const sampleCount = Number(row?.crypto_fee_samples ?? 0);
    const cryptoRateBps = recentCryptoUsd > 0 && notionalUsd > 0 ? (recentCryptoUsd / notionalUsd) * 10000 : null;
    return {
      totalUsd: Number(row?.total_usd ?? 0),
      cryptoUsd,
      cryptoUsdRecent: recentCryptoUsd,
      regulatoryUsd: Number(row?.regulatory_usd ?? 0),
      unattributedUsd: Number(row?.unattributed_usd ?? 0),
      cryptoRateBps,
      cryptoFeeSampleCount: sampleCount,
      cryptoTradedNotionalUsd: notionalUsd,
      cryptoFeeAsOf: row?.crypto_fee_as_of ? String(row.crypto_fee_as_of) : null,
      cryptoFeeTelemetryStatus: sampleCount >= 3 && cryptoRateBps !== null ? 'available' : sampleCount > 0 ? 'insufficient' : 'unavailable',
    };
  }

  async acquireCycleLease(owner: string, ttlMs = CYCLE_LEASE_TTL_MS, leaseKey = 'global'): Promise<boolean> {
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

  async reserveCryptoEntry(input: {
    reservationKey: string;
    owner: string;
    symbol: string;
    notionalUsd: number;
    maxOrdersPerWindow: number;
    windowMs?: number;
    ttlMs?: number;
    nowMs?: number;
  }): Promise<{ reserved: boolean; idempotent: boolean; reason?: string }> {
    try {
      await this.ensureTradeSchema();
      const nowMs = input.nowMs ?? Date.now();
      const windowMs = Math.max(1, Math.floor(input.windowMs ?? 60_000));
      const ttlMs = Math.max(windowMs, Math.floor(input.ttlMs ?? 120_000));
      const maxOrders = Math.max(0, Math.floor(input.maxOrdersPerWindow));
      const notionalUsd = Number(input.notionalUsd);
      if (!input.reservationKey || !input.owner || !input.symbol || !Number.isFinite(notionalUsd) || notionalUsd < 0) {
        return { reserved: false, idempotent: false, reason: 'invalid crypto reservation input' };
      }

      const existing = await this.db.prepare(`
        SELECT owner, status, expires_at
        FROM crypto_entry_reservations
        WHERE reservation_key = ?
        LIMIT 1
      `).bind(input.reservationKey).first() as { owner?: string; status?: string; expires_at?: number } | null;
      // A reservation row is durable until reconciliation proves a terminal
      // broker state or a pre-submit orphan. Its local expiry is only a rate
      // window hint and must never release an unresolved accepted order.
      if (existing) {
        if (existing.owner !== input.owner) {
          return { reserved: false, idempotent: false, reason: 'crypto reservation key owned by another invocation' };
        }
        if (existing.status === 'committed') {
          return { reserved: false, idempotent: true, reason: 'crypto reservation already committed' };
        }
        if (Number(existing.expires_at) <= nowMs) {
          const released = await this.releaseExpiredCryptoEntryReservation(input.reservationKey, nowMs);
          if (!released) {
            return { reserved: false, idempotent: true, reason: 'expired crypto reservation remains linked to an unresolved trade/order' };
          }
        } else {
          return { reserved: true, idempotent: true };
        }
      }

      // The INSERT ... SELECT is the atomic D1/SQLite rate-window boundary.
      const result = await this.db.prepare(`
        INSERT INTO crypto_entry_reservations
          (reservation_key, owner, symbol, notional_usd, status, created_at, expires_at)
        SELECT ?, ?, ?, ?, 'active', ?, ?
        WHERE ? > 0
          AND (
            SELECT COUNT(*) FROM (
              SELECT reservation_key
              FROM crypto_entry_reservations
              WHERE status IN ('active', 'committed')
                AND expires_at > ?
                AND created_at >= ?
                AND NOT EXISTS (
                  SELECT 1 FROM trades
                  WHERE trades.client_order_id = crypto_entry_reservations.reservation_key
                    AND trades.strategy = 'crypto'
                    AND trades.side = 'buy'
                )
              UNION ALL
              SELECT COALESCE(client_order_id, alpaca_order_id)
              FROM trades
              WHERE strategy = 'crypto'
                AND side = 'buy'
                AND status NOT IN ('rejected', 'canceled', 'cancelled', 'expired')
                AND timestamp >= datetime(?, 'unixepoch')
            )
          ) < ?
        ON CONFLICT(reservation_key) DO NOTHING
      `).bind(
        input.reservationKey,
        input.owner,
        input.symbol,
        notionalUsd,
        nowMs,
        nowMs + ttlMs,
        maxOrders,
        nowMs,
        nowMs - windowMs,
        nowMs / 1000,
        maxOrders,
      ).run();
      if ((result.meta.changes ?? 0) > 0) return { reserved: true, idempotent: false };

      const after = await this.db.prepare(`
        SELECT owner, status, expires_at
        FROM crypto_entry_reservations
        WHERE reservation_key = ?
        LIMIT 1
      `).bind(input.reservationKey).first() as { owner?: string; status?: string; expires_at?: number } | null;
      if (after && after.owner === input.owner && Number(after.expires_at) > nowMs) {
        return after.status === 'committed'
          ? { reserved: false, idempotent: true, reason: 'crypto reservation already committed' }
          : { reserved: true, idempotent: true };
      }
      return { reserved: false, idempotent: false, reason: maxOrders === 0 ? 'crypto entry rate limit disabled' : 'crypto entry rate limit reached' };
    } catch (error) {
      return { reserved: false, idempotent: false, reason: `crypto reservation state unavailable: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async finalizeCryptoEntryReservation(reservationKey: string, owner: string, committed: boolean, nowMs = Date.now()): Promise<void> {
    await this.ensureTradeSchema();
    if (committed) {
      await this.db.prepare(`
        UPDATE crypto_entry_reservations
        SET status = 'committed', expires_at = ?
        WHERE reservation_key = ? AND owner = ? AND status = 'active'
      `).bind(nowMs + CRYPTO_COMMITTED_RESERVATION_TTL_MS, reservationKey, owner).run();
    } else {
      await this.db.prepare(
        'DELETE FROM crypto_entry_reservations WHERE reservation_key = ? AND owner = ? AND status = \'active\''
      ).bind(reservationKey, owner).run();
    }
  }

  async getCryptoEntryReservations(nowMs = Date.now()): Promise<Array<{ reservationKey: string; owner: string; symbol: string; notionalUsd: number; status: 'active' | 'committed'; createdAt: number; expiresAt: number }>> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(`
      SELECT reservation_key, owner, symbol, notional_usd, status, created_at, expires_at
      FROM crypto_entry_reservations
      WHERE status = 'committed' OR (status = 'active' AND expires_at > ?)
      ORDER BY created_at ASC
    `).bind(nowMs).all();
    return (result.results as Array<Record<string, unknown>>).flatMap(row => {
      const notionalUsd = Number(row.notional_usd);
      const createdAt = Number(row.created_at);
      const expiresAt = Number(row.expires_at);
      if (!row.reservation_key || !row.owner || !row.symbol || !Number.isFinite(notionalUsd) || notionalUsd < 0 || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) return [];
      return [{
        reservationKey: String(row.reservation_key),
        owner: String(row.owner),
        symbol: String(row.symbol),
        notionalUsd,
        status: row.status === 'committed' ? 'committed' as const : 'active' as const,
        createdAt,
        expiresAt,
      }];
    });
  }

  async getCryptoEntryReservationNotional(): Promise<number> {
    const reservations = await this.getCryptoEntryReservations();
    return reservations.reduce((total, reservation) => total + reservation.notionalUsd, 0);
  }

  async releaseExpiredCryptoEntryReservation(reservationKey: string, nowMs = Date.now()): Promise<boolean> {
    await this.ensureTradeSchema();
    // Expiry alone is not evidence that a broker submit was never accepted.
    // Delete only an active expired row with no locally linked trade/order;
    // committed and unresolved rows remain durable for reconciliation.
    const result = await this.db.prepare(`
      DELETE FROM crypto_entry_reservations
       WHERE reservation_key = ?
         AND status = 'active'
         AND expires_at <= ?
         AND NOT EXISTS (
           SELECT 1 FROM trades
            WHERE trades.client_order_id = crypto_entry_reservations.reservation_key
               OR trades.alpaca_order_id = crypto_entry_reservations.reservation_key
         )
    `).bind(reservationKey, nowMs).run();
    return (result.meta.changes ?? 0) > 0;
  }

  /**
   * Bounded maintenance cleanup for expired active reservation orphans. A row
   * is removed only when no local trade/order references its deterministic key;
   * committed reservations and any linked/unknown state are retained.
   */
  async cleanupExpiredCryptoEntryReservations(limit = 25, nowMs = Date.now()): Promise<number> {
    await this.ensureTradeSchema();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const result = await this.db.prepare(`
      DELETE FROM crypto_entry_reservations
       WHERE rowid IN (
         SELECT reservation.rowid
           FROM crypto_entry_reservations AS reservation
          WHERE reservation.status = 'active'
            AND reservation.expires_at <= ?
            AND NOT EXISTS (
              SELECT 1 FROM trades
               WHERE trades.client_order_id = reservation.reservation_key
                  OR trades.alpaca_order_id = reservation.reservation_key
            )
          ORDER BY reservation.expires_at ASC, reservation.created_at ASC
          LIMIT ?
       )
    `).bind(nowMs, safeLimit).run();
    return result.meta.changes ?? 0;
  }

  async reconcileCryptoEntryReservation(order: Order): Promise<void> {
    await this.ensureTradeSchema();
    const reservationKey = order.client_order_id;
    if (!reservationKey) return;
    try {
      if (TERMINAL_ORDER_STATUSES.has(order.status)) {
        const hasPartialFill = order.filled_qty > 0 && order.filled_qty < order.qty * 0.999;
        if (!hasPartialFill) {
          await this.db.prepare(
            'DELETE FROM crypto_entry_reservations WHERE reservation_key = ?'
          ).bind(reservationKey).run();
          return;
        }
        // A canceled/expired/replaced order can still leave broker exposure.
        // Retain the reservation until the current broker position and the
        // terminal trade are reconciled, preventing a duplicate full retry.
        await this.db.prepare(`
          UPDATE crypto_entry_reservations
          SET status = 'committed', expires_at = ?
          WHERE reservation_key = ?
        `).bind(Date.now() + CRYPTO_COMMITTED_RESERVATION_TTL_MS, reservationKey).run();
        return;
      }
      await this.db.prepare(`
        UPDATE crypto_entry_reservations
        SET status = 'committed', expires_at = ?
        WHERE reservation_key = ?
      `).bind(Date.now() + CRYPTO_COMMITTED_RESERVATION_TTL_MS, reservationKey).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('no such table')) throw error;
      // The standalone reservation migration is optional for stock-only and
      // legacy reconciliation. Crypto entry admission remains fail-closed when
      // the reservation exposure cannot be read.
    }
  }

  async getLatestCryptoEntryProtection(symbol: string): Promise<{ stop_loss_price: number | null; take_profit_price: number | null } | null> {
    await this.ensureTradeSchema();
    const row = await this.db.prepare(`
      SELECT intent_stop_loss_price, intent_take_profit_price
      FROM trades
      WHERE strategy = 'crypto' AND side = 'buy' AND ticker = ?
        AND intent_stop_loss_price IS NOT NULL AND intent_take_profit_price IS NOT NULL
      ORDER BY timestamp DESC LIMIT 1
    `).bind(symbol).first() as { intent_stop_loss_price?: number | null; intent_take_profit_price?: number | null } | null;
    if (!row) return null;
    return {
      stop_loss_price: row.intent_stop_loss_price ?? null,
      take_profit_price: row.intent_take_profit_price ?? null,
    };
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

  private shapeDecision(row: any): any {
    const storedReason = row.execution_reason || row.reason || '';
    const structured = parseDecisionSkip(row.execution_reason);
    return {
      ...row,
      execution_reason: structured?.message ?? storedReason,
      ...(structured ? { skip_context: structured.context } : {}),
    };
  }

  async getRecentDecisions(limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(
      'SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?'
    ).bind(limit).all();
    return (result.results as any[]).map(row => this.shapeDecision(row));
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
    return (result.results as any[]).map(row => this.shapeDecision(row));
  }

  // ============================================================
  // Trades
  // ============================================================

  async logTrade(record: TradeRecord): Promise<number> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      `INSERT INTO trades (alpaca_order_id, client_order_id, ticker, side, qty, filled_qty, leaves_qty, fill_price, avg_fill_price, status, order_type, limit_price, stop_price, time_in_force, estimated_value, decision_id, error_message, strategy, broker_updated_at, submitted_at, filled_at, canceled_at, expired_at, failed_at, replaced_at, intent_stop_loss_price, intent_take_profit_price, last_reconciled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      record.alpaca_order_id,
      record.client_order_id ?? null,
      record.ticker,
      record.side,
      record.qty,
      record.filled_qty ?? null,
      record.leaves_qty ?? null,
      record.fill_price,
      record.avg_fill_price,
      record.status,
      record.order_type,
      record.limit_price,
      record.stop_price,
      record.time_in_force ?? 'day',
      record.estimated_value,
      record.decision_id,
      record.error_message,
      record.strategy ?? null,
      record.broker_updated_at ?? null,
      record.submitted_at ?? null,
      record.filled_at ?? null,
      record.canceled_at ?? null,
      record.expired_at ?? null,
      record.failed_at ?? null,
      record.replaced_at ?? null,
      record.intent_stop_loss_price ?? null,
      record.intent_take_profit_price ?? null
    ).run();

    return result.meta.last_row_id as number;
  }

  async countRecentSubmittedOrders(strategy: 'daytrading' | 'swing' | 'crypto', side: 'buy' | 'sell', windowSeconds: number): Promise<number> {
    await this.ensureTradeSchema();
    const safeWindowSeconds = Math.max(1, Math.floor(windowSeconds));
    const row = await this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM trades
      WHERE strategy = ?
        AND side = ?
        AND timestamp >= datetime('now', ?)
        AND status NOT IN ('rejected', 'canceled', 'cancelled', 'expired')
    `).bind(strategy, side, `-${safeWindowSeconds} seconds`).first() as { count?: number } | null;
    return Number(row?.count ?? 0);
  }

  /**
   * Detect a trade that must block reuse of the same deterministic
   * client_order_id. Non-terminal rows always block. Terminal rows with any
   * broker-confirmed fill also block because retrying could duplicate exposure;
   * zero-fill terminal rejected/canceled/expired rows remain retryable.
   */
  async findNonTerminalTradeByClientOrderId(clientOrderId: string): Promise<
    | {
        tradeId: number;
        status: string;
        side: string;
        ticker: string;
        filledQty: number;
        leavesQty: number;
        alpacaOrderId: string | null;
        clientOrderId: string | null;
        decisionId: number | null;
        strategy: TradeRecord['strategy'];
      }
    | undefined
  > {
    await this.ensureTradeSchema();
    const row = await this.db.prepare(
      `SELECT id, status, side, ticker, qty, filled_qty, leaves_qty,
              alpaca_order_id, client_order_id, decision_id, strategy
         FROM trades
        WHERE client_order_id = ?
          AND (
            status NOT IN ('rejected', 'canceled', 'cancelled', 'expired', 'replaced', 'done_for_day', 'stopped')
            OR COALESCE(filled_qty, 0) > 0
          )
        ORDER BY COALESCE(broker_updated_at, timestamp) DESC, id DESC LIMIT 1`
    ).bind(clientOrderId).first() as {
      id: number;
      status: string;
      side: string;
      ticker: string;
      qty: number;
      filled_qty: number | null;
      leaves_qty: number | null;
      alpaca_order_id: string | null;
      client_order_id: string | null;
      decision_id: number | null;
      strategy: TradeRecord['strategy'];
    } | null;
    if (!row) return undefined;
    return {
      tradeId: row.id,
      status: row.status,
      side: row.side,
      ticker: row.ticker,
      filledQty: Number(row.filled_qty ?? 0),
      leavesQty: Number(row.leaves_qty ?? Math.max(0, Number(row.qty ?? 0) - Number(row.filled_qty ?? 0))),
      alpacaOrderId: row.alpaca_order_id,
      clientOrderId: row.client_order_id,
      decisionId: row.decision_id,
      strategy: row.strategy ?? null,
    };
  }

  async logOrderTrade(order: Order, options: {
    decisionId?: number | null;
    estimatedValue?: number | null;
    errorMessage?: string | null;
    strategy?: 'daytrading' | 'swing' | 'crypto' | null;
    intentStopLossPrice?: number | null;
    intentTakeProfitPrice?: number | null;
  } = {}): Promise<number> {
    await this.ensureTradeSchema();
    const existing = await this.db.prepare(
      'SELECT id, filled_qty, leaves_qty, fill_price, avg_fill_price, broker_updated_at, strategy FROM trades WHERE alpaca_order_id = ? LIMIT 1'
    ).bind(order.id).first() as {
      id?: number;
      filled_qty?: number | null;
      leaves_qty?: number | null;
      fill_price?: number | null;
      avg_fill_price?: number | null;
      broker_updated_at?: string | null;
      strategy?: TradeRecord['strategy'];
    } | null;
    if (existing?.id !== undefined && existing?.id !== null) {
      await this.db.prepare(
        `UPDATE trades SET client_order_id = COALESCE(?, client_order_id),
             time_in_force = COALESCE(?, time_in_force),
             status = CASE WHEN broker_updated_at IS NULL OR ? >= broker_updated_at THEN ? ELSE status END,
             filled_qty = MAX(COALESCE(filled_qty, 0), COALESCE(?, 0)),
             leaves_qty = COALESCE(?, leaves_qty),
             fill_price = COALESCE(?, fill_price), avg_fill_price = COALESCE(?, avg_fill_price),
             broker_updated_at = CASE WHEN broker_updated_at IS NULL OR ? >= broker_updated_at THEN ? ELSE broker_updated_at END,
             submitted_at = CASE WHEN ? IS NOT NULL AND (submitted_at IS NULL OR ? >= submitted_at) THEN ? ELSE submitted_at END,
             filled_at = CASE WHEN ? IS NOT NULL AND (filled_at IS NULL OR ? >= filled_at) THEN ? ELSE filled_at END,
             canceled_at = CASE WHEN ? IS NOT NULL AND (canceled_at IS NULL OR ? >= canceled_at) THEN ? ELSE canceled_at END,
             expired_at = CASE WHEN ? IS NOT NULL AND (expired_at IS NULL OR ? >= expired_at) THEN ? ELSE expired_at END,
             failed_at = CASE WHEN ? IS NOT NULL AND (failed_at IS NULL OR ? >= failed_at) THEN ? ELSE failed_at END,
             replaced_at = CASE WHEN ? IS NOT NULL AND (replaced_at IS NULL OR ? >= replaced_at) THEN ? ELSE replaced_at END,
             last_reconciled_at = datetime('now'),
             decision_id = COALESCE(decision_id, ?), strategy = COALESCE(strategy, ?),
             intent_stop_loss_price = COALESCE(intent_stop_loss_price, ?),
             intent_take_profit_price = COALESCE(intent_take_profit_price, ?)
         WHERE alpaca_order_id = ?`
      ).bind(order.client_order_id ?? null, order.time_in_force ?? null, order.updated_at ?? null, order.status,
        order.filled_qty, order.leaves_qty, order.filled_avg_price, order.filled_avg_price,
        order.updated_at ?? null, order.updated_at ?? null,
        order.submitted_at ?? null, order.submitted_at ?? null, order.submitted_at ?? null,
        order.filled_at ?? null, order.filled_at ?? null, order.filled_at ?? null,
        order.canceled_at ?? null, order.canceled_at ?? null, order.canceled_at ?? null,
        order.expired_at ?? null, order.expired_at ?? null, order.expired_at ?? null,
        order.failed_at ?? null, order.failed_at ?? null, order.failed_at ?? null,
        order.replaced_at ?? null, order.replaced_at ?? null, order.replaced_at ?? null,
        options.decisionId ?? null, options.strategy ?? null, options.intentStopLossPrice ?? null, options.intentTakeProfitPrice ?? null, order.id).run();
      return existing.id as number;
    }

    return this.logTrade({
      alpaca_order_id: order.id,
      client_order_id: order.client_order_id,
      ticker: order.symbol,
      side: order.side,
      qty: order.qty,
      filled_qty: order.filled_qty,
      leaves_qty: order.leaves_qty ?? Math.max(0, order.qty - order.filled_qty),
      fill_price: order.filled_avg_price,
      avg_fill_price: order.filled_avg_price,
      status: order.status,
      broker_updated_at: order.updated_at,
      submitted_at: order.submitted_at,
      filled_at: order.filled_at,
      canceled_at: order.canceled_at,
      expired_at: order.expired_at,
      failed_at: order.failed_at,
      replaced_at: order.replaced_at,
      order_type: order.type,
      time_in_force: order.time_in_force,
      limit_price: order.limit_price,
      stop_price: order.stop_price,
      estimated_value: options.estimatedValue ?? (order.qty * (order.filled_avg_price ?? order.limit_price ?? order.stop_price ?? 0)),
      decision_id: options.decisionId ?? null,
      error_message: options.errorMessage ?? null,
      strategy: options.strategy ?? null,
      intent_stop_loss_price: options.intentStopLossPrice ?? null,
      intent_take_profit_price: options.intentTakeProfitPrice ?? null,
    });
  }

  async updateTradeStatus(orderId: string, status: string, fillPrice: number | null, avgFillPrice: number | null, order?: Order): Promise<void> {
    await this.ensureTradeSchema();
    await this.db.prepare(
      `UPDATE trades SET
         status = CASE WHEN broker_updated_at IS NULL OR ? IS NULL OR ? >= broker_updated_at THEN ? ELSE status END,
         filled_qty = CASE WHEN ? IS NULL THEN filled_qty ELSE MAX(COALESCE(filled_qty, 0), ?) END,
         leaves_qty = COALESCE(?, leaves_qty),
         fill_price = COALESCE(?, fill_price),
         avg_fill_price = COALESCE(?, avg_fill_price),
         client_order_id = COALESCE(?, client_order_id),
         time_in_force = COALESCE(?, time_in_force),
         broker_updated_at = CASE WHEN ? IS NULL OR broker_updated_at IS NULL OR ? >= broker_updated_at THEN ? ELSE broker_updated_at END,
         submitted_at = CASE WHEN ? IS NOT NULL AND (submitted_at IS NULL OR ? >= submitted_at) THEN ? ELSE submitted_at END,
         filled_at = CASE WHEN ? IS NOT NULL AND (filled_at IS NULL OR ? >= filled_at) THEN ? ELSE filled_at END,
         canceled_at = CASE WHEN ? IS NOT NULL AND (canceled_at IS NULL OR ? >= canceled_at) THEN ? ELSE canceled_at END,
         expired_at = CASE WHEN ? IS NOT NULL AND (expired_at IS NULL OR ? >= expired_at) THEN ? ELSE expired_at END,
         failed_at = CASE WHEN ? IS NOT NULL AND (failed_at IS NULL OR ? >= failed_at) THEN ? ELSE failed_at END,
         replaced_at = CASE WHEN ? IS NOT NULL AND (replaced_at IS NULL OR ? >= replaced_at) THEN ? ELSE replaced_at END,
         last_reconciled_at = datetime('now')
       WHERE alpaca_order_id = ?`
    ).bind(
      order?.updated_at ?? null, order?.updated_at ?? null, status,
      order?.filled_qty ?? null, order?.filled_qty ?? null,
      order ? order.qty - order.filled_qty : null,
      fillPrice, avgFillPrice, order?.client_order_id ?? null, order?.time_in_force ?? null,
      order?.updated_at ?? null, order?.updated_at ?? null, order?.updated_at ?? null,
      order?.submitted_at ?? null, order?.submitted_at ?? null, order?.submitted_at ?? null,
      order?.filled_at ?? null, order?.filled_at ?? null, order?.filled_at ?? null,
      order?.canceled_at ?? null, order?.canceled_at ?? null, order?.canceled_at ?? null,
      order?.expired_at ?? null, order?.expired_at ?? null, order?.expired_at ?? null,
      order?.failed_at ?? null, order?.failed_at ?? null, order?.failed_at ?? null,
      order?.replaced_at ?? null, order?.replaced_at ?? null, order?.replaced_at ?? null,
      orderId,
    ).run();
  }

  private async inferCryptoSellStrategy(
    symbol: string,
    createdAt: string | null | undefined,
    existingStrategy?: TradeRecord['strategy'],
  ): Promise<TradeRecord['strategy']> {
    const [positions, earlierTrades] = await Promise.all([
      this.db.prepare(
        `SELECT ticker, strategy FROM positions
         WHERE closed_at IS NULL AND strategy IS NOT NULL`
      ).all(),
      this.db.prepare(
        `SELECT ticker, side, strategy, timestamp FROM trades
         WHERE side = 'buy' AND strategy = 'crypto'`
      ).all(),
    ]);

    return inferCryptoSellStrategy({
      orderSymbol: symbol,
      orderSide: 'sell',
      orderCreatedAt: createdAt,
      existingStrategy,
      openPositions: positions.results as unknown as PositionAttributionMetadata[],
      earlierTrades: earlierTrades.results as unknown as CryptoBuyAttributionMetadata[],
      cryptoUniverse: DEFAULT_CRYPTO_UNIVERSE,
    });
  }

  /**
   * Apply broker order snapshots to D1 without broker side effects.
   * Both buys and sells are imported. Status and fill progress are monotonic:
   * an older broker snapshot cannot overwrite a newer status/timestamp or reduce
   * filled_qty. Terminal statuses are documented in alpaca.ts.
   */
  async reconcileOrders(orders: Order[]): Promise<number> {
    await this.ensureTradeSchema();
    let imported = 0;
    for (const order of orders) {
      if (!order?.id || (order.side !== 'buy' && order.side !== 'sell')) continue;
      const existing = await this.db.prepare(
        'SELECT id, decision_id, strategy, status, broker_updated_at, leaves_qty FROM trades WHERE alpaca_order_id = ? LIMIT 1'
      ).bind(order.id).first() as {
        id?: number;
        decision_id?: number | null;
        strategy?: TradeRecord['strategy'];
        status?: string | null;
        broker_updated_at?: string | null;
        leaves_qty?: number | null;
      } | null;
      let strategy: TradeRecord['strategy'] = existing?.strategy ?? null;
      if (order.side === 'sell') {
        strategy = (await this.inferCryptoSellStrategy(order.symbol, order.created_at, strategy)) ?? null;
      }
      if (existing?.id !== undefined && existing.id !== null) {
        const incomingUpdatedAt = order.updated_at ?? null;
        const isNewerOrEqual = !existing.broker_updated_at || !incomingUpdatedAt || incomingUpdatedAt >= existing.broker_updated_at;
        const preserveTerminalStatus = Boolean(existing.status && TERMINAL_ORDER_STATUSES.has(existing.status) && !TERMINAL_ORDER_STATUSES.has(order.status));
        const status = preserveTerminalStatus || !isNewerOrEqual ? (existing.status ?? order.status) : order.status;
        const leavesQty = isNewerOrEqual
          ? (order.leaves_qty ?? Math.max(0, order.qty - order.filled_qty))
          : existing.leaves_qty ?? null;
        const brokerUpdatedAt = isNewerOrEqual ? incomingUpdatedAt : existing.broker_updated_at ?? null;
        await this.db.prepare(
          `UPDATE trades SET
             client_order_id = COALESCE(?, client_order_id),
             status = ?,
             filled_qty = MAX(COALESCE(filled_qty, 0), COALESCE(?, 0)),
             leaves_qty = COALESCE(?, leaves_qty),
             fill_price = COALESCE(?, fill_price),
             avg_fill_price = COALESCE(?, avg_fill_price),
             time_in_force = COALESCE(?, time_in_force),
             broker_updated_at = ?,
             submitted_at = CASE WHEN ? IS NOT NULL AND (submitted_at IS NULL OR ? >= submitted_at) THEN ? ELSE submitted_at END,
             filled_at = CASE WHEN ? IS NOT NULL AND (filled_at IS NULL OR ? >= filled_at) THEN ? ELSE filled_at END,
             canceled_at = CASE WHEN ? IS NOT NULL AND (canceled_at IS NULL OR ? >= canceled_at) THEN ? ELSE canceled_at END,
             expired_at = CASE WHEN ? IS NOT NULL AND (expired_at IS NULL OR ? >= expired_at) THEN ? ELSE expired_at END,
             failed_at = CASE WHEN ? IS NOT NULL AND (failed_at IS NULL OR ? >= failed_at) THEN ? ELSE failed_at END,
             replaced_at = CASE WHEN ? IS NOT NULL AND (replaced_at IS NULL OR ? >= replaced_at) THEN ? ELSE replaced_at END,
             strategy = COALESCE(strategy, ?), last_reconciled_at = datetime('now')
           WHERE alpaca_order_id = ?`
        ).bind(
          order.client_order_id ?? null, status, order.filled_qty, leavesQty,
          order.filled_avg_price, order.filled_avg_price, order.time_in_force ?? null, brokerUpdatedAt,
          order.submitted_at ?? null, order.submitted_at ?? null, order.submitted_at ?? null,
          order.filled_at ?? null, order.filled_at ?? null, order.filled_at ?? null,
          order.canceled_at ?? null, order.canceled_at ?? null, order.canceled_at ?? null,
          order.expired_at ?? null, order.expired_at ?? null, order.expired_at ?? null,
          order.failed_at ?? null, order.failed_at ?? null, order.failed_at ?? null,
          order.replaced_at ?? null, order.replaced_at ?? null, order.replaced_at ?? null,
          strategy, order.id,
        ).run();

        await this.reconcileCryptoEntryReservation(order);

        if (existing.decision_id !== null && existing.decision_id !== undefined && isNewerOrEqual) {
          const fullyFilled = status === 'filled' && order.filled_qty > 0 && order.filled_qty >= order.qty * 0.999;
          const terminalRejected = ['rejected', 'canceled', 'cancelled', 'expired', 'done_for_day', 'stopped'].includes(status);
          const executed = fullyFilled ? 1 : terminalRejected ? 2 : 0;
          const reason = fullyFilled
            ? `Broker confirmed fill: ${order.filled_qty}/${order.qty} @ ${order.filled_avg_price ?? 'unknown'}`
            : terminalRejected
              ? `Broker order terminal status: ${status}`
              : `Broker order status: ${status}; filled ${order.filled_qty}/${order.qty}`;
          await this.updateDecisionStatus(existing.decision_id, executed, reason);
        }
      } else {
        await this.logOrderTrade(order, { strategy });
        await this.reconcileCryptoEntryReservation(order);
        imported++;
      }
    }
    await this.backfillCryptoSellAttribution();
    return imported;
  }

  /**
   * Idempotently repair only NULL-strategy sell rows that the same narrow
   * crypto attribution rules can prove are crypto. Unknown symbols, stock
   * punctuation, non-USD pairs, buys, and already-attributed rows are untouched.
   */
  async backfillCryptoSellAttribution(limit = 200): Promise<number> {
    await this.ensureTradeSchema();
    const rows = await this.db.prepare(
      `SELECT id, ticker, side, timestamp, strategy FROM trades
       WHERE side = 'sell' AND strategy IS NULL
       ORDER BY timestamp ASC LIMIT ?`
    ).bind(limit).all();
    let updated = 0;

    for (const row of rows.results as Array<{
      id: number;
      ticker: string;
      side: string;
      timestamp: string;
      strategy: TradeRecord['strategy'];
    }>) {
      const strategy = await this.inferCryptoSellStrategy(row.ticker, row.timestamp, null);
      if (strategy !== 'crypto') continue;
      const result = await this.db.prepare(
        `UPDATE trades SET strategy = 'crypto'
         WHERE id = ? AND side = 'sell' AND strategy IS NULL`
      ).bind(row.id).run();
      if ((result.meta.changes ?? 0) > 0) updated++;
    }
    return updated;
  }

  async getTradesNeedingSync(limit: number = 200, includeLifecycleBackfill = false): Promise<any[]> {
    await this.ensureTradeSchema();
    const terminalStatuses = "'filled', 'canceled', 'cancelled', 'rejected', 'expired', 'replaced', 'done_for_day', 'stopped'";
    const predicate = includeLifecycleBackfill
      ? `(status NOT IN (${terminalStatuses})
          OR (status = 'filled' AND (submitted_at IS NULL OR filled_at IS NULL))
          OR (status IN ('canceled', 'cancelled') AND (submitted_at IS NULL OR canceled_at IS NULL))
          OR (status = 'expired' AND (submitted_at IS NULL OR expired_at IS NULL))
          OR (status = 'replaced' AND (submitted_at IS NULL OR replaced_at IS NULL))
          OR (status = 'rejected' AND failed_at IS NULL)
          OR (status IN ('done_for_day', 'stopped') AND submitted_at IS NULL))`
      : `status NOT IN (${terminalStatuses})`;
    const result = await this.db.prepare(
      `SELECT * FROM trades
       WHERE alpaca_order_id IS NOT NULL
         AND ${predicate}
       ORDER BY COALESCE(last_reconciled_at, timestamp) ASC LIMIT ?`
    ).bind(limit).all();
    return result.results as any[];
  }

  async findNonTerminalExitBySymbol(strategy: 'daytrading' | 'swing', ticker: string): Promise<{
    tradeId: number;
    status: string;
    qty: number;
    filledQty: number;
    leavesQty: number;
    alpacaOrderId: string | null;
    clientOrderId: string | null;
    brokerUpdatedAt: string | null;
    lastReconciledAt: string | null;
  } | undefined> {
    await this.ensureTradeSchema();
    const row = await this.db.prepare(
      `SELECT id, status, qty, filled_qty, leaves_qty, alpaca_order_id, client_order_id,
              broker_updated_at, last_reconciled_at
       FROM trades
       WHERE (strategy = ? OR strategy IS NULL)
         AND ticker = ?
         AND side = 'sell'
         AND status NOT IN ('filled', 'canceled', 'cancelled', 'rejected', 'expired', 'replaced', 'done_for_day', 'stopped')
       ORDER BY COALESCE(broker_updated_at, timestamp) DESC, id DESC LIMIT 1`
    ).bind(strategy, ticker).first() as {
      id: number;
      status: string;
      qty: number;
      filled_qty: number | null;
      leaves_qty: number | null;
      alpaca_order_id: string | null;
      client_order_id: string | null;
      broker_updated_at: string | null;
      last_reconciled_at: string | null;
    } | null;
    if (!row) return undefined;
    return {
      tradeId: row.id,
      status: row.status,
      qty: Number(row.qty ?? 0),
      filledQty: Number(row.filled_qty ?? 0),
      leavesQty: Number(row.leaves_qty ?? Math.max(0, Number(row.qty ?? 0) - Number(row.filled_qty ?? 0))),
      alpacaOrderId: row.alpaca_order_id,
      clientOrderId: row.client_order_id,
      brokerUpdatedAt: row.broker_updated_at,
      lastReconciledAt: row.last_reconciled_at,
    };
  }

  /**
   * Add conservative per-trade accounting metadata without inventing
   * fill/lot-level P&L. Gross P&L cannot currently be linked to a single
   * trade because positions.closed_pl has no order/lot key. Fees are exposed
   * only when every broker_fees row linked by order_id has a known USD value;
   * orderless/account-level fees remain outside individual trades.
   */
  private async enrichTradeAccounting(trades: any[]): Promise<any[]> {
    if (trades.length === 0) return trades;
    const orderIds = Array.from(new Set(
      trades.map(trade => trade.alpaca_order_id).filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    ));
    const feesByOrder = new Map<string, { fee: number | null; attribution: 'broker-attributed' | 'broker-linked-value-unavailable' }>();
    // D1 rejects oversized variable lists. Keep this read-only enrichment bounded
    // because scheduled strategy reads can request up to 200 trades and the API
    // can request up to 500 trades.
    const orderIdBatchSize = 50;
    for (let start = 0; start < orderIds.length; start += orderIdBatchSize) {
      const batch = orderIds.slice(start, start + orderIdBatchSize);
      const placeholders = batch.map(() => '?').join(',');
      const feeRows = await this.db.prepare(
        `SELECT order_id,
                SUM(CASE WHEN usd_value IS NOT NULL AND usd_value >= 0 THEN usd_value ELSE 0 END) AS fee_usd,
                COUNT(*) AS fee_rows,
                SUM(CASE WHEN usd_value IS NULL OR usd_value < 0 THEN 1 ELSE 0 END) AS unknown_fee_rows
           FROM broker_fees
          WHERE order_id IN (${placeholders})
            AND order_id IS NOT NULL
            AND TRIM(order_id) <> ''
          GROUP BY order_id`
      ).bind(...batch).all();
      for (const row of feeRows.results as Array<{
        order_id?: string | null;
        fee_usd?: number | null;
        fee_rows?: number | null;
        unknown_fee_rows?: number | null;
      }>) {
        if (!row.order_id || Number(row.fee_rows ?? 0) <= 0) continue;
        const unknownFeeRows = Number(row.unknown_fee_rows ?? 0);
        const fee = row.fee_usd == null ? null : Number(row.fee_usd);
        feesByOrder.set(String(row.order_id), {
          fee: unknownFeeRows === 0 && fee !== null && Number.isFinite(fee) ? fee : null,
          attribution: unknownFeeRows === 0 && fee !== null && Number.isFinite(fee)
            ? 'broker-attributed'
            : 'broker-linked-value-unavailable',
        });
      }
    }

    return trades.map(trade => {
      const linkedFee = trade.alpaca_order_id ? feesByOrder.get(String(trade.alpaca_order_id)) : undefined;
      const gross = null;
      const fee = linkedFee?.fee ?? null;
      const net = gross !== null && fee !== null ? gross - fee : null;
      const filledQty = Number(trade.filled_qty);
      const averageFillPrice = Number(trade.avg_fill_price);
      const filledNotional = Number.isFinite(filledQty) && filledQty > 0 && Number.isFinite(averageFillPrice)
        ? filledQty * averageFillPrice
        : null;
      const estimatedValue = Number(trade.estimated_value);
      const estimatedVsFilledDelta = filledNotional !== null && Number.isFinite(estimatedValue)
        ? filledNotional - estimatedValue
        : null;
      const observabilityFields = TRADE_OBSERVABILITY_FIELDS.reduce<Record<string, unknown>>((fields, field) => {
        fields[field] = trade[field] ?? null;
        return fields;
      }, {});
      return {
        ...trade,
        ...observabilityFields,
        gross,
        fee,
        net,
        estimated_value_basis: 'order_time_estimate',
        filled_notional: filledNotional,
        estimated_vs_filled_delta: estimatedVsFilledDelta,
        accounting_status: 'unavailable_fill_lot_exact',
        fee_attribution: linkedFee?.attribution ?? 'none-recorded',
      };
    });
  }

  async getRecentTrades(
    limit: number = 50,
    strategy?: 'daytrading' | 'swing' | 'crypto',
    offset: number = 0,
    status?: string,
  ): Promise<any[]> {
    await this.ensureTradeSchema();
    const predicates: string[] = [];
    const bindings: unknown[] = [];
    if (strategy) {
      predicates.push('strategy = ?');
      bindings.push(strategy);
    }
    if (status) {
      predicates.push('status = ?');
      bindings.push(status);
    }
    const where = predicates.length > 0 ? ` WHERE ${predicates.join(' AND ')}` : '';
    const query = `SELECT * FROM trades${where} ORDER BY timestamp DESC, id ASC LIMIT ? OFFSET ?`;
    const boundedOffset = Math.max(0, Math.floor(offset));
    const result = await this.db.prepare(query).bind(...bindings, limit, boundedOffset).all();
    return this.enrichTradeAccounting(result.results as any[]);
  }

  async getRecentTradesByStrategy(strategy: 'daytrading' | 'swing' | 'crypto', limit: number = 100): Promise<any[]> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      'SELECT * FROM trades WHERE strategy = ? ORDER BY timestamp DESC LIMIT ?'
    ).bind(strategy, limit).all();
    return this.enrichTradeAccounting(result.results as any[]);
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

  async closePosition(ticker: string, closedPl: number | null, reason: string): Promise<void> {
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

  /** Read the latest durable account-equity observations for rolling risk checks. */
  async getRecentEquityHistory(limit: number = 20): Promise<number[]> {
    const snapshots = await this.getRecentSnapshots(limit);
    return snapshots
      .map(snapshot => Number(snapshot.equity))
      .filter(equity => Number.isFinite(equity))
      .reverse();
  }

  // ============================================================
  // Category snapshots (per-strategy market value & P&L, broker-authoritative)
  // ============================================================

  /**
   * Realized P&L for positions closed today, grouped by strategy, using a
   * UTC day boundary (SQLite's date('now') is UTC). Each position's
   * closed_pl is recorded exactly once when it closes, so this never
   * double-counts or fabricates a value for a day with no closes.
   */
  async getRealizedPlToday(): Promise<Record<string, number>> {
    const result = await this.db.prepare(
      `SELECT COALESCE(strategy, 'daytrading') as strategy,
              COALESCE(SUM(closed_pl), 0) as realized_today
         FROM positions
        WHERE closed_at IS NOT NULL AND closed_pl IS NOT NULL AND closed_at >= date('now')
        GROUP BY COALESCE(strategy, 'daytrading')`
    ).all();
    const out: Record<string, number> = {};
    for (const r of result.results as any[]) out[r.strategy] = r.realized_today;
    return out;
  }

  /**
   * Log one row per category from currently-known broker positions.
   * daily_pl = today's broker-reported intraday unrealized change for
   * currently-held positions + today's already-recorded realized closes.
   * Categories with zero current exposure are still logged at zero — this
   * is real (no positions), not a fabricated/missing value.
   */
  async logCategorySnapshots(summaries: readonly CategoryPositionSummary[]): Promise<void> {
    await this.ensureTradeSchema();
    const realizedToday = await this.getRealizedPlToday();
    for (const s of summaries) {
      const realizedPlToday = realizedToday[s.strategy] ?? 0;
      const dailyPl = s.unrealizedIntradayPl + realizedPlToday;
      await this.db.prepare(
        `INSERT INTO category_snapshots (strategy, market_value, unrealized_pl, realized_pl_today, daily_pl, positions_count)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(s.strategy, s.marketValue, s.unrealizedPl, realizedPlToday, dailyPl, s.positionsCount).run();
    }
  }

  async getCategorySnapshots(strategy: CategoryStrategy, limit: number = 500): Promise<any[]> {
    await this.ensureTradeSchema();
    const result = await this.db.prepare(
      `SELECT * FROM category_snapshots WHERE strategy = ? ORDER BY timestamp DESC LIMIT ?`
    ).bind(strategy, limit).all();
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
      analyzed_candidates?: number;
      filtered_candidates?: number;
    }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO run_log (trigger, market_open, duration_ms, decisions_made, trades_executed, errors, error_details, status, analyzed_candidates, filtered_candidates)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      run.trigger,
      run.market_open,
      run.duration_ms,
      run.decisions_made,
      run.trades_executed,
      run.errors,
      run.error_details,
      run.status,
      run.analyzed_candidates ?? 0,
      run.filtered_candidates ?? 0
    ).run();
  }

  async getRecentRuns(
    limitOrOptions: number | {
      limit?: number;
      offset?: number;
      strategy?: 'daytrading' | 'swing' | 'crypto';
      trigger?: string;
      status?: string;
      code?: string;
      search?: string;
    } = 30,
    legacyOffset: number = 0,
  ): Promise<any[]> {
    const options = typeof limitOrOptions === 'number'
      ? { limit: limitOrOptions, offset: legacyOffset }
      : limitOrOptions;
    const predicates: string[] = [];
    const bindings: unknown[] = [];
    if (options.strategy === 'swing') {
      predicates.push(`trigger IN ('swing_cron', 'manual_swing')`);
    } else if (options.strategy === 'crypto') {
      predicates.push(`trigger IN ('crypto_cron', 'manual_crypto')`);
    } else if (options.strategy === 'daytrading') {
      predicates.push(`trigger NOT IN ('swing_cron', 'manual_swing', 'crypto_cron', 'manual_crypto', 'reconcile_cron')`);
    }
    if (options.trigger) {
      predicates.push('trigger = ?');
      bindings.push(options.trigger);
    }
    if (options.status) {
      predicates.push('status = ?');
      bindings.push(options.status);
    }
    if (options.code) {
      // Structured skip/error codes are persisted in error_details. INSTR
      // avoids LIKE wildcard semantics and also matches legacy plain-string
      // details such as CYCLE_LEASE_HELD.
      predicates.push("INSTR(COALESCE(error_details, ''), ?) > 0");
      bindings.push(options.code);
    }
    if (options.search) {
      predicates.push("INSTR(COALESCE(error_details, ''), ?) > 0");
      bindings.push(options.search);
    }
    const limit = Math.max(0, Math.floor(options.limit ?? 30));
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const where = predicates.length > 0 ? ` WHERE ${predicates.join(' AND ')}` : '';
    const result = await this.db.prepare(
      `SELECT * FROM run_log${where} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`
    ).bind(...bindings, limit, offset).all();
    return (result.results as any[]).map(row => ({ ...row, run_details: parseRunDetails(row.error_details) }));
  }

  async getRecentRunsByStrategy(strategy: 'daytrading' | 'swing' | 'crypto', limit: number = 100): Promise<any[]> {
    return this.getRecentRuns({ strategy, limit });
  }

  // ============================================================
  // Strategy comparison
  // ============================================================

  async getStrategyComparison(currentPositions?: readonly {
    strategy: string | null;
    unrealized_pl: number;
    market_value: number;
    unrealized_intraday_pl?: number;
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

    const feeSummary = await this.getBrokerFeeSummary();

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
          feesUsd: 0,
          feeAttribution: 'none-recorded',
          grossTotalPl: 0,
          netTotalPl: 0,
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

    // Only fees with reliable strategy evidence are assigned to a strategy.
    // CFEE is crypto-specific; regulatory/account-level FEE stays explicitly
    // unattributed instead of being fabricated into daytrading or swing.
    const crypto = ensure('crypto');
    crypto.feesUsd = feeSummary.cryptoUsd;
    crypto.feeAttribution = crypto.feesUsd > 0 ? 'broker-attributed' : 'none-recorded';
    for (const s of Object.values(strategies) as any[]) {
      if (s.strategy !== 'crypto') {
        s.feesUsd = 0;
        s.feeAttribution = feeSummary.regulatoryUsd > 0 ? 'account-level-unattributed' : 'none-recorded';
      }
      s.grossTotalPl = s.realizedPl + s.unrealizedPl;
      s.netTotalPl = s.grossTotalPl - s.feesUsd;
      // `totalPl` is the legacy public field; keep it semantically aligned
      // with the net value while retaining both explicit gross/net fields.
      s.totalPl = s.netTotalPl;
      s.winRate = (s.wins + s.losses) > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0;
    }

    // Live category daily P&L and portfolio value. These require
    // broker-authoritative current positions (currentPositions) — without
    // them there is no reliable "today" intraday number, so the fields are
    // left unset rather than derived from stale/D1-only data.
    if (currentPositions) {
      const realizedToday = await this.getRealizedPlToday();
      const intradayByStrategy = new Map<string, number>();
      for (const p of currentPositions) {
        if (p.strategy !== 'daytrading' && p.strategy !== 'swing' && p.strategy !== 'crypto') continue;
        intradayByStrategy.set(
          p.strategy,
          (intradayByStrategy.get(p.strategy) ?? 0) + (p.unrealized_intraday_pl ?? 0)
        );
      }
      for (const strat of ['daytrading', 'swing', 'crypto'] as const) {
        const s = ensure(strat);
        const realized = realizedToday[strat] ?? 0;
        const intraday = intradayByStrategy.get(strat) ?? 0;
        s.dailyPl = intraday + realized;
        // Broker-marked market value of current broker positions attributed
        // to this strategy — never account equity split by strategy.
        s.portfolioValue = s.marketValue;
      }
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

    const strategyRows = Object.values(strategies);
    return {
      strategies: strategyRows,
      timeSeries,
      fees: feeSummary,
      accountLevelFeesUsd: feeSummary.regulatoryUsd,
      netTotalPl: strategyRows.reduce((sum: number, s: any) => sum + s.netTotalPl, 0) - feeSummary.regulatoryUsd,
    };
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

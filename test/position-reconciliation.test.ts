import { describe, expect, test } from 'bun:test';
import type { Position } from '../src/alpaca';
import { closeBrokerAbsentPositions, reconcileBrokerQuantityMismatches } from '../src/position-reconciliation';
import { RiskManager } from '../src/risk-manager';

const brokerPosition = (symbol: string, qty: number): Position => ({
  asset_id: `asset-${symbol}`,
  symbol,
  qty,
  side: 'long',
  market_value: qty * 100,
  cost_basis: qty * 90,
  unrealized_pl: qty * 10,
  unrealized_plpc: 0.1,
  unrealized_intraday_pl: 0,
  unrealized_intraday_plpc: 0,
  current_price: 100,
  avg_entry_price: 90,
  change_today: 0,
  change_today_pct: 0,
});

describe('broker quantity reconciliation', () => {
  test('persists broker quantity for an existing mismatch without weakening the halt decision', async () => {
    const writes: any[] = [];
    const db = {
      upsertPosition: async (position: any) => { writes.push(position); },
    };

    const reconciled = await reconcileBrokerQuantityMismatches(
      db,
      [brokerPosition('NOW', 2), brokerPosition('AAPL', 1)],
      [
        { ticker: 'NOW', qty: 1, strategy: 'daytrading', stop_loss_price: 80, take_profit_price: 110 },
        { ticker: 'AAPL', qty: 1, strategy: 'daytrading' },
      ],
    );

    expect(reconciled).toBe(1);
    expect(writes).toEqual([expect.objectContaining({
      ticker: 'NOW',
      qty: 2,
      strategy: 'daytrading',
      stop_loss_price: 80,
      take_profit_price: 110,
    })]);

    const manager = new RiskManager({
      maxPositions: 5,
      maxPositionPct: 50,
      stopLossATRMultiplier: 1.5,
      takeProfitATRMultiplier: 2,
      trailingStopPct: 5,
      dailyLossLimitPct: 15,
      rollingDrawdownLimitPct: 10,
      minConfidence: 0.5,
      enableMargin: false,
      eodFlatten: false,
      targetVolatilityPct: 2,
      maxOrderRatePerMin: 10,
      minEdgeAfterCosts: 5,
      maxCapitalUsd: 5000,
    });
    const broker = brokerPosition('NOW', 2);
    const recovered = manager.checkDivergence([broker], [{ ticker: 'NOW', qty: writes[0].qty, side: 'long' }]);
    expect(recovered.divergent).toBe(false);
  });

  test('closes D1-only rows but preserves rows with pending broker orders', async () => {
    const closed: any[] = [];
    const db = { closePosition: async (...args: any[]) => { closed.push(args); } };

    const absent = await closeBrokerAbsentPositions(
      db,
      [brokerPosition('AAPL', 1)],
      [
        { ticker: 'UAL', qty: 1, strategy: 'swing' },
        { ticker: 'SEDG', qty: 3, strategy: 'swing' },
      ],
      new Set(['SEDG']),
    );

    expect(absent).toEqual(['UAL']);
    expect(closed).toEqual([['UAL', null, 'broker_authoritative_sync_absent']]);
  });

  test('matches known crypto punctuation across broker and D1 symbols without stripping stock punctuation', async () => {
    const closed: any[] = [];
    const db = { closePosition: async (...args: any[]) => { closed.push(args); } };

    const absent = await closeBrokerAbsentPositions(
      db,
      [brokerPosition('BTC/USD', 1), brokerPosition('BRKB', 1)],
      [
        { ticker: 'BTCUSD', qty: 1, strategy: 'crypto' },
        { ticker: 'BRK.B', qty: 1, strategy: 'swing' },
      ],
    );

    expect(absent).toEqual(['BRK.B']);
    expect(closed).toEqual([['BRK.B', null, 'broker_authoritative_sync_absent']]);
  });

  test('reconciles quantity for known crypto symbols across broker punctuation while preserving the broker symbol', async () => {
    const writes: any[] = [];
    const db = { upsertPosition: async (position: any) => { writes.push(position); } };

    const reconciled = await reconcileBrokerQuantityMismatches(
      db,
      [brokerPosition('BTC/USD', 2), brokerPosition('BRKB', 2)],
      [
        { ticker: 'BTCUSD', qty: 1, strategy: 'crypto', stop_loss_price: 80, take_profit_price: 110 },
        { ticker: 'BRK.B', qty: 1, strategy: 'swing' },
      ],
    );

    expect(reconciled).toBe(1);
    expect(writes).toEqual([expect.objectContaining({
      ticker: 'BTC/USD',
      qty: 2,
      strategy: 'crypto',
      stop_loss_price: 80,
      take_profit_price: 110,
    })]);
  });

  test('does not invent internal rows for broker-only positions', async () => {
    const writes: any[] = [];
    const db = { upsertPosition: async (position: any) => { writes.push(position); } };

    const reconciled = await reconcileBrokerQuantityMismatches(
      db,
      [brokerPosition('MSFT', 2)],
      [],
    );

    expect(reconciled).toBe(0);
    expect(writes).toEqual([]);
  });
});

describe('Control-1347-C maintenance broker-absent close (no pending-trade predicate)', () => {
  test('closes an open D1 row whose exit already filled, ignoring getTradesNeedingSync exclusion', async () => {
    const { Database } = await import('../src/database');
    const { createFakeD1, createTestDatabase } = await import('./helpers/fake-d1');
    const { closeBrokerAbsentPositions } = await import('../src/position-reconciliation');
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));

    // BAC-style shape: the swing exit is already FILLED (so getTradesNeedingSync,
    // which only returns NON-terminal rows, cannot see it) while the D1 position
    // row is still open.
    await db.logTrade({
      alpaca_order_id: 'bac-exit', client_order_id: 'sell-bac', ticker: 'BAC', side: 'sell',
      qty: 1, fill_price: 50.27, avg_fill_price: 50.27, status: 'filled', order_type: 'market',
      limit_price: null, stop_price: null, estimated_value: 50.27, decision_id: 1,
      error_message: null, strategy: 'swing', filled_qty: 1, leaves_qty: 0,
    });
    const needing = await db.getTradesNeedingSync(200);
    expect(needing.map(t => t.ticker)).not.toContain('BAC');

    sqlite.run(`INSERT INTO positions (ticker, side, qty, avg_entry_price, current_price, market_value, unrealized_pl, unrealized_plpc, strategy)
      VALUES ('BAC', 'long', 1, 50.27, 50.27, 50.27, 0, 0, 'swing')`);
    const open = await db.getOpenPositions();
    expect(open.map(p => p.ticker)).toContain('BAC');

    // The broker book no longer holds BAC, so maintenance closes the row.
    const closed = await closeBrokerAbsentPositions(db, [], open);
    expect(closed).toContain('BAC');
    const after = sqlite.query(`SELECT closed_at, close_reason FROM positions WHERE ticker = 'BAC'`).get() as any;
    expect(after.closed_at).not.toBeNull();
    expect(after.close_reason).toBe('broker_authoritative_sync_absent');
  });
});

import { describe, expect, test } from 'bun:test';
import { Database } from '../src/database';
import { createFakeD1, createTestDatabase } from './helpers/fake-d1';
import { feeTelemetryFromAggregate } from '../src/crypto-runtime';

function createDb() {
  return new Database(createFakeD1(createTestDatabase()));
}

async function seedTrade(db: Database, overrides: Partial<Parameters<Database['logTrade']>[0]> = {}) {
  return db.logTrade({
    alpaca_order_id: 'order-1',
    client_order_id: 'bot_1_AAPL',
    ticker: 'AAPL',
    side: 'buy',
    qty: 10,
    fill_price: null,
    avg_fill_price: null,
    status: 'submitted',
    order_type: 'market',
    limit_price: null,
    stop_price: null,
    estimated_value: 1000,
    decision_id: 1,
    error_message: null,
    strategy: 'daytrading',
    ...overrides,
  });
}

describe('findNonTerminalTradeByClientOrderId', () => {
  test('returns a blocking trade when a non-terminal row shares the client order id', async () => {
    const db = createDb();
    await seedTrade(db, { status: 'new' });
    const hit = await db.findNonTerminalTradeByClientOrderId('bot_1_AAPL');
    expect(hit).toBeDefined();
    expect(hit?.ticker).toBe('AAPL');
    expect(hit?.side).toBe('buy');
    expect(hit?.status).toBe('new');
  });

  test('returns undefined when the row is terminal (rejected/canceled/expired), so a retry is allowed', async () => {
    const db = createDb();
    for (const status of ['rejected', 'canceled', 'cancelled', 'expired', 'done_for_day', 'stopped', 'replaced']) {
      const unique = createDb();
      await seedTrade(unique, { client_order_id: `bot_1_${status}`, status });
      expect(await unique.findNonTerminalTradeByClientOrderId(`bot_1_${status}`)).toBeUndefined();
    }
  });

  test('returns undefined when no row matches the client order id', async () => {
    const db = createDb();
    await seedTrade(db);
    expect(await db.findNonTerminalTradeByClientOrderId('bot_999_MSFT')).toBeUndefined();
  });

  test('only the newest blocking row is returned across repeated submissions', async () => {
    const db = createDb();
    await seedTrade(db, { alpaca_order_id: 'order-1', client_order_id: 'swing_1_TSLA' });
    await seedTrade(db, { alpaca_order_id: 'order-2', client_order_id: 'swing_1_TSLA', status: 'filled' });
    const hit = await db.findNonTerminalTradeByClientOrderId('swing_1_TSLA');
    expect(hit?.tradeId).toBe(2);
  });
});

describe('non-terminal stock/swing exit guard', () => {
  test('blocks a repeated exit and exposes broker lifecycle fields', async () => {
    const db = createDb();
    await seedTrade(db, {
      alpaca_order_id: 'sell-1',
      client_order_id: 'sell-client-1',
      ticker: 'AAPL',
      side: 'sell',
      qty: 10,
      filled_qty: 4,
      leaves_qty: 6,
      status: 'partially_filled',
      strategy: 'daytrading',
      broker_updated_at: '2026-08-21T07:00:00Z',
    });
    const pending = await db.findNonTerminalExitBySymbol('daytrading', 'AAPL');
    expect(pending).toMatchObject({
      status: 'partially_filled',
      qty: 10,
      filledQty: 4,
      leavesQty: 6,
      alpacaOrderId: 'sell-1',
      clientOrderId: 'sell-client-1',
    });
  });

  test('does not block after a terminal exit', async () => {
    const db = createDb();
    await seedTrade(db, { side: 'sell', status: 'filled', strategy: 'swing', ticker: 'MSFT' });
    expect(await db.findNonTerminalExitBySymbol('swing', 'MSFT')).toBeUndefined();
  });
});

describe('feeTelemetryFromAggregate freshness gate', () => {
  const base = { feeUsd: 17.5, notionalUsd: 10000, sampleCount: 3, minSamples: 3 };

  test('fresh telemetry within the max age is available', () => {
    const now = Date.now();
    const t = feeTelemetryFromAggregate({ ...base, asOf: new Date(now - 30_000).toISOString(), maxAgeMs: 60_000, nowMs: now });
    expect(t.status).toBe('available');
    if (t.status === 'available') expect(t.rateBps).toBeCloseTo(17.5, 5);
  });

  test('stale telemetry older than maxAgeMs 60_000 is unavailable (fails closed)', () => {
    const now = Date.now();
    const t = feeTelemetryFromAggregate({ ...base, asOf: new Date(now - 61_000).toISOString(), maxAgeMs: 60_000, nowMs: now });
    expect(t.status).toBe('unavailable');
    if (t.status !== 'available') expect(t.reason).toContain('stale');
  });

  test('telemetry at the reference 180_000 freshness bound is still stale under a 60_000 max age', () => {
    const now = Date.now();
    const t = feeTelemetryFromAggregate({ ...base, asOf: new Date(now - 180_000).toISOString(), maxAgeMs: 60_000, nowMs: now });
    expect(t.status).toBe('unavailable'); // 180s > 60s max age, so fails closed as stale
  });

  test('insufficient samples returns insufficient, never a rate', () => {
    const t = feeTelemetryFromAggregate({ ...base, sampleCount: 2 });
    expect(t.status).toBe('insufficient');
  });

  test('non-positive or missing fee/notional returns unavailable', () => {
    expect(feeTelemetryFromAggregate({ ...base, feeUsd: 0 }).status).toBe('unavailable');
    expect(feeTelemetryFromAggregate({ ...base, notionalUsd: 0 }).status).toBe('unavailable');
  });
});


describe('trade observability enrichment', () => {
  test('exposes conservative per-trade accounting fields and only linked fees', async () => {
    const db = createDb();
    await seedTrade(db, { alpaca_order_id: 'order-without-fee', status: 'filled', filled_qty: 10, avg_fill_price: 100 });
    const sqlite = createTestDatabase();
    const dbWithFee = new Database(createFakeD1(sqlite));
    await dbWithFee.logTrade({
      alpaca_order_id: 'order-with-fee', client_order_id: 'client-1', ticker: 'AAPL', side: 'buy', qty: 10,
      fill_price: 100, avg_fill_price: 100, status: 'filled', order_type: 'market', limit_price: null,
      stop_price: null, estimated_value: 1000, decision_id: 1, error_message: null, strategy: 'daytrading',
    });
    sqlite.prepare(`INSERT INTO broker_fees (activity_id, fee_type, order_id, usd_value) VALUES (?, 'FEE', ?, ?)`)
      .run('fee-1', 'order-with-fee', 1.25);
    const [withFee] = await dbWithFee.getRecentTrades(10);
    expect(withFee).toMatchObject({
      gross: null,
      fee: 1.25,
      net: null,
      accounting_status: 'unavailable_fill_lot_exact',
      fee_attribution: 'broker-attributed',
    });
    sqlite.prepare(`INSERT INTO broker_fees (activity_id, fee_type, order_id, usd_value) VALUES (?, 'FEE', ?, NULL)`)
      .run('fee-unknown', 'order-with-unknown-fee');
    await dbWithFee.logTrade({
      alpaca_order_id: 'order-with-unknown-fee', client_order_id: 'client-2', ticker: 'MSFT', side: 'sell', qty: 1,
      fill_price: 200, avg_fill_price: 200, status: 'filled', order_type: 'market', limit_price: null,
      stop_price: null, estimated_value: 200, decision_id: null, error_message: null, strategy: 'daytrading',
    });
    const [, unknownFee] = await dbWithFee.getRecentTrades(10);
    expect(unknownFee).toMatchObject({ fee: null, fee_attribution: 'broker-linked-value-unavailable', net: null });
    const dbWithoutFee = db;
    const [withoutFee] = await dbWithoutFee.getRecentTrades(10);
    expect(withoutFee).toMatchObject({
      gross: null,
      fee: null,
      net: null,
      accounting_status: 'unavailable_fill_lot_exact',
      fee_attribution: 'none-recorded',
    });
  });

  test('persists broker time_in_force including crypto GTC', async () => {
    const db = createDb();
    await db.logOrderTrade({
      id: 'crypto-order', client_order_id: 'crypto-client', symbol: 'BTCUSD', qty: 1, filled_qty: 0,
      leaves_qty: 1, filled_avg_price: null, type: 'market', side: 'buy', status: 'new', time_in_force: 'gtc',
      created_at: '2026-08-21T10:00:00Z', updated_at: '2026-08-21T10:00:00Z', submitted_at: null,
      filled_at: null, canceled_at: null, expired_at: null, failed_at: null, replaced_at: null,
      limit_price: null, stop_price: null, trail_price: null, trail_percent: null,
    }, { strategy: 'crypto' });
    const row = (await db.getRecentTrades(10))[0];
    expect(row.time_in_force).toBe('gtc');
  });
});

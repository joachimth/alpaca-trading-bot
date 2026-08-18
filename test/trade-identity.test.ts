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

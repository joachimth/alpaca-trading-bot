import { describe, expect, test } from 'bun:test';
import { Database } from '../src/database';
import type { Order } from '../src/alpaca';
import { createFakeD1, createTestDatabase } from './helpers/fake-d1';
import { reconcileBrokerOrders } from '../src/order-reconciliation';

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1', client_order_id: 'client-1', symbol: 'AAPL', qty: 10,
  filled_qty: 0, leaves_qty: 10, filled_avg_price: null, type: 'market', side: 'buy',
  status: 'new', time_in_force: 'day', created_at: '2026-08-07T10:00:00Z',
  updated_at: '2026-08-07T10:00:00Z', submitted_at: '2026-08-07T10:00:00Z',
  filled_at: null, canceled_at: null, expired_at: null, failed_at: null, replaced_at: null,
  limit_price: null, stop_price: null, trail_price: null, trail_percent: null,
  ...overrides,
});

async function rows(sqlite: any) {
  return sqlite.query('SELECT * FROM trades ORDER BY id').all() as any[];
}

describe('scheduled order reconciliation', () => {
  test('upserts buys and sells, including partial fills and broker metadata', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.reconcileOrders([
      order({ id: 'buy-1', side: 'buy', filled_qty: 3, leaves_qty: 7, filled_avg_price: 101, status: 'partially_filled', updated_at: '2026-08-07T10:01:00Z' }),
      order({ id: 'sell-1', client_order_id: 'sell-client', side: 'sell', symbol: 'MSFT', qty: 2, filled_qty: 2, leaves_qty: 0, filled_avg_price: 202, status: 'filled', updated_at: '2026-08-07T10:02:00Z' }),
    ]);
    const result = await rows(sqlite);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ alpaca_order_id: 'buy-1', side: 'buy', filled_qty: 3, leaves_qty: 7, status: 'partially_filled', broker_updated_at: '2026-08-07T10:01:00Z' });
    expect(result[1]).toMatchObject({ alpaca_order_id: 'sell-1', side: 'sell', client_order_id: 'sell-client', filled_qty: 2, leaves_qty: 0, status: 'filled' });
  });

  test('is idempotent and never regresses newer fill progress or status', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.reconcileOrders([order({ filled_qty: 10, leaves_qty: 0, filled_avg_price: 100, status: 'filled', updated_at: '2026-08-07T10:05:00Z' })]);
    await db.reconcileOrders([order({ filled_qty: 2, leaves_qty: 8, status: 'new', updated_at: '2026-08-07T10:01:00Z' })]);
    const result = await rows(sqlite);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ filled_qty: 10, leaves_qty: 0, status: 'filled', broker_updated_at: '2026-08-07T10:05:00Z' });
  });

  test('persists every documented terminal status without broker side effects', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const statuses = ['filled', 'canceled', 'cancelled', 'rejected', 'expired', 'replaced', 'done_for_day', 'stopped'];
    await db.reconcileOrders(statuses.map((status, i) => order({ id: `terminal-${i}`, status, updated_at: `2026-08-07T10:${String(i).padStart(2, '0')}:00Z` })));
    expect((await rows(sqlite)).map(row => row.status)).toEqual(statuses);
  });

  test('shared scheduled reconciliation only reads the broker and performs no order side effects', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const calls: string[] = [];
    const broker = {
      getRecentOrders: async (_limit: number, options: any) => {
        calls.push(`getRecentOrders:${options.direction}`);
        expect(options.after).toBeString();
        return [order({ id: 'read-only-1', status: 'filled', filled_qty: 10, leaves_qty: 0 })];
      },
      getOrder: async () => { calls.push('getOrder'); throw new Error('unexpected lookup'); },
      submitOrder: async () => { calls.push('submitOrder'); throw new Error('must not submit'); },
      cancelOrder: async () => { calls.push('cancelOrder'); throw new Error('must not cancel'); },
    };
    const result = await reconcileBrokerOrders(db, broker as any);
    expect(result.brokerOrders).toBe(1);
    expect(calls).toEqual(['getRecentOrders:desc']);
    expect((await rows(sqlite))[0]).toMatchObject({ status: 'filled', filled_qty: 10, leaves_qty: 0 });
  });
});

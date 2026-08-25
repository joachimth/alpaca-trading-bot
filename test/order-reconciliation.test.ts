import { describe, expect, test } from 'bun:test';
import { Database } from '../src/database';
import type { Order } from '../src/alpaca';
import { createFakeD1, createTestDatabase } from './helpers/fake-d1';
import { MAX_ORDER_LOOKUPS_PER_INVOCATION, reconcileBrokerOrders } from '../src/order-reconciliation';

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
    expect(result[0]).toMatchObject({
      alpaca_order_id: 'buy-1', side: 'buy', filled_qty: 3, leaves_qty: 7,
      status: 'partially_filled', broker_updated_at: '2026-08-07T10:01:00Z',
      submitted_at: '2026-08-07T10:00:00Z',
    });
    expect(result[1]).toMatchObject({
      alpaca_order_id: 'sell-1', side: 'sell', client_order_id: 'sell-client',
      filled_qty: 2, leaves_qty: 0, status: 'filled',
    });
  });

  test('persists lifecycle timestamps on initial import and preserves them during older reconciliation', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const lifecycle = {
      submitted_at: '2026-08-07T10:00:00Z',
      filled_at: '2026-08-07T10:03:00Z',
      canceled_at: '2026-08-07T10:04:00Z',
      expired_at: '2026-08-07T10:05:00Z',
      failed_at: '2026-08-07T10:06:00Z',
      replaced_at: '2026-08-07T10:07:00Z',
    };
    await db.reconcileOrders([order({ id: 'lifecycle-order', status: 'filled', filled_qty: 10, leaves_qty: 0, updated_at: '2026-08-07T10:08:00Z', ...lifecycle })]);
    await db.reconcileOrders([order({ id: 'lifecycle-order', status: 'new', filled_qty: 0, leaves_qty: 10, updated_at: '2026-08-07T10:01:00Z', submitted_at: null, filled_at: null, canceled_at: null, expired_at: null, failed_at: null, replaced_at: null })]);
    expect((await rows(sqlite))[0]).toMatchObject(lifecycle);
  });

  test('preserves the order-time estimate and exposes realized filled notional after reconciliation', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.logOrderTrade(order({ id: 'estimate-order', qty: 10, filled_qty: 0, leaves_qty: 10, filled_avg_price: null }), {
      strategy: 'daytrading',
      estimatedValue: 1000,
    });
    const pending = (await db.getRecentTrades(10)).find(trade => trade.alpaca_order_id === 'estimate-order');
    expect(pending).toMatchObject({
      estimated_value: 1000,
      estimated_value_basis: 'order_time_estimate',
      filled_notional: null,
      estimated_vs_filled_delta: null,
    });

    await db.reconcileOrders([order({
      id: 'estimate-order', qty: 10, filled_qty: 4, leaves_qty: 6,
      filled_avg_price: 101, status: 'partially_filled', updated_at: '2026-08-07T10:01:00Z',
    })]);
    const partial = (await db.getRecentTrades(10)).find(trade => trade.alpaca_order_id === 'estimate-order');
    expect(partial).toMatchObject({
      estimated_value: 1000,
      estimated_value_basis: 'order_time_estimate',
      filled_notional: 404,
      estimated_vs_filled_delta: -596,
    });
  });

  test('updates linked decision metadata when reconciliation confirms a fill', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const decisionId = await db.logDecision({
      ticker: 'AAPL', action: 'BUY', confidence: 0.9, signal_source: 'ta', reason: 'test',
      price_at_decision: 100, executed: 0, execution_reason: 'Order submitted: broker status pending_new',
    });
    await db.logOrderTrade(order({ id: 'decision-order', decisionId: undefined }), { decisionId, strategy: 'daytrading', estimatedValue: 1000 });
    await db.reconcileOrders([order({ id: 'decision-order', filled_qty: 10, leaves_qty: 0, filled_avg_price: 101, status: 'filled', updated_at: '2026-08-07T10:05:00Z' })]);
    const decision = sqlite.query('SELECT executed, execution_reason FROM decisions WHERE id = ?').get(decisionId) as any;
    expect(decision).toEqual({ executed: 1, execution_reason: 'Broker confirmed fill: 10/10 @ 101' });
  });

  test('classifies a terminal done_for_day order with partial fill as executed, not rejected', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const decisionId = await db.logDecision({
      ticker: 'AAPL', action: 'BUY', confidence: 0.9, signal_source: 'ta', reason: 'test',
      price_at_decision: 100, executed: 0, execution_reason: 'Order submitted: broker status pending_new',
    });
    await db.logOrderTrade(order({ id: 'partial-terminal', decisionId: undefined }), { decisionId, strategy: 'daytrading', estimatedValue: 1000 });
    await db.reconcileOrders([order({ id: 'partial-terminal', filled_qty: 4, leaves_qty: 6, filled_avg_price: 101, status: 'done_for_day', updated_at: '2026-08-07T10:05:00Z' })]);
    const decision = sqlite.query('SELECT executed, execution_reason FROM decisions WHERE id = ?').get(decisionId) as any;
    expect(decision.executed).toBe(1);
    expect(decision.execution_reason).toContain('partial fill before terminal status');
  });

  test('classifies a terminal done_for_day order with zero fill as rejected', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const decisionId = await db.logDecision({
      ticker: 'AAPL', action: 'BUY', confidence: 0.9, signal_source: 'ta', reason: 'test',
      price_at_decision: 100, executed: 0, execution_reason: 'Order submitted: broker status pending_new',
    });
    await db.logOrderTrade(order({ id: 'zero-terminal', decisionId: undefined }), { decisionId, strategy: 'daytrading', estimatedValue: 1000 });
    await db.reconcileOrders([order({ id: 'zero-terminal', filled_qty: 0, leaves_qty: 10, status: 'done_for_day', updated_at: '2026-08-07T10:05:00Z' })]);
    const decision = sqlite.query('SELECT executed, execution_reason FROM decisions WHERE id = ?').get(decisionId) as any;
    expect(decision.executed).toBe(2);
    expect(decision.execution_reason).toContain('terminal status');
  });

  test('is idempotent and never regresses newer fill progress, status, or lifecycle timestamps', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.reconcileOrders([order({
      filled_qty: 10, leaves_qty: 0, filled_avg_price: 100, status: 'filled',
      updated_at: '2026-08-07T10:05:00Z', filled_at: '2026-08-07T10:04:00Z',
    })]);
    await db.reconcileOrders([order({
      filled_qty: 2, leaves_qty: 8, status: 'new', updated_at: '2026-08-07T10:01:00Z',
      filled_at: null,
    })]);
    const result = await rows(sqlite);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      filled_qty: 10, leaves_qty: 0, status: 'filled',
      broker_updated_at: '2026-08-07T10:05:00Z',
      submitted_at: '2026-08-07T10:00:00Z',
      filled_at: '2026-08-07T10:04:00Z',
    });
  });

  test('persists terminal lifecycle timestamps on a later broker snapshot', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.reconcileOrders([order({ id: 'terminal-lifecycle', status: 'new' })]);
    await db.reconcileOrders([order({
      id: 'terminal-lifecycle', status: 'canceled', updated_at: '2026-08-07T10:06:00Z',
      canceled_at: '2026-08-07T10:06:00Z',
    })]);
    const result = await rows(sqlite);
    expect(result[0]).toMatchObject({ status: 'canceled', canceled_at: '2026-08-07T10:06:00Z' });
  });

  test('persists every documented terminal status without broker side effects', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const statuses = ['filled', 'canceled', 'cancelled', 'rejected', 'expired', 'replaced', 'done_for_day', 'stopped'];
    await db.reconcileOrders(statuses.map((status, i) => order({ id: `terminal-${i}`, status, updated_at: `2026-08-07T10:${String(i).padStart(2, '0')}:00Z` })));
    expect((await rows(sqlite)).map(row => row.status)).toEqual(statuses);
  });

  test('strategy leases are isolated and expired leases can be recovered', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));

    expect(await db.acquireCycleLease('day-owner', 0, 'daytrading')).toBe(true);
    expect(await db.acquireCycleLease('maintenance-owner', undefined, 'maintenance')).toBe(true);
    expect(sqlite.query('SELECT lease_key FROM cycle_leases ORDER BY lease_key').all()).toEqual([
      { lease_key: 'daytrading' },
      { lease_key: 'maintenance' },
    ]);

    expect(await db.acquireCycleLease('replacement-owner', 0, 'daytrading')).toBe(true);
    expect(sqlite.query('SELECT owner FROM cycle_leases WHERE lease_key = \'daytrading\'').get()).toEqual({ owner: 'replacement-owner' });
  });

  test('backfills broker lifecycle timestamps on terminal rows without broker mutations', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.reconcileOrders([order({
      id: 'historical-filled', status: 'filled', filled_qty: 10, leaves_qty: 0,
      filled_avg_price: 101, updated_at: '2026-08-07T10:05:00Z',
      submitted_at: null, filled_at: null, canceled_at: null, expired_at: null,
      failed_at: null, replaced_at: null,
    })]);
    const calls: string[] = [];
    const broker = {
      getRecentOrders: async () => { calls.push('getRecentOrders'); return []; },
      getOrder: async (orderId: string) => {
        calls.push(`getOrder:${orderId}`);
        return order({
          id: orderId, status: 'filled', filled_qty: 10, leaves_qty: 0,
          filled_avg_price: 101, updated_at: '2026-08-07T10:06:00Z',
          submitted_at: null, filled_at: '2026-08-07T10:04:00Z',
          canceled_at: null, expired_at: null, failed_at: null, replaced_at: null,
        });
      },
      submitOrder: async () => { calls.push('submitOrder'); throw new Error('must not submit'); },
      cancelOrder: async () => { calls.push('cancelOrder'); throw new Error('must not cancel'); },
    };
    const result = await reconcileBrokerOrders(db, broker as any);
    expect(result.pendingLookups).toBe(1);
    expect(calls).toEqual(['getRecentOrders', 'getOrder:historical-filled']);
    expect((await rows(sqlite))[0]).toMatchObject({
      status: 'filled', filled_at: '2026-08-07T10:04:00Z',
      canceled_at: null, expired_at: null, failed_at: null, replaced_at: null,
    });
  });

  test('does not repeatedly select inapplicable terminal lifecycle fields for backfill', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.reconcileOrders([order({
      id: 'already-complete-canceled', status: 'canceled', updated_at: '2026-08-07T10:06:00Z',
      submitted_at: '2026-08-07T10:00:00Z', canceled_at: '2026-08-07T10:06:00Z',
    })]);
    expect(await db.getTradesNeedingSync(200, true)).toHaveLength(0);
  });

  test('bounds read-only order lookups per invocation and leaves the remainder for the next pass', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const pendingOrders = Array.from({ length: MAX_ORDER_LOOKUPS_PER_INVOCATION + 3 }, (_, i) => order({
      id: `pending-${i}`,
      client_order_id: `pending-client-${i}`,
      symbol: `SYM${i}`,
      status: 'new',
      updated_at: `2026-08-07T10:${String(i % 60).padStart(2, '0')}:00Z`,
    }));
    await db.reconcileOrders(pendingOrders);
    const calls: string[] = [];
    const broker = {
      getRecentOrders: async () => { calls.push('getRecentOrders'); return []; },
      getOrder: async (orderId: string) => {
        calls.push(`getOrder:${orderId}`);
        return pendingOrders.find(candidate => candidate.id === orderId)!;
      },
    };

    const result = await reconcileBrokerOrders(db, broker as any);
    expect(result.pendingLookups).toBe(MAX_ORDER_LOOKUPS_PER_INVOCATION);
    expect(calls).toHaveLength(MAX_ORDER_LOOKUPS_PER_INVOCATION + 1);
    expect(calls[0]).toBe('getRecentOrders');
    expect(calls.slice(1)).toEqual(pendingOrders.slice(0, MAX_ORDER_LOOKUPS_PER_INVOCATION).map(candidate => `getOrder:${candidate.id}`));
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

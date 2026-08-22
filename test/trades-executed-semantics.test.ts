import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { AlpacaClient, type Order } from '../src/alpaca';
import { classifyCryptoOrder } from '../src/crypto-runtime';

const daytradingSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const swingSource = readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8');
const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');

const order = (overrides: Partial<Order> = {}): Order => ({
  id: 'order-1', client_order_id: 'client-1', symbol: 'AAPL', qty: 10,
  filled_qty: 0, leaves_qty: 10, filled_avg_price: null, type: 'market', side: 'buy',
  status: 'new', time_in_force: 'day', created_at: '2026-08-22T10:00:00Z',
  updated_at: '2026-08-22T10:00:00Z', submitted_at: '2026-08-22T10:00:00Z',
  filled_at: null, canceled_at: null, expired_at: null, failed_at: null, replaced_at: null,
  limit_price: null, stop_price: null, trail_price: null, trail_percent: null,
  ...overrides,
});

describe('trades_executed semantic contract', () => {
  test('counts only a broker-confirmed full fill in the stock predicate', () => {
    const client = new AlpacaClient({ apiKey: 'test', apiSecret: 'test', baseUrl: 'https://paper-api.alpaca.markets' });
    expect(client.isOrderFullyFilled(order({ status: 'accepted' }))).toBe(false);
    expect(client.isOrderFullyFilled(order({ status: 'pending_new' }))).toBe(false);
    expect(client.isOrderFullyFilled(order({ status: 'partially_filled', filled_qty: 4, leaves_qty: 6 }))).toBe(false);
    expect(client.isOrderFullyFilled(order({ status: 'filled', filled_qty: 9, leaves_qty: 1 }))).toBe(false);
    expect(client.isOrderFullyFilled(order({ status: 'filled', filled_qty: 10, leaves_qty: 0 }))).toBe(true);
  });

  test('keeps crypto lifecycle classification distinct from the full-fill count', () => {
    expect(classifyCryptoOrder({ status: 'accepted', qty: 10, filled_qty: 0 })).toBe('pending');
    expect(classifyCryptoOrder({ status: 'partially_filled', qty: 10, filled_qty: 4 })).toBe('partially_filled');
    expect(classifyCryptoOrder({ status: 'filled', qty: 10, filled_qty: 9 })).toBe('partially_filled');
    expect(classifyCryptoOrder({ status: 'filled', qty: 10, filled_qty: 10 })).toBe('filled');
  });

  test('guards every strategy trades_executed increment with broker full-fill logic', () => {
    expect(daytradingSource).toContain('if (fullyFilled) tradesExecuted++;');
    expect(swingSource).toContain('if (fullyFilled) tradesExecuted++;');
    expect(cryptoSource).toContain('if (fullyFilled) tradesExecuted++;');
    expect(daytradingSource).toContain('const fullyFilled = alpaca.isOrderFullyFilled(order);');
    expect(swingSource).toContain("const fullyFilled = order.status === 'filled' && order.filled_qty > 0 && order.filled_qty >= order.qty * 0.999;");
    expect(cryptoSource).toContain('const fullyFilled = outcome === \'filled\';');
  });
});

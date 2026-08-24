import { afterEach, describe, expect, test } from 'bun:test';
import { AlpacaClient } from '../src/alpaca';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Alpaca order normalization', () => {
  test('account market value falls back to broker long and short aggregates when omitted', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: 'acct-1', account_number: 'paper-1', status: 'ACTIVE', currency: 'USD',
      cash: '9000', portfolio_value: '10000', equity: '10000', buying_power: '20000',
      long_market_value: '8500', short_market_value: '0', market_value: '0', last_equity: '9900',
      change_today: '0', change_today_pct: '0', pattern_day_trader: false,
      trading_blocked: false, transfers_blocked: false, account_blocked: false,
    }), { status: 200 })) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    await expect(client.getAccount()).resolves.toMatchObject({ market_value: 8500 });
  });

  test('closePosition can defer fill polling for bounded strategy cycles', async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method || 'GET'} ${String(input)}`);
      return new Response(JSON.stringify({
        id: 'exit-1',
        client_order_id: 'exit-client',
        symbol: 'AAPL',
        qty: '1',
        filled_qty: '0',
        leaves_qty: '1',
        filled_avg_price: null,
        type: 'market',
        side: 'sell',
        status: 'accepted',
        time_in_force: 'day',
        created_at: '2026-08-23T22:00:00Z',
        updated_at: '2026-08-23T22:00:00Z',
        submitted_at: '2026-08-23T22:00:00Z',
        filled_at: null,
        canceled_at: null,
        expired_at: null,
        failed_at: null,
        replaced_at: null,
        limit_price: null,
        stop_price: null,
        trail_price: null,
        trail_percent: null,
      }), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.closePosition('AAPL', { waitForFill: false });

    expect(result).toMatchObject({ id: 'exit-1', status: 'accepted', filled_qty: 0, leaves_qty: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('DELETE https://paper-api.alpaca.markets/v2/positions/AAPL');
  });

  test('submitOrder preserves broker lifecycle timestamps', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      id: 'order-1',
      client_order_id: 'client-1',
      symbol: 'AAPL',
      qty: '2',
      filled_qty: '2',
      leaves_qty: '0',
      filled_avg_price: '100.25',
      type: 'market',
      side: 'buy',
      status: 'filled',
      time_in_force: 'day',
      created_at: '2026-08-21T10:00:00Z',
      updated_at: '2026-08-21T10:00:02Z',
      submitted_at: '2026-08-21T10:00:00Z',
      filled_at: '2026-08-21T10:00:02Z',
      canceled_at: null,
      expired_at: null,
      failed_at: null,
      replaced_at: null,
      limit_price: null,
      stop_price: null,
      trail_price: null,
      trail_percent: null,
    }), { status: 200 })) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.submitOrder({ symbol: 'AAPL', qty: 2, side: 'buy', type: 'market' });

    expect(result).toMatchObject({
      id: 'order-1',
      qty: 2,
      filled_qty: 2,
      leaves_qty: 0,
      status: 'filled',
      submitted_at: '2026-08-21T10:00:00Z',
      filled_at: '2026-08-21T10:00:02Z',
    });
  });
});

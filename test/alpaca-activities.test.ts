import { afterEach, describe, expect, test } from 'bun:test';
import { ACCOUNT_ACTIVITY_PAGE_BUDGET, AlpacaClient } from '../src/alpaca';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function activity(id: string) {
  return { id, activity_type: 'FILL', symbol: 'AAPL', qty: '1', price: '100' };
}

describe('bounded Alpaca account activity pagination', () => {
  test('stops at the explicit page budget and reports degraded truncation', async () => {
    const requests: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      const page = requests.length;
      return new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => activity(`${page}-${i}`))), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.getAccountActivitiesBounded(['FILL'], undefined, undefined, 2);

    expect(requests).toHaveLength(2);
    expect(result.pages).toBe(2);
    expect(result.pageBudget).toBe(2);
    expect(result.activities).toHaveLength(200);
    expect(result.truncated).toBe(true);
    expect(result.degraded).toBe(true);
    expect(new URL(requests[1]).searchParams.get('page_token')).toBe('1-99');
  });

  test('uses the scheduled default budget and completes without degradation when pagination ends', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      const data = calls === 1
        ? Array.from({ length: 2 }, (_, i) => activity(`a-${i}`))
        : [];
      return new Response(JSON.stringify(data), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.getAccountActivitiesBounded(['FILL']);

    expect(calls).toBe(1);
    expect(result.pageBudget).toBe(ACCOUNT_ACTIVITY_PAGE_BUDGET);
    expect(result.pages).toBe(1);
    expect(result.activities).toHaveLength(2);
    expect(result.truncated).toBe(false);
    expect(result.degraded).toBe(false);
  });
  test('C-1226/C-1229-A: the scheduled budget reaches post-trade-date fee rows past a full day of fills', async () => {
    // A full session of FILL rows (~900 = 9 pages) precedes the FEE rows Alpaca
    // posts after the trade date. The budget must walk past them, not stop inside
    // the fills. NOTE (C-1229-A): this proves the budget is adequate for one
    // session; it does NOT prove the window start or the D1 write path.
    const fills = Array.from({ length: 900 }, (_, i) => activity(`f-${i}`));
    const fees = [
      { id: 'fee-reg', activity_type: 'FEE', date: '2026-10-08', net_amount: '-0.27' },
      { id: 'fee-cat', activity_type: 'FEE', date: '2026-10-08', net_amount: '-0.02' },
    ];
    const stream = [...fills, ...fees];
    let calls = 0;
    globalThis.fetch = (async () => {
      const start = calls * 100;
      calls++;
      return new Response(JSON.stringify(stream.slice(start, start + 100)), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.getAccountActivitiesBounded(['FILL', 'CFEE', 'FEE']);

    expect(result.truncated).toBe(false);
    expect(result.degraded).toBe(false);
    expect(result.activities.some(a => a.id === 'fee-reg')).toBe(true);
    expect(result.activities.some(a => a.id === 'fee-cat')).toBe(true);
    expect(result.pageBudget).toBe(ACCOUNT_ACTIVITY_PAGE_BUDGET);
  });
});

describe('C-1231-A: the ledger sync window must reach post-trade-date fee rows', () => {
  test('a fee posted after its trade date is inside the scheduled overlap window', async () => {
    // Alpaca stamps a FEE with the trade-date id (sorts at 00:00 of that date)
    // but posts it the next day ~00:05-00:15z. The overlap must therefore span
    // more than the posting lag, not just 15 minutes.
    const { RECONCILIATION_OVERLAP_MINUTES } = await import('../src/broker-ledger');
    expect(RECONCILIATION_OVERLAP_MINUTES).toBeGreaterThanOrEqual(24 * 60);
  });
});

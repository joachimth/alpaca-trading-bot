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
});

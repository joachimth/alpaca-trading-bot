import { afterEach, describe, expect, test } from 'bun:test';
import { AlpacaClient } from '../src/alpaca';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function bar(t: string, close: number) {
  return { t, o: close - 1, h: close + 1, l: close - 2, c: close, v: 1000 };
}

describe('Alpaca batch stock bars', () => {
  test('normalizes multi-symbol bars and preserves symbols with no data', async () => {
    const requests: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requests.push(String(input));
      return new Response(JSON.stringify({
        bars: {
          AAPL: [bar('2026-08-05T20:00:00Z', 101)],
          MSFT: [bar('2026-08-05T20:00:00Z', 202)],
        },
      }), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.getBarsBatch(['AAPL', 'MSFT', 'MISSING'], '1Day', 400, {
      start: '2025-01-01T00:00:00Z',
      end: '2026-08-05T20:00:00Z',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toContain('/v2/stocks/bars?');
    expect(requests[0]).toContain('limit=1200');
    expect(requests[0]).toContain('symbols=AAPL%2CMSFT%2CMISSING');
    expect(result.pages).toBe(1);
    expect(result.symbolsRequested).toBe(3);
    expect(result.barsBySymbol.get('AAPL')?.[0].t).toBe(Date.parse('2026-08-05T20:00:00Z') / 1000);
    expect(result.barsBySymbol.get('MSFT')?.[0].c).toBe(202);
    expect(result.barsBySymbol.get('MISSING')).toEqual([]);
  });

  test('follows pagination and combines sparse symbols', async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      if (call === 1) {
        return new Response(JSON.stringify({
          bars: { AAPL: [bar('2026-08-01T20:00:00Z', 101)] },
          next_page_token: 'page-2',
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        bars: { TSLA: [bar('2026-08-05T20:00:00Z', 303)] },
      }), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const result = await client.getBarsBatch(['AAPL', 'TSLA'], '1Day', 400);

    expect(call).toBe(2);
    expect(result.pages).toBe(2);
    expect(result.barsBySymbol.get('AAPL')).toHaveLength(1);
    expect(result.barsBySymbol.get('TSLA')?.[0].c).toBe(303);
  });

  test('rejects a repeated pagination token instead of looping', async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      return new Response(JSON.stringify({
        bars: {},
        next_page_token: 'same-token',
      }), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    await expect(client.getBarsBatch(['AAPL'], '1Day', 400)).rejects.toThrow('repeated next_page_token');
    expect(call).toBe(2);
  });

  test('rejects pagination beyond the bounded request budget', async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      return new Response(JSON.stringify({
        bars: {},
        next_page_token: `page-${call + 1}`,
      }), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    await expect(client.getBarsBatch(['AAPL'], '1Day', 400)).rejects.toThrow('exceeded 8-page budget');
    expect(call).toBe(8);
  });

  test('keeps a full swing universe within a bounded batch request budget', async () => {
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      const hasNextPage = call < 6;
      return new Response(JSON.stringify({
        bars: call === 1 ? { SYM0: [bar('2026-08-05T20:00:00Z', 100)] } : {},
        ...(hasNextPage ? { next_page_token: `page-${call + 1}` } : {}),
      }), { status: 200 });
    }) as typeof fetch;

    const client = new AlpacaClient({ apiKey: 'key', apiSecret: 'secret', baseUrl: 'https://paper-api.alpaca.markets' });
    const symbols = Array.from({ length: 150 }, (_, i) => `SYM${i}`);
    const result = await client.getBarsBatch(symbols, '1Day', 400);

    expect(call).toBe(6);
    expect(result.pages).toBe(6);
    expect(call).toBeLessThan(10);
    expect(result.barsBySymbol.get('SYM0')).toHaveLength(1);
    expect(result.barsBySymbol.get('SYM149')).toEqual([]);
  });
});

import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Database as Sqlite } from 'bun:sqlite';
import { runScheduledMaintenance, type Env } from '../src/index';
import { parseRunDetails } from '../src/skip-reasons';
import { createFakeD1 } from './helpers/fake-d1';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function seededSqlite(): Sqlite {
  const sqlite = new Sqlite(':memory:');
  sqlite.run(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return sqlite;
}

describe('scheduled maintenance reconciliation observability', () => {
  test('marks a clean maintenance reconciliation as ok while retaining MAINTENANCE_ONLY detail', async () => {
    const sqlite = seededSqlite();
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/v2/orders?')) return new Response('[]', { status: 200 });
      if (url.includes('/v2/account/activities?')) return new Response('[]', { status: 200 });
      throw new Error(`unexpected broker request: ${url}`);
    }) as typeof fetch;
    const env = {
      DB: createFakeD1(sqlite),
      ALPACA_API_KEY: 'test-key',
      ALPACA_API_SECRET: 'test-secret',
      ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
      LLM_API_KEY: '',
    } as unknown as Env;

    await runScheduledMaintenance(env, 'clean_reconcile_test');
    const run = sqlite.query(`SELECT status, errors, error_details FROM run_log WHERE trigger = 'clean_reconcile_test' ORDER BY id DESC LIMIT 1`).get() as { status: string; errors: number; error_details: string };
    const details = parseRunDetails(run.error_details);
    expect(run.status).toBe('ok');
    expect(run.errors).toBe(0);
    expect(details).toContainEqual(expect.objectContaining({ code: 'MAINTENANCE_ONLY' }));
  });

  test('persists lookupFailures and marks an individual lookup failure degraded without broker mutations', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`
      INSERT INTO trades (alpaca_order_id, client_order_id, ticker, side, qty, filled_qty, leaves_qty, status, order_type, time_in_force)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('missing-order-1', 'client-missing-1', 'AAPL', 'buy', 1, 0, 1, 'new', 'market', 'day');

    const requests: Array<{ method: string; url: string }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ method: init?.method || 'GET', url });
      if (url.includes('/v2/orders?')) return new Response('[]', { status: 200 });
      if (url.includes('/v2/orders/missing-order-1')) return new Response('', { status: 404 });
      if (url.includes('/v2/account/activities?')) return new Response('[]', { status: 200 });
      throw new Error(`unexpected broker request: ${url}`);
    }) as typeof fetch;

    const env = {
      DB: createFakeD1(sqlite),
      ALPACA_API_KEY: 'test-key',
      ALPACA_API_SECRET: 'test-secret',
      ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
      LLM_API_KEY: '',
    } as unknown as Env;

    await runScheduledMaintenance(env, 'reconcile_test');

    const run = sqlite.query(`
      SELECT status, errors, error_details
      FROM run_log
      WHERE trigger = 'reconcile_test'
      ORDER BY id DESC
      LIMIT 1
    `).get() as { status: string; errors: number; error_details: string };
    const details = parseRunDetails(run.error_details);
    const maintenance = details.find(detail => typeof detail === 'object' && detail.code === 'MAINTENANCE_ONLY') as any;
    const lookupFailure = details.find(detail => typeof detail === 'object' && detail.code === 'BROKER_ORDER_LOOKUP_DEGRADED') as any;

    expect(run.status).toBe('degraded');
    expect(run.errors).toBe(0);
    expect(maintenance).toMatchObject({
      context: { pendingLookups: 1, lookupFailures: 1 },
    });
    expect(lookupFailure).toMatchObject({
      scope: 'reconciliation',
      context: { pendingLookups: 1, lookupFailures: 1 },
    });
    expect(requests.length).toBe(3);
    expect(requests.every(request => request.method === 'GET')).toBe(true);
    expect(requests.some(request => /trigger|submit|cancel|close|replace|retry|migrat/i.test(request.url))).toBe(false);
  });
});

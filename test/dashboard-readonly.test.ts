import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Database as Sqlite } from 'bun:sqlite';
import type { Env } from '../src/index';
import { DashboardAPI } from '../src/api';
import { Database } from '../src/database';
import { createFakeD1 } from './helpers/fake-d1';

function seededSqlite(): Sqlite {
  const sqlite = new Sqlite(':memory:');
  sqlite.run(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return sqlite;
}

function trackedD1(sqlite: Sqlite): { d1: any; sql: string[] } {
  const sql: string[] = [];
  const base = createFakeD1(sqlite);
  return {
    sql,
    d1: {
      prepare(statement: string) {
        sql.push(statement);
        return base.prepare(statement);
      },
    },
  };
}

describe('dashboard read-only hotfix', () => {
  test('read-only Database construction performs no schema repair', async () => {
    const tracked = trackedD1(seededSqlite());
    const db = new Database(tracked.d1, { readOnly: true });

    await Promise.all([
      db.getConfig(),
      db.getRecentSnapshots(90),
      db.getCategorySnapshots('daytrading', 90),
    ]);

    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('runs endpoint honors limit, offset, page, and filters without broker access', async () => {
    const sqlite = seededSqlite();
    for (let i = 0; i < 45; i += 1) {
      sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status) VALUES (?, ?, ?)`).run(
        `2026-08-21 00:${String(i).padStart(2, '0')}:00`,
        i % 2 === 0 ? 'crypto_cron' : 'reconcile_cron',
        i % 3 === 0 ? 'skipped' : 'ok',
      );
    }
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const pageResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?limit=4&page=2&trigger=crypto_cron'));
    expect(pageResponse.status).toBe(200);
    const pageBody = await pageResponse.json() as any;
    expect(pageBody.limit).toBe(4);
    expect(pageBody.offset).toBe(4);
    expect(pageBody.page).toBe(2);
    expect(pageBody.runs).toHaveLength(4);
    expect(pageBody.runs.every((run: any) => run.trigger === 'crypto_cron')).toBe(true);

    const offsetResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?limit=3&offset=5&status=skipped'));
    expect(offsetResponse.status).toBe(200);
    const offsetBody = await offsetResponse.json() as any;
    expect(offsetBody.limit).toBe(3);
    expect(offsetBody.offset).toBe(5);
    expect(offsetBody.page).toBe(2);
    expect(offsetBody.runs).toHaveLength(3);
    expect(offsetBody.runs.every((run: any) => run.status === 'skipped')).toBe(true);

    const explicitOffsetResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?limit=10&offset=10&page=1'));
    expect(explicitOffsetResponse.status).toBe(200);
    const explicitOffsetBody = await explicitOffsetResponse.json() as any;
    expect(explicitOffsetBody.limit).toBe(10);
    expect(explicitOffsetBody.offset).toBe(10);
    expect(explicitOffsetBody.page).toBe(2);
    expect(explicitOffsetBody.runs).toHaveLength(10);
    expect(tracked.sql.some(statement => statement.includes('LIMIT ? OFFSET ?'))).toBe(true);

    const invalidStrategyResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?strategy=typo'));
    expect(invalidStrategyResponse.status).toBe(400);
    expect(await invalidStrategyResponse.json()).toMatchObject({ error: 'Invalid strategy filter' });
  });

  test('runs endpoint maps production trigger aliases without rewriting canonical history', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status) VALUES (?, ?, ?)`).run('2026-08-21 13:00:00', 'cron', 'ok');
    sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status) VALUES (?, ?, ?)`).run('2026-08-21 12:50:00', 'reconcile_cron', 'skipped');
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;
    const api = new DashboardAPI(env);

    for (const requestedTrigger of ['cron', 'daytrading_cron']) {
      const response = await api.handle(new Request(`https://bot.example/api/runs?trigger=${requestedTrigger}`));
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.runs).toHaveLength(1);
      expect(body.runs[0].trigger).toBe('cron');
    }
    for (const requestedTrigger of ['reconcile_cron', 'reconciliation_cron']) {
      const response = await api.handle(new Request(`https://bot.example/api/runs?trigger=${requestedTrigger}`));
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.runs).toHaveLength(1);
      expect(body.runs[0].trigger).toBe('reconcile_cron');
    }

    const unsupportedTriggerResponse = await api.handle(new Request('https://bot.example/api/runs?trigger=not_a_real_trigger'));
    expect(unsupportedTriggerResponse.status).toBe(200);
    expect((await unsupportedTriggerResponse.json() as any).runs).toHaveLength(0);
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('trades endpoint filters by strategy and rejects invalid filters without broker access', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO trades (ticker, side, qty, strategy, status) VALUES (?, 'buy', 1, ?, 'filled')`).run('BTCUSD', 'crypto');
    sqlite.prepare(`INSERT INTO trades (ticker, side, qty, strategy, status) VALUES (?, 'buy', 1, ?, 'filled')`).run('AAPL', 'daytrading');
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const cryptoResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?strategy=crypto&limit=10'));
    expect(cryptoResponse.status).toBe(200);
    const cryptoBody = await cryptoResponse.json() as any;
    expect(cryptoBody.strategy).toBe('crypto');
    expect(cryptoBody.trades).toHaveLength(1);
    expect(cryptoBody.trades[0].ticker).toBe('BTCUSD');

    const boundedResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=9999'));
    expect(boundedResponse.status).toBe(200);
    expect((await boundedResponse.json() as any).limit).toBe(500);

    const invalidResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?strategy=typo'));
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({ error: 'Invalid strategy filter' });
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('dashboard aligns account market value and latest snapshot count with the same broker positions', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO performance_snapshots (timestamp, positions_count) VALUES (?, ?)`).run('2026-08-21 12:00:00', 99);
    const tracked = trackedD1(sqlite);
    const env = {
      DB: tracked.d1,
      ALPACA_API_KEY: 'test',
      ALPACA_API_SECRET: 'test',
      ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
    } as unknown as Env;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v2/account')) return Response.json({
        id: 'acct-1', account_number: 'paper-1', status: 'ACTIVE', currency: 'USD',
        cash: '9000', portfolio_value: '10000', equity: '10000', buying_power: '20000',
        market_value: '0', long_market_value: '9000', short_market_value: '0', last_equity: '10000',
        change_today: '0', change_today_pct: '0', pattern_day_trader: false,
        trading_blocked: false, transfers_blocked: false, account_blocked: false,
      });
      if (url.endsWith('/v2/positions')) return Response.json([
        {
          asset_id: 'asset-a', symbol: 'AAPL', qty: '1', side: 'long', market_value: '125',
          cost_basis: '100', unrealized_pl: '25', unrealized_plpc: '0.25',
          unrealized_intraday_pl: '0', unrealized_intraday_plpc: '0', current_price: '125',
          avg_entry_price: '100', change_today: '0', change_today_pct: '0',
        },
        {
          asset_id: 'asset-b', symbol: 'MSFT', qty: '-1', side: 'short', market_value: '-25',
          cost_basis: '-30', unrealized_pl: '5', unrealized_plpc: '0.1667',
          unrealized_intraday_pl: '0', unrealized_intraday_plpc: '0', current_price: '25',
          avg_entry_price: '30', change_today: '0', change_today_pct: '0',
        },
      ]);
      throw new Error(`unexpected test fetch: ${url}`);
    };

    try {
      const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/dashboard'));
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.positionsAvailable).toBe(true);
      expect(body.positions).toHaveLength(2);
      expect(body.account.market_value).toBe(100);
      expect(body.latestSnapshot.positions_count).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('dashboard marks broker-derived aggregates unavailable instead of falling back to D1', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO performance_snapshots (timestamp, positions_count) VALUES (?, ?)`).run('2026-08-21 12:00:00', 7);
    const tracked = trackedD1(sqlite);
    const env = {
      DB: tracked.d1,
      ALPACA_API_KEY: 'test',
      ALPACA_API_SECRET: 'test',
      ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
    } as unknown as Env;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v2/account')) return Response.json({
        id: 'acct-1', account_number: 'paper-1', status: 'ACTIVE', currency: 'USD',
        cash: '9000', portfolio_value: '10000', equity: '10000', buying_power: '20000',
        market_value: '8500', long_market_value: '8500', short_market_value: '0', last_equity: '10000',
        change_today: '0', change_today_pct: '0', pattern_day_trader: false,
        trading_blocked: false, transfers_blocked: false, account_blocked: false,
      });
      if (url.endsWith('/v2/positions')) throw new Error('broker positions unavailable');
      throw new Error(`unexpected test fetch: ${url}`);
    };

    try {
      const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/dashboard'));
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.positionsAvailable).toBe(false);
      expect(body.positions).toEqual([]);
      expect(body.account.market_value).toBeNull();
      expect(body.latestSnapshot.positions_count).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('dashboard bounds chart payload and omits duplicate strategy history', async () => {
    const sqlite = seededSqlite();
    for (let i = 0; i < 120; i += 1) {
      sqlite.prepare(`INSERT INTO performance_snapshots (timestamp, equity) VALUES (?, ?)`).run(`2026-01-${String((i % 28) + 1).padStart(2, '0')} 00:00:00`, i);
      for (const strategy of ['daytrading', 'swing', 'crypto']) {
        sqlite.prepare(`INSERT INTO category_snapshots (timestamp, strategy, market_value) VALUES (?, ?, ?)`).run(
          `2026-01-${String((i % 28) + 1).padStart(2, '0')} 00:00:00`, strategy, i,
        );
      }
    }
    const tracked = trackedD1(sqlite);
    const env = {
      DB: tracked.d1,
      ALPACA_API_KEY: 'test',
      ALPACA_API_SECRET: 'test',
      ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
      LLM_API_KEY: 'test',
    } as unknown as Env;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v2/account')) return Response.json({ equity: '100000' });
      if (url.endsWith('/v2/positions')) return Response.json([]);
      throw new Error(`unexpected test fetch: ${url}`);
    };

    try {
      const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/dashboard'));
      expect(response.status).toBe(200);
      const body = await response.json() as any;
      expect(body.strategyHistory).toBeUndefined();
      expect(body.performanceHistory).toHaveLength(90);
      expect(body.categoryHistory.daytrading).toHaveLength(90);
      expect(body.categoryHistory.swing).toHaveLength(90);
      expect(body.categoryHistory.crypto).toHaveLength(90);
      expect(body.positionsAvailable).toBe(true);
      expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

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

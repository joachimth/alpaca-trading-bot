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
  test('run table renders durable candidate counts and filtered trigger aliases', () => {
    const dashboard = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8');
    expect(dashboard).toContain('<th>Alias</th>');
    expect(dashboard).toContain('<th>Analyzed</th>');
    expect(dashboard).toContain('<th>Filtered</th>');
    expect(dashboard).toContain('r.trigger_alias');
    expect(dashboard).toContain('r.analyzed_candidates');
    expect(dashboard).toContain('r.filtered_candidates');
  });

  test('trade table labels order-time estimates and renders available fill comparison fields', () => {
    const dashboard = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8');
    expect(dashboard).toContain('Est. Value<br><small>(order-time)</small>');
    expect(dashboard).toContain('<th>Filled Notional</th>');
    expect(dashboard).toContain('<th>Est. vs Filled Δ</th>');
    expect(dashboard).toContain('fmtMoney(t.filled_notional)');
    expect(dashboard).toContain('fmtSignedMoney(t.estimated_vs_filled_delta)');
    expect(dashboard).toContain('Filled notional and estimate delta are shown only when broker fill data is available');
  });

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

  test('loads the bounded chronological equity window from durable performance snapshots', async () => {
    const sqlite = seededSqlite();
    for (let i = 0; i < 22; i += 1) {
      sqlite.prepare(
        `INSERT INTO performance_snapshots (timestamp, account_id, equity) VALUES (?, ?, ?)`,
      ).run(`2026-08-20 00:${String(i).padStart(2, '0')}:00`, 'acct-1', 10_000 + i);
    }

    const db = new Database(createFakeD1(sqlite), { readOnly: true });
    await expect(db.getRecentEquityHistory(20)).resolves.toEqual(
      Array.from({ length: 20 }, (_, index) => 10_002 + index),
    );
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

    sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status, error_details) VALUES (?, ?, ?, ?)`).run(
      '2026-08-21 00:50:00', 'cron', 'skipped', JSON.stringify([{ type: 'skip', code: 'CYCLE_LEASE_HELD', scope: 'cycle', message: 'Lease held' }]),
    );
    const codeResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?limit=10&code=LEASE_HELD'));
    expect(codeResponse.status).toBe(200);
    const codeBody = await codeResponse.json() as any;
    expect(codeBody).toMatchObject({ code: 'LEASE_HELD', offset: 0, page: 1 });
    expect(codeBody.runs).toHaveLength(1);
    expect(codeBody.runs[0].error_details).toContain('CYCLE_LEASE_HELD');

    const searchResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?limit=10&search=Lease%20held'));
    expect(searchResponse.status).toBe(200);
    const searchBody = await searchResponse.json() as any;
    expect(searchBody).toMatchObject({ search: 'Lease held' });
    expect(searchBody.runs).toHaveLength(1);
  });

  test('runs endpoint exposes durable analyzed and filtered candidate counts', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status, analyzed_candidates, filtered_candidates) VALUES (?, ?, ?, ?, ?)`).run(
      '2026-08-21 13:00:00', 'crypto_cron', 'skipped', 15, 4,
    );
    const env = { DB: createFakeD1(sqlite) } as unknown as Env;
    const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/runs?trigger=crypto_cron'));
    expect(response.status).toBe(200);
    expect((await response.json() as any).runs[0]).toMatchObject({ analyzed_candidates: 15, filtered_candidates: 4 });
  });

  test('decisions endpoint exposes structured crypto skip context without rewriting legacy reason', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO decisions (timestamp, ticker, action, confidence, signal_source, reason, execution_reason, executed) VALUES (?, ?, 'BUY', ?, 'crypto', ?, ?, 2)`).run(
      '2026-08-21 13:00:00', 'BTCUSD', 0.9, 'crypto signal', JSON.stringify({
        type: 'skip',
        message: 'Calibrated raw edge unavailable',
        context: { configured_threshold_bps: 8, edge_source: 'unavailable', edge_status: 'unavailable', estimated_cost_bps: 6.6 },
      }),
    );
    const env = { DB: createFakeD1(sqlite) } as unknown as Env;
    const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/decisions?limit=1'));
    expect(response.status).toBe(200);
    expect((await response.json() as any).decisions[0]).toMatchObject({
      execution_reason: 'Calibrated raw edge unavailable',
      skip_context: { configured_threshold_bps: 8, edge_source: 'unavailable', edge_status: 'unavailable', estimated_cost_bps: 6.6 },
    });
  });

  test('runs endpoint combines strategy, status, trigger, and pagination filters', async () => {
    const sqlite = seededSqlite();
    const rows = [
      ['2026-08-21 14:00:00', 'crypto_cron', 'skipped'],
      ['2026-08-21 13:00:00', 'crypto_cron', 'ok'],
      ['2026-08-21 12:00:00', 'swing_cron', 'skipped'],
      ['2026-08-21 11:00:00', 'cron', 'skipped'],
    ];
    for (const row of rows) {
      sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status) VALUES (?, ?, ?)`).run(...row);
    }
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;
    const response = await new DashboardAPI(env).handle(new Request(
      'https://bot.example/api/runs?strategy=crypto&status=skipped&trigger=crypto_cron&limit=1&page=1',
    ));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({ trigger: 'crypto_cron', status: 'skipped' });
    expect(body.offset).toBe(0);
    expect(body.page).toBe(1);
    expect(tracked.sql.some(statement => statement.includes('trigger IN'))).toBe(true);
    expect(tracked.sql.some(statement => statement.includes('status = ?'))).toBe(true);
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('runs endpoint maps production trigger aliases without rewriting canonical history', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status) VALUES (?, ?, ?)`).run('2026-08-21 13:00:00', 'cron', 'ok');
    sqlite.prepare(`INSERT INTO run_log (timestamp, trigger, status) VALUES (?, ?, ?)`).run('2026-08-21 12:50:00', 'reconcile_cron', 'skipped');
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;
    const api = new DashboardAPI(env);

    const canonicalDaytradingResponse = await api.handle(new Request('https://bot.example/api/runs?trigger=cron'));
    expect(canonicalDaytradingResponse.status).toBe(200);
    const canonicalDaytradingBody = await canonicalDaytradingResponse.json() as any;
    expect(canonicalDaytradingBody.runs).toHaveLength(1);
    expect(canonicalDaytradingBody.runs[0]).toMatchObject({ trigger: 'cron' });
    expect(Object.prototype.hasOwnProperty.call(canonicalDaytradingBody.runs[0], 'trigger_alias')).toBe(false);

    const aliasDaytradingResponse = await api.handle(new Request('https://bot.example/api/runs?trigger=daytrading_cron'));
    expect(aliasDaytradingResponse.status).toBe(200);
    const aliasDaytradingBody = await aliasDaytradingResponse.json() as any;
    expect(aliasDaytradingBody.runs).toHaveLength(1);
    expect(aliasDaytradingBody.runs[0]).toMatchObject({ trigger: 'cron', trigger_alias: 'daytrading_cron' });

    const canonicalReconciliationResponse = await api.handle(new Request('https://bot.example/api/runs?trigger=reconcile_cron'));
    expect(canonicalReconciliationResponse.status).toBe(200);
    const canonicalReconciliationBody = await canonicalReconciliationResponse.json() as any;
    expect(canonicalReconciliationBody.runs).toHaveLength(1);
    expect(canonicalReconciliationBody.runs[0]).toMatchObject({ trigger: 'reconcile_cron' });
    expect(Object.prototype.hasOwnProperty.call(canonicalReconciliationBody.runs[0], 'trigger_alias')).toBe(false);

    const aliasReconciliationResponse = await api.handle(new Request('https://bot.example/api/runs?trigger=reconciliation_cron'));
    expect(aliasReconciliationResponse.status).toBe(200);
    const aliasReconciliationBody = await aliasReconciliationResponse.json() as any;
    expect(aliasReconciliationBody.runs).toHaveLength(1);
    expect(aliasReconciliationBody.runs[0]).toMatchObject({ trigger: 'reconcile_cron', trigger_alias: 'reconciliation_cron' });

    const unsupportedTriggerResponse = await api.handle(new Request('https://bot.example/api/runs?trigger=not_a_real_trigger'));
    expect(unsupportedTriggerResponse.status).toBe(200);
    expect((await unsupportedTriggerResponse.json() as any).runs).toHaveLength(0);
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('trades endpoint filters by strategy and rejects invalid filters without broker access', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO trades (ticker, side, qty, strategy, status) VALUES (?, 'buy', 1, ?, 'filled')`).run('BTCUSD', 'crypto');
    sqlite.prepare(`INSERT INTO trades (ticker, side, qty, strategy, status) VALUES (?, 'buy', 1, ?, 'filled')`).run('AAPL', 'daytrading');
    sqlite.prepare(`INSERT INTO trades (ticker, side, qty, strategy, status) VALUES (?, 'sell', 1, ?, 'accepted')`).run('ETHUSD', 'crypto');
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const cryptoResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?strategy=crypto&limit=10'));
    expect(cryptoResponse.status).toBe(200);
    const cryptoBody = await cryptoResponse.json() as any;
    expect(cryptoBody.strategy).toBe('crypto');
    expect(cryptoBody.trades).toHaveLength(2);
    expect(cryptoBody.trades.some((trade: any) => trade.ticker === 'BTCUSD')).toBe(true);
    expect(cryptoBody.trades.some((trade: any) => trade.ticker === 'ETHUSD')).toBe(true);

    const filledResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?strategy=crypto&status=filled&limit=10'));
    expect(filledResponse.status).toBe(200);
    const filledBody = await filledResponse.json() as any;
    expect(filledBody).toMatchObject({ strategy: 'crypto', status: 'filled' });
    expect(filledBody.trades).toHaveLength(1);
    expect(filledBody.trades[0]).toMatchObject({ ticker: 'BTCUSD', status: 'filled' });

    const boundedResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=9999'));
    expect(boundedResponse.status).toBe(200);
    expect((await boundedResponse.json() as any).limit).toBe(500);

    const invalidResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?strategy=typo'));
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({ error: 'Invalid strategy filter' });
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('trades endpoint honors limit, offset, and page without broker access', async () => {
    const sqlite = seededSqlite();
    for (let i = 0; i < 6; i += 1) {
      sqlite.prepare(`INSERT INTO trades (timestamp, ticker, side, qty, strategy, status)
        VALUES (?, 'SYM' || ?, 'buy', 1, 'crypto', 'filled')`).run(
        `2026-08-21 00:0${i}:00`, i,
      );
    }
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const pageResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=2&page=2'));
    expect(pageResponse.status).toBe(200);
    const pageBody = await pageResponse.json() as any;
    expect(pageBody).toMatchObject({ limit: 2, offset: 2, page: 2 });
    expect(pageBody.trades.map((trade: any) => trade.ticker)).toEqual(['SYM3', 'SYM2']);

    const offsetResponse = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=2&offset=4&strategy=crypto'));
    expect(offsetResponse.status).toBe(200);
    const offsetBody = await offsetResponse.json() as any;
    expect(offsetBody).toMatchObject({ limit: 2, offset: 4, page: 3, strategy: 'crypto' });
    expect(offsetBody.trades.map((trade: any) => trade.ticker)).toEqual(['SYM1', 'SYM0']);
    expect(tracked.sql.some(statement => statement.includes('LIMIT ? OFFSET ?'))).toBe(true);
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('trades endpoint returns distinct offset slices with stable ordering', async () => {
    const sqlite = seededSqlite();
    for (let i = 0; i < 75; i += 1) {
      sqlite.prepare(`INSERT INTO trades (timestamp, ticker, side, qty, status) VALUES (?, ?, 'buy', 1, 'filled')`)
        .run('2026-08-22 12:00:00', `SYM${i}`);
    }
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;
    const api = new DashboardAPI(env);

    const pageOneResponse = await api.handle(new Request('https://bot.example/api/trades?limit=30&offset=0'));
    const pageTwoResponse = await api.handle(new Request('https://bot.example/api/trades?limit=30&offset=30'));
    const pageThreeResponse = await api.handle(new Request('https://bot.example/api/trades?limit=30&offset=60'));
    expect(pageOneResponse.status).toBe(200);
    expect(pageTwoResponse.status).toBe(200);
    expect(pageThreeResponse.status).toBe(200);

    const pageOne = await pageOneResponse.json() as any;
    const pageTwo = await pageTwoResponse.json() as any;
    const pageThree = await pageThreeResponse.json() as any;
    expect(pageOne).toMatchObject({ limit: 30, offset: 0, page: 1 });
    expect(pageTwo).toMatchObject({ limit: 30, offset: 30, page: 2 });
    expect(pageThree).toMatchObject({ limit: 30, offset: 60, page: 3 });
    expect(pageOne.trades).toHaveLength(30);
    expect(pageTwo.trades).toHaveLength(30);
    expect(pageThree.trades).toHaveLength(15);
    expect(pageOne.trades[0].ticker).toBe('SYM0');
    expect(pageTwo.trades[0].ticker).toBe('SYM30');
    expect(pageThree.trades[0].ticker).toBe('SYM60');
    expect(new Set([
      ...pageOne.trades.map((trade: any) => trade.ticker),
      ...pageTwo.trades.map((trade: any) => trade.ticker),
      ...pageThree.trades.map((trade: any) => trade.ticker),
    ]).size).toBe(75);
    expect(tracked.sql.some(statement => statement.includes('LIMIT ? OFFSET ?'))).toBe(true);
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('trades accounting batches order IDs to stay below D1 variable limits', async () => {
    const sqlite = seededSqlite();
    for (let i = 0; i < 101; i += 1) {
      const orderId = `order-${i}`;
      sqlite.prepare(`INSERT INTO trades (alpaca_order_id, ticker, side, qty, filled_qty, avg_fill_price, status, strategy)
        VALUES (?, ?, 'buy', 1, 1, 100, 'filled', 'crypto')`).run(orderId, `SYM${i}`);
      sqlite.prepare(`INSERT INTO broker_fees (activity_id, fee_type, order_id, usd_value)
        VALUES (?, 'CFEE', ?, ?)`).run(`fee-${i}`, orderId, 0.01);
    }
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=120'));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.trades).toHaveLength(101);
    expect(body.trades.every((trade: any) => trade.fee === 0.01)).toBe(true);

    const feeQueries = tracked.sql.filter(statement => statement.includes('FROM broker_fees'));
    expect(feeQueries).toHaveLength(3);
    expect(feeQueries.map(statement => (statement.match(/\?/g) || []).length)).toEqual([50, 50, 1]);
  });

  test('trades endpoint exposes conservative accounting fields without assigning account-level fees', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO trades (alpaca_order_id, ticker, side, qty, filled_qty, avg_fill_price, status, strategy, time_in_force)
      VALUES (?, ?, 'buy', 1, 1, 100, 'filled', 'crypto', 'gtc')`).run('order-linked', 'BTCUSD');
    sqlite.prepare(`INSERT INTO trades (alpaca_order_id, ticker, side, qty, filled_qty, avg_fill_price, status, strategy)
      VALUES (?, ?, 'sell', 1, 1, 110, 'filled', 'crypto')`).run('order-unlinked', 'ETHUSD');
    sqlite.prepare(`INSERT INTO broker_fees (activity_id, fee_type, order_id, usd_value) VALUES (?, 'CFEE', ?, ?)`)
      .run('fee-linked', 'order-linked', 0.25);
    sqlite.prepare(`INSERT INTO broker_fees (activity_id, fee_type, order_id, usd_value) VALUES (?, 'FEE', NULL, ?)`)
      .run('fee-account', 9.99);
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=10'));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.trades).toHaveLength(2);
    const linked = body.trades.find((trade: any) => trade.alpaca_order_id === 'order-linked');
    const unlinked = body.trades.find((trade: any) => trade.alpaca_order_id === 'order-unlinked');
    expect(linked).toMatchObject({ gross: null, fee: 0.25, net: null, accounting_status: 'unavailable_fill_lot_exact', fee_attribution: 'broker-attributed', time_in_force: 'gtc' });
    expect(unlinked).toMatchObject({ gross: null, fee: null, net: null, accounting_status: 'unavailable_fill_lot_exact', fee_attribution: 'none-recorded' });
    expect(Object.prototype.hasOwnProperty.call(linked, 'gross')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(linked, 'fee')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(linked, 'net')).toBe(true);
    expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
  });

  test('legacy trade rows receive a stable lifecycle and accounting response shape without DDL', async () => {
    const sqlite = new Sqlite(':memory:');
    sqlite.run(`
      CREATE TABLE trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        alpaca_order_id TEXT,
        ticker TEXT NOT NULL,
        side TEXT NOT NULL,
        qty REAL NOT NULL,
        fill_price REAL,
        avg_fill_price REAL,
        status TEXT NOT NULL DEFAULT 'submitted',
        order_type TEXT NOT NULL DEFAULT 'market',
        time_in_force TEXT NOT NULL DEFAULT 'day',
        estimated_value REAL,
        decision_id INTEGER,
        error_message TEXT
      );
      CREATE TABLE broker_fees (
        activity_id TEXT PRIMARY KEY,
        fee_type TEXT NOT NULL,
        order_id TEXT,
        usd_value REAL
      );
    `);
    sqlite.prepare(`INSERT INTO trades (alpaca_order_id, ticker, side, qty, avg_fill_price, status)
      VALUES ('legacy-order', 'AAPL', 'buy', 1, 100, 'filled')`).run();
    const tracked = trackedD1(sqlite);
    const env = { DB: tracked.d1 } as unknown as Env;

    const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/trades?limit=10'));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.trades).toHaveLength(1);
    const trade = body.trades[0];
    for (const field of [
      'submitted_at', 'filled_at', 'canceled_at', 'expired_at', 'failed_at', 'replaced_at',
      'gross', 'fee', 'net', 'accounting_status', 'fee_attribution',
    ]) {
      expect(Object.prototype.hasOwnProperty.call(trade, field)).toBe(true);
    }
    expect(trade).toMatchObject({
      submitted_at: null,
      filled_at: null,
      canceled_at: null,
      expired_at: null,
      failed_at: null,
      replaced_at: null,
      gross: null,
      fee: null,
      net: null,
      accounting_status: 'unavailable_fill_lot_exact',
      fee_attribution: 'none-recorded',
    });
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
      expect(body.positions[0]).toMatchObject({ metadata_source: 'none', metadata_updated_at: null });
      expect(body.freshness.current_state_source).toBe('alpaca');
      expect(body.freshness.current_state_observed_at).toMatch(/^2026-/);
      expect(body.freshness.metadata_source).toBe('none');
      expect(body.freshness.metadata_updated_at).toBeNull();
      expect(body.freshness.semantics).toContain('D1 fields are metadata only');
      expect(body.account.market_value).toBe(100);
      expect(body.latestSnapshot.positions_count).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('positions endpoint returns 503 and no D1 fallback when broker positions are unavailable', async () => {
    const sqlite = seededSqlite();
    sqlite.prepare(`INSERT INTO positions (ticker, side, qty, avg_entry_price, current_price, market_value, unrealized_pl, unrealized_plpc) VALUES ('AAPL', 'long', 1, 100, 100, 100, 0, 0)`).run();
    const tracked = trackedD1(sqlite);
    const env = {
      DB: tracked.d1,
      ALPACA_API_KEY: 'test',
      ALPACA_API_SECRET: 'test',
      ALPACA_BASE_URL: 'https://paper-api.alpaca.markets',
    } as unknown as Env;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (): Promise<Response> => Response.json({ error: 'service unavailable' }, { status: 503 });

    try {
      const response = await new DashboardAPI(env).handle(new Request('https://bot.example/api/positions'));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        positions: [],
        positionsAvailable: false,
        source: 'alpaca',
      });
      expect(tracked.sql).toEqual([]);
      expect(tracked.sql.some(statement => /\\b(?:ALTER|CREATE|DROP|PRAGMA|REINDEX)\\b/i.test(statement))).toBe(false);
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

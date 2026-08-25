import { describe, expect, test } from 'bun:test';
import { Database as Sqlite } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import worker, { FALLBACK_CONFIG, positionsStrategySchemaReady, resolveDaytradingConfig } from '../src/index';
import { parseRunDetails } from '../src/skip-reasons';
import { SWING_FALLBACK_CONFIG, resolveSwingConfig } from '../src/swing-strategy';
import { createFakeD1 } from './helpers/fake-d1';

describe('runtime capital-cap aliases', () => {
  test('daytrading loader accepts camelCase and seeded snake_case cap keys', () => {
    expect(resolveDaytradingConfig({ maxCapitalUsd: '5100' }).maxCapitalUsd).toBe(5100);
    expect(resolveDaytradingConfig({ max_capital_usd: '5200' }).maxCapitalUsd).toBe(5200);
    expect(resolveDaytradingConfig({}).maxCapitalUsd).toBe(FALLBACK_CONFIG.maxCapitalUsd);
  });

  test('swing loader accepts namespaced camelCase and seeded snake_case cap keys', () => {
    expect(resolveSwingConfig({ swing_maxCapitalUsd: '4100' }).maxCapitalUsd).toBe(4100);
    expect(resolveSwingConfig({ swing_max_capital_usd: '4200' }).maxCapitalUsd).toBe(4200);
    expect(resolveSwingConfig({}).maxCapitalUsd).toBe(SWING_FALLBACK_CONFIG.maxCapitalUsd);
  });

  test('malformed cap overrides preserve the existing runtime fallback', () => {
    expect(resolveDaytradingConfig({ max_capital_usd: 'not-a-number' }).maxCapitalUsd).toBe(5000);
    expect(resolveSwingConfig({ swing_max_capital_usd: '-1' }).maxCapitalUsd).toBe(3700);
  });
});

describe('scheduled schema readiness', () => {
  test('scheduled handler contains no per-invocation positions DDL', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('ALTER TABLE positions ADD COLUMN strategy');
  });

  test('checks positions.strategy without issuing DDL', async () => {
    const sqlite = new Sqlite(':memory:');
    sqlite.run(`CREATE TABLE positions (ticker TEXT, strategy TEXT)`);
    const sql: string[] = [];
    const base = createFakeD1(sqlite);
    const db = { prepare(statement: string) { sql.push(statement); return base.prepare(statement); } };

    expect(await positionsStrategySchemaReady(db)).toBe(true);
    expect(sql).toEqual([`SELECT 1 FROM pragma_table_info('positions') WHERE name = ? LIMIT 1`]);
    expect(sql.some(statement => /ALTER|CREATE|DROP/i.test(statement))).toBe(false);
  });

  test('fails closed when the required strategy column is absent', async () => {
    const sqlite = new Sqlite(':memory:');
    sqlite.run(`CREATE TABLE positions (ticker TEXT)`);
    expect(await positionsStrategySchemaReady(createFakeD1(sqlite))).toBe(false);
  });

  test('persists a structured skipped run without broker access when the schema gate blocks a cron', async () => {
    const sqlite = new Sqlite(':memory:');
    sqlite.run(`
      CREATE TABLE positions (ticker TEXT);
      CREATE TABLE run_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger TEXT NOT NULL,
        market_open INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        decisions_made INTEGER NOT NULL DEFAULT 0,
        trades_executed INTEGER NOT NULL DEFAULT 0,
        errors INTEGER NOT NULL DEFAULT 0,
        error_details TEXT,
        status TEXT NOT NULL
      )
    `);
    const sql: string[] = [];
    const base = createFakeD1(sqlite);
    const env = { DB: { prepare(statement: string) { sql.push(statement); return base.prepare(statement); } } } as any;
    let pending: Promise<void> | undefined;
    await worker.scheduled(
      { cron: '0 22 * * 1-5' } as ScheduledEvent,
      env,
      { waitUntil(value: Promise<void>) { pending = value; } } as ExecutionContext,
    );
    await pending;

    const run = sqlite.query(`SELECT status, errors, error_details FROM run_log WHERE trigger = 'swing_cron'`).get() as {
      status: string;
      errors: number;
      error_details: string;
    };
    const details = parseRunDetails(run.error_details);
    expect(run.status).toBe('skipped');
    expect(run.errors).toBe(0);
    expect(details).toContainEqual(expect.objectContaining({
      type: 'skip',
      code: 'REQUIRED_SCHEMA_MISSING',
      scope: 'schema',
      context: expect.objectContaining({ required: 'positions.strategy', failClosed: true }),
    }));
    expect(sql.some(statement => /\\b(?:ALTER|CREATE|DROP)\\b/i.test(statement))).toBe(false);
  });
});

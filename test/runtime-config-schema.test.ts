import { describe, expect, test } from 'bun:test';
import { Database as Sqlite } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { FALLBACK_CONFIG, positionsStrategySchemaReady, resolveDaytradingConfig } from '../src/index';
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
});

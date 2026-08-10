import { describe, expect, test } from 'bun:test';
import { Database as Sqlite } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { Database } from '../src/database';
import { resolveCryptoConfig } from '../src/crypto-runtime';
import { createFakeD1 } from './helpers/fake-d1';

const fallback = {
  maxPositions: 5,
  maxPositionPct: 25,
  maxTradesPerCycle: 2,
  maxEntriesPerCycle: 1,
  maxDiscretionaryExitsPerCycle: 2,
  minEdgeAfterCosts: 8,
  maxOrderRatePerMin: 5,
  maxCapitalUsd: 2000,
  minConfidence: 0.7,
};

function createSeededDatabase(): Sqlite {
  const sqlite = new Sqlite(':memory:');
  sqlite.run(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  return sqlite;
}

describe('crypto config against the seeded schema', () => {
  test('loads the real schema snake_case crypto defaults', async () => {
    const sqlite = createSeededDatabase();
    const db = new Database(createFakeD1(sqlite));
    const config = resolveCryptoConfig(await db.getConfig(), fallback);

    expect(config.maxPositions).toBe(5);
    expect(config.maxPositionPct).toBe(25);
    expect(config.maxTradesPerCycle).toBe(2);
    expect(config.maxEntriesPerCycle).toBe(1);
    expect(config.maxDiscretionaryExitsPerCycle).toBe(2);
    expect(config.minEdgeAfterCosts).toBe(8);
    expect(config.maxOrderRatePerMin).toBe(5);
    expect(config.maxCapitalUsd).toBe(2000);
  });

  test('accepts camelCase and snake_case, with camelCase precedence', async () => {
    const sqlite = createSeededDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.setConfig('crypto_max_positions', '3');
    await db.setConfig('crypto_maxPositions', '4');
    await db.setConfig('crypto_max_capital_usd', '1000');
    await db.setConfig('crypto_maxCapitalUsd', '1200');

    const config = resolveCryptoConfig(await db.getConfig(), fallback);
    expect(config.maxPositions).toBe(4);
    expect(config.maxCapitalUsd).toBe(1200);
  });

  test('preserves valid zero and falls back for malformed or missing values', async () => {
    const sqlite = createSeededDatabase();
    const db = new Database(createFakeD1(sqlite));
    await db.setConfig('crypto_maxCapitalUsd', '0');
    await db.setConfig('crypto_maxPositions', 'not-a-number');
    await db.setConfig('crypto_max_trades_per_cycle', '4junk');
    await db.setConfig('crypto_min_edge_after_costs', '0');

    const config = resolveCryptoConfig(await db.getConfig(), fallback);
    expect(config.maxCapitalUsd).toBe(0);
    expect(config.maxPositions).toBe(5);
    expect(config.maxTradesPerCycle).toBe(2);
    expect(config.minEdgeAfterCosts).toBe(0);
    expect(config.maxEntriesPerCycle).toBe(1);
  });
});

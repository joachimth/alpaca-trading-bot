import { describe, expect, test } from 'bun:test';
import { Database as Sqlite } from 'bun:sqlite';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../crypto-entry-reservations-migration.sql', import.meta.url), 'utf8');

function createFreshDatabase(): Sqlite {
  return new Sqlite(':memory:');
}

describe('crypto reservation schema migration', () => {
  test('applies to a fresh database with the table and expiry index', () => {
    const sqlite = createFreshDatabase();
    sqlite.run(migration);

    expect(sqlite.query("SELECT type, name FROM sqlite_master WHERE name = 'crypto_entry_reservations'").get()).toEqual({
      type: 'table',
      name: 'crypto_entry_reservations',
    });
    expect(sqlite.query("SELECT type, name FROM sqlite_master WHERE name = 'idx_crypto_entry_reservations_expiry'").get()).toEqual({
      type: 'index',
      name: 'idx_crypto_entry_reservations_expiry',
    });
    expect(sqlite.query("PRAGMA table_info('crypto_entry_reservations')").all()).toHaveLength(7);
  });

  test('is safe to reapply without changing the schema', () => {
    const sqlite = createFreshDatabase();
    sqlite.run(migration);
    const before = sqlite.query("SELECT type, name, sql FROM sqlite_master WHERE name IN ('crypto_entry_reservations', 'idx_crypto_entry_reservations_expiry') ORDER BY name").all();

    sqlite.run(migration);

    expect(sqlite.query("SELECT type, name, sql FROM sqlite_master WHERE name IN ('crypto_entry_reservations', 'idx_crypto_entry_reservations_expiry') ORDER BY name").all()).toEqual(before);
  });
});

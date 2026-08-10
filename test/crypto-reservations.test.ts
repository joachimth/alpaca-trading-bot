import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { Database } from '../src/database';
import { createFakeD1, createTestDatabase } from './helpers/fake-d1';

function createReservationDatabase() {
  const sqlite = createTestDatabase();
  sqlite.run(readFileSync(new URL('../crypto-entry-reservations-migration.sql', import.meta.url), 'utf8'));
  return sqlite;
}

const reservation = (db: Database, overrides: Partial<Parameters<Database['reserveCryptoEntry']>[0]> = {}) => db.reserveCryptoEntry({
  reservationKey: 'crypto_1_BTCUSD',
  owner: 'owner-1',
  symbol: 'BTCUSD',
  notionalUsd: 100,
  maxOrdersPerWindow: 1,
  windowMs: 60_000,
  ttlMs: 120_000,
  nowMs: 1_000_000,
  ...overrides,
});

describe('crypto persistent reservations', () => {
  test('allows only one of two competing invocations to consume the final slot', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    const results = await Promise.all([
      reservation(db, { reservationKey: 'crypto_a_BTCUSD', owner: 'owner-a' }),
      reservation(db, { reservationKey: 'crypto_b_ETHUSD', owner: 'owner-b' }),
    ]);
    expect(results.filter(result => result.reserved)).toHaveLength(1);
    expect(Number(sqlite.query('SELECT COUNT(*) AS count FROM crypto_entry_reservations').get().count)).toBe(1);
  });

  test('same key retry is idempotent and another owner cannot replay it', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    expect(await reservation(db)).toEqual({ reserved: true, idempotent: false });
    expect(await reservation(db)).toEqual({ reserved: true, idempotent: true });
    const other = await reservation(db, { owner: 'owner-2' });
    expect(other.reserved).toBe(false);
    expect(other.reason).toContain('owned by another');
    expect(Number(sqlite.query('SELECT COUNT(*) AS count FROM crypto_entry_reservations').get().count)).toBe(1);
  });

  test('failed submission releases an active reservation for a retry', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', false, 1_000_000);
    expect(await reservation(db, { reservationKey: 'crypto_2_ETHUSD', owner: 'owner-2' })).toEqual({ reserved: true, idempotent: false });
  });

  test('committed reservation remains idempotent until the rate-window expiry boundary', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', true, 1_000_000, 60_000);
    const beforeExpiry = await reservation(db, { reservationKey: 'crypto_2_ETHUSD', owner: 'owner-2', nowMs: 1_059_999 });
    expect(beforeExpiry.reserved).toBe(false);
    const atExpiry = await reservation(db, { reservationKey: 'crypto_2_ETHUSD', owner: 'owner-2', nowMs: 1_060_000 });
    expect(atExpiry.reserved).toBe(true);
  });

  test('fails closed when the reservation table is absent', async () => {
    const db = new Database(createFakeD1(createTestDatabase()));
    const result = await reservation(db);
    expect(result.reserved).toBe(false);
    expect(result.reason).toContain('state unavailable');
  });

  test('fails closed for malformed input and database errors', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    expect((await reservation(db, { notionalUsd: Number.NaN })).reserved).toBe(false);
    const brokenDb = new Database(createFakeD1(new (require('bun:sqlite').Database)(':memory:')));
    const result = await reservation(brokenDb);
    expect(result.reserved).toBe(false);
    expect(result.reason).toContain('state unavailable');
  });
});

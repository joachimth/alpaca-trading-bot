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

  test('committed reservation remains protected beyond the short rate window', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', true, 1_000_000);
    const longAfterRateWindow = await reservation(db, { reservationKey: 'crypto_2_ETHUSD', owner: 'owner-2', nowMs: 1_060_000 });
    expect(longAfterRateWindow.reserved).toBe(false);
    expect(await db.getCryptoEntryReservationNotional(1_060_000)).toBe(100);
    expect(await db.getCryptoEntryReservationNotional(400_000_000_000)).toBe(100);
  });

  test('terminal broker reconciliation releases a committed reservation', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', true, 1_000_000);
    await db.reconcileCryptoEntryReservation({
      id: 'order-1', client_order_id: 'crypto_1_BTCUSD', symbol: 'BTCUSD', qty: 1, filled_qty: 0, leaves_qty: 1,
      filled_avg_price: null, type: 'market', side: 'buy', status: 'rejected', time_in_force: 'gtc',
      created_at: '2026-08-07T10:00:00Z', updated_at: '2026-08-07T10:01:00Z', submitted_at: null, filled_at: null, canceled_at: null, expired_at: null, failed_at: null, replaced_at: null, limit_price: null, stop_price: null, trail_price: null, trail_percent: null,
    });
    expect(await db.getCryptoEntryReservationNotional(1_060_000)).toBe(0);
  });

  test('terminal partial fill retains reservation and blocks duplicate retry', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', true, 1_000_000);
    await db.reconcileCryptoEntryReservation({
      id: 'order-partial', client_order_id: 'crypto_1_BTCUSD', symbol: 'BTCUSD', qty: 1, filled_qty: 0.25, leaves_qty: 0.75,
      filled_avg_price: 400, type: 'market', side: 'buy', status: 'canceled', time_in_force: 'gtc',
      created_at: '2026-08-07T10:00:00Z', updated_at: '2026-08-07T10:01:00Z', submitted_at: null, filled_at: null, canceled_at: '2026-08-07T10:01:00Z', expired_at: null, failed_at: null, replaced_at: null, limit_price: null, stop_price: null, trail_price: null, trail_percent: null,
    });
    expect(await db.getCryptoEntryReservationNotional(1_060_000)).toBe(100);
    expect(await reservation(db, { owner: 'owner-2', nowMs: 1_060_000 })).toMatchObject({ reserved: false });
  });

  test('lookup failure does not release an expired unresolved reservation', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', true, 1_000_000);
    // No broker snapshot is equivalent to an unknown state, never a safe orphan.
    expect(await db.getCryptoEntryReservationNotional(400_000_000_000)).toBe(100);
    expect((await db.getCryptoEntryReservations())[0]?.reservationKey).toBe('crypto_1_BTCUSD');
  });

  test('same-key retry after expiry removes only an unlinked active orphan', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db, { nowMs: 1_000_000, ttlMs: 100, windowMs: 100 });
    expect(await reservation(db, { nowMs: 1_000_101, owner: 'owner-1', windowMs: 100 })).toEqual({ reserved: true, idempotent: false });
  });

  test('expired active reservation linked to a trade remains retained and blocks same-key retry', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db, { nowMs: 1_000_000, ttlMs: 100, windowMs: 100 });
    sqlite.run(`INSERT INTO trades (alpaca_order_id, client_order_id, ticker, side, qty, filled_qty, leaves_qty, status, order_type, time_in_force, strategy)
      VALUES ('order-linked', 'crypto_1_BTCUSD', 'BTCUSD', 'buy', 1, 0, 1, 'accepted', 'market', 'gtc', 'crypto')`);
    expect(await reservation(db, { nowMs: 1_000_101, owner: 'owner-1' })).toMatchObject({ reserved: false, idempotent: true });
    expect(await db.getCryptoEntryReservations(1_000_101)).toHaveLength(0);
    expect(Number(sqlite.query(`SELECT COUNT(*) AS count FROM crypto_entry_reservations WHERE reservation_key = 'crypto_1_BTCUSD'`).get().count)).toBe(1);
  });

  test('only an explicitly verified pre-submit active orphan may be released', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    expect(await db.releaseExpiredCryptoEntryReservation('crypto_1_BTCUSD', 1_200_001)).toBe(true);
    expect(await db.getCryptoEntryReservations()).toHaveLength(0);
  });

  test('bounded cleanup removes expired active orphans but retains committed and unresolved rows', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db, { reservationKey: 'orphan', nowMs: 1_000_000, ttlMs: 100, windowMs: 100, maxOrdersPerWindow: 10 });
    await reservation(db, { reservationKey: 'committed', nowMs: 1_000_000, ttlMs: 100, windowMs: 100, maxOrdersPerWindow: 10 });
    await db.finalizeCryptoEntryReservation('committed', 'owner-1', true, 1_000_000);
    await reservation(db, { reservationKey: 'linked', nowMs: 1_000_000, ttlMs: 100, windowMs: 100, maxOrdersPerWindow: 10 });
    sqlite.run(`INSERT INTO trades (alpaca_order_id, client_order_id, ticker, side, qty, filled_qty, leaves_qty, status, order_type, time_in_force, strategy)
      VALUES ('linked-order', 'linked', 'BTCUSD', 'buy', 1, 0, 1, 'accepted', 'market', 'gtc', 'crypto')`);
    expect(await db.cleanupExpiredCryptoEntryReservations(10, 1_000_101)).toBe(1);
    expect(Number(sqlite.query('SELECT COUNT(*) AS count FROM crypto_entry_reservations').get().count)).toBe(2);
    expect(Number(sqlite.query(`SELECT COUNT(*) AS count FROM crypto_entry_reservations WHERE reservation_key = 'committed'`).get().count)).toBe(1);
    expect(Number(sqlite.query(`SELECT COUNT(*) AS count FROM crypto_entry_reservations WHERE reservation_key = 'linked'`).get().count)).toBe(1);
  });

  test('imported terminal broker orders release matching reservations during reconciliation', async () => {
    const sqlite = createReservationDatabase();
    const db = new Database(createFakeD1(sqlite));
    await reservation(db);
    await db.finalizeCryptoEntryReservation('crypto_1_BTCUSD', 'owner-1', true, 1_000_000);
    await db.reconcileOrders([{
      id: 'order-imported', client_order_id: 'crypto_1_BTCUSD', symbol: 'BTCUSD', qty: 1, filled_qty: 0, leaves_qty: 1,
      filled_avg_price: null, type: 'market', side: 'buy', status: 'rejected', time_in_force: 'gtc',
      created_at: '2026-08-07T10:00:00Z', updated_at: '2026-08-07T10:01:00Z', submitted_at: null, filled_at: null, canceled_at: null, expired_at: null, failed_at: null, replaced_at: null, limit_price: null, stop_price: null, trail_price: null, trail_percent: null,
    }]);
    expect(await db.getCryptoEntryReservationNotional(1_060_000)).toBe(0);
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

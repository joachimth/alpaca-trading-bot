import { describe, expect, test } from 'bun:test';
import { Database } from '../src/database';
import { createFakeD1, createTestDatabase } from './helpers/fake-d1';

 describe('broker fee ledger', () => {
  test('values CFEE from qty*price, FEE from net_amount, and remains idempotent', async () => {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    const activities = [
      {
        id: 'cfee-1', activity_type: 'CFEE', date: '2026-08-06',
        created_at: '2026-08-07T00:00:00Z', symbol: 'LTCUSD', qty: '-0.0175', price: '45.65',
        net_amount: '0', currency: 'USD', status: 'executed',
      },
      {
        id: 'fee-1', activity_type: 'FEE', date: '2026-08-06',
        created_at: '2026-08-07T00:00:00Z', activity_sub_type: 'REG',
        net_amount: '-0.55', currency: 'USD', status: 'executed',
      },
    ];

    const first = await db.upsertBrokerActivities(activities as any);
    const second = await db.upsertBrokerActivities(activities as any);
    const summary = await db.getBrokerFeeSummary();

    expect(first.fees).toBe(2);
    expect(second.fees).toBe(2);
    expect(Number(sqlite.query('SELECT COUNT(*) AS count FROM broker_fees').get().count)).toBe(2);
    expect(summary.cryptoUsd).toBeCloseTo(0.798875, 6);
    expect(summary.regulatoryUsd).toBeCloseTo(0.55, 6);
    expect(summary.totalUsd).toBeCloseTo(1.348875, 6);
    expect(summary.unattributedUsd).toBeCloseTo(1.348875, 6);
  });
});

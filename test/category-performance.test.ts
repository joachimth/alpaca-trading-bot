import { describe, expect, test } from 'bun:test';
import type { Position } from '../src/alpaca';
import { Database } from '../src/database';
import { projectBrokerPositions, summarizeByCategory, type BrokerPositionProjection } from '../src/position-projection';
import { createFakeD1, createTestDatabase } from './helpers/fake-d1';

const brokerPosition = (symbol: string, values: Partial<Position> = {}): Position => ({
  asset_id: `asset-${symbol}`,
  symbol,
  qty: 10,
  side: 'long',
  market_value: 1000,
  cost_basis: 900,
  unrealized_pl: 100,
  unrealized_plpc: 0.1,
  unrealized_intraday_pl: 20,
  unrealized_intraday_plpc: 0.02,
  current_price: 100,
  avg_entry_price: 90,
  change_today: 2,
  change_today_pct: 0.02,
  ...values,
});

describe('summarizeByCategory', () => {
  test('sums broker-authoritative positions per category and defaults missing categories to zero', () => {
    const projections: BrokerPositionProjection[] = [
      { ...projectBrokerPositions([brokerPosition('AAPL')], [{ ticker: 'AAPL', strategy: 'daytrading' }])[0] },
      { ...projectBrokerPositions([brokerPosition('BTCUSD', { market_value: 500, unrealized_pl: 50, unrealized_intraday_pl: 5 })], [{ ticker: 'BTCUSD', strategy: 'crypto' }])[0] },
      { ...projectBrokerPositions([brokerPosition('ETHUSD', { market_value: 300, unrealized_pl: -10, unrealized_intraday_pl: -2 })], [{ ticker: 'ETHUSD', strategy: 'crypto' }])[0] },
      { ...projectBrokerPositions([brokerPosition('WEIRD')], [])[0] }, // unattributed / unowned-by-bot broker position
    ];

    const summary = summarizeByCategory(projections);
    const byStrategy = Object.fromEntries(summary.map(s => [s.strategy, s]));

    expect(byStrategy.daytrading).toEqual({ strategy: 'daytrading', positionsCount: 1, marketValue: 1000, unrealizedPl: 100, unrealizedIntradayPl: 20 });
    expect(byStrategy.crypto).toEqual({ strategy: 'crypto', positionsCount: 2, marketValue: 800, unrealizedPl: 40, unrealizedIntradayPl: 3 });
    // swing has no current positions — real zero exposure, not a missing/fabricated value
    expect(byStrategy.swing).toEqual({ strategy: 'swing', positionsCount: 0, marketValue: 0, unrealizedPl: 0, unrealizedIntradayPl: 0 });
    // the unattributed broker position must not be folded into any category
    const totalCounted = summary.reduce((n, s) => n + s.positionsCount, 0);
    expect(totalCounted).toBe(3);
  });
});

describe('crypto symbol normalization in position matching', () => {
  test('matches broker slash-form symbol to compact D1 metadata', () => {
    const result = projectBrokerPositions(
      [brokerPosition('AAVE/USD')],
      [{ ticker: 'AAVEUSD', strategy: 'swing' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe('swing');
  });

  test('matches broker compact symbol to slash-form D1 metadata', () => {
    const result = projectBrokerPositions(
      [brokerPosition('BTCUSD')],
      [{ ticker: 'BTC/USD', strategy: 'crypto' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe('crypto');
  });

  test('does not rewrite non-crypto tickers with punctuation', () => {
    const result = projectBrokerPositions(
      [brokerPosition('BRK.B')],
      [{ ticker: 'BRK.B', strategy: 'daytrading' }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe('daytrading');
  });
});

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('Database category snapshots (real SQLite, UTC day boundaries)', () => {
  function setup() {
    const sqlite = createTestDatabase();
    const db = new Database(createFakeD1(sqlite));
    return { sqlite, db };
  }

  const today = utcDateString(new Date());
  const yesterday = utcDateString(new Date(Date.parse(`${today}T00:00:00.000Z`) - 24 * 60 * 60 * 1000));

  async function insertClosedPosition(sqlite: ReturnType<typeof createTestDatabase>, opts: {
    ticker: string;
    strategy: string;
    closedAt: string;
    closedPl: number;
  }) {
    sqlite.run(
      `INSERT INTO positions (ticker, side, qty, avg_entry_price, market_value, unrealized_pl, closed_at, closed_pl, strategy)
       VALUES (?, 'long', 1, 100, 0, 0, ?, ?, ?)`,
      [opts.ticker, opts.closedAt, opts.closedPl, opts.strategy],
    );
  }

  test('getRealizedPlToday only counts closes within the current UTC day', async () => {
    const { sqlite, db } = setup();
    await insertClosedPosition(sqlite, { ticker: 'AAPL', strategy: 'daytrading', closedAt: `${today} 12:00:00`, closedPl: 42 });
    await insertClosedPosition(sqlite, { ticker: 'MSFT', strategy: 'daytrading', closedAt: `${yesterday} 23:59:00`, closedPl: 1000 });
    await insertClosedPosition(sqlite, { ticker: 'BTCUSD', strategy: 'crypto', closedAt: `${today} 01:00:00`, closedPl: -5 });

    const realizedToday = await db.getRealizedPlToday();
    expect(realizedToday.daytrading).toBe(42);
    expect(realizedToday.crypto).toBe(-5);
    expect(realizedToday.swing ?? 0).toBe(0);
  });

  test('logCategorySnapshots computes daily_pl from live intraday unrealized + realized-today only', async () => {
    const { sqlite, db } = setup();
    await insertClosedPosition(sqlite, { ticker: 'AAPL', strategy: 'daytrading', closedAt: `${today} 09:00:00`, closedPl: 30 });

    await db.logCategorySnapshots([
      { strategy: 'daytrading', positionsCount: 2, marketValue: 1000, unrealizedPl: 80, unrealizedIntradayPl: 15 },
      { strategy: 'swing', positionsCount: 0, marketValue: 0, unrealizedPl: 0, unrealizedIntradayPl: 0 },
      { strategy: 'crypto', positionsCount: 1, marketValue: 500, unrealizedPl: -20, unrealizedIntradayPl: -8 },
    ]);

    const dayRows = await db.getCategorySnapshots('daytrading', 10);
    expect(dayRows).toHaveLength(1);
    expect(dayRows[0].market_value).toBe(1000);
    expect(dayRows[0].realized_pl_today).toBe(30);
    expect(dayRows[0].daily_pl).toBe(15 + 30); // intraday unrealized + realized today

    const swingRows = await db.getCategorySnapshots('swing', 10);
    expect(swingRows).toHaveLength(1);
    expect(swingRows[0].market_value).toBe(0);
    expect(swingRows[0].daily_pl).toBe(0);

    const cryptoRows = await db.getCategorySnapshots('crypto', 10);
    expect(cryptoRows[0].daily_pl).toBe(-8);
  });

  test('category_snapshots starts empty — no retroactive backfill, explicit insufficient-history state', async () => {
    const { db } = setup();
    const rows = await db.getCategorySnapshots('daytrading', 10);
    expect(rows).toEqual([]);
  });

  test('getStrategyComparison derives dailyPl/portfolioValue only from live broker positions, never account equity', async () => {
    const { sqlite, db } = setup();
    await insertClosedPosition(sqlite, { ticker: 'AAPL', strategy: 'daytrading', closedAt: `${today} 10:00:00`, closedPl: 25 });

    const currentPositions: BrokerPositionProjection[] = projectBrokerPositions(
      [
        brokerPosition('MSFT', { market_value: 2000, unrealized_pl: 150, unrealized_intraday_pl: 40 }),
        brokerPosition('BTCUSD', { market_value: 500, unrealized_pl: -30, unrealized_intraday_pl: -12 }),
      ],
      [
        { ticker: 'MSFT', strategy: 'daytrading' },
        { ticker: 'BTCUSD', strategy: 'crypto' },
      ],
    );

    const comparison = await db.getStrategyComparison(currentPositions);
    const day = comparison.strategies.find((s: any) => s.strategy === 'daytrading');
    const crypto = comparison.strategies.find((s: any) => s.strategy === 'crypto');
    const swing = comparison.strategies.find((s: any) => s.strategy === 'swing');

    expect(day.portfolioValue).toBe(2000);
    expect(day.dailyPl).toBe(40 + 25); // intraday unrealized + realized today
    expect(crypto.portfolioValue).toBe(500);
    expect(crypto.dailyPl).toBe(-12);
    // swing has no current broker positions and no closes today: real zero, not undefined/fabricated
    expect(swing?.dailyPl ?? 0).toBe(0);
    expect(swing?.portfolioValue ?? 0).toBe(0);
  });

  test('strategy comparison exposes gross, fee, net, and fee-attribution fields without assigning account-level fees to a strategy', async () => {
    const { sqlite, db } = setup();
    sqlite.run(
      `INSERT INTO positions (ticker, side, qty, avg_entry_price, market_value, unrealized_pl, closed_at, closed_pl, strategy)
       VALUES ('AAPL', 'long', 1, 100, 0, 0, '2026-08-07 10:00:00', 100, 'daytrading')`,
    );
    sqlite.run(
      `INSERT INTO positions (ticker, side, qty, avg_entry_price, market_value, unrealized_pl, closed_at, closed_pl, strategy)
       VALUES ('BTCUSD', 'long', 1, 100, 0, 0, '2026-08-07 10:00:00', 50, 'crypto')`,
    );
    await db.upsertBrokerActivities([
      {
        id: 'cfee-comparison', activity_type: 'CFEE', date: '2026-08-07',
        created_at: '2026-08-07T11:00:00Z', symbol: 'BTCUSD', qty: '-0.02', price: '10',
        net_amount: '0', currency: 'USD', status: 'executed',
      },
      {
        id: 'reg-comparison', activity_type: 'FEE', date: '2026-08-07',
        created_at: '2026-08-07T11:00:00Z', activity_sub_type: 'REG',
        net_amount: '-3', currency: 'USD', status: 'executed',
      },
    ] as any);

    const comparison = await db.getStrategyComparison();
    const day = comparison.strategies.find((s: any) => s.strategy === 'daytrading');
    const crypto = comparison.strategies.find((s: any) => s.strategy === 'crypto');

    expect(day).toMatchObject({
      grossTotalPl: 100,
      feesUsd: 0,
      netTotalPl: 100,
      totalPl: 100,
      feeAttribution: 'account-level-unattributed',
    });
    expect(crypto).toMatchObject({
      grossTotalPl: 50,
      feesUsd: 0.2,
      netTotalPl: 49.8,
      totalPl: 49.8,
      feeAttribution: 'broker-attributed',
    });
    expect(crypto.totalPl).not.toBe(crypto.grossTotalPl);
    expect(comparison.accountLevelFeesUsd).toBe(3);
    // Aggregate net includes the account-level regulatory fee exactly once.
    expect(comparison.netTotalPl).toBeCloseTo(146.8, 10);
  });

  test('without live broker positions, dailyPl/portfolioValue are left unset rather than derived from stale D1 data', async () => {
    const { sqlite, db } = setup();
    // An open D1-tracked position exists, but with no broker-authoritative
    // currentPositions supplied there is no reliable "today" number for it.
    sqlite.run(
      `INSERT INTO positions (ticker, side, qty, avg_entry_price, market_value, unrealized_pl, strategy)
       VALUES ('AAPL', 'long', 1, 100, 150, 50, 'daytrading')`,
    );

    const comparison = await db.getStrategyComparison();
    expect(comparison.strategies.length).toBeGreaterThan(0);
    for (const s of comparison.strategies) {
      expect(s.dailyPl).toBeUndefined();
      expect(s.portfolioValue).toBeUndefined();
    }
  });
});

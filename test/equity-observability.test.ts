import { describe, expect, test } from 'bun:test';
import { accountWithEquityDirection, resolveEquityDirection } from '../src/equity-observability';

const base = { change_today: 0, change_today_pct: 0, equity: 9900, last_equity: 10000 };

describe('equity direction observability fallback', () => {
  test('uses broker direction when non-zero', () => {
    const result = resolveEquityDirection({ ...base, change_today: 25, change_today_pct: 0.25 });
    expect(result).toMatchObject({ changeToday: 25, changeTodayPct: 0.25, source: 'broker_change_today_pct', fallbackUsed: false });
  });

  test('uses equity delta as PERCENT POINTS when broker daily percentage is zero', () => {
    const result = resolveEquityDirection(base);
    // -$100 on a $10,000 prior close is -1 percent point, NOT -100. The raw dollar
    // delta was previously written into change_today_pct, so a -$18 day read as
    // -18% and tripped the 15% / 5% daily-loss guards.
    expect(result).toMatchObject({ changeToday: -100, changeTodayPct: -1, source: 'equity_delta_fallback', fallbackUsed: true });
    expect(accountWithEquityDirection(base)).toMatchObject({ change_today: -100, change_today_pct: -1 });
  });

  test('a small dollar drawdown never reads as a large percentage', () => {
    // Regression: production observed change_today_pct = -18.1945 for a -$18.19
    // equity delta on a ~$97k account. That is 0.019%, far below every daily-loss
    // limit, and must never halt entries.
    const account = { change_today: 0, change_today_pct: 0, equity: 97092.92, last_equity: 97111.1145 };
    const result = resolveEquityDirection(account);
    expect(result.source).toBe('equity_delta_fallback');
    expect(result.changeToday).toBeCloseTo(-18.1945, 3);
    expect(result.changeTodayPct).toBeCloseTo(-0.01873575, 6);
    expect(Math.abs(result.changeTodayPct)).toBeLessThan(15);
    expect(Math.abs(result.changeTodayPct)).toBeLessThan(5);
  });

  test('matches the broker percentage when the broker reports one', () => {
    const account = { change_today: 25, change_today_pct: 0.25, equity: 10025, last_equity: 10000 };
    const result = resolveEquityDirection(account);
    expect(result.source).toBe('broker_change_today_pct');
    expect(result.changeTodayPct).toBeCloseTo(0.25, 6);
  });

  test('does not invent direction when both broker and equity baseline are unavailable', () => {
    const result = resolveEquityDirection({ ...base, equity: Number.NaN, last_equity: 0 });
    expect(result).toMatchObject({ changeToday: 0, changeTodayPct: 0, source: 'unavailable', fallbackUsed: true });
  });
});

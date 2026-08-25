import { describe, expect, test } from 'bun:test';
import { accountWithEquityDirection, resolveEquityDirection } from '../src/equity-observability';

const base = { change_today: 0, change_today_pct: 0, equity: 9900, last_equity: 10000 };

describe('equity direction observability fallback', () => {
  test('uses broker direction when non-zero', () => {
    const result = resolveEquityDirection({ ...base, change_today: 25, change_today_pct: 0.25 });
    expect(result).toMatchObject({ changeToday: 25, changeTodayPct: 0.25, source: 'broker_change_today_pct', fallbackUsed: false });
  });

  test('uses equity delta when broker daily percentage is zero', () => {
    const result = resolveEquityDirection(base);
    expect(result).toMatchObject({ changeToday: -100, changeTodayPct: -1, source: 'equity_delta_fallback', fallbackUsed: true });
    expect(accountWithEquityDirection(base)).toMatchObject({ change_today: -100, change_today_pct: -1 });
  });

  test('does not invent direction when both broker and equity baseline are unavailable', () => {
    const result = resolveEquityDirection({ ...base, equity: Number.NaN, last_equity: 0 });
    expect(result).toMatchObject({ changeToday: 0, changeTodayPct: 0, source: 'unavailable', fallbackUsed: true });
  });
});

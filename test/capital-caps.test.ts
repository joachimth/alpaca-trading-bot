import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CAPITAL_CAP_DEFAULTS, resolveCapitalCaps, validateCapitalCap } from '../src/capital-caps';

describe('capital cap resolution', () => {
  test('uses runtime fallback defaults when D1 keys are missing', () => {
    expect(resolveCapitalCaps({})).toEqual(CAPITAL_CAP_DEFAULTS);
  });

  test('uses the requested D1 keys for valid overrides (camelCase)', () => {
    expect(resolveCapitalCaps({
      maxCapitalUsd: '5100',
      swing_maxCapitalUsd: '4100',
      crypto_maxCapitalUsd: '2500',
    })).toEqual({ daytrading: 5100, swing: 4100, crypto: 2500 });
  });

  test('uses snake_case D1 keys matching the stored schema', () => {
    expect(resolveCapitalCaps({
      max_capital_usd: '5100',
      swing_max_capital_usd: '4100',
      crypto_max_capital_usd: '2500',
    })).toEqual({ daytrading: 5100, swing: 4100, crypto: 2500 });
  });

  test('prefers camelCase when both key formats are present', () => {
    expect(resolveCapitalCaps({
      maxCapitalUsd: '6000',
      max_capital_usd: '5000',
      swing_maxCapitalUsd: '5000',
      swing_max_capital_usd: '3700',
      crypto_maxCapitalUsd: '3000',
      crypto_max_capital_usd: '2000',
    })).toEqual({ daytrading: 6000, swing: 5000, crypto: 3000 });
  });

  test('returns unavailable for missing malformed, non-finite, and negative values', () => {
    expect(validateCapitalCap(undefined)).toBeNull();
    expect(validateCapitalCap('')).toBeNull();
    expect(validateCapitalCap('not-a-number')).toBeNull();
    expect(validateCapitalCap('Infinity')).toBeNull();
    expect(validateCapitalCap(-1)).toBeNull();
    expect(validateCapitalCap(0)).toBe(0);
    expect(resolveCapitalCaps({ maxCapitalUsd: '-1', swing_maxCapitalUsd: 'NaN', crypto_maxCapitalUsd: 'Infinity' })).toEqual({
      daytrading: null,
      swing: null,
      crypto: null,
    });
    expect(resolveCapitalCaps({ max_capital_usd: '-1', swing_max_capital_usd: 'NaN', crypto_max_capital_usd: 'Infinity' })).toEqual({
      daytrading: null,
      swing: null,
      crypto: null,
    });
  });
});

describe('dashboard capital cap contract', () => {
  test('renders one cap card under each strategy tab and consumes server-resolved caps', () => {
    const html = readFileSync(new URL('../dashboard/index.html', import.meta.url), 'utf8');
    expect((html.match(/class="metric-label">Capital cap/g) || []).length).toBe(3);
    for (const id of ['mDayCapitalCap', 'mSwingCapitalCap', 'mCryptoCapitalCap']) expect(html).toContain(id);
    expect(html).toContain('const capValue = dashboardData.capitalCaps && dashboardData.capitalCaps[strategy];');
    expect(html).not.toContain("fetchAPI('/api/config')");
  });
});

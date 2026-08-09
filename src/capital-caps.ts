export type CapitalCapStrategy = 'daytrading' | 'swing' | 'crypto';

export type CapitalCaps = Record<CapitalCapStrategy, number | null>;

export const CAPITAL_CAP_DEFAULTS: Readonly<Record<CapitalCapStrategy, number>> = {
  daytrading: 5000,
  swing: 3700,
  crypto: 2000,
};

const CAPITAL_CAP_KEYS: Readonly<Record<CapitalCapStrategy, string>> = {
  // These are the exact D1 key forms the existing runtime loaders accept.
  daytrading: 'maxCapitalUsd',
  swing: 'swing_maxCapitalUsd',
  crypto: 'crypto_maxCapitalUsd',
};

/**
 * Resolve the display-only cap from the exact D1 keys and fallback defaults
 * accepted by the strategy loaders. A present malformed override is unavailable;
 * account buying power, cash, equity, and portfolio value are never inputs.
 */
export function resolveCapitalCaps(dbConfig: Record<string, string>): CapitalCaps {
  const caps = {} as CapitalCaps;
  for (const strategy of Object.keys(CAPITAL_CAP_KEYS) as CapitalCapStrategy[]) {
    const key = CAPITAL_CAP_KEYS[strategy];
    const raw = dbConfig[key];
    caps[strategy] = raw === undefined
      ? CAPITAL_CAP_DEFAULTS[strategy]
      : validateCapitalCap(raw);
  }
  return caps;
}

export function validateCapitalCap(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

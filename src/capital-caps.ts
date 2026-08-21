export type CapitalCapStrategy = 'daytrading' | 'swing' | 'crypto';

export type CapitalCaps = Record<CapitalCapStrategy, number | null>;

export const CAPITAL_CAP_DEFAULTS: Readonly<Record<CapitalCapStrategy, number>> = {
  daytrading: 5000,
  swing: 3700,
  crypto: 2000,
};

const CAPITAL_CAP_KEYS: Readonly<Record<CapitalCapStrategy, readonly string[]>> = {
  // D1 schema uses snake_case keys; runtime loaders reference camelCase internally.
  // Both forms are checked so the resolver works with either format.
  daytrading: ['maxCapitalUsd', 'max_capital_usd'],
  swing: ['swing_maxCapitalUsd', 'swing_max_capital_usd'],
  crypto: ['crypto_maxCapitalUsd', 'crypto_max_capital_usd'],
};

/**
 * Resolve the display-only cap from the exact D1 keys and fallback defaults
 * accepted by the strategy loaders. A present malformed override is unavailable;
 * account buying power, cash, equity, and portfolio value are never inputs.
 */
export function resolveCapitalCaps(dbConfig: Record<string, string>): CapitalCaps {
  const caps = {} as CapitalCaps;
  for (const strategy of Object.keys(CAPITAL_CAP_KEYS) as CapitalCapStrategy[]) {
    const keys = CAPITAL_CAP_KEYS[strategy];
    let raw: string | undefined;
    for (const key of keys) {
      if (key in dbConfig) {
        raw = dbConfig[key];
        break;
      }
    }
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

/**
 * Resolve a runtime cap override using the same aliases and precedence as the
 * dashboard resolver. `undefined` means no valid override was found; callers
 * retain their existing fallback for missing or malformed values.
 */
export function resolveCapitalCapOverride(
  dbConfig: Record<string, string>,
  strategy: CapitalCapStrategy,
): number | undefined {
  const keys = CAPITAL_CAP_KEYS[strategy];
  for (const key of keys) {
    if (!(key in dbConfig)) continue;
    const value = validateCapitalCap(dbConfig[key]);
    return value === null ? undefined : value;
  }
  return undefined;
}

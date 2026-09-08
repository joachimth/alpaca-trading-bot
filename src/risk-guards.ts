// Per-strategy entry risk guards (Joachim-approved Sep 8, 2026).
//
// The pre-existing limits are account-level percentages (daily_loss_limit_pct
// = 15% of the whole account, rolling_drawdown_limit_pct = 10% over a
// ~100-minute equity window). On a ~$97k account that means roughly $14,500
// of intraday loss before anything trips, so in practice they never fire and
// an unprofitable strategy can bleed indefinitely. These guards are hard USD
// stops measured on the strategy's own daily P&L plus an absolute account
// equity floor:
//
//   - DAILY_LOSS_LIMIT_USD: daytrading $150, swing $100, crypto $100
//     (default 150/100/100; strategy daily P&L = positions closed today,
//     UTC, + broker intraday unrealized P&L of currently open positions).
//     When breached, new BUY entries are paused for the rest of the UTC day;
//     risk-reducing exits and reconciliation stay eligible.
//   - ACCOUNT_DRAWDOWN_FLOOR: $97,000 absolute equity floor. Below it, all
//     new entries halt pending review; exits stay eligible.
//
// Resolution semantics mirror capital-caps.ts: a missing key keeps the
// default; an explicit empty value or 0 disables that guard; a malformed,
// negative, or non-finite override is ignored so the default (fail closed)
// is retained. Guards never alter caps, sizing, or exit logic.

export type GuardedStrategy = 'daytrading' | 'swing' | 'crypto';

export interface RiskGuardConfig {
  dailyLossLimitUsd: Record<GuardedStrategy, number | null>;
  accountEquityFloorUsd: number | null;
}

export const RISK_GUARD_DEFAULTS: Readonly<{
  dailyLossLimitUsd: Record<GuardedStrategy, number>;
  accountEquityFloorUsd: number;
}> = {
  dailyLossLimitUsd: { daytrading: 150, swing: 100, crypto: 100 },
  accountEquityFloorUsd: 97000,
};

const DAILY_LOSS_KEYS: Readonly<Record<GuardedStrategy, readonly string[]>> = {
  // D1 schema uses snake_case keys; camelCase aliases are accepted like the
  // capital-cap resolver so runtime loaders can use either format.
  daytrading: ['dailyLossLimitUsd', 'daily_loss_limit_usd'],
  swing: ['swingDailyLossLimitUsd', 'swing_daily_loss_limit_usd'],
  crypto: ['cryptoDailyLossLimitUsd', 'crypto_daily_loss_limit_usd'],
};

const ACCOUNT_FLOOR_KEYS: readonly string[] = ['accountEquityFloorUsd', 'account_equity_floor_usd'];

/**
 * Parse one USD guard override.
 * - undefined: no valid override (key missing, empty, malformed, negative,
 *   or non-finite) — the caller keeps the default so a typo or a blank value
 *   can never silently switch a guard off (fail closed)
 * - null: explicitly disabled by the operator via the value 0
 * - number: the override value
 */
export function parseGuardUsd(raw: string | undefined): number | null | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined; // blank keeps the default (fail closed)
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined; // malformed keeps the default
  if (numeric === 0) return null; // explicit disable
  return numeric;
}

export function resolveRiskGuardConfig(dbConfig: Record<string, string>): RiskGuardConfig {
  const dailyLossLimitUsd = {} as Record<GuardedStrategy, number | null>;
  for (const strategy of Object.keys(DAILY_LOSS_KEYS) as GuardedStrategy[]) {
    let value: number | null = RISK_GUARD_DEFAULTS.dailyLossLimitUsd[strategy];
    for (const key of DAILY_LOSS_KEYS[strategy]) {
      if (!(key in dbConfig)) continue;
      const parsed = parseGuardUsd(dbConfig[key]);
      if (parsed !== undefined) value = parsed;
      break;
    }
    dailyLossLimitUsd[strategy] = value;
  }
  let accountEquityFloorUsd: number | null = RISK_GUARD_DEFAULTS.accountEquityFloorUsd;
  for (const key of ACCOUNT_FLOOR_KEYS) {
    if (!(key in dbConfig)) continue;
    const parsed = parseGuardUsd(dbConfig[key]);
    if (parsed !== undefined) accountEquityFloorUsd = parsed;
    break;
  }
  return { dailyLossLimitUsd, accountEquityFloorUsd };
}

export type EntryGuardCode = 'DAILY_LOSS_LIMIT_USD' | 'ACCOUNT_DRAWDOWN_FLOOR' | 'RISK_GUARD_UNAVAILABLE' | 'CRYPTO_DISABLED_BY_CONFIG';

export interface EntryGuardEvaluation {
  blocked: boolean;
  code: EntryGuardCode | null;
  reason: string;
  context: Record<string, unknown>;
}

/**
 * Evaluate the entry guards for one strategy. Order matters: the account
 * equity floor is checked first because it halts every strategy, then the
 * strategy-specific daily loss limit.
 */
export function evaluateEntryGuards(input: {
  strategy: GuardedStrategy;
  equityUsd: number;
  strategyDailyPlUsd: number;
  config: RiskGuardConfig;
}): EntryGuardEvaluation {
  const { strategy, equityUsd, strategyDailyPlUsd, config } = input;
  const floor = config.accountEquityFloorUsd;
  if (floor !== null && floor > 0 && Number.isFinite(equityUsd) && equityUsd < floor) {
    return {
      blocked: true,
      code: 'ACCOUNT_DRAWDOWN_FLOOR',
      reason: `Account equity $${equityUsd.toFixed(2)} is below the approved floor $${floor.toFixed(2)}; new entries halted pending review`,
      context: {
        strategy,
        equityUsd,
        floorUsd: floor,
        shortfallUsd: floor - equityUsd,
      },
    };
  }
  const limit = config.dailyLossLimitUsd[strategy];
  if (limit !== null && limit > 0 && Number.isFinite(strategyDailyPlUsd) && strategyDailyPlUsd <= -limit) {
    return {
      blocked: true,
      code: 'DAILY_LOSS_LIMIT_USD',
      reason: `Strategy daily P&L $${strategyDailyPlUsd.toFixed(2)} reached the $${limit.toFixed(2)} daily loss limit; new entries paused for the rest of the UTC day`,
      context: {
        strategy,
        dailyPlUsd: strategyDailyPlUsd,
        limitUsd: limit,
      },
    };
  }
  return {
    blocked: false,
    code: null,
    reason: '',
    context: { strategy, equityUsd, dailyPlUsd: strategyDailyPlUsd },
  };
}

/**
 * Strategy daily P&L input for the guard: realized P&L of positions closed
 * today (UTC boundary, recorded exactly once per close) plus the broker's
 * intraday unrealized P&L for currently open positions of that strategy.
 * Non-finite inputs count as zero so a malformed projection cannot fake a
 * healthy number.
 */
export function strategyDailyPlUsd(realizedTodayUsd: number, intradayUnrealizedUsd: number): number {
  const realized = Number.isFinite(realizedTodayUsd) ? realizedTodayUsd : 0;
  const intraday = Number.isFinite(intradayUnrealizedUsd) ? intradayUnrealizedUsd : 0;
  return realized + intraday;
}

/**
 * Crypto is formally disabled (Joachim decision Sep 8, 2026) until fee
 * telemetry is fresh AND a backtested edge exists. Fail closed: only the
 * explicit string 'true' enables it.
 */
export function cryptoTradingEnabled(dbConfig: Record<string, string>): boolean {
  const raw = dbConfig['crypto_trading_enabled'];
  return raw !== undefined && raw.trim().toLowerCase() === 'true';
}

/** Unavailable-guard evaluation used when the guard itself cannot be computed. */
export function riskGuardUnavailable(strategy: GuardedStrategy, detail: string): EntryGuardEvaluation {
  return {
    blocked: true,
    code: 'RISK_GUARD_UNAVAILABLE',
    reason: `Entry risk guard could not be evaluated (${detail}); new entries blocked, exits remain eligible`,
    context: { strategy, detail },
  };
}

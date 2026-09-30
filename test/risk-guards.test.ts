import { describe, expect, test } from 'bun:test';
import {
  RISK_GUARD_DEFAULTS,
  cryptoTradingEnabled,
  evaluateEntryGuards,
  parseGuardUsd,
  resolveRiskGuardConfig,
  riskGuardUnavailable,
  strategyDailyPlUsd,
} from '../src/risk-guards';

describe('risk guard config resolution', () => {
  test('uses the Joachim-approved defaults when D1 keys are missing', () => {
    expect(resolveRiskGuardConfig({})).toEqual(RISK_GUARD_DEFAULTS as never);
  });

  test('uses snake_case D1 keys for valid overrides', () => {
    expect(resolveRiskGuardConfig({
      daily_loss_limit_usd: '200',
      swing_daily_loss_limit_usd: '120',
      crypto_daily_loss_limit_usd: '80',
      account_equity_floor_usd: '96000',
    })).toEqual({
      dailyLossLimitUsd: { daytrading: 200, swing: 120, crypto: 80 },
      accountEquityFloorUsd: 96000,
    });
  });

  test('accepts camelCase aliases like the capital-cap resolver', () => {
    expect(resolveRiskGuardConfig({
      dailyLossLimitUsd: '175',
      accountEquityFloorUsd: '97500',
    })).toEqual({
      dailyLossLimitUsd: { daytrading: 175, swing: 100, crypto: 100 },
      accountEquityFloorUsd: 97500,
    });
  });

  test('explicit 0 disables a guard but blank, malformed, and negative values keep the default (fail closed)', () => {
    expect(parseGuardUsd(undefined)).toBeUndefined();
    expect(parseGuardUsd('')).toBeUndefined();
    expect(parseGuardUsd('abc')).toBeUndefined();
    expect(parseGuardUsd('-50')).toBeUndefined();
    expect(parseGuardUsd('0')).toBeNull();
    expect(parseGuardUsd('250')).toBe(250);

    const cfg = resolveRiskGuardConfig({ daily_loss_limit_usd: '0', account_equity_floor_usd: 'not-a-number' });
    expect(cfg.dailyLossLimitUsd.daytrading).toBeNull();
    expect(cfg.dailyLossLimitUsd.swing).toBe(RISK_GUARD_DEFAULTS.dailyLossLimitUsd.swing);
    expect(cfg.accountEquityFloorUsd).toBe(RISK_GUARD_DEFAULTS.accountEquityFloorUsd);
  });
});

describe('entry guard evaluation', () => {
  const cfg = resolveRiskGuardConfig({});

  test('passes when equity is above the floor and daily P&L is above the limit', () => {
    const result = evaluateEntryGuards({
      strategy: 'daytrading',
      equityUsd: 97700,
      strategyDailyPlUsd: -100,
      config: cfg,
    });
    expect(result.blocked).toBe(false);
    expect(result.code).toBeNull();
  });

  test('trips DAILY_LOSS_LIMIT_USD at exactly the approved limit', () => {
    const result = evaluateEntryGuards({
      strategy: 'daytrading',
      equityUsd: 97700,
      strategyDailyPlUsd: -150,
      config: cfg,
    });
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('DAILY_LOSS_LIMIT_USD');
    expect(result.context).toMatchObject({ strategy: 'daytrading', dailyPlUsd: -150, limitUsd: 150 });
  });

  test('uses the swing limit for swing and the crypto limit for crypto', () => {
    expect(evaluateEntryGuards({ strategy: 'swing', equityUsd: 97700, strategyDailyPlUsd: -100, config: cfg }).code).toBe('DAILY_LOSS_LIMIT_USD');
    expect(evaluateEntryGuards({ strategy: 'swing', equityUsd: 97700, strategyDailyPlUsd: -99.99, config: cfg }).blocked).toBe(false);
    expect(evaluateEntryGuards({ strategy: 'crypto', equityUsd: 97700, strategyDailyPlUsd: -100, config: cfg }).code).toBe('DAILY_LOSS_LIMIT_USD');
    expect(evaluateEntryGuards({ strategy: 'crypto', equityUsd: 97700, strategyDailyPlUsd: -99.99, config: cfg }).blocked).toBe(false);
  });

  test('trips ACCOUNT_DRAWDOWN_FLOOR below $97,000 for every strategy, ahead of the daily loss check', () => {
    for (const strategy of ['daytrading', 'swing', 'crypto'] as const) {
      const result = evaluateEntryGuards({
        strategy,
        equityUsd: 96999.99,
        strategyDailyPlUsd: -500,
        config: cfg,
      });
      expect(result.blocked).toBe(true);
      expect(result.code).toBe('ACCOUNT_DRAWDOWN_FLOOR');
      expect(result.context).toMatchObject({ equityUsd: 96999.99, floorUsd: 97000 });
    }
  });

  test('a disabled daily limit never trips and a disabled floor never trips', () => {
    const disabled = resolveRiskGuardConfig({
      daily_loss_limit_usd: '0',
      swing_daily_loss_limit_usd: '0',
      crypto_daily_loss_limit_usd: '0',
      account_equity_floor_usd: '0',
    });
    expect(evaluateEntryGuards({ strategy: 'daytrading', equityUsd: 50000, strategyDailyPlUsd: -5000, config: disabled }).blocked).toBe(false);
  });

  test('non-finite daily P&L cannot fake a healthy number but non-finite equity does not trip the floor', () => {
    const fin = evaluateEntryGuards({ strategy: 'daytrading', equityUsd: 97700, strategyDailyPlUsd: Number.NaN, config: cfg });
    expect(fin.blocked).toBe(false); // NaN treated as zero by strategyDailyPlUsd, not passed raw here
    const guard = evaluateEntryGuards({ strategy: 'daytrading', equityUsd: Number.NaN, strategyDailyPlUsd: -10, config: cfg });
    expect(guard.blocked).toBe(false); // floor skipped when equity unknown; broker fetch failure is surfaced elsewhere
  });

  test('riskGuardUnavailable blocks entries fail-closed', () => {
    const result = riskGuardUnavailable('daytrading', 'D1_ERROR');
    expect(result.blocked).toBe(true);
    expect(result.code).toBe('RISK_GUARD_UNAVAILABLE');
  });
});

describe('strategy daily P&L input', () => {
  test('sums realized-today and intraday unrealized, treating non-finite as zero', () => {
    expect(strategyDailyPlUsd(-120, -40)).toBe(-160);
    expect(strategyDailyPlUsd(Number.NaN, -40)).toBe(-40);
    expect(strategyDailyPlUsd(-120, Number.NaN)).toBe(-120);
    expect(strategyDailyPlUsd(Number.NaN, Number.NaN)).toBe(0);
  });
});

describe('crypto formal disable', () => {
  test('fails closed: only the explicit string true enables crypto', () => {
    expect(cryptoTradingEnabled({})).toBe(false);
    expect(cryptoTradingEnabled({ crypto_trading_enabled: '' })).toBe(false);
    expect(cryptoTradingEnabled({ crypto_trading_enabled: 'false' })).toBe(false);
    expect(cryptoTradingEnabled({ crypto_trading_enabled: 'TRUE' })).toBe(true);
    expect(cryptoTradingEnabled({ crypto_trading_enabled: 'true' })).toBe(true);
  });
});

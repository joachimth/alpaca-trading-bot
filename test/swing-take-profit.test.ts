import { describe, expect, test } from 'bun:test';
import { SwingRiskManager, type SwingRiskConfig } from '../src/swing-risk';
import type { SwingScore } from '../src/swing-signals';
import { SWING_FALLBACK_CONFIG, resolveSwingConfig } from '../src/swing-strategy';

const config = (values: Partial<SwingRiskConfig> = {}): SwingRiskConfig => ({
  maxPositions: 5,
  maxPositionPct: 50,
  targetPositionPct: 20,
  maxSectorPct: 20,
  maxGrossExposure: 100,
  stopLossPct: 8,
  takeProfitPct: 15,
  trailingStopPct: 8,
  dailyLossLimitPct: 5,
  rollingDrawdownLimitPct: 15,
  minConfidence: 0.5,
  minEdgeAfterCosts: 5,
  exitZScore: -0.5,
  enableMargin: false,
  earningsBlackoutDays: 3,
  maxTurnoverPct: 30,
  minTradeSize: 0.25,
  maxOrderRatePerMin: 15,
  maxCapitalUsd: 3700,
  ...values,
});

const score = (compositeScore = 2): SwingScore => ({
  symbol: 'AAPL',
  compositeScore,
  rank: 1,
  percentile: 95,
  signals: ['test'],
  indicators: {
    symbol: 'AAPL', vol20d: 0.3, reversal5d: 0, maGap: 0, volumeRatio: 1, bbPosition: 0.5,
    maxDailyReturn21d: 0.02, betaProxy: 1, sector: 'technology',
  } as SwingScore['indicators'],
  reversalScore: 1,
  momentumScore: 1,
  proximityScore: 1,
  volumeScore: 1,
  qualityScore: 1,
});

const position = (values: Record<string, unknown> = {}) => ({
  ticker: 'AAPL', side: 'long', qty: 10, avg_entry_price: 100, current_price: 100,
  market_value: 1000, unrealized_pl: 0, unrealized_plpc: 0,
  ...values,
});

describe('swing take profit (implemented 2026-10-14, Joachim\'s call)', () => {
  test('exits protectively at or above the take-profit gain', () => {
    const manager = new SwingRiskManager(config({ takeProfitPct: 15 }));
    const result = manager.checkExit(score(), position({ unrealized_pl: 160, unrealized_plpc: 0.16 }));
    expect(result.shouldExit).toBe(true);
    expect(result.exitType).toBe('protective');
    expect(result.reason).toContain('Take profit');
  });

  test('does not exit below the take-profit gain (z-score hysteresis still governs)', () => {
    const manager = new SwingRiskManager(config({ takeProfitPct: 15 }));
    const result = manager.checkExit(score(2), position({ unrealized_pl: 100, unrealized_plpc: 0.10 }));
    expect(result.shouldExit).toBe(false);
    expect(result.exitType).toBe('none');
  });

  test('take profit bypasses the discretionary exit-cost gate', () => {
    // A protective exit must not be held back by the fee gate that governs
    // discretionary (z-score) exits - that gate only makes sense for small gains.
    const manager = new SwingRiskManager(config({ takeProfitPct: 15, observedFeeBps: 200 }));
    const result = manager.checkExit(score(-2), position({ unrealized_pl: 200, unrealized_plpc: 0.20 }));
    expect(result.shouldExit).toBe(true);
    expect(result.exitType).toBe('protective');
    expect(result.isHysteresisSkip).toBe(false);
  });

  test('does not take profit on a loss even if abs(plpc) is large', () => {
    const manager = new SwingRiskManager(config({ takeProfitPct: 15, stopLossPct: 20 }));
    const result = manager.checkExit(score(2), position({ unrealized_pl: -160, unrealized_plpc: -0.16 }));
    expect(result.shouldExit).toBe(false);
    expect(result.reason).not.toContain('Take profit');
  });
});

describe('swing snake_case D1 mapping (dead-knob fix 2026-10-14)', () => {
  test('swing_* snake_case keys now merge into camelCase runtime config', () => {
    expect(resolveSwingConfig({ swing_min_confidence: '0.6' }).minConfidence).toBe(0.6);
    expect(resolveSwingConfig({ swing_exit_zscore: '-0.7' }).exitZScore).toBe(-0.7);
    expect(resolveSwingConfig({ swing_take_profit_pct: '12' }).takeProfitPct).toBe(12);
    expect(resolveSwingConfig({}).takeProfitPct).toBe(SWING_FALLBACK_CONFIG.takeProfitPct);
  });

  test('keys with no runtime-config counterpart do not create new fields', () => {
    const resolved = resolveSwingConfig({ swing_daily_loss_limit_usd: '100', swing_scan_universe_size: '150' });
    expect((resolved as any).dailyLossLimitUsd).toBeUndefined();
    expect((resolved as any).scanUniverseSize).toBeUndefined();
  });

  test('capital cap override still wins over the generic mapping', () => {
    expect(resolveSwingConfig({ swing_max_capital_usd: '4200' }).maxCapitalUsd).toBe(4200);
    expect(resolveSwingConfig({ swing_max_capital_usd: '-1' }).maxCapitalUsd).toBe(10000);
  });

  test('boolean swing keys still map through snake_case', () => {
    expect(resolveSwingConfig({ swing_enable_margin: 'true' }).enableMargin).toBe(true);
    expect(resolveSwingConfig({ swing_enable_margin: 'false' }).enableMargin).toBe(false);
  });
});

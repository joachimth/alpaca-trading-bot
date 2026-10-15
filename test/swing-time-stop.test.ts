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

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

describe('swing time stop (implemented 2026-10-15, Joachim\'s call)', () => {
  test('exits a losing position held past maxHoldDays protectively', () => {
    const manager = new SwingRiskManager(config({ maxHoldDays: 14 }));
    const result = manager.checkExit(
      score(2), // healthy z-score - only the time stop can trigger
      position({ unrealized_pl: -5.2, unrealized_plpc: -0.03 }), // below the 8% stop
      daysAgo(49)
    );
    expect(result.shouldExit).toBe(true);
    expect(result.exitType).toBe('protective');
    expect(result.reason).toContain('Time stop');
    expect(result.reason).toContain('49');
  });

  test('does not exit a winning position held past maxHoldDays (winners ride)', () => {
    const manager = new SwingRiskManager(config({ maxHoldDays: 14 }));
    const result = manager.checkExit(score(2), position({ unrealized_pl: 40, unrealized_plpc: 0.09 }), daysAgo(49));
    expect(result.shouldExit).toBe(false);
    expect(result.exitType).toBe('none');
  });

  test('does not exit a losing position within maxHoldDays', () => {
    const manager = new SwingRiskManager(config({ maxHoldDays: 14 }));
    const result = manager.checkExit(score(2), position({ unrealized_pl: -10, unrealized_plpc: -0.05 }), daysAgo(5));
    expect(result.shouldExit).toBe(false);
    expect(result.exitType).toBe('none');
  });

  test('is disabled when maxHoldDays is 0 or undefined', () => {
    const opened = daysAgo(120);
    for (const maxHoldDays of [0, undefined]) {
      const manager = new SwingRiskManager(config({ maxHoldDays }));
      const result = manager.checkExit(score(2), position({ unrealized_pl: -10, unrealized_plpc: -0.05 }), opened);
      expect(result.shouldExit).toBe(false);
      expect(result.exitType).toBe('none');
    }
  });

  test('parses D1 opened_at format (space-separated UTC) and ISO format alike', () => {
    const manager = new SwingRiskManager(config({ maxHoldDays: 14 }));
    const iso = new Date(Date.now() - 49 * 86_400_000).toISOString();
    const d1 = iso.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
    for (const openedAt of [iso, d1]) {
      const result = manager.checkExit(score(2), position({ unrealized_pl: -5, unrealized_plpc: -0.03 }), openedAt);
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('Time stop');
    }
  });

  test('fallback config ships maxHoldDays 14 and resolveSwingConfig maps the D1 key', () => {
    expect(SWING_FALLBACK_CONFIG.maxHoldDays).toBe(14);
    const resolved = resolveSwingConfig({ swing_max_hold_days: '21' });
    expect(resolved.maxHoldDays).toBe(21);
  });
});

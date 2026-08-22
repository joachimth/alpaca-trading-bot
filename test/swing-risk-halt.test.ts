import { describe, expect, test } from 'bun:test';
import { getSwingRiskHaltSkipContext } from '../src/swing-strategy';
import { SwingRiskManager, type SwingRiskConfig } from '../src/swing-risk';

const config: SwingRiskConfig = {
  maxPositions: 5,
  maxPositionPct: 50,
  targetPositionPct: 20,
  maxSectorPct: 20,
  maxGrossExposure: 100,
  stopLossPct: 15,
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
};

describe('swing RISK_HALTED skip context', () => {
  test('contains the actual halt reason rather than the boolean halt flag', () => {
    const riskManager = new SwingRiskManager(config);
    const haltReason = 'Rolling drawdown limit: 16.25%';
    riskManager.haltTrading(haltReason);

    const context = getSwingRiskHaltSkipContext(riskManager);

    expect(context).toEqual({ reason: haltReason });
    expect(context.reason).toBe(haltReason);
    expect(typeof context.reason).toBe('string');
    expect(typeof context.reason).not.toBe('boolean');
    expect(context.reason).not.toBe(true);
    expect(context.reason).not.toBe(false);
  });
});

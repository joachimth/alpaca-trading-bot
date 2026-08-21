import { describe, expect, test } from 'bun:test';
import type { AccountInfo, Position } from '../src/alpaca';
import type { AIDecision } from '../src/ai-decision';
import { RiskManager, type RiskConfig } from '../src/risk-manager';
import { SwingRiskManager, type SwingRiskConfig } from '../src/swing-risk';
import type { SwingScore } from '../src/swing-signals';
import type { TAIndicators } from '../src/technical-analysis';

const account = (values: Partial<AccountInfo> = {}): AccountInfo => ({
  id: 'acct-1',
  account_number: 'paper-1',
  status: 'ACTIVE',
  currency: 'USD',
  cash: 10_000,
  portfolio_value: 10_000,
  equity: 10_000,
  buying_power: 10_000,
  long_market_value: 0,
  short_market_value: 0,
  market_value: 0,
  last_equity: 10_000,
  change_today: 0,
  change_today_pct: 0,
  pattern_day_trader: false,
  trading_blocked: false,
  transfers_blocked: false,
  account_blocked: false,
  ...values,
});

const indicators = (values: Partial<TAIndicators> = {}): TAIndicators => ({
  symbol: 'AAPL',
  price: 100,
  rsi: 50,
  emaFast: 100,
  emaSlow: 99,
  emaTrend: 'up',
  macd: 1,
  macdSignal: 0.5,
  macdHistogram: 0.5,
  macdTrend: 'bullish',
  atr: 1,
  atrPct: 1,
  volume: 1_000_000,
  volumeAvg: 1_000_000,
  volumeRatio: 1,
  support: 98,
  resistance: 102,
  pricePosition: 0.5,
  stochK: 60,
  stochD: 55,
  bbUpper: 103,
  bbMiddle: 100,
  bbLower: 97,
  bbPosition: 0.5,
  adx: 25,
  obv: 1_000,
  obvTrend: 'up',
  shortTermReturn: 0.01,
  shortTermReturnPeriods: 5,
  gapPct: 0,
  vwap: 100,
  vwapDeviation: 0,
  intradayReturn: 0.01,
  ...values,
});

const position = (values: Partial<Position> = {}): Position => ({
  asset_id: 'asset-1',
  symbol: 'AAPL',
  qty: 50,
  side: 'long',
  market_value: 5_000,
  cost_basis: 4_900,
  unrealized_pl: 10,
  unrealized_plpc: 10 / 4_900,
  unrealized_intraday_pl: 0,
  unrealized_intraday_plpc: 0,
  current_price: 100,
  avg_entry_price: 98,
  change_today: 0,
  change_today_pct: 0,
  ...values,
});

const decision: AIDecision = {
  action: 'BUY',
  confidence: 0.9,
  reasoning: 'test decision',
  factors: ['test'],
  adjustedFromTA: false,
  taSignal: {
    action: 'BUY',
    confidence: 0.9,
    reasons: ['test'],
    indicators: indicators(),
  },
};

const riskConfig = (values: Partial<RiskConfig> = {}): RiskConfig => ({
  maxPositions: 5,
  maxPositionPct: 50,
  stopLossATRMultiplier: 1.5,
  takeProfitATRMultiplier: 2,
  trailingStopPct: 2,
  dailyLossLimitPct: 10,
  rollingDrawdownLimitPct: 20,
  minConfidence: 0.5,
  enableMargin: false,
  eodFlatten: false,
  targetVolatilityPct: 2,
  maxOrderRatePerMin: 10,
  minEdgeAfterCosts: 0,
  maxCapitalUsd: 0,
  ...values,
});

const swingIndicators = {
  symbol: 'AAPL',
  price: 100,
  ret1d: 0.01,
  ret5d: 0.02,
  ret21d: 0.05,
  ret63d: 0.1,
  ret126d: 0.15,
  ret252d: 0.2,
  momentum12_1: 0.1,
  high52w: 105,
  high52wProximity: 0.95,
  low52w: 70,
  vol20d: 0.1,
  vol60d: 0.1,
  volRatio: 1,
  volume20d: 1_000_000,
  volumeRatio: 1,
  amihudIlliquidity: 0.01,
  rsi14: 55,
  rsi5: 55,
  bbPosition: 0.6,
  maxDailyReturn21d: 0.03,
  betaProxy: 1,
  sector: 'technology',
};

const score = (values: Partial<SwingScore> = {}): SwingScore => ({
  symbol: 'AAPL',
  compositeScore: 2,
  rank: 1,
  percentile: 95,
  signals: ['test'],
  indicators: swingIndicators,
  reversalScore: 1,
  momentumScore: 1,
  proximityScore: 1,
  volumeScore: 1,
  qualityScore: 1,
  ...values,
});

const swingConfig = (values: Partial<SwingRiskConfig> = {}): SwingRiskConfig => ({
  maxPositions: 5,
  maxPositionPct: 25,
  targetPositionPct: 10,
  maxSectorPct: 25,
  maxGrossExposure: 100,
  stopLossPct: 10,
  trailingStopPct: 5,
  dailyLossLimitPct: 10,
  rollingDrawdownLimitPct: 20,
  minConfidence: 1,
  minEdgeAfterCosts: 5,
  exitZScore: -1,
  enableMargin: false,
  earningsBlackoutDays: 0,
  maxTurnoverPct: 50,
  minTradeSize: 0,
  maxOrderRatePerMin: 10,
  maxCapitalUsd: 0,
  ...values,
});

describe('broker quantity mismatch safety regression coverage', () => {
  test('detects quantity divergence and blocks new BUY admission', () => {
    const manager = new RiskManager(riskConfig());
    const divergence = manager.checkDivergence(
      [position({ qty: 2 })],
      [{ ticker: 'AAPL', qty: 1, side: 'long' }],
    );
    expect(divergence.divergent).toBe(true);
    expect(divergence.details[0]).toContain('qty mismatch');

    manager.haltTrading('New entries blocked by broker/internal quantity mismatch: AAPL');
    const result = manager.checkTrade(decision, account(), [position({ qty: 2 })], indicators());
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Trading halted: New entries blocked by broker/internal quantity mismatch');
  });

  test('does not report a mismatch within the quantity tolerance', () => {
    const manager = new RiskManager(riskConfig());
    const divergence = manager.checkDivergence(
      [position({ qty: 1.0005 })],
      [{ ticker: 'AAPL', qty: 1, side: 'long' }],
    );
    expect(divergence.divergent).toBe(false);
  });
});

describe('fee-aware RiskManager regression coverage', () => {
  test('estimates costs from final quantity/notional, not a one-share default', () => {
    const manager = new RiskManager(riskConfig({ observedFeeBps: 10 }));
    const result = manager.checkTrade(decision, account(), [], indicators());

    // 50 shares × $100 × (1.5 + 5 + 0.1 + 10) bps = $8.30.
    expect(result.approved).toBe(true);
    expect(result.adjustedQty).toBe(50);
    expect(result.estimatedCosts).toBeCloseTo(8.3, 10);
  });

  test('blocks a discretionary profitable exit when costs consume gross P&L', () => {
    const manager = new RiskManager(riskConfig({ observedFeeBps: 10 }));
    const result = manager.checkExitCost(position({ unrealized_pl: 8.3 }), indicators());

    expect(result.approved).toBe(false);
    expect(result.estimatedCosts).toBeCloseTo(8.3, 10);
    expect(result.edgeAfterCosts).toBeCloseTo(0, 10);
    expect(result.reason).toContain('gross P&L');
  });

  test('allows a losing discretionary exit for risk reduction', () => {
    const manager = new RiskManager(riskConfig({ observedFeeBps: 10 }));
    const result = manager.checkExitCost(position({ unrealized_pl: -25 }), indicators());

    expect(result.approved).toBe(true);
    expect(result.estimatedCosts).toBeCloseTo(8.3, 10);
    expect(result.edgeAfterCosts).toBeCloseTo(-33.3, 10);
  });
});

describe('fee-aware SwingRiskManager regression coverage', () => {
  test('expectedEdgeBps=0 approves and reports an uncalibrated edge gate without inventing a z-score edge gate', () => {
    const manager = new SwingRiskManager(swingConfig({ expectedEdgeBps: 0 }));
    const result = manager.checkEntry(score(), account({ cash: 100_000, portfolio_value: 100_000 }), [], 100);

    expect(result.approved).toBe(true);
    expect(result.edgeAfterCosts).toBeUndefined();
    expect(result.reason).toContain('edge gate not calibrated');
    expect(result.reason).not.toContain('Edge after costs insufficient');
  });

  test('rejects a calibrated expected edge that does not clear costs', () => {
    const manager = new SwingRiskManager(swingConfig({ expectedEdgeBps: 9 }));
    const result = manager.checkEntry(score(), account({ cash: 100_000, portfolio_value: 100_000 }), [], 100);

    expect(result.approved).toBe(false);
    expect(result.edgeAfterCosts).toBeCloseTo(-375.0644730092272, 6);
    expect(result.reason).toContain('Edge after costs insufficient');
  });

  test('approves a calibrated expected edge that clears costs', () => {
    const manager = new SwingRiskManager(swingConfig({ expectedEdgeBps: 400 }));
    const result = manager.checkEntry(score(), account({ cash: 100_000, portfolio_value: 100_000 }), [], 100);

    expect(result.approved).toBe(true);
    expect(result.edgeAfterCosts).toBeCloseTo(15.9355269907728, 6);
    expect(result.reason).toContain('edge after costs: 15.9bps');
  });
});

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { RiskManager, type RiskConfig } from '../src/risk-manager';
import type { AccountInfo } from '../src/alpaca';
import type { AIDecision } from '../src/ai-decision';
import type { Position } from '../src/alpaca';
import type { TAIndicators } from '../src/technical-analysis';

const wranglerToml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

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

const indicators: TAIndicators = {
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
};

const position: Position = {
  asset_id: 'asset-1',
  symbol: 'AAPL',
  qty: 1,
  side: 'long',
  market_value: 100,
  cost_basis: 90,
  unrealized_pl: 10,
  unrealized_plpc: 10 / 90,
  unrealized_intraday_pl: 0,
  unrealized_intraday_plpc: 0,
  current_price: 100,
  avg_entry_price: 90,
  change_today: 0,
  change_today_pct: 0,
};

const buyDecision: AIDecision = {
  action: 'BUY',
  confidence: 0.9,
  reasoning: 'regression test',
  factors: ['regression test'],
  adjustedFromTA: false,
  taSignal: {
    action: 'BUY',
    confidence: 0.9,
    reasons: ['regression test'],
    indicators,
  },
};

const riskConfig: RiskConfig = {
  maxPositions: 5,
  maxPositionPct: 50,
  stopLossATRMultiplier: 1.5,
  takeProfitATRMultiplier: 2,
  trailingStopPct: 5,
  dailyLossLimitPct: 10,
  rollingDrawdownLimitPct: 10,
  minConfidence: 0.5,
  enableMargin: false,
  eodFlatten: false,
  targetVolatilityPct: 2,
  maxOrderRatePerMin: 10,
  minEdgeAfterCosts: 0,
  maxCapitalUsd: 0,
};

describe('audit schedule and dispatch regressions', () => {
  test('keeps the four configured cron expressions exact', () => {
    expect(wranglerToml).toContain(
      'crons = ["*/5 13-21 * * 1-5", "0 22 * * 1-5", "7-59/30 * * * *", "*/10 * * * *"]',
    );
  });

  test('keeps each cron expression mapped to its current dispatch path', () => {
    expect(workerSource).toMatch(/event\.cron === '0 22 \* \* 1-5'[\s\S]*?runStrategyWithSchemaGate\(env, 'swing_cron', runSwingCycle\)/);
    expect(workerSource).toMatch(/event\.cron === '7-59\/30 \* \* \* \*'[\s\S]*?runStrategyWithSchemaGate\(env, 'crypto_cron', runCryptoCycle\)/);
    expect(workerSource).toMatch(/event\.cron === '\*\/5 13-21 \* \* 1-5'[\s\S]*?runStrategyWithSchemaGate\(env, 'cron', runTradingCycleWithLease\)/);
    expect(workerSource).toMatch(/event\.cron === '\*\/10 \* \* \* \*'[\s\S]*?runScheduledMaintenance\(env, 'reconcile_cron'\)/);
  });
});

describe('audit equity-direction and risk semantics', () => {
  test('account snapshots count every broker position, not strategy-filtered risk positions', () => {
    expect(workerSource).toContain('positions_count: allBrokerPositions.length');
    const swingSource = readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8');
    const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');
    expect(swingSource).toContain('positions_count: allBrokerPositions.length');
    expect(cryptoSource).toContain('positions_count: positions.length');
  });

  test('keeps swing RISK_HALTED skip context on the actual halt reason, not the boolean flag', () => {
    const swingSource = readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8');
    expect(swingSource).toContain("const haltContext = getSwingRiskHaltSkipContext(riskManager);");
    expect(swingSource).toContain("skips.add('RISK_HALTED', 'cycle', 'Swing trading is halted by risk controls', haltContext);");
    expect(swingSource).not.toContain("{ reason: riskManager.isTradingHalted() }");
  });

  test('keeps account total P&L direction as current equity minus last equity', () => {
    expect(workerSource).toContain('total_pl: account.equity - account.last_equity');
    expect(workerSource).toContain('total_plpc: account.last_equity > 0 ? ((account.equity - account.last_equity) / account.last_equity) * 100 : 0');
    expect(account({ equity: 10_250, last_equity: 10_000 }).equity - account({ equity: 10_250, last_equity: 10_000 }).last_equity).toBe(250);
  });

  test('blocks a BUY at the configured negative daily-loss threshold but not on positive direction', () => {
    const positive = new RiskManager(riskConfig).checkTrade(
      buyDecision,
      account({ equity: 10_250, last_equity: 10_000, change_today_pct: 10 }),
      [],
      indicators,
    );
    expect(positive.approved).toBe(true);

    const negativeManager = new RiskManager(riskConfig);
    const negative = negativeManager.checkTrade(
      buyDecision,
      account({ equity: 9_000, last_equity: 10_000, change_today_pct: -10 }),
      [],
      indicators,
    );
    expect(negative.approved).toBe(false);
    expect(negative.reason).toContain('Daily loss limit reached');
  });

  test('triggers rolling drawdown only when current equity falls from the observed peak', () => {
    const manager = new RiskManager(riskConfig);
    manager.updateEquitySnapshot(10_000);
    manager.updateEquitySnapshot(10_500);
    manager.updateEquitySnapshot(10_000);
    manager.updateEquitySnapshot(9_500);
    manager.updateEquitySnapshot(9_500);
    expect(manager.isTradingHalted()).toBe(false);

    manager.updateEquitySnapshot(9_300);
    expect(manager.isTradingHalted()).toBe(true);
    expect(manager.getKillState().reason).toContain('Rolling drawdown limit reached');
  });
});


describe('audit run-count lifecycle semantics', () => {
  test('counts only broker-confirmed full fills, not submitted or partial orders', () => {
    const swingSource = readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8');
    const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');

    expect(workerSource).toContain('const fullyFilled = alpaca.isOrderFullyFilled(order);');
    expect(workerSource).toContain('if (fullyFilled) tradesExecuted++;');
    expect(swingSource).toMatch(/const fullyFilled = order\.status === 'filled'[\s\S]*?if \(fullyFilled\) tradesExecuted\+\+;/);
    expect(cryptoSource).toMatch(/const fullyFilled = outcome === 'filled';[\s\S]*?if \(fullyFilled\) tradesExecuted\+\+;/);

    expect(workerSource).toContain('Broker order status: ${order.status}; filled ${order.filled_qty}/${order.qty}');
    expect(swingSource).toContain('Broker order status: ${order.status}; filled ${order.filled_qty}/${order.qty}');
    expect(cryptoSource).toContain('Order submitted: ${riskCheck.adjustedQty} units; broker status ${order.status}');
  });
});

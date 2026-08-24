import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { RiskManager, type RiskConfig } from '../src/risk-manager';
import {
  checkDaytradingBuyMinimumNotional,
  daytradingExitEstimatedValue,
  daytradingRiskSkipCode,
  daytradingRiskSkipContext,
} from '../src/index';
import { SkipReasonCollector, parseRunDetails, serializeRunDetails } from '../src/skip-reasons';
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

  test('records successful broker-only reconciliation as non-error observability', () => {
    const reconciliationBranch = workerSource.match(/\} else \{\n        \/\/ Auto-reconcile: upsert all broker positions into DB[\s\S]*?\n      \}\n    \}\n\n    \/\/ 6\./)?.[0] ?? '';
    expect(reconciliationBranch).toContain("skips.add('BROKER_ONLY_RECONCILED', 'reconciliation'");
    expect(reconciliationBranch).not.toContain('errors.push');
    expect(reconciliationBranch).toContain('await db.upsertPosition');
    expect(reconciliationBranch).toContain("await db.closePosition(dbPos.ticker, null, 'auto_reconcile_not_in_broker')");
    expect(workerSource).toContain('errors.push(`Broker quantity reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);');
  });

  test('keeps swing and crypto broker fan-out bounded by deferring duplicate reconciliation', () => {
    const swingSource = readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8');
    const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');
    const alpacaSource = readFileSync(new URL('../src/alpaca.ts', import.meta.url), 'utf8');
    for (const [strategy, source] of [['swing', swingSource], ['crypto', cryptoSource]] as const) {
      expect(source, `${strategy} must not import broker ledger reconciliation`).not.toContain("from './broker-ledger'");
      expect(source, `${strategy} must not import broker order reconciliation`).not.toContain("from './order-reconciliation'");
      expect(source, `${strategy} must not call broker ledger reconciliation`).not.toContain('syncBrokerLedger(');
      expect(source, `${strategy} must not call broker order reconciliation`).not.toContain('reconcileBrokerOrders(');
      expect(source, `${strategy} must record deferred reconciliation evidence`).toContain("RECONCILIATION_DEFERRED_TO_MAINTENANCE");
      expect(source, `${strategy} must name the maintenance cron`).toContain("maintenanceTrigger: 'reconcile_cron'");
    }
    expect(swingSource).toContain("closePosition(sell.symbol, { waitForFill: false })");
    expect(alpacaSource).toContain('options: { waitForFill?: boolean } = {}');
    expect(alpacaSource).toContain('options.waitForFill !== false');
  });

  test('keeps close paths conservative when fill-derived realized P&L is unavailable', () => {
    for (const source of [workerSource,
      readFileSync(new URL('../src/swing-strategy.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/position-reconciliation.ts', import.meta.url), 'utf8')]) {
      expect(source).not.toMatch(/closePosition\([^\n]*,\s*(?:pos|existingPos)\.unrealized_pl/);
      expect(source).not.toMatch(/closePosition\([^\n]*,\s*0\s*,/);
    }
  });

  test('keeps crypto fee telemetry fail-closed when maintenance data is missing or stale', () => {
    const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');
    const runtimeSource = readFileSync(new URL('../src/crypto-runtime.ts', import.meta.url), 'utf8');
    expect(cryptoSource).toContain("const feeTelemetry: FeeTelemetry = !feeSummary");
    expect(cryptoSource).toContain("maxAgeMs: 60_000");
    expect(runtimeSource).toContain("if (!input.asOf) return { status: 'unavailable'");
    expect(runtimeSource).toContain("reason: 'crypto fee telemetry is stale'");
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

  test('logs crypto candidate counts and does no downstream decision or order work when TA is insufficient', () => {
    const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');
    const earlyReturn = cryptoSource.match(/if \(validTA\.length < 3\) \{([\s\S]*?)\n    \}\n\n    \/\/ Generate signals/);

    expect(earlyReturn).not.toBeNull();
    expect(earlyReturn?.[1]).toContain('analyzed_candidates: validTA.length');
    expect(earlyReturn?.[1]).toContain('filtered_candidates: 0');
    expect(earlyReturn?.[1]).toContain('return;');
    expect(earlyReturn?.[1]).not.toMatch(/generateSignal|refineWithLLM|logDecision|submitOrder|closePosition/);
  });

  test('loads durable rolling equity history before each fresh RiskManager invocation', () => {
    expect(workerSource).toContain('const recentEquityHistory = await db.getRecentEquityHistory();');
    expect(workerSource).toContain('new RiskManager(riskConfig, recentEquityHistory)');
    const cryptoSource = readFileSync(new URL('../src/crypto-strategy.ts', import.meta.url), 'utf8');
    expect(cryptoSource).toContain('const recentEquityHistory = await db.getRecentEquityHistory();');
    expect(cryptoSource).toContain('new RiskManager(riskConfig, recentEquityHistory)');

    expect(workerSource).toContain('performance snapshot');
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

    // Repeated values and a recovery do not trigger the halt; only the
    // actual 10,500 peak-to-9,300 current decline crosses 10%.
    manager.updateEquitySnapshot(9_300);
    expect(manager.isTradingHalted()).toBe(true);
    expect(manager.getKillState().reason).toContain('Rolling drawdown limit reached');
  });

  test('preserves durable rolling history when a new RiskManager instance is created', () => {
    const durableHistory = [10_000, 10_500, 10_000, 9_500];
    const first = new RiskManager(riskConfig, durableHistory);
    first.updateEquitySnapshot(9_700);
    expect(first.isTradingHalted()).toBe(false);

    const second = new RiskManager(riskConfig, first.getKillState().equityHistory);
    second.updateEquitySnapshot(9_300);
    expect(second.getKillState().equityHistory).toEqual([...durableHistory, 9_700, 9_300]);
    expect(second.isTradingHalted()).toBe(true);
    expect(second.getKillState().reason).toContain('Rolling drawdown limit reached');
  });

  test('bounds and filters restored rolling equity history', () => {
    const bounded = new RiskManager(riskConfig, [NaN, ...Array.from({ length: 25 }, (_, index) => index + 1)]);
    expect(bounded.getKillState().equityHistory).toHaveLength(20);
    expect(bounded.getKillState().equityHistory[0]).toBe(6);
  });
});


describe('daytrading order preflight regressions', () => {
  test('rejects below-minimum BUY notionals without resizing the strategy quantity', () => {
    expect(checkDaytradingBuyMinimumNotional(0.5, 1.99)).toMatchObject({
      approved: false,
      estimatedNotionalUsd: 0.995,
      minimumNotionalUsd: 1,
    });
    expect(checkDaytradingBuyMinimumNotional(1, 1)).toMatchObject({ approved: true });
    expect(checkDaytradingBuyMinimumNotional(0.5, 1.99).reason).toContain('below the broker minimum');
  });

  test('uses only read-side position data for missing filled-sell estimates', () => {
    expect(daytradingExitEstimatedValue(
      { qty: 2, filled_avg_price: null },
      { qty: 2, current_price: 4.25, market_value: 8.5 },
    )).toBe(8.5);
    expect(daytradingExitEstimatedValue(
      { qty: 2, filled_avg_price: null },
      { qty: 2, current_price: 0, market_value: 8.5 },
    )).toBe(8.5);
  });

  test('keeps MIN_ORDER_SIZE skip structured and immediately before BUY submit only', () => {
    expect(workerSource).toContain('const minimumNotionalCheck = checkDaytradingBuyMinimumNotional(qty, signal.indicators.price);');
    expect(workerSource).toContain("skips.add('MIN_ORDER_SIZE', 'decision'");
    expect(workerSource).toContain('serializeDecisionSkip(minimumNotionalCheck.reason, skipContext)');
    const minimumCheckIndex = workerSource.indexOf('const minimumNotionalCheck = checkDaytradingBuyMinimumNotional(qty, signal.indicators.price);');
    const submitIndex = workerSource.indexOf('const order = await alpaca.submitOrder({', minimumCheckIndex);
    expect(minimumCheckIndex).toBeGreaterThanOrEqual(0);
    expect(submitIndex).toBeGreaterThan(minimumCheckIndex);
    expect(workerSource.slice(minimumCheckIndex, submitIndex)).toContain('continue;');
    expect(workerSource).not.toContain('signal.action === \'SELL\' && checkDaytradingBuyMinimumNotional');
  });
});

describe('daytrading risk rejection observability', () => {
  test('persists structured risk reason/context while preserving the decision reason and broker-free rejection', () => {
    const manager = new RiskManager({ ...riskConfig, maxPositions: 0 });
    const riskCheck = manager.checkTrade(buyDecision, account(), [], indicators);
    expect(riskCheck.approved).toBe(false);
    expect(riskCheck.reason).toContain('Max positions reached');

    const skips = new SkipReasonCollector();
    const skipCode = daytradingRiskSkipCode(riskCheck.reason);
    expect(skipCode).toBe('NO_ENTRY_RISK');
    skips.add(skipCode, 'decision', 'Daytrading entry skipped by risk controls', daytradingRiskSkipContext({
      symbol: indicators.symbol,
      decisionId: 91,
      action: 'BUY',
      riskCheck,
    }));
    const persisted = parseRunDetails(serializeRunDetails([], skips));
    expect(persisted).toEqual([
      expect.objectContaining({
        type: 'skip',
        code: 'NO_ENTRY_RISK',
        scope: 'decision',
        count: 1,
        context: {
          strategy: 'daytrading',
          symbol: 'AAPL',
          decision_id: 91,
          action: 'BUY',
          reason: riskCheck.reason,
        },
      }),
    ]);

    // Risk rejection occurs before any Alpaca client call; this test exercises
    // the same pure decision boundary and intentionally has no broker client.
    expect(riskCheck.adjustedQty).toBeUndefined();
  });

  test('keeps the daytrading rejection path structured without changing broker mutation order', () => {
    expect(workerSource).toContain("await db.updateDecisionStatus(decisionId, 2, riskCheck.reason);");
    expect(workerSource).toContain("const skipCode = daytradingRiskSkipCode(riskCheck.reason);");
    expect(workerSource).toContain("skips.add(skipCode, 'decision', 'Daytrading entry skipped by risk controls'");
    expect(workerSource).toContain('console.log(`Skipped ${signal.indicators.symbol}: ${riskCheck.reason}`);');
    const rejectionBlock = workerSource.match(/riskCheck = riskManager\.checkTrade\(decision, account, positions, signal\.indicators, cycleEntryNotionalUsd\);([\s\S]*?)\n        \}\n      \}/)?.[1] ?? '';
    expect(rejectionBlock).toContain('updateDecisionStatus(decisionId, 2, riskCheck.reason);');
    expect(rejectionBlock).toContain('const skipCode = daytradingRiskSkipCode(riskCheck.reason);');
    expect(rejectionBlock).toContain("skips.add(skipCode, 'decision'");
    expect(rejectionBlock).toContain('console.log(`Skipped ${signal.indicators.symbol}: ${riskCheck.reason}`);');
    expect(rejectionBlock).not.toMatch(/submitOrder|closePosition|cancelOrder|replaceOrder/);
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

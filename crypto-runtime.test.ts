import { describe, expect, test } from 'bun:test';
import { classifyCryptoOrder, classifyCryptoSubmitError, cryptoBudgetDecision, cryptoClientOrderId, cryptoFeeRateBps, cryptoMinimumOrderCheck, cryptoReservationNotional, evaluateCryptoProtectiveExit, feeTelemetryFromAggregate, hasPendingCryptoExit, projectedPositions, rankCryptoCandidates, resolveCryptoConfig, createCycleExposure, reserveEntry, shouldFinalizeCryptoPosition } from '/workspace/alpaca-trading-bot/src/crypto-runtime';
import { checkCryptoEntryRisk, cryptoRiskSkipContext, prepareCryptoRiskDecision } from '/workspace/alpaca-trading-bot/src/crypto-strategy';
import { RiskManager, type RiskConfig } from '/workspace/alpaca-trading-bot/src/risk-manager';
import type { AccountInfo } from '/workspace/alpaca-trading-bot/src/alpaca';
import type { AIDecision } from '/workspace/alpaca-trading-bot/src/ai-decision';
import type { TAIndicators } from '/workspace/alpaca-trading-bot/src/technical-analysis';

const account: AccountInfo = {
  id: 'acct-1', account_number: 'paper-1', status: 'ACTIVE', currency: 'USD',
  cash: 10_000, portfolio_value: 10_000, equity: 10_000, buying_power: 10_000,
  long_market_value: 0, short_market_value: 0, market_value: 0, last_equity: 10_000,
  change_today: 0, change_today_pct: 0, pattern_day_trader: false,
  trading_blocked: false, transfers_blocked: false, account_blocked: false,
};

const indicators: TAIndicators = {
  symbol: 'BTCUSD', price: 100, rsi: 50, emaFast: 100, emaSlow: 99, emaTrend: 'up',
  macd: 1, macdSignal: 0.5, macdHistogram: 0.5, macdTrend: 'bullish', atr: 1, atrPct: 1,
  volume: 1_000_000, volumeAvg: 1_000_000, volumeRatio: 1, support: 98, resistance: 102,
  pricePosition: 0.5, stochK: 60, stochD: 55, bbUpper: 103, bbMiddle: 100, bbLower: 97,
  bbPosition: 0.5, adx: 25, obv: 1_000, obvTrend: 'up', shortTermReturn: 0.01,
  shortTermReturnPeriods: 5, gapPct: 0, vwap: 100, vwapDeviation: 0, intradayReturn: 0.01,
};

const cryptoRiskConfig = (values: Partial<RiskConfig> = {}): RiskConfig => ({
  maxPositions: 5, maxPositionPct: 50, stopLossATRMultiplier: 1.5, takeProfitATRMultiplier: 2,
  trailingStopPct: 2, dailyLossLimitPct: 10, rollingDrawdownLimitPct: 20, minConfidence: 0.5,
  enableMargin: false, eodFlatten: false, targetVolatilityPct: 2, maxOrderRatePerMin: 10,
  minEdgeAfterCosts: 8, feeTelemetryStatus: 'available', requireFeeTelemetry: true,
  requireCalibratedEdge: true, maxCapitalUsd: 2_000, ...values,
});

const cryptoBuyDecision = (rawEdgeBps?: number): AIDecision => {
  const signal = { action: 'BUY' as const, confidence: 0.9, reasons: ['calibrated test'], indicators, ...(rawEdgeBps === undefined ? {} : { rawEdgeBps }) };
  return { ...signal, reasoning: 'calibrated test', factors: signal.reasons, adjustedFromTA: false, taSignal: signal };
};

describe('crypto runtime correctness helpers', () => {
  test('resolves camelCase before snake_case and rejects numeric prefixes', () => {
    const cfg = resolveCryptoConfig({ crypto_max_positions: '3', crypto_maxPositions: '4junk', crypto_max_capital_usd: '1000', crypto_maxCapitalUsd: '1200' }, { maxPositions: 5, maxCapitalUsd: 2000, maxTradesPerCycle: 2, maxEntriesPerCycle: 1, maxDiscretionaryExitsPerCycle: 2, maxPositionPct: 25, minEdgeAfterCosts: 8, maxOrderRatePerMin: 5, minConfidence: 0.7 });
    expect(cfg.maxPositions).toBe(3);
    expect(cfg.maxCapitalUsd).toBe(1200);
  });

  test('blocks crypto entries below the broker minimum notional', () => {
    expect(cryptoMinimumOrderCheck(9.99)).toEqual({
      allowed: false,
      reason: 'Crypto order notional $9.99 is below broker minimum $10.00',
    });
    expect(cryptoMinimumOrderCheck(10)).toEqual({ allowed: true });
    expect(cryptoMinimumOrderCheck(Number.NaN).allowed).toBe(false);
  });

  test('converts USD fees to basis points using traded notional', () => {
    expect(cryptoFeeRateBps(1, 1000)).toBe(10);
    expect(cryptoFeeRateBps(0.5, 5000)).toBe(1);
  });

  test('fails closed for missing, stale, or insufficient fee telemetry', () => {
    expect(feeTelemetryFromAggregate({ feeUsd: 1, notionalUsd: 1000, sampleCount: 0, minSamples: 3 }).status).toBe('insufficient');
    expect(feeTelemetryFromAggregate({ feeUsd: 1, notionalUsd: 1000, sampleCount: 3, minSamples: 3, maxAgeMs: 60_000, nowMs: Date.parse('2026-08-09T00:02:00.000Z') }).status).toBe('unavailable');
    expect(feeTelemetryFromAggregate({ feeUsd: 1, notionalUsd: 1000, sampleCount: 3, minSamples: 3, asOf: 'not-a-date', maxAgeMs: 60_000, nowMs: Date.parse('2026-08-09T00:02:00.000Z') }).status).toBe('unavailable');
    expect(feeTelemetryFromAggregate({ feeUsd: 1, notionalUsd: 1000, sampleCount: 3, minSamples: 3, asOf: '2026-08-09T00:00:00.000Z', maxAgeMs: 60_000, nowMs: Date.parse('2026-08-09T00:02:00.000Z') }).status).toBe('unavailable');
    expect(feeTelemetryFromAggregate({ feeUsd: 1, notionalUsd: 1000, sampleCount: 3, minSamples: 3, asOf: '2026-08-09T00:00:00.000Z', maxAgeMs: 180_000, nowMs: Date.parse('2026-08-09T00:02:00.000Z') }).status).toBe('available');
  });

  test('keeps entry and discretionary-exit budgets separate', () => {
    expect(cryptoBudgetDecision({ action: 'BUY', entryCount: 1, maxEntriesPerCycle: 1, discretionaryExitCount: 0, maxDiscretionaryExitsPerCycle: 2 })).toEqual({ allowed: false, reasonCode: 'MAX_ENTRIES_PER_CYCLE' });
    expect(cryptoBudgetDecision({ action: 'SELL', entryCount: 1, maxEntriesPerCycle: 1, discretionaryExitCount: 0, maxDiscretionaryExitsPerCycle: 2 }).allowed).toBe(true);
    expect(cryptoBudgetDecision({ action: 'SELL', entryCount: 0, maxEntriesPerCycle: 1, discretionaryExitCount: 2, maxDiscretionaryExitsPerCycle: 2 })).toEqual({ allowed: false, reasonCode: 'MAX_DISCRETIONARY_EXITS_PER_CYCLE' });
    expect(cryptoBudgetDecision({ action: 'HOLD', entryCount: 1, maxEntriesPerCycle: 1, discretionaryExitCount: 2, maxDiscretionaryExitsPerCycle: 2 }).allowed).toBe(true);
    expect(cryptoBudgetDecision({ action: 'BUY', entryCount: 0, maxEntriesPerCycle: 1, discretionaryExitCount: 0, maxDiscretionaryExitsPerCycle: 2, totalTradeCount: 2, maxTradesPerCycle: 2 })).toEqual({ allowed: false, reasonCode: 'MAX_TRADES_PER_CYCLE' });
    expect(cryptoBudgetDecision({ action: 'SELL', entryCount: 0, maxEntriesPerCycle: 1, discretionaryExitCount: 0, maxDiscretionaryExitsPerCycle: 2, totalTradeCount: 1, maxTradesPerCycle: 2 }).allowed).toBe(true);
  });

  test('loads persisted reservations into cap exposure without double counting same key', () => {
    const exposure = createCycleExposure([], [
      { reservationKey: 'crypto_1_BTCUSD', symbol: 'BTCUSD', notionalUsd: 700 },
      { reservationKey: 'crypto_2_ETHUSD', symbol: 'ETHUSD', notionalUsd: 500 },
    ]);
    expect(exposure.reservedNotionalUsd).toBe(1200);
    reserveEntry(exposure, 'SOLUSD', 300);
    expect(exposure.reservedNotionalUsd).toBe(1500);
    expect(projectedPositions(exposure)).toHaveLength(3);
  });

  test('reservations project position count and capital', () => {
    const exposure = createCycleExposure([]);
    reserveEntry(exposure, 'BTCUSD', 900);
    reserveEntry(exposure, 'ETHUSD', 900);
    expect(projectedPositions(exposure)).toHaveLength(2);
    expect(exposure.reservedNotionalUsd).toBe(1800);
  });

  test('evaluates ATR stop, ATR target, fallback stop, and trailing giveback', () => {
    const position = (values: Partial<{ current_price: number; unrealized_pl: number; unrealized_plpc: number; change_today_pct: number }> = {}) => ({
      asset_id: 'asset-1', symbol: 'BTCUSD', qty: 1, side: 'long' as const,
      market_value: 100, cost_basis: 100, current_price: 100,
      unrealized_pl: 0, unrealized_plpc: 0, unrealized_intraday_pl: 0,
      unrealized_intraday_plpc: 0, change_today: 0, change_today_pct: 0,
      avg_entry_price: 100, ...values,
    });
    expect(evaluateCryptoProtectiveExit(position({ current_price: 90, unrealized_pl: -10, unrealized_plpc: -0.1 }), { stop_loss_price: 95 }, 12, 8)?.kind).toBe('stop_loss');
    expect(evaluateCryptoProtectiveExit(position({ current_price: 110, unrealized_pl: 10, unrealized_plpc: 0.1 }), { take_profit_price: 105 }, 12, 8)?.kind).toBe('take_profit');
    expect(evaluateCryptoProtectiveExit(position({ current_price: 85, unrealized_pl: -15, unrealized_plpc: -0.15 }), {}, 12, 8)?.kind).toBe('stop_loss');
    expect(evaluateCryptoProtectiveExit(position({ current_price: 105, unrealized_pl: 5, unrealized_plpc: 0.05, change_today_pct: -8 }), {}, 12, 8)?.kind).toBe('trailing_stop');
    expect(evaluateCryptoProtectiveExit(position({ current_price: 105, unrealized_pl: 5, unrealized_plpc: 0.05, change_today_pct: -7.9 }), {}, 12, 8)).toBeNull();
  });

  test('classifies thrown submits fail-closed except conclusive client or broker rejection', () => {
    expect(classifyCryptoSubmitError(new Error('Failed to fetch'))).toBe('ambiguous');
    expect(classifyCryptoSubmitError(new Error('The operation was aborted'))).toBe('ambiguous');
    for (const status of [408, 409, 429, 500, 502, 503]) {
      expect(classifyCryptoSubmitError(new Error(`Alpaca submitOrder failed: ${status} upstream`))).toBe('ambiguous');
    }
    expect(classifyCryptoSubmitError(new Error('Alpaca submitOrder failed: 400 invalid quantity'))).toBe('definitive_rejection');
    expect(classifyCryptoSubmitError(new Error('Alpaca submitOrder failed: 422 insufficient buying power'))).toBe('definitive_rejection');
  });

  test('classifies partial, rejected, cancelled, expired, pending, and timed-out orders without inventing fills', () => {
    const base = { qty: 10, filled_qty: 0 };
    expect(classifyCryptoOrder({ ...base, status: 'partially_filled' })).toBe('partially_filled');
    expect(classifyCryptoOrder({ ...base, status: 'rejected' })).toBe('rejected');
    expect(classifyCryptoOrder({ ...base, status: 'canceled' })).toBe('canceled');
    expect(classifyCryptoOrder({ ...base, status: 'expired' })).toBe('expired');
    expect(classifyCryptoOrder({ ...base, status: 'accepted' })).toBe('pending');
    expect(classifyCryptoOrder({ ...base, status: 'accepted' }, { timedOut: true })).toBe('timed_out');
    expect(classifyCryptoOrder({ qty: 10, filled_qty: 10, status: 'filled' })).toBe('filled');
    expect(classifyCryptoOrder({ qty: 10, filled_qty: 9, status: 'filled' })).toBe('partially_filled');
  });

  test('protective exits remain pending until full broker confirmation', () => {
    expect(shouldFinalizeCryptoPosition({ qty: 10, filled_qty: 4, status: 'partially_filled' })).toBe(false);
    expect(shouldFinalizeCryptoPosition({ qty: 10, filled_qty: 0, status: 'accepted' })).toBe(false);
    expect(shouldFinalizeCryptoPosition({ qty: 10, filled_qty: 0, status: 'rejected' })).toBe(false);
    expect(shouldFinalizeCryptoPosition({ qty: 10, filled_qty: 10, status: 'filled' })).toBe(true);
  });

  test('reserves only confirmed quantity after a cancelled or expired partial fill', () => {
    expect(cryptoReservationNotional({ qty: 10, filled_qty: 0, filled_avg_price: null, status: 'rejected' }, 100)).toBe(0);
    expect(cryptoReservationNotional({ qty: 10, filled_qty: 3, filled_avg_price: 101, status: 'canceled' }, 100)).toBe(303);
    expect(cryptoReservationNotional({ qty: 10, filled_qty: 3, filled_avg_price: null, status: 'expired' }, 100)).toBe(300);
    expect(cryptoReservationNotional({ qty: 10, filled_qty: 3, filled_avg_price: 101, status: 'accepted' }, 100)).toBe(1000);
  });

  test('recognizes an existing pending crypto exit but ignores terminal or other-strategy rows', () => {
    expect(hasPendingCryptoExit('BTCUSD', [
      { ticker: 'BTCUSD', side: 'sell', strategy: 'crypto', status: 'accepted' },
    ])).toBe(true);
    expect(hasPendingCryptoExit('BTCUSD', [
      { ticker: 'BTCUSD', side: 'sell', strategy: 'crypto', status: 'filled' },
      { ticker: 'BTCUSD', side: 'sell', strategy: 'swing', status: 'accepted' },
    ])).toBe(false);
  });

  test('uses a stable client order ID so a retry cannot create a second crypto order', () => {
    expect(cryptoClientOrderId(42, 'BTCUSD')).toBe('crypto_42_BTCUSD');
    expect(cryptoClientOrderId(42, 'BTCUSD')).toBe(cryptoClientOrderId(42, 'BTCUSD'));
    expect(cryptoClientOrderId(43, 'BTCUSD')).not.toBe(cryptoClientOrderId(42, 'BTCUSD'));
  });

  test('ranking is exit-first and deterministic', () => {
    const ranked = rankCryptoCandidates([
      { symbol: 'ETHUSD', signal: { action: 'BUY', confidence: 0.9 } },
      { symbol: 'BTCUSD', signal: { action: 'SELL', confidence: 0.7 } },
      { symbol: 'AAVEUSD', signal: { action: 'BUY', confidence: 0.8 } },
    ]);
    expect(ranked.map(x => x.symbol)).toEqual(['BTCUSD', 'ETHUSD', 'AAVEUSD']);
  });

  test('strategy-level positive calibrated raw edge reaches crypto risk admission', () => {
    const manager = new RiskManager(cryptoRiskConfig());
    const decision = cryptoBuyDecision(20);
    const prepared = prepareCryptoRiskDecision(decision);
    const result = checkCryptoEntryRisk(manager, decision, account, [], indicators);

    expect(prepared.rawEdgeBps).toBe(20);
    expect(result.approved).toBe(true);
    expect(result.edgeAfterCosts).toBeCloseTo(13.4, 10);
  });

  test('strategy-level missing calibrated raw edge remains rejected', () => {
    const manager = new RiskManager(cryptoRiskConfig());
    const decision = cryptoBuyDecision();
    const result = checkCryptoEntryRisk(manager, decision, account, [], indicators);

    expect(prepareCryptoRiskDecision(decision).rawEdgeBps).toBeUndefined();
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('Calibrated raw edge unavailable');
  });

  test('structured crypto edge skip context exposes numeric comparison without inventing edge or fees', () => {
    const manager = new RiskManager(cryptoRiskConfig({ rawEdgeBps: 14 }));
    const result = checkCryptoEntryRisk(manager, cryptoBuyDecision(14), account, [], indicators);
    const context = cryptoRiskSkipContext({
      symbol: 'BTCUSD',
      decisionId: 42,
      skipCode: 'INSUFFICIENT_NET_EDGE',
      riskCheck: result,
      minEdgeAfterCostsBps: 8,
      feeTelemetryStatus: 'available',
    });

    expect(result.approved).toBe(false);
    expect(context).toMatchObject({
      edge_gate_evaluated: true,
      min_edge_after_costs_bps: 8,
      edge_source: 'calibrated_raw_edge_bps',
      edge_status: 'available',
      raw_edge_bps: 14,
      estimated_cost_bps: 6.6,
      estimated_cost_usd: 0.066,
      edgeAfterCosts: 7.4,
      fee_telemetry_status: 'available',
    });
    expect(context).not.toHaveProperty('edge_status_reason');
    expect(context).not.toHaveProperty('fee_usd');
    expect(context).not.toHaveProperty('gross');
    expect(context).not.toHaveProperty('net');
  });

  test('missing-edge skip context reports unavailable status and omits unavailable edge values', () => {
    const manager = new RiskManager(cryptoRiskConfig());
    const result = checkCryptoEntryRisk(manager, cryptoBuyDecision(), account, [], indicators);
    const context = cryptoRiskSkipContext({
      symbol: 'BTCUSD',
      decisionId: 43,
      skipCode: 'EDGE_CALIBRATION_UNAVAILABLE',
      riskCheck: result,
      minEdgeAfterCostsBps: 8,
      feeTelemetryStatus: 'available',
    });

    expect(context).toMatchObject({
      edge_gate_evaluated: true,
      min_edge_after_costs_bps: 8,
      edge_source: 'unavailable',
      edge_status: 'unavailable',
      edge_status_reason: 'Calibrated raw edge unavailable for configured minimum edge after costs (8bps)',
      estimated_cost_bps: 6.6,
      estimated_cost_usd: 0.066,
    });
    expect(context).not.toHaveProperty('raw_edge_bps');
    expect(context).not.toHaveProperty('edgeAfterCosts');
  });
});

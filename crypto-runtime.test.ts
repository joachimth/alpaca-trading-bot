import { describe, expect, test } from 'bun:test';
import { classifyCryptoOrder, cryptoBudgetDecision, cryptoClientOrderId, cryptoFeeRateBps, cryptoMinimumOrderCheck, cryptoReservationNotional, evaluateCryptoProtectiveExit, feeTelemetryFromAggregate, hasPendingCryptoExit, projectedPositions, rankCryptoCandidates, resolveCryptoConfig, createCycleExposure, reserveEntry, shouldFinalizeCryptoPosition } from '/workspace/alpaca-trading-bot/src/crypto-runtime';

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
});

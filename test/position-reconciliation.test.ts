import { describe, expect, test } from 'bun:test';
import type { Position } from '../src/alpaca';
import { closeBrokerAbsentPositions, reconcileBrokerQuantityMismatches } from '../src/position-reconciliation';
import { RiskManager } from '../src/risk-manager';

const brokerPosition = (symbol: string, qty: number): Position => ({
  asset_id: `asset-${symbol}`,
  symbol,
  qty,
  side: 'long',
  market_value: qty * 100,
  cost_basis: qty * 90,
  unrealized_pl: qty * 10,
  unrealized_plpc: 0.1,
  unrealized_intraday_pl: 0,
  unrealized_intraday_plpc: 0,
  current_price: 100,
  avg_entry_price: 90,
  change_today: 0,
  change_today_pct: 0,
});

describe('broker quantity reconciliation', () => {
  test('persists broker quantity for an existing mismatch without weakening the halt decision', async () => {
    const writes: any[] = [];
    const db = {
      upsertPosition: async (position: any) => { writes.push(position); },
    };

    const reconciled = await reconcileBrokerQuantityMismatches(
      db,
      [brokerPosition('NOW', 2), brokerPosition('AAPL', 1)],
      [
        { ticker: 'NOW', qty: 1, strategy: 'daytrading', stop_loss_price: 80, take_profit_price: 110 },
        { ticker: 'AAPL', qty: 1, strategy: 'daytrading' },
      ],
    );

    expect(reconciled).toBe(1);
    expect(writes).toEqual([expect.objectContaining({
      ticker: 'NOW',
      qty: 2,
      strategy: 'daytrading',
      stop_loss_price: 80,
      take_profit_price: 110,
    })]);

    const manager = new RiskManager({
      maxPositions: 5,
      maxPositionPct: 50,
      stopLossATRMultiplier: 1.5,
      takeProfitATRMultiplier: 2,
      trailingStopPct: 5,
      dailyLossLimitPct: 15,
      rollingDrawdownLimitPct: 10,
      minConfidence: 0.5,
      enableMargin: false,
      eodFlatten: false,
      targetVolatilityPct: 2,
      maxOrderRatePerMin: 10,
      minEdgeAfterCosts: 5,
      maxCapitalUsd: 5000,
    });
    const broker = brokerPosition('NOW', 2);
    const recovered = manager.checkDivergence([broker], [{ ticker: 'NOW', qty: writes[0].qty, side: 'long' }]);
    expect(recovered.divergent).toBe(false);
  });

  test('closes D1-only rows but preserves rows with pending broker orders', async () => {
    const closed: any[] = [];
    const db = { closePosition: async (...args: any[]) => { closed.push(args); } };

    const absent = await closeBrokerAbsentPositions(
      db,
      [brokerPosition('AAPL', 1)],
      [
        { ticker: 'UAL', qty: 1, strategy: 'swing' },
        { ticker: 'SEDG', qty: 3, strategy: 'swing' },
      ],
      new Set(['SEDG']),
    );

    expect(absent).toEqual(['UAL']);
    expect(closed).toEqual([['UAL', 0, 'broker_authoritative_sync_absent']]);
  });

  test('does not invent internal rows for broker-only positions', async () => {
    const writes: any[] = [];
    const db = { upsertPosition: async (position: any) => { writes.push(position); } };

    const reconciled = await reconcileBrokerQuantityMismatches(
      db,
      [brokerPosition('MSFT', 2)],
      [],
    );

    expect(reconciled).toBe(0);
    expect(writes).toEqual([]);
  });
});

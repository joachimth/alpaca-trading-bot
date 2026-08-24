import { describe, expect, test } from 'bun:test';
import type { Position } from '../src/alpaca';
import { projectBrokerPositions } from '../src/position-projection';

const brokerPosition = (symbol: string, values: Partial<Position> = {}): Position => ({
  asset_id: `asset-${symbol}`,
  symbol,
  qty: 14,
  side: 'long',
  market_value: 260,
  cost_basis: 250,
  unrealized_pl: 10,
  unrealized_plpc: 4,
  unrealized_intraday_pl: 1,
  unrealized_intraday_plpc: 0.4,
  current_price: 18.57,
  avg_entry_price: 17.86,
  change_today: 0.5,
  change_today_pct: 0.2,
  ...values,
});

describe('projectBrokerPositions', () => {
  test('uses broker positions as current state and excludes D1-only rows', () => {
    const result = projectBrokerPositions(
      [brokerPosition('SOFI')],
      [
        { ticker: 'AMZN', strategy: 'daytrading' },
        { ticker: 'ENPH', strategy: 'daytrading' },
        { ticker: 'SOFI', strategy: 'daytrading', stop_loss_price: 16.5 },
        { ticker: 'SHOP', strategy: 'daytrading' },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe('SOFI');
    expect(result[0].qty).toBe(14);
    expect(result[0].market_value).toBe(260);
    expect(result[0].strategy).toBe('daytrading');
    expect(result[0].metadata_source).toBe('d1');
    expect(result[0].metadata_updated_at).toBeNull();
    expect(result[0].stop_loss_price).toBe(16.5);
  });

  test('marks broker-only positions as unattributed without inventing D1 metadata', () => {
    const result = projectBrokerPositions([brokerPosition('AAPL')], []);
    expect(result).toHaveLength(1);
    expect(result[0].strategy).toBe('unattributed');
    expect(result[0].stop_loss_price).toBeNull();
    expect(result[0].take_profit_price).toBeNull();
  });
});

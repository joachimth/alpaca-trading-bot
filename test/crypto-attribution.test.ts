import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_CRYPTO_UNIVERSE,
  inferCryptoSellStrategy,
  normalizeCryptoSymbol,
} from '../src/crypto-attribution';

const sell = (orderSymbol: string, orderCreatedAt = '2026-08-04T14:30:24.000Z') => ({
  orderSymbol,
  orderSide: 'sell',
  orderCreatedAt,
  cryptoUniverse: DEFAULT_CRYPTO_UNIVERSE,
});

const cryptoBuy = (ticker: string, timestamp = '2026-08-04T13:00:00.000Z') => ({
  ticker,
  side: 'buy',
  strategy: 'crypto' as const,
  timestamp,
});

describe('crypto sell attribution', () => {
  test('normalizes only configured slash-USD crypto symbols', () => {
    expect(normalizeCryptoSymbol('AAVE/USD')).toBe('AAVEUSD');
    expect(normalizeCryptoSymbol('UNI/USD')).toBe('UNIUSD');
    expect(normalizeCryptoSymbol('LTC/USD')).toBe('LTCUSD');
    expect(normalizeCryptoSymbol('SOL/USD')).toBe('SOLUSD');
    expect(normalizeCryptoSymbol('SOL')).toBeNull();
    expect(normalizeCryptoSymbol('BRK.B')).toBeNull();
    expect(normalizeCryptoSymbol('XYZ/USD')).toBeNull();
    expect(normalizeCryptoSymbol('AAVE/EUR')).toBeNull();
  });

  test.each(['AAVE/USD', 'UNI/USD', 'LTC/USD', 'SOL/USD'])(
    'uses the configured-universe fallback for %s',
    orderSymbol => {
      expect(inferCryptoSellStrategy(sell(orderSymbol))).toBe('crypto');
    },
  );

  test('uses normalized open-position metadata first', () => {
    expect(inferCryptoSellStrategy({
      ...sell('AAVE/USD'),
      openPositions: [{ ticker: 'AAVEUSD', strategy: 'swing' }],
      earlierTrades: [cryptoBuy('AAVEUSD')],
    })).toBe('swing');
  });

  test('uses the latest earlier crypto buy when the position is already closed', () => {
    expect(inferCryptoSellStrategy({
      ...sell('AAVE/USD', '2026-08-04T14:30:24.000Z'),
      earlierTrades: [
        cryptoBuy('AAVEUSD', '2026-08-04T12:00:00.000Z'),
        cryptoBuy('AAVEUSD', '2026-08-04T14:00:00.000Z'),
      ],
    })).toBe('crypto');
  });

  test('does not use a buy that is later than the sell', () => {
    expect(inferCryptoSellStrategy({
      ...sell('AAVE/USD'),
      earlierTrades: [cryptoBuy('AAVEUSD', '2026-08-04T15:00:00.000Z')],
    })).toBe('crypto');
  });

  test('keeps an already-attributed row unchanged', () => {
    expect(inferCryptoSellStrategy({
      ...sell('BRK.B'),
      existingStrategy: 'swing',
    })).toBe('swing');
  });

  test.each([
    ['SOL', undefined],
    ['AAVEUSD', undefined],
    ['BRK.B', undefined],
    ['XYZ/USD', undefined],
    ['AAVE/EUR', undefined],
    ['AAVE/USD', 'buy'],
  ])('does not infer crypto for negative case %s', (orderSymbol, orderSide) => {
    expect(inferCryptoSellStrategy({
      ...sell(orderSymbol),
      orderSide: orderSide ?? 'sell',
    })).toBeNull();
  });

  test('does not infer from a non-crypto buy or a non-matching symbol', () => {
    expect(inferCryptoSellStrategy({
      ...sell('AAVEUSD'),
      earlierTrades: [
        { ticker: 'AAVEUSD', side: 'buy', strategy: 'daytrading', timestamp: '2026-08-04T13:00:00.000Z' },
        cryptoBuy('UNIUSD', '2026-08-04T13:01:00.000Z'),
      ],
    })).toBeNull();
  });
});

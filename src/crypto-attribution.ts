export const DEFAULT_CRYPTO_UNIVERSE = [
  'BTCUSD',
  'ETHUSD',
  'SOLUSD',
  'AVAXUSD',
  'LINKUSD',
  'MATICUSD',
  'DOTUSD',
  'UNIUSD',
  'ATOMUSD',
  'LTCUSD',
  'BCHUSD',
  'NEARUSD',
  'AAVEUSD',
  'XLMUSD',
  'ALGOUSD',
] as const;

export type Strategy = 'daytrading' | 'swing' | 'crypto';

export interface PositionAttributionMetadata {
  ticker: string;
  strategy: Strategy | null | undefined;
}

export interface CryptoBuyAttributionMetadata {
  ticker: string;
  side: string;
  strategy: Strategy | null | undefined;
  timestamp: string | null | undefined;
}

export interface CryptoSellAttributionInput {
  orderSymbol: string;
  orderSide: string;
  orderCreatedAt: string | null | undefined;
  existingStrategy?: Strategy | null;
  openPositions?: readonly PositionAttributionMetadata[];
  earlierTrades?: readonly CryptoBuyAttributionMetadata[];
  cryptoUniverse?: readonly string[];
}

/**
 * Normalize only symbols that are known members of the crypto universe.
 *
 * Alpaca uses BASE/USD while D1's crypto orders use BASEUSD. This is
 * deliberately not a general punctuation stripper: stock symbols such as
 * BRK.B and arbitrary pairs remain non-crypto symbols.
 */
export function normalizeCryptoSymbol(
  symbol: string,
  cryptoUniverse: readonly string[] = DEFAULT_CRYPTO_UNIVERSE,
): string | null {
  const value = symbol.trim().toUpperCase();
  const universe = new Set(cryptoUniverse.map(item => item.trim().toUpperCase()));

  if (universe.has(value)) return value;

  const slashUsdMatch = /^([A-Z0-9]+)\/USD$/.exec(value);
  if (!slashUsdMatch) return null;

  const compact = `${slashUsdMatch[1]}USD`;
  return universe.has(compact) ? compact : null;
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isStrategy(value: string | null | undefined): value is Strategy {
  return value === 'daytrading' || value === 'swing' || value === 'crypto';
}

/**
 * Infer an order's strategy without changing broker state.
 *
 * The order is intentionally limited to sells. Attribution precedence is:
 * 1. matching open-position metadata;
 * 2. the latest earlier crypto buy for the normalized symbol;
 * 3. the configured-universe-only BASE/USD fallback.
 */
export function inferCryptoSellStrategy(
  input: CryptoSellAttributionInput,
): Strategy | null {
  if (input.orderSide.toLowerCase() !== 'sell') return null;
  if (input.existingStrategy && isStrategy(input.existingStrategy)) {
    return input.existingStrategy;
  }

  // Only broker-form slash/USD sells are eligible for inference. Compact D1
  // symbols remain valid match keys for linked buys/positions, but must not be
  // mistaken for broker sell symbols or receive the fallback attribution.
  if (!/^\s*[A-Z0-9]+\/USD\s*$/i.test(input.orderSymbol)) return null;

  const universe = input.cryptoUniverse ?? DEFAULT_CRYPTO_UNIVERSE;
  const normalizedOrderSymbol = normalizeCryptoSymbol(input.orderSymbol, universe);
  if (!normalizedOrderSymbol) return null;

  const openPosition = (input.openPositions ?? []).find(position => (
    normalizeCryptoSymbol(position.ticker, universe) === normalizedOrderSymbol &&
    isStrategy(position.strategy)
  ));
  if (openPosition && isStrategy(openPosition.strategy)) {
    return openPosition.strategy;
  }

  const orderTimestamp = toTimestamp(input.orderCreatedAt);
  if (orderTimestamp !== null) {
    const earlierCryptoBuys = (input.earlierTrades ?? [])
      .filter(trade => (
        trade.side.toLowerCase() === 'buy' &&
        trade.strategy === 'crypto' &&
        normalizeCryptoSymbol(trade.ticker, universe) === normalizedOrderSymbol &&
        (() => {
          const tradeTimestamp = toTimestamp(trade.timestamp);
          return tradeTimestamp !== null && tradeTimestamp < orderTimestamp;
        })()
      ))
      .sort((left, right) => (
        (toTimestamp(right.timestamp) ?? Number.NEGATIVE_INFINITY) -
        (toTimestamp(left.timestamp) ?? Number.NEGATIVE_INFINITY)
      ));

    if (earlierCryptoBuys.length > 0) return 'crypto';
  }

  // Only broker's slash-form USD crypto symbols may use this fallback.
  return /^\s*[A-Z0-9]+\/USD\s*$/i.test(input.orderSymbol) ? 'crypto' : null;
}

import type { Position } from './alpaca';
import { normalizeCryptoSymbol } from './crypto-attribution';

/**
 * The subset of a D1 position that is safe to carry into a broker-backed
 * dashboard projection. D1 is metadata only here; it is not a source for
 * current quantity, prices, market value, or P&L.
 */
export interface PositionMetadata {
  ticker: string;
  strategy?: string | null;
  stop_loss_price?: number | null;
  take_profit_price?: number | null;
  opened_at?: string | null;
  updated_at?: string | null;
}

export type PositionFreshnessSemantics = {
  current_state_source: 'alpaca';
  current_state_observed_at: string;
  metadata_source: 'd1' | 'none';
  metadata_updated_at: string | null;
};

export interface BrokerPositionProjection {
  asset_id: string;
  ticker: string;
  symbol: string;
  side: Position['side'];
  qty: number;
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  unrealized_intraday_pl: number;
  unrealized_intraday_plpc: number;
  change_today: number;
  change_today_pct: number;
  strategy: string | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  opened_at: string | null;
  updated_at: string | null;
  metadata_source: 'd1' | 'none';
  metadata_updated_at: string | null;
}

/**
 * Project the broker's current positions into the shape used by the dashboard.
 * The broker list is authoritative: a D1-only symbol is never emitted.
 */
export function projectBrokerPositions(
  brokerPositions: readonly Position[],
  metadataPositions: readonly PositionMetadata[],
): BrokerPositionProjection[] {
  const metadataBySymbol = new Map(
    metadataPositions.map(position => [normalizeSymbol(position.ticker), position]),
  );

  return brokerPositions.map(position => {
    const metadata = metadataBySymbol.get(normalizeSymbol(position.symbol));
    return {
      asset_id: position.asset_id,
      ticker: position.symbol,
      symbol: position.symbol,
      side: position.side,
      qty: position.qty,
      avg_entry_price: position.avg_entry_price,
      current_price: position.current_price,
      market_value: position.market_value,
      cost_basis: position.cost_basis,
      unrealized_pl: position.unrealized_pl,
      unrealized_plpc: position.unrealized_plpc,
      unrealized_intraday_pl: position.unrealized_intraday_pl,
      unrealized_intraday_plpc: position.unrealized_intraday_plpc,
      change_today: position.change_today,
      change_today_pct: position.change_today_pct,
      strategy: metadata?.strategy ?? 'unattributed',
      stop_loss_price: metadata?.stop_loss_price ?? null,
      take_profit_price: metadata?.take_profit_price ?? null,
      opened_at: metadata?.opened_at ?? null,
      updated_at: metadata?.updated_at ?? null,
      metadata_source: metadata ? 'd1' : 'none',
      metadata_updated_at: metadata?.updated_at ?? null,
    };
  });
}

/**
 * Broker positions and D1 metadata can disagree on crypto symbol punctuation
 * (AAVE/USD vs AAVEUSD). Only known-universe crypto symbols are rewritten;
 * stock tickers (including ones with punctuation, e.g. BRK.B) pass through
 * unchanged so this never invents a match for a non-crypto symbol.
 */
function normalizeSymbol(symbol: string): string {
  const value = symbol.trim().toUpperCase();
  return normalizeCryptoSymbol(value) ?? value;
}

export type CategoryStrategy = 'daytrading' | 'swing' | 'crypto';

const CATEGORY_STRATEGIES: readonly CategoryStrategy[] = ['daytrading', 'swing', 'crypto'];

export interface CategoryPositionSummary {
  strategy: CategoryStrategy;
  positionsCount: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedIntradayPl: number;
}

function isCategoryStrategy(value: string | null): value is CategoryStrategy {
  return value === 'daytrading' || value === 'swing' || value === 'crypto';
}

/**
 * Aggregate broker-authoritative positions into per-category totals.
 *
 * Only positions the broker currently holds are counted — this is never
 * derived from account equity or from D1-only rows. Positions the broker
 * holds but that carry no strategy attribution ('unattributed', e.g. a
 * manually-opened or unrecognized position) are intentionally excluded from
 * every category rather than guessed into one.
 */
export function summarizeByCategory(
  projections: readonly BrokerPositionProjection[],
): CategoryPositionSummary[] {
  const totals = new Map<CategoryStrategy, CategoryPositionSummary>(
    CATEGORY_STRATEGIES.map(strategy => [
      strategy,
      { strategy, positionsCount: 0, marketValue: 0, unrealizedPl: 0, unrealizedIntradayPl: 0 },
    ]),
  );
  for (const p of projections) {
    if (!isCategoryStrategy(p.strategy)) continue;
    const entry = totals.get(p.strategy)!;
    entry.positionsCount += 1;
    entry.marketValue += p.market_value;
    entry.unrealizedPl += p.unrealized_pl;
    entry.unrealizedIntradayPl += p.unrealized_intraday_pl;
  }
  return CATEGORY_STRATEGIES.map(strategy => totals.get(strategy)!);
}

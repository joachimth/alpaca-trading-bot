import type { Position } from './alpaca';
import type { Database } from './database';

interface InternalPositionMetadata {
  ticker: string;
  qty: number;
  strategy?: string | null;
  stop_loss_price?: number | null;
  take_profit_price?: number | null;
}

/**
 * Close D1-only current-position rows after a complete broker snapshot.
 * The broker remains authoritative; this path changes only D1 state and never
 * submits or closes a broker position.
 */
export async function closeBrokerAbsentPositions(
  db: Pick<Database, 'closePosition'>,
  brokerPositions: readonly Position[],
  internalPositions: readonly InternalPositionMetadata[],
  excludedSymbols: ReadonlySet<string> = new Set(),
  reason = 'broker_authoritative_sync_absent',
): Promise<string[]> {
  const brokerSymbols = new Set(brokerPositions.map(position => position.symbol));
  const absentSymbols: string[] = [];

  for (const internal of internalPositions) {
    if (brokerSymbols.has(internal.ticker) || excludedSymbols.has(internal.ticker)) continue;
    await db.closePosition(internal.ticker, null, reason);
    absentSymbols.push(internal.ticker);
  }

  return absentSymbols;
}

/**
 * Reconcile only quantity mismatches from a broker snapshot into D1 metadata.
 * The broker remains authoritative, and the caller must still retain its
 * mismatch halt for the current cycle; this only prevents a stale D1 quantity
 * from causing the same halt on every later cycle.
 */
export async function reconcileBrokerQuantityMismatches(
  db: Pick<Database, 'upsertPosition'>,
  brokerPositions: readonly Position[],
  internalPositions: readonly InternalPositionMetadata[],
): Promise<number> {
  const internalByTicker = new Map(internalPositions.map(position => [position.ticker, position]));
  let reconciled = 0;

  for (const brokerPosition of brokerPositions) {
    const internal = internalByTicker.get(brokerPosition.symbol);
    if (!internal || Math.abs(internal.qty - brokerPosition.qty) <= 0.001) continue;

    await db.upsertPosition({
      ticker: brokerPosition.symbol,
      side: brokerPosition.side,
      qty: brokerPosition.qty,
      avg_entry_price: brokerPosition.avg_entry_price,
      current_price: brokerPosition.current_price,
      market_value: brokerPosition.market_value,
      unrealized_pl: brokerPosition.unrealized_pl,
      unrealized_plpc: brokerPosition.unrealized_plpc,
      stop_loss_price: internal.stop_loss_price ?? null,
      take_profit_price: internal.take_profit_price ?? null,
      strategy: internal.strategy ?? null,
    });
    reconciled += 1;
  }

  return reconciled;
}

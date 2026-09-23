/**
 * FIFO lot-matching for per-sell gross P&L (item-5 of the Sep 8 loss
 * diagnosis).
 *
 * The trade ledger records buys and sells with filled quantities and average
 * fill prices, but per-sell gross P&L was never durable: positions.closed_pl
 * has no order/lot key, so gross stayed null and the /api/trades surface
 * reported `filled_lot_exact_unavailable`. This module makes gross durable by
 * matching each filled sell against the recorded filled buy lots for the same
 * symbol in FIFO order at write/backfill time.
 *
 * Conservative boundaries (unchanged from the fee-ledger rules):
 * - Only trades recorded in the ledger participate. Closes that happened
 *   outside the trade path (never recorded as sell trades) are invisible
 *   here; FIFO over the recorded ledger is the defined basis and is labeled
 *   `fifo-lot-matched` so consumers can audit it.
 * - A sell with no recorded prior buys gets `fifo-no-recorded-lots` and no
 *   gross (never invented).
 * - A sell whose matched lots include a missing/unknown fill price gets
 *   `fifo-lot-incomplete` and no gross (never guessed).
 * - Fees are NOT part of gross; they stay conservative/unattributed
 *   separately (net = gross - fee only when both are known).
 */

export interface FifoTradeLike {
  id: number;
  side: string;
  status: string;
  filled_qty: number | null;
  avg_fill_price: number | null;
  filled_at: string | null;
  timestamp: string;
}

export interface FifoLotMatch {
  buy_trade_id: number;
  qty: number;
  buy_price: number;
}

export type FifoSellOutcome =
  | 'matched'
  | 'no-fill'
  | 'no-recorded-lots'
  | 'incomplete-price';

export interface FifoSellResult {
  outcome: FifoSellOutcome;
  /** Per-sell gross P&L in USD (proceeds minus FIFO cost, fees excluded). */
  gross: number | null;
  lots: FifoLotMatch[];
}

const FILLED = 'filled';

function chronological(a: FifoTradeLike, b: FifoTradeLike): number {
  const aKey = a.filled_at ?? a.timestamp;
  const bKey = b.filled_at ?? b.timestamp;
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  return a.id - b.id;
}

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Replay the recorded filled trades for ONE symbol in chronological order and
 * return the FIFO lot match for the sell identified by `targetSellId`.
 *
 * All filled sells (including ones already matched in earlier backfill runs)
 * consume lots during the replay so the lot state stays deterministic and
 * independent of which subset of sells a bounded maintenance pass processed.
 */
export function matchSellFifo(
  targetSellId: number,
  symbolTrades: readonly FifoTradeLike[],
): FifoSellResult {
  const target = symbolTrades.find(
    trade => trade.id === targetSellId && String(trade.side).toLowerCase() === 'sell',
  );
  if (!target) {
    return { outcome: 'no-fill', gross: null, lots: [] };
  }
  const sellQty = Number(target.filled_qty);
  const sellPrice = Number(target.avg_fill_price);
  if (!finitePositive(sellQty) || !Number.isFinite(sellPrice) || sellPrice <= 0) {
    return { outcome: 'no-fill', gross: null, lots: [] };
  }

  interface OpenLot {
    buyTradeId: number;
    qty: number;
    price: number | null;
  }
  const openLots: OpenLot[] = [];
  let gross = 0;
  let priceIncomplete = false;
  const matched: FifoLotMatch[] = [];

  for (const trade of [...symbolTrades].sort(chronological)) {
    const qty = Number(trade.filled_qty);
    if (!finitePositive(qty)) continue;
    const price = Number(trade.avg_fill_price);
    const priceKnown = Number.isFinite(price) && price > 0;

    if (String(trade.side).toLowerCase() === 'buy' && String(trade.status) === FILLED) {
      openLots.push({
        buyTradeId: trade.id,
        qty,
        price: priceKnown ? price : null,
      });
      continue;
    }

    // Sells (filled) consume lots in FIFO order.
    if (String(trade.side).toLowerCase() !== 'sell' || String(trade.status) !== FILLED) continue;

    let sellRemaining = qty;
    const isTarget = trade.id === targetSellId;
    const targetLots: FifoLotMatch[] = [];
    while (sellRemaining > 1e-9 && openLots.length > 0) {
      const lot = openLots[0];
      const take = Math.min(lot.qty, sellRemaining);
      if (lot.price === null) {
        if (isTarget) priceIncomplete = true;
      } else if (isTarget) {
        gross += take * (sellPrice - lot.price);
        targetLots.push({ buy_trade_id: lot.buyTradeId, qty: take, buy_price: lot.price });
      }
      lot.qty -= take;
      sellRemaining -= take;
      if (lot.qty <= 1e-9) openLots.shift();
    }
    if (isTarget) {
      matched.push(...targetLots);
    }
  }

  if (priceIncomplete) {
    return { outcome: 'incomplete-price', gross: null, lots: [] };
  }
  // Nothing consumed: either no recorded buys precede the sell, or the
  // recorded buys were all consumed by earlier sells (closes outside the
  // trade path). Both are conservative no-gross outcomes; the basis label
  // distinguishes them for audit.
  if (matched.length === 0) {
    return { outcome: 'no-recorded-lots', gross: null, lots: [] };
  }
  return {
    outcome: 'matched',
    gross: Math.round(gross * 1e6) / 1e6,
    lots: matched,
  };
}

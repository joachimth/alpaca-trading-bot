import { AlpacaClient, type Order } from './alpaca';
import { Database } from './database';

export interface ReconciliationResult {
  brokerOrders: number;
  imported: number;
  pendingLookups: number;
  lookupFailures: number;
}

const OVERLAP_MS = 15 * 60 * 1000;

function overlapAfter(): string {
  return new Date(Date.now() - OVERLAP_MS).toISOString();
}

const LOOKUP_CONCURRENCY = 4;

/**
 * Read-only broker reconciliation used by scheduled strategy cycles.
 * It never submits, cancels, replaces, or retries orders.
 *
 * The recent-order list is only a fast path. Locally pending orders are also
 * fetched individually so an order outside Alpaca's recent-order page cannot
 * remain stale in D1 indefinitely.
 */
export async function reconcileBrokerOrders(
  db: Database,
  alpaca: AlpacaClient,
  recentLimit = 100,
): Promise<ReconciliationResult> {
  const recentOrders = await alpaca.getRecentOrders(recentLimit, { after: overlapAfter(), direction: 'desc' });
  const ordersById = new Map<string, Order>(recentOrders.map(order => [order.id, order]));
  const pending = await db.getTradesNeedingSync(200);
  const pendingIds = pending
    .map(trade => String(trade.alpaca_order_id || ''))
    .filter(Boolean)
    .filter(orderId => !ordersById.has(orderId));

  let lookupFailures = 0;
  for (let i = 0; i < pendingIds.length; i += LOOKUP_CONCURRENCY) {
    const batch = pendingIds.slice(i, i + LOOKUP_CONCURRENCY);
    const results = await Promise.all(batch.map(async orderId => {
      try {
        return await alpaca.getOrder(orderId);
      } catch (error) {
        lookupFailures++;
        console.warn(`Order reconciliation lookup failed for ${orderId}:`, error);
        return null;
      }
    }));
    for (const order of results) {
      if (order) ordersById.set(order.id, order);
    }
  }

  const imported = await db.reconcileOrders(Array.from(ordersById.values()));
  return {
    brokerOrders: ordersById.size,
    imported,
    pendingLookups: pendingIds.length,
    lookupFailures,
  };
}

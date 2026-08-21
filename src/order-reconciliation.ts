import { AlpacaClient, type Order } from './alpaca';
import { Database } from './database';

export interface ReconciliationResult {
  brokerOrders: number;
  imported: number;
  pendingLookups: number;
  lookupFailures: number;
}

const OVERLAP_MS = 15 * 60 * 1000;

function overlapAfter(oldestReservationCreatedAt?: number): string {
  const overlapStart = Date.now() - OVERLAP_MS;
  const reservationStart = Number.isFinite(oldestReservationCreatedAt)
    ? Number(oldestReservationCreatedAt)
    : overlapStart;
  return new Date(Math.min(overlapStart, reservationStart)).toISOString();
}

const LOOKUP_CONCURRENCY = 4;
// Keep read-only reconciliation below the Worker subrequest budget. Remaining
// eligible rows stay in D1 and are picked up by the next scheduled pass.
export const MAX_ORDER_LOOKUPS_PER_INVOCATION = 8;

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
  let reservations: Awaited<ReturnType<Database['getCryptoEntryReservations']>> = [];
  try {
    reservations = await db.getCryptoEntryReservations();
  } catch (error) {
    // The crypto reservation migration is optional for legacy stock-only
    // reconciliation. A missing table is not evidence that any order is safe
    // to release, so continue with the normal recent-order and trade lookup.
    if (!(error instanceof Error && error.message.toLowerCase().includes('no such table'))) throw error;
  }
  const oldestReservationCreatedAt = reservations.reduce<number | undefined>((oldest, reservation) =>
    oldest === undefined ? reservation.createdAt : Math.min(oldest, reservation.createdAt), undefined);
  const recentOrders = await alpaca.getRecentOrders(recentLimit, { after: overlapAfter(oldestReservationCreatedAt), direction: 'desc' });
  const ordersById = new Map<string, Order>(recentOrders.map(order => [order.id, order]));
  // Include terminal rows with missing broker lifecycle fields for a
  // read-only getOrder refresh. Trading callers keep the old pending-only
  // semantics and never treat these historical rows as live orders.
  const pending = await db.getTradesNeedingSync(200, true);
  const pendingIds = pending
    .map(trade => String(trade.alpaca_order_id || ''))
    .filter(Boolean)
    .filter(orderId => !ordersById.has(orderId));
  const lookupIds = pendingIds.slice(0, MAX_ORDER_LOOKUPS_PER_INVOCATION);

  let lookupFailures = 0;
  for (let i = 0; i < lookupIds.length; i += LOOKUP_CONCURRENCY) {
    const batch = lookupIds.slice(i, i + LOOKUP_CONCURRENCY);
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
    pendingLookups: lookupIds.length,
    lookupFailures,
  };
}

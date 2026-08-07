import { AlpacaClient, type AccountActivity } from './alpaca';
import { Database } from './database';

const RECONCILIATION_OVERLAP_DAYS = 3;

function utcDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Read-only broker activity import. Alpaca posts crypto fees after the trade
 * date, so keep a bounded overlap and make the D1 writes idempotent by activity id.
 */
export async function syncBrokerLedger(db: Database, alpaca: AlpacaClient): Promise<{
  activities: number;
  fills: number;
  fees: number;
}> {
  const activities = await alpaca.getAccountActivities(
    ['FILL', 'CFEE', 'FEE'],
    utcDateDaysAgo(RECONCILIATION_OVERLAP_DAYS),
    new Date().toISOString(),
  );
  return db.upsertBrokerActivities(activities.map(normalizeBrokerActivity));
}

export function normalizeBrokerActivity(activity: AccountActivity): AccountActivity {
  return {
    ...activity,
    symbol: activity.symbol?.replace('/', '').toUpperCase(),
    order_id: activity.order_id || null,
  };
}

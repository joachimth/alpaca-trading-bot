import { AlpacaClient, type AccountActivity, ACCOUNT_ACTIVITY_PAGE_BUDGET } from './alpaca';
import { Database } from './database';

const RECONCILIATION_OVERLAP_DAYS = 3;

function utcDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export interface BrokerLedgerSyncResult {
  activities: number;
  fills: number;
  fees: number;
  pages: number;
  pageBudget: number;
  truncated: boolean;
  degraded: boolean;
}

/**
 * Read-only broker activity import. Alpaca posts crypto fees after the trade
 * date, so keep a bounded overlap and make the D1 writes idempotent by activity id.
 * A bounded result is explicitly marked degraded when another page exists; the
 * next scheduled pass will revisit the same overlap and converge without any
 * broker mutation.
 */
export async function syncBrokerLedger(db: Database, alpaca: AlpacaClient): Promise<BrokerLedgerSyncResult> {
  const after = utcDateDaysAgo(RECONCILIATION_OVERLAP_DAYS);
  const until = new Date().toISOString();
  const result = await alpaca.getAccountActivitiesBounded(
    ['FILL', 'CFEE', 'FEE'],
    after,
    until,
    ACCOUNT_ACTIVITY_PAGE_BUDGET,
  );
  const imported = await db.upsertBrokerActivities(result.activities.map(normalizeBrokerActivity));
  return { ...imported, pages: result.pages, pageBudget: result.pageBudget, truncated: result.truncated, degraded: result.degraded };
}

export function normalizeBrokerActivity(activity: AccountActivity): AccountActivity {
  return {
    ...activity,
    symbol: activity.symbol?.replace('/', '').toUpperCase(),
    order_id: activity.order_id || null,
  };
}

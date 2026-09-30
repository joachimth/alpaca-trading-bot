import { AlpacaClient, type AccountActivity, ACCOUNT_ACTIVITY_PAGE_BUDGET } from './alpaca';
import { Database } from './database';

const RECONCILIATION_OVERLAP_MINUTES = 15;
const FALLBACK_OVERLAP_DAYS = 3;
const WATERMARK_KEY = 'broker_ledger_synced_until';

function utcDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function utcDateMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
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
 *
 * D1 write-budget optimization: a `broker_ledger_synced_until` watermark is
 * persisted in bot_config after each successful sync. On subsequent runs, the
 * overlap window starts from `watermark - 15min` instead of `now - 3 days`,
 * eliminating redundant re-writes of already-known rows that counted against
 * the 100k rows-written/day free-tier limit.
 */
export async function syncBrokerLedger(db: Database, alpaca: AlpacaClient): Promise<BrokerLedgerSyncResult> {
  const watermark = await db.getConfigValue(WATERMARK_KEY);
  const after = watermark
    ? utcDateMinutesAgo(RECONCILIATION_OVERLAP_MINUTES) // use recent overlap when watermark exists
    : utcDateDaysAgo(FALLBACK_OVERLAP_DAYS); // cold-start: use full 3-day fallback
  const until = new Date().toISOString();
  const result = await alpaca.getAccountActivitiesBounded(
    ['FILL', 'CFEE', 'FEE'],
    after,
    until,
    ACCOUNT_ACTIVITY_PAGE_BUDGET,
  );
  const imported = await db.upsertBrokerActivities(result.activities.map(normalizeBrokerActivity));

  // Persist watermark so the next sync only fetches recent activity.
  if (!result.truncated) {
    await db.setConfig(WATERMARK_KEY, until);
  }

  return { ...imported, pages: result.pages, pageBudget: result.pageBudget, truncated: result.truncated, degraded: result.degraded };
}

export function normalizeBrokerActivity(activity: AccountActivity): AccountActivity {
  return {
    ...activity,
    symbol: activity.symbol?.replace('/', '').toUpperCase(),
    order_id: activity.order_id || null,
  };
}

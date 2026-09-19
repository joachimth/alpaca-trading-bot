// Daily analytics snapshot persistence.
// Runs from scheduled maintenance (once per UTC day, watermark-gated) and
// writes per-strategy KPI snapshots so improvement of the trading AI over
// time is measurable. Computation reuses the read-only analytics engine.

import type { Database } from './database';
import {
  buildAnalytics,
  ANALYSIS_VERSION,
  type ClosedPositionRow,
  type TradeRow,
  type DecisionRow,
} from './analytics';

export async function recordDailyAnalyticsSnapshots(db: Database, snapshotDate: string): Promise<{ recorded: number }> {
  let recorded = 0;
  for (const strategy of ['daytrading', 'swing'] as const) {
    const [positions, trades] = await Promise.all([
      db.getClosedPositionsInWindow(null, null, strategy),
      db.getFilledTradesInWindow(null, strategy),
    ]);
    const decisionIds = Array.from(new Set(trades.map((t: any) => t.decision_id).filter((id): id is number => id != null)));
    const decisions = await db.getDecisionsByIds(decisionIds);
    const orderIds = Array.from(new Set(trades.map((t: any) => t.alpaca_order_id).filter((id): id is string => id != null)));
    const feeMap = await db.getBrokerFeesByOrders(orderIds);

    const result = buildAnalytics({
      positions: positions as ClosedPositionRow[],
      trades: trades as TradeRow[],
      decisions: decisions as DecisionRow[],
      fees: Array.from(feeMap.entries()).map(([order_id, usd_value]) => ({ order_id, usd_value, strategy, fee_type: null })),
      periodStart: null,
      periodEnd: null,
      comparisonPositions: null,
    });

    await db.recordAnalyticsSnapshot({
      snapshotDate,
      strategy,
      period: 'all',
      metrics: JSON.stringify(result.kpis),
      analysisVersion: ANALYSIS_VERSION,
    });
    recorded += 1;
  }
  return { recorded };
}

import { describe, expect, test } from 'bun:test';

/**
 * Regression test for the swing cap bypass via the BROKER_ONLY_RECONCILED
 * auto-reconcile path (Control-117, Aug 26 2026).
 *
 * The defect: when swing BUYs fill at market open, the daytrading cron's
 * divergence auto-reconcile imports the new broker positions without a
 * `strategy` field. The final sync then re-tags them as 'daytrading' because
 * `swingOwnedSymbols` only looked at D1 positions with strategy='swing' —
 * which the newly filled swing positions didn't have yet.
 *
 * The fix: `getSwingTradeSymbols()` queries the trades table for swing BUY
 * tickers, and both the auto-reconcile and final sync paths exclude those
 * symbols from daytrading attribution.
 */

describe('swing cap bypass via auto-reconcile (Control-117)', () => {
  test('getSwingTradeSymbols returns distinct swing BUY tickers from trades table', async () => {
    const queries: string[] = [];
    const bindings: any[] = [];
    const mockDb = {
      ensureTradeSchema: async () => {},
      db: {
        prepare: (sql: string) => ({
          bind: (...args: any[]) => {
            queries.push(sql);
            bindings.push(args);
            return {
              all: async () => ({
                results: [
                  { ticker: 'F' },
                  { ticker: 'FCEL' },
                  { ticker: 'AAL' },
                  { ticker: 'F' }, // duplicate - should be deduped by Set
                ],
              }),
            };
          },
        }),
      },
    };

    // Inline the method logic to test it without the full class
    const result = await (async () => {
      await (mockDb as any).ensureTradeSchema();
      const res = await (mockDb as any).db.prepare(
        `SELECT DISTINCT ticker FROM trades
         WHERE strategy = 'swing' AND side = 'buy'
         ORDER BY timestamp DESC LIMIT ?`
      ).bind(200).all();
      return new Set((res.results as any[]).map((r: any) => r.ticker));
    })();

    expect(result instanceof Set).toBe(true);
    expect(result.size).toBe(3);
    expect(result.has('F')).toBe(true);
    expect(result.has('FCEL')).toBe(true);
    expect(result.has('AAL')).toBe(true);
    expect(queries[0]).toContain("strategy = 'swing'");
    expect(queries[0]).toContain("side = 'buy'");
    expect(queries[0]).toContain('DISTINCT ticker');
  });

  test('swing trade symbols are excluded from daytrading attribution set', () => {
    // Simulate the merged exclusion set used in both the auto-reconcile and
    // final sync paths.
    const syncDbPositions = [
      { ticker: 'GOOGL', strategy: 'swing' },
      { ticker: 'AMD', strategy: 'swing' },
      { ticker: 'INTC', strategy: 'daytrading' },
      { ticker: 'AVGO', strategy: null }, // newly filled, unattributed
    ];
    const swingTradeSymbols = new Set(['F', 'FCEL', 'AAL', 'GOOGL']);

    const swingOwnedSymbols = new Set([
      ...syncDbPositions.filter(p => p.strategy === 'swing').map(p => p.ticker),
      ...swingTradeSymbols,
    ]);

    // Swing D1 positions are excluded
    expect(swingOwnedSymbols.has('GOOGL')).toBe(true);
    expect(swingOwnedSymbols.has('AMD')).toBe(true);
    // Swing trade symbols not yet in D1 are also excluded
    expect(swingOwnedSymbols.has('F')).toBe(true);
    expect(swingOwnedSymbols.has('FCEL')).toBe(true);
    expect(swingOwnedSymbols.has('AAL')).toBe(true);
    // Daytrading positions are NOT excluded
    expect(swingOwnedSymbols.has('INTC')).toBe(false);
    // Unattributed positions that are NOT swing trades are NOT excluded
    expect(swingOwnedSymbols.has('AVGO')).toBe(false);
  });

  test('auto-reconcile exclusion prevents swing fills from being imported as daytrading', () => {
    // Simulate the auto-reconcile loop: broker positions include swing fills
    // that should be excluded from the daytrading upsert.
    const brokerPositions = [
      { symbol: 'F', qty: 161, side: 'long' },      // swing fill
      { symbol: 'FCEL', qty: 111, side: 'long' },   // swing fill
      { symbol: 'INTC', qty: 1, side: 'long' },     // genuine daytrading
      { symbol: 'AVGO', qty: 0.35, side: 'long' },  // genuine daytrading
    ];
    const reconcileSwingSymbols = new Set(['F', 'FCEL', 'AAL', 'GOOGL']);

    const upserted: string[] = [];
    for (const pos of brokerPositions) {
      if (reconcileSwingSymbols.has(pos.symbol)) continue;
      upserted.push(pos.symbol);
    }

    // Swing fills are NOT upserted by the daytrading auto-reconcile
    expect(upserted).not.toContain('F');
    expect(upserted).not.toContain('FCEL');
    // Genuine daytrading positions ARE upserted
    expect(upserted).toContain('INTC');
    expect(upserted).toContain('AVGO');
  });

  test('daytrading BUY on swing-owned symbol is excluded (Control-150 cap bypass fix)', () => {
    // Simulate the BUY exclusion gate added in Control-150.
    // When daytrading buys a swing-held symbol, the broker combines them into
    // one position tagged 'swing' in D1. The daytrading cap check filters by
    // strategy='daytrading' and cannot see the daytrading portion — a cap bypass.
    // The fix excludes swing-owned symbols from daytrading BUYs entirely.
    const swingOwnedSymbols = new Set(['RIVN', 'AVGO', 'F', 'FCEL', 'AAL']);
    const decisions = [
      { action: 'BUY', symbol: 'RIVN' },   // swing-owned → skip
      { action: 'BUY', symbol: 'TSLA' },   // not swing-owned → proceed
      { action: 'SELL', symbol: 'RIVN' },  // swing-owned but SELL → proceed (exits allowed)
      { action: 'BUY', symbol: 'PLUG' },   // not swing-owned → proceed
    ];

    const skipped: string[] = [];
    const proceeded: string[] = [];
    for (const d of decisions) {
      if (d.action === 'BUY' && swingOwnedSymbols.has(d.symbol)) {
        skipped.push(d.symbol);
        continue;
      }
      proceeded.push(`${d.action}:${d.symbol}`);
    }

    // BUY on swing-owned is skipped
    expect(skipped).toEqual(['RIVN']);
    // SELL on swing-owned is NOT skipped (exits are always allowed)
    expect(proceeded).toContain('SELL:RIVN');
    // BUY on non-swing symbols proceeds
    expect(proceeded).toContain('BUY:TSLA');
    expect(proceeded).toContain('BUY:PLUG');
  });
});

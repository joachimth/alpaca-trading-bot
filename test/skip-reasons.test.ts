import { describe, expect, test } from 'bun:test';
import {
  SkipReasonCollector,
  hasSkipDetails,
  parseRunDetails,
  runStatus,
  serializeRunDetails,
  parseDecisionSkip,
  serializeDecisionSkip,
} from '../src/skip-reasons';

describe('skip reason details', () => {
  test('serializes structured skips while preserving legacy strings', () => {
    const skips = new SkipReasonCollector();
    skips.add('MARKET_CLOSED', 'cycle', 'Market is closed', { nextOpen: '2026-08-07T13:30:00Z' });
    const encoded = serializeRunDetails(['legacy error'], skips);
    expect(parseRunDetails(encoded)).toEqual([
      'legacy error',
      expect.objectContaining({ type: 'skip', code: 'MARKET_CLOSED', scope: 'cycle', count: 1 }),
    ]);
    expect(hasSkipDetails(encoded)).toBe(true);
  });

  test('aggregates repeated reasons with a bounded stable entry', () => {
    const skips = new SkipReasonCollector();
    skips.add('HELD_POSITION', 'decision', 'Already held', { symbol: 'AAPL' });
    skips.add('HELD_POSITION', 'decision', 'Already held', { symbol: 'AAPL' });
    expect(skips.toArray()).toEqual([
      expect.objectContaining({ code: 'HELD_POSITION', count: 2, context: { symbol: 'AAPL' } }),
    ]);
  });

  test('coalesces one cycle-level mismatch event while retaining mismatch context', () => {
    const skips = new SkipReasonCollector();
    const context = { strategy: 'daytrading', mismatchCount: 2, details: ['NOW: qty mismatch', 'MSFT: qty mismatch'] };
    skips.add('POSITION_QTY_MISMATCH', 'cycle', 'New daytrading BUY entries blocked by broker/internal quantity mismatch; risk-reducing exits remain eligible', context);
    skips.add('POSITION_QTY_MISMATCH', 'cycle', 'New daytrading BUY entries blocked by broker/internal quantity mismatch; risk-reducing exits remain eligible', context);
    expect(skips.toArray()).toHaveLength(1);
    expect(skips.toArray()[0]).toMatchObject({ code: 'POSITION_QTY_MISMATCH', scope: 'cycle', count: 2, context: { strategy: 'daytrading', mismatchCount: 2 } });
  });

  test('successful broker-only reconciliation is observable without becoming an error', () => {
    const skips = new SkipReasonCollector();
    skips.add('BROKER_ONLY_RECONCILED', 'reconciliation', 'Broker-authoritative position divergence reconciled into D1', {
      details: ['MSFT: in broker but not internal'],
    });
    expect(runStatus([], skips)).toBe('ok');
    expect(runStatus([], skips, false, 1)).toBe('ok');
    expect(serializeRunDetails([], skips)).toContain('BROKER_ONLY_RECONCILED');
    expect(runStatus(['broker reconciliation failed'], skips)).toBe('error');
  });

  test('error wins over skips and skip-only runs are labeled skipped', () => {
    const skips = new SkipReasonCollector();
    skips.add('MARKET_CLOSED', 'cycle', 'Market is closed');
    expect(runStatus([], skips)).toBe('skipped');
    expect(runStatus([], skips, false, 1)).toBe('ok');
    expect(runStatus(['real error'], skips)).toBe('error');
  });

  test('legacy plain strings still parse', () => {
    expect(parseRunDetails('["old error"]')).toEqual(['old error']);
    expect(parseRunDetails('old plain error')).toEqual(['old plain error']);
  });

  test('decision skip envelopes preserve readable reason and structured context', () => {
    const encoded = serializeDecisionSkip('Calibrated raw edge unavailable', {
      configured_threshold_bps: 8,
      edge_source: 'unavailable',
      edge_status: 'unavailable',
      estimated_cost_bps: 6.6,
    });
    expect(parseDecisionSkip(encoded)).toEqual({
      type: 'skip',
      message: 'Calibrated raw edge unavailable',
      context: {
        configured_threshold_bps: 8,
        edge_source: 'unavailable',
        edge_status: 'unavailable',
        estimated_cost_bps: 6.6,
      },
    });
    expect(parseDecisionSkip('legacy reason')).toBeNull();
  });
});


describe('degraded run status', () => {
  test('preserves degraded severity above skip-only status', async () => {
    const { runStatus, SkipReasonCollector } = await import('../src/skip-reasons');
    const skips = new SkipReasonCollector();
    skips.add('BROKER_LEDGER_DEGRADED', 'reconciliation', 'ledger truncated');
    expect(runStatus([], skips, true, 0)).toBe('degraded');
  });
});

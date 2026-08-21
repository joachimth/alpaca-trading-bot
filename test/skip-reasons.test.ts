import { describe, expect, test } from 'bun:test';
import {
  SkipReasonCollector,
  hasSkipDetails,
  parseRunDetails,
  runStatus,
  serializeRunDetails,
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

  test('error wins over skips and skip-only runs are labeled skipped', () => {
    const skips = new SkipReasonCollector();
    skips.add('DECISION_HOLD', 'decision', 'HOLD');
    expect(runStatus([], skips)).toBe('skipped');
    expect(runStatus([], skips, false, 1)).toBe('ok');
    expect(runStatus(['real error'], skips)).toBe('error');
  });

  test('legacy plain strings still parse', () => {
    expect(parseRunDetails('["old error"]')).toEqual(['old error']);
    expect(parseRunDetails('old plain error')).toEqual(['old plain error']);
  });
});

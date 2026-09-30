import { describe, expect, test } from 'bun:test';
import type { Bar } from '../src/alpaca';
import { assessIntradayBars, CRYPTO_BAR_INTERVAL_SECONDS, DAYTRADING_BAR_INTERVAL_SECONDS } from '../src/market-data-quality';

function bars(latest: string, count = 50): Bar[] {
  const latestSeconds = Date.parse(latest) / 1000;
  return Array.from({ length: count }, (_, index) => ({
    t: latestSeconds - (count - index - 1) * 300,
    o: 100,
    h: 101,
    l: 99,
    c: 100.5,
    v: 1000,
  }));
}

describe('intraday bar freshness safeguards', () => {
  const now = new Date('2026-08-25T14:00:00.000Z');

  test('accepts a fresh daytrading latest bar and reports its timestamp', () => {
    const assessment = assessIntradayBars(bars('2026-08-25T13:55:00.000Z'), DAYTRADING_BAR_INTERVAL_SECONDS, now);
    expect(assessment.quality).toBe('ok');
    expect(assessment.latestBarAt).toBe('2026-08-25T13:55:00.000Z');
    expect(assessment.ageSeconds).toBe(300);
  });

  test('rejects stale crypto bars with bounded interval metadata', () => {
    const assessment = assessIntradayBars(bars('2026-08-25T12:00:00.000Z'), CRYPTO_BAR_INTERVAL_SECONDS, now);
    expect(assessment.quality).toBe('stale');
    expect(assessment.maxStaleSeconds).toBe(2700);
    expect(assessment.latestBarAt).toBe('2026-08-25T12:00:00.000Z');
  });

  test('rejects future bars fail-closed instead of promoting them to indicators', () => {
    const assessment = assessIntradayBars(bars('2026-08-25T14:02:00.000Z'), DAYTRADING_BAR_INTERVAL_SECONDS, now);
    expect(assessment.quality).toBe('future');
    expect(assessment.futureBarAt).toBe('2026-08-25T14:02:00.000Z');
    expect(assessment.bars).toHaveLength(0);
  });
});

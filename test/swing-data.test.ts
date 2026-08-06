import { describe, expect, test } from 'bun:test';
import type { Bar } from '../src/alpaca';
import {
  assessSwingBars,
  getSwingBarsWindow,
  isSwingEntryDataDegraded,
  latestCompletedUsSessionClose,
  SWING_MIN_BARS,
} from '../src/swing-data';

function bars(count: number, latest = '2026-08-05T20:00:00.000Z'): Bar[] {
  const latestSeconds = Date.parse(latest) / 1000;
  return Array.from({ length: count }, (_, index) => ({
    t: latestSeconds - (count - index - 1) * 86400,
    o: 100 + index,
    h: 101 + index,
    l: 99 + index,
    c: 100.5 + index,
    v: 200_000,
  }));
}

describe('swing data window and degraded-data safeguards', () => {
  test('uses the latest completed US session, not the current partial session', () => {
    expect(latestCompletedUsSessionClose(new Date('2026-08-05T21:59:00Z')).toISOString())
      .toBe('2026-08-05T20:00:00.000Z');
    expect(latestCompletedUsSessionClose(new Date('2026-08-05T22:01:00Z')).toISOString())
      .toBe('2026-08-05T20:00:00.000Z');
    expect(latestCompletedUsSessionClose(new Date('2026-08-08T12:00:00Z')).toISOString())
      .toBe('2026-08-07T20:00:00.000Z');
  });

  test('requests a buffered calendar history window', () => {
    const window = getSwingBarsWindow(new Date('2026-08-05T22:01:00Z'));
    expect(window.end).toBe('2026-08-05T20:00:00.000Z');
    expect(Date.parse(window.end) - Date.parse(window.start)).toBe(500 * 86400 * 1000);
  });

  test('rejects empty, invalid, and short bar responses', () => {
    const now = new Date('2026-08-05T22:01:00Z');
    expect(assessSwingBars([], now).quality).toBe('empty');
    expect(assessSwingBars([{ ...bars(1)[0], c: 0 }], now).quality).toBe('invalid');
    expect(assessSwingBars(bars(SWING_MIN_BARS - 1), now).quality).toBe('short');
  });

  test('rejects stale bars and accepts a fresh valid series', () => {
    const now = new Date('2026-08-05T22:01:00Z');
    expect(assessSwingBars(bars(SWING_MIN_BARS, '2026-07-25T20:00:00.000Z'), now).quality).toBe('stale');
    const assessment = assessSwingBars(bars(SWING_MIN_BARS), now);
    expect(assessment.quality).toBe('ok');
    expect(assessment.valid).toBe(SWING_MIN_BARS);
  });

  test('keeps the existing 20-candidate entry threshold in degraded mode', () => {
    expect(isSwingEntryDataDegraded(0)).toBe(true);
    expect(isSwingEntryDataDegraded(19)).toBe(true);
    expect(isSwingEntryDataDegraded(20)).toBe(false);
  });
});

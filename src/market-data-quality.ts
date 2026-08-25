import type { Bar } from './alpaca';

export type IntradayBarsQuality = 'ok' | 'empty' | 'invalid' | 'stale' | 'future';

export interface IntradayBarsAssessment {
  quality: IntradayBarsQuality;
  bars: Bar[];
  received: number;
  valid: number;
  latestBarAt: string | null;
  ageSeconds: number | null;
  maxStaleSeconds: number;
  futureBarAt: string | null;
}

const FUTURE_BAR_CLOCK_SKEW_SECONDS = 60;

function timestampSeconds(value: number | string): number {
  if (typeof value === 'number') return value > 1e12 ? value / 1000 : value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed / 1000 : Number.NaN;
}

function validBar(bar: Bar): boolean {
  return [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite)
    && bar.o > 0 && bar.h > 0 && bar.l > 0 && bar.c > 0
    && bar.h >= bar.l && bar.v >= 0;
}

/**
 * Validate the newest intraday bar before indicators are evaluated. A future
 * timestamp or a bounded stale window is a data-integrity failure, not a
 * signal. Invalid/future/stale responses therefore fail closed with no bars
 * promoted to TA.
 */
export function assessIntradayBars(
  bars: Bar[],
  intervalSeconds: number,
  now: Date = new Date(),
  maxStaleIntervals = 3,
): IntradayBarsAssessment {
  const nowSeconds = now.getTime() / 1000;
  const maxStaleSeconds = Math.max(intervalSeconds, intervalSeconds * Math.max(1, maxStaleIntervals));
  const normalized = bars
    .map(bar => ({ ...bar, t: timestampSeconds(bar.t) }))
    .filter(bar => Number.isFinite(bar.t) && validBar(bar))
    .sort((a, b) => a.t - b.t)
    .filter((bar, index, all) => index === 0 || bar.t !== all[index - 1].t);
  const future = normalized.find(bar => bar.t > nowSeconds + FUTURE_BAR_CLOCK_SKEW_SECONDS);
  const usable = future ? [] : normalized;
  const latestTimestamp = usable.length ? usable[usable.length - 1].t : null;
  const ageSeconds = latestTimestamp === null ? null : Math.max(0, nowSeconds - latestTimestamp);
  const latestBarAt = latestTimestamp === null ? null : new Date(latestTimestamp * 1000).toISOString();
  const futureBarAt = future ? new Date(future.t * 1000).toISOString() : null;
  const base = { received: bars.length, valid: normalized.length, latestBarAt, ageSeconds, maxStaleSeconds, futureBarAt };

  if (bars.length === 0) return { ...base, quality: 'empty', bars: [] };
  if (future) return { ...base, quality: 'future', bars: [] };
  if (normalized.length === 0) return { ...base, quality: 'invalid', bars: [] };
  if (ageSeconds !== null && ageSeconds > maxStaleSeconds) return { ...base, quality: 'stale', bars: normalized };
  return { ...base, quality: 'ok', bars: normalized };
}

export const DAYTRADING_BAR_INTERVAL_SECONDS = 5 * 60;
export const DAYTRADING_MAX_BAR_STALE_INTERVALS = 3;
export const CRYPTO_BAR_INTERVAL_SECONDS = 15 * 60;
export const CRYPTO_MAX_BAR_STALE_INTERVALS = 3;

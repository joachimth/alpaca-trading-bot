import type { Bar } from './alpaca';

/** Existing strategy thresholds; data quality must not weaken them. */
export const SWING_MIN_BARS = 60;
export const SWING_MIN_FILTERED_CANDIDATES = 20;

/**
 * The Alpaca historical-bars API defaults `start` to the beginning of the
 * current day. That is not sufficient for a daily swing lookback, so request
 * an explicit calendar window with room for weekends and market holidays.
 */
export const SWING_BAR_LIMIT = 400;
export const SWING_HISTORY_CALENDAR_DAYS = 500;
export const SWING_MAX_STALE_CALENDAR_DAYS = 5;

export interface SwingBarsWindow {
  start: string;
  end: string;
  endDate: Date;
}

export type SwingBarsQuality = 'ok' | 'empty' | 'invalid' | 'stale' | 'short';

export interface SwingBarsAssessment {
  quality: SwingBarsQuality;
  bars: Bar[];
  received: number;
  valid: number;
  latestBarAt: string | null;
  staleDays: number | null;
}

function datePartsInNewYork(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: string): number => Number(parts.find(p => p.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function newYorkLocalDateToUtc(year: number, month: number, day: number, hour: number): Date {
  // Determine the NY offset on the requested local date, then convert the
  // requested 16:00 NY close to UTC. This handles EST/EDT without a library.
  const probeUtc = new Date(Date.UTC(year, month - 1, day, hour));
  const rendered = datePartsInNewYork(probeUtc);
  const renderedAsUtc = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute);
  const offsetMs = probeUtc.getTime() - renderedAsUtc;
  return new Date(Date.UTC(year, month - 1, day, hour) + offsetMs);
}

function addCalendarDays(year: number, month: number, day: number, delta: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Latest completed 16:00 America/New_York session boundary. */
export function latestCompletedUsSessionClose(now: Date = new Date()): Date {
  const local = datePartsInNewYork(now);
  const weekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  const beforeClose = local.hour < 16;
  let delta = beforeClose ? -1 : 0;

  // A weekend cannot have a completed regular US equity session today.
  if (weekday === 0) delta = -2; // Sunday -> Friday
  if (weekday === 6) delta = -1; // Saturday -> Friday

  let sessionDate = addCalendarDays(local.year, local.month, local.day, delta);
  let sessionWeekday = new Date(Date.UTC(sessionDate.year, sessionDate.month - 1, sessionDate.day)).getUTCDay();
  while (sessionWeekday === 0 || sessionWeekday === 6) {
    sessionDate = addCalendarDays(sessionDate.year, sessionDate.month, sessionDate.day, -1);
    sessionWeekday = new Date(Date.UTC(sessionDate.year, sessionDate.month - 1, sessionDate.day)).getUTCDay();
  }
  return newYorkLocalDateToUtc(sessionDate.year, sessionDate.month, sessionDate.day, 16);
}

export function getSwingBarsWindow(now: Date = new Date()): SwingBarsWindow {
  const endDate = latestCompletedUsSessionClose(now);
  const startDate = new Date(endDate.getTime() - SWING_HISTORY_CALENDAR_DAYS * 24 * 60 * 60 * 1000);
  return { start: startDate.toISOString(), end: endDate.toISOString(), endDate };
}

function toTimestampSeconds(value: number | string): number {
  if (typeof value === 'number') return value > 1e12 ? value / 1000 : value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed / 1000 : Number.NaN;
}

function isValidBar(bar: Bar): boolean {
  return [bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite)
    && bar.o > 0 && bar.h > 0 && bar.l > 0 && bar.c > 0
    && bar.h >= bar.l && bar.v >= 0;
}

/**
 * Normalize, de-duplicate, and reject unusable/future bars before indicators
 * are computed. A stale or short result is never promoted to a candidate.
 */
export function assessSwingBars(
  bars: Bar[],
  now: Date = new Date(),
  maxStaleCalendarDays: number = SWING_MAX_STALE_CALENDAR_DAYS,
): SwingBarsAssessment {
  const completedClose = latestCompletedUsSessionClose(now).getTime() / 1000;
  const normalized = bars
    .map(bar => ({ ...bar, t: toTimestampSeconds(bar.t) }))
    .filter(bar => Number.isFinite(bar.t) && bar.t <= completedClose && isValidBar(bar))
    .sort((a, b) => a.t - b.t)
    .filter((bar, index, all) => index === 0 || bar.t !== all[index - 1].t);

  const latestTimestamp = normalized.length > 0 ? normalized[normalized.length - 1].t : null;
  const staleDays = latestTimestamp === null ? null : Math.max(0, (completedClose - latestTimestamp) / 86400);
  const latestBarAt = latestTimestamp === null ? null : new Date(latestTimestamp * 1000).toISOString();
  const base = { received: bars.length, valid: normalized.length, latestBarAt, staleDays };

  if (bars.length === 0) return { ...base, quality: 'empty', bars: normalized };
  if (normalized.length === 0) return { ...base, quality: 'invalid', bars: normalized };
  if (staleDays !== null && staleDays > maxStaleCalendarDays) return { ...base, quality: 'stale', bars: normalized };
  if (normalized.length < SWING_MIN_BARS) return { ...base, quality: 'short', bars: normalized };
  return { ...base, quality: 'ok', bars: normalized };
}

export function isSwingEntryDataDegraded(filteredCandidates: number): boolean {
  return filteredCandidates < SWING_MIN_FILTERED_CANDIDATES;
}

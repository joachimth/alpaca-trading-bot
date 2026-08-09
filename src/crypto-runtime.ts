import type { Position } from './alpaca';

export type CryptoProtectiveExit = {
  reason: string;
  kind: 'stop_loss' | 'take_profit' | 'trailing_stop';
};

export function evaluateCryptoProtectiveExit(
  position: Position,
  dbPosition: { stop_loss_price?: number | null; take_profit_price?: number | null } | undefined,
  stopLossPct: number,
  trailingStopPct: number,
): CryptoProtectiveExit | null {
  const stop = dbPosition?.stop_loss_price;
  if (typeof stop === 'number' && Number.isFinite(stop) && position.current_price <= stop) {
    return { kind: 'stop_loss', reason: `ATR stop loss hit: price $${position.current_price.toFixed(2)} <= stop $${stop.toFixed(2)}` };
  }

  const target = dbPosition?.take_profit_price;
  if (typeof target === 'number' && Number.isFinite(target) && position.current_price >= target) {
    return { kind: 'take_profit', reason: `ATR take profit hit: price $${position.current_price.toFixed(2)} >= target $${target.toFixed(2)}` };
  }

  if ((stop === null || stop === undefined) && position.unrealized_pl < 0 && position.unrealized_plpc <= -(stopLossPct / 100)) {
    return { kind: 'stop_loss', reason: `Fallback stop loss: ${(position.unrealized_plpc * 100).toFixed(1)}% loss` };
  }

  // Alpaca's position change_today_pct is expressed in percentage points.
  if (position.unrealized_pl > 0 && position.change_today_pct <= -Math.abs(trailingStopPct)) {
    return { kind: 'trailing_stop', reason: `Trailing stop: giving back ${position.change_today_pct.toFixed(1)}% today` };
  }

  return null;
}

export type CryptoConfig = {
  maxPositions: number;
  maxPositionPct: number;
  maxTradesPerCycle: number;
  maxEntriesPerCycle: number;
  maxDiscretionaryExitsPerCycle: number;
  minEdgeAfterCosts: number;
  maxOrderRatePerMin: number;
  maxCapitalUsd: number;
  minConfidence: number;
  [key: string]: unknown;
};

export type FeeTelemetry =
  | { status: 'available'; rateBps: number; sampleCount: number; notionalUsd: number; asOf: string }
  | { status: 'insufficient' | 'unavailable'; reason: string };

const STRICT_NUMERIC = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const STRICT_BOOLEAN = /^(true|false|1|0)$/i;

function snakeCase(key: string): string {
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function parseValue(raw: string, fallback: unknown): unknown {
  const value = raw.trim();
  if (typeof fallback === 'boolean') {
    if (!STRICT_BOOLEAN.test(value)) return undefined;
    return /^(true|1)$/i.test(value);
  }
  if (typeof fallback === 'number') {
    if (!STRICT_NUMERIC.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return value;
}

/**
 * Resolve namespaced configuration. Explicit precedence is:
 * namespaced camelCase key, then namespaced snake_case key, then legacy
 * unprefixed camelCase, then legacy unprefixed snake_case, then fallback.
 */
export function resolveCryptoConfig<T extends CryptoConfig>(raw: Record<string, string>, fallback: T): T {
  const resolved = { ...fallback } as T;
  for (const key of Object.keys(fallback)) {
    const aliases = [
      `crypto_${key}`,
      `crypto_${snakeCase(key)}`,
      key,
      snakeCase(key),
    ];
    for (const alias of aliases) {
      const rawValue = raw[alias];
      if (rawValue === undefined) continue;
      const parsed = parseValue(rawValue, fallback[key]);
      if (parsed !== undefined) {
        (resolved as Record<string, unknown>)[key] = parsed;
        break;
      }
      // A malformed namespaced value does not override a valid alias of the
      // other supported spelling; malformed legacy values still fail closed.
      if (alias.startsWith('crypto_')) continue;
      break;
    }
  }
  return resolved;
}

export type CycleExposure = {
  brokerPositions: Position[];
  reservedNotionalUsd: number;
  reservedSymbols: Set<string>;
  reservedBySymbol: Map<string, number>;
  approvedEntryCount: number;
};

export function createCycleExposure(brokerPositions: Position[]): CycleExposure {
  return {
    brokerPositions: [...brokerPositions],
    reservedNotionalUsd: 0,
    reservedSymbols: new Set(),
    reservedBySymbol: new Map(),
    approvedEntryCount: 0,
  };
}

export function projectedPositions(exposure: CycleExposure): Position[] {
  const projected = [...exposure.brokerPositions];
  for (const symbol of exposure.reservedBySymbol.keys()) {
    if (projected.some(position => position.symbol === symbol)) continue;
    projected.push({
      asset_id: `reserved:${symbol}`,
      symbol,
      qty: 1,
      side: 'long',
      // Quantity 1 makes the reservation count as a position; notional is
      // tracked separately by RiskManager via reservedNotionalUsd.
      market_value: 0,
      cost_basis: 0,
      unrealized_pl: 0,
      unrealized_plpc: 0,
      unrealized_intraday_pl: 0,
      unrealized_intraday_plpc: 0,
      current_price: 0,
      avg_entry_price: 0,
      change_today: 0,
      change_today_pct: 0,
    });
  }
  return projected;
}

export function reserveEntry(exposure: CycleExposure, symbol: string, notionalUsd: number): void {
  const safeNotional = Number.isFinite(notionalUsd) ? Math.max(0, notionalUsd) : 0;
  exposure.reservedNotionalUsd += safeNotional;
  exposure.reservedSymbols.add(symbol);
  exposure.reservedBySymbol.set(symbol, (exposure.reservedBySymbol.get(symbol) ?? 0) + safeNotional);
  exposure.approvedEntryCount += 1;
}

export function cryptoFeeRateBps(feeUsd: number, tradedNotionalUsd: number): number | null {
  if (!Number.isFinite(feeUsd) || !Number.isFinite(tradedNotionalUsd) || tradedNotionalUsd <= 0) return null;
  return Math.abs(feeUsd) / tradedNotionalUsd * 10000;
}

export function classifyCryptoSkip(reason: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes('fee telemetry')) return 'FEE_DATA_UNAVAILABLE';
  if (normalized.includes('max positions')) return 'MAX_POSITIONS';
  if (normalized.includes('capital cap') || normalized.includes('available cash')) return 'CAPITAL_CAP';
  if (normalized.includes('confidence')) return 'CONFIDENCE_BELOW_THRESHOLD';
  if (normalized.includes('edge after costs')) return 'INSUFFICIENT_NET_EDGE';
  if (normalized.includes('rate limit')) return 'ORDER_RATE_LIMIT';
  return 'RISK_DECISION';
}

export function cryptoBudgetDecision(input: {
  action: 'BUY' | 'SELL' | 'CLOSE' | 'HOLD';
  entryCount: number;
  maxEntriesPerCycle: number;
  discretionaryExitCount: number;
  maxDiscretionaryExitsPerCycle: number;
}): { allowed: boolean; reasonCode?: string } {
  if (input.action === 'BUY' && input.entryCount >= input.maxEntriesPerCycle) {
    return { allowed: false, reasonCode: 'MAX_ENTRIES_PER_CYCLE' };
  }
  if ((input.action === 'SELL' || input.action === 'CLOSE') && input.discretionaryExitCount >= input.maxDiscretionaryExitsPerCycle) {
    return { allowed: false, reasonCode: 'MAX_DISCRETIONARY_EXITS_PER_CYCLE' };
  }
  return { allowed: true };
}

export function feeTelemetryFromAggregate(input: {
  feeUsd: number;
  notionalUsd: number;
  sampleCount: number;
  minSamples: number;
  asOf?: string | null;
  maxAgeMs?: number;
  nowMs?: number;
}): FeeTelemetry {
  if (input.sampleCount < input.minSamples) {
    return { status: 'insufficient', reason: `fee samples ${input.sampleCount} below minimum ${input.minSamples}` };
  }
  if (!Number.isFinite(input.feeUsd) || input.feeUsd <= 0 || !Number.isFinite(input.notionalUsd) || input.notionalUsd <= 0) {
    return { status: 'unavailable', reason: 'missing, non-positive, or invalid crypto fee/notional' };
  }
  const rateBps = cryptoFeeRateBps(input.feeUsd, input.notionalUsd);
  if (rateBps === null || rateBps <= 0) return { status: 'unavailable', reason: 'missing or invalid crypto fee notional' };
  if (input.asOf && input.maxAgeMs !== undefined && (input.nowMs ?? Date.now()) - Date.parse(input.asOf) > input.maxAgeMs) {
    return { status: 'unavailable', reason: 'crypto fee telemetry is stale' };
  }
  return { status: 'available', rateBps, sampleCount: input.sampleCount, notionalUsd: input.notionalUsd, asOf: input.asOf ?? new Date().toISOString() };
}

export type RankedCryptoCandidate<T> = T & { action: string; confidence: number; calibratedNetEdgeBps?: number; feeTelemetryStatus?: FeeTelemetry['status'] };

export function rankCryptoCandidates<T extends { symbol: string; signal: { action: string; confidence: number }; calibratedNetEdgeBps?: number; feeTelemetryStatus?: FeeTelemetry['status'] }>(candidates: T[]): T[] {
  const phase = (action: string) => action === 'CLOSE' || action === 'SELL' ? 0 : action === 'BUY' ? 1 : 2;
  return [...candidates].sort((a, b) =>
    phase(a.signal.action) - phase(b.signal.action) ||
    (b.calibratedNetEdgeBps ?? Number.NEGATIVE_INFINITY) - (a.calibratedNetEdgeBps ?? Number.NEGATIVE_INFINITY) ||
    (b.feeTelemetryStatus === 'available' ? 1 : 0) - (a.feeTelemetryStatus === 'available' ? 1 : 0) ||
    b.signal.confidence - a.signal.confidence ||
    a.symbol.localeCompare(b.symbol)
  );
}

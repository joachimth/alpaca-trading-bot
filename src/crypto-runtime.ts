import type { Order, Position } from './alpaca';

export type CryptoProtectiveExit = {
  reason: string;
  kind: 'stop_loss' | 'take_profit' | 'trailing_stop';
};

export type CryptoOrderOutcome =
  | 'filled'
  | 'partially_filled'
  | 'pending'
  | 'rejected'
  | 'canceled'
  | 'expired'
  | 'timed_out';

/**
 * Classify a broker snapshot without treating submission or a local timeout as
 * a fill. This is shared by entries and protective exits so position/accounting
 * state changes only after broker-confirmed full execution.
 */
export function classifyCryptoOrder(
  order: Pick<Order, 'status' | 'qty' | 'filled_qty'>,
  options: { timedOut?: boolean } = {},
): CryptoOrderOutcome {
  if (order.status === 'filled' && order.filled_qty > 0 && order.filled_qty >= order.qty * 0.999) return 'filled';
  if (order.status === 'rejected') return 'rejected';
  if (order.status === 'canceled' || order.status === 'cancelled') return 'canceled';
  if (order.status === 'expired' || order.status === 'done_for_day' || order.status === 'stopped') return 'expired';
  if (options.timedOut) return 'timed_out';
  if (order.status === 'partially_filled' || order.filled_qty > 0) return 'partially_filled';
  return 'pending';
}

export function cryptoClientOrderId(decisionId: number, symbol: string): string {
  return `crypto_${decisionId}_${symbol}`;
}

export const CRYPTO_MIN_ORDER_NOTIONAL_USD = 10;

export function cryptoMinimumOrderCheck(
  notionalUsd: number,
  minimumNotionalUsd = CRYPTO_MIN_ORDER_NOTIONAL_USD,
): { allowed: boolean; reason?: string } {
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
    return { allowed: false, reason: 'Crypto order notional is missing or invalid' };
  }
  if (!Number.isFinite(minimumNotionalUsd) || minimumNotionalUsd <= 0) {
    return { allowed: false, reason: 'Crypto minimum order notional is missing or invalid' };
  }
  if (notionalUsd < minimumNotionalUsd) {
    return {
      allowed: false,
      reason: `Crypto order notional $${notionalUsd.toFixed(2)} is below broker minimum $${minimumNotionalUsd.toFixed(2)}`,
    };
  }
  return { allowed: true };
}


export function shouldFinalizeCryptoPosition(order: Pick<Order, 'status' | 'qty' | 'filled_qty'>): boolean {
  return classifyCryptoOrder(order) === 'filled';
}

export function cryptoReservationNotional(
  order: Pick<Order, 'status' | 'qty' | 'filled_qty' | 'filled_avg_price'>,
  referencePrice: number,
): number {
  const outcome = classifyCryptoOrder(order);
  if (outcome === 'rejected' || outcome === 'canceled' || outcome === 'expired') {
    return order.filled_qty > 0 ? order.filled_qty * (order.filled_avg_price ?? referencePrice) : 0;
  }
  return order.qty * referencePrice;
}

export function hasPendingCryptoExit(
  symbol: string,
  trades: readonly { ticker?: string | null; side?: string | null; strategy?: string | null; status?: string | null }[],
): boolean {
  const terminal = new Set(['filled', 'canceled', 'cancelled', 'rejected', 'expired', 'replaced', 'done_for_day', 'stopped']);
  return trades.some(trade =>
    trade.ticker === symbol &&
    trade.side === 'sell' &&
    trade.strategy === 'crypto' &&
    !terminal.has(String(trade.status || '').toLowerCase())
  );
}

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
    const namespacedAliases = [`crypto_${key}`, `crypto_${snakeCase(key)}`];
    let namespacedValueSeen = false;
    let namespacedValueResolved = false;
    for (const alias of namespacedAliases) {
      const rawValue = raw[alias];
      if (rawValue === undefined) continue;
      namespacedValueSeen = true;
      const parsed = parseValue(rawValue, fallback[key]);
      if (parsed !== undefined) {
        (resolved as Record<string, unknown>)[key] = parsed;
        namespacedValueResolved = true;
        break;
      }
    }
    // A malformed namespaced value must not silently fall through to a
    // similarly named global setting from the seeded schema. A valid alternate
    // namespaced spelling still wins; otherwise retain the safe fallback.
    if (namespacedValueSeen) {
      if (namespacedValueResolved) continue;
      continue;
    }
    for (const alias of [key, snakeCase(key)]) {
      const rawValue = raw[alias];
      if (rawValue === undefined) continue;
      const parsed = parseValue(rawValue, fallback[key]);
      if (parsed !== undefined) (resolved as Record<string, unknown>)[key] = parsed;
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

export type PersistedCryptoReservation = {
  reservationKey: string;
  symbol: string;
  notionalUsd: number;
};

export function createCycleExposure(
  brokerPositions: Position[],
  persistedReservations: readonly PersistedCryptoReservation[] = [],
): CycleExposure {
  const exposure: CycleExposure = {
    brokerPositions: [...brokerPositions],
    reservedNotionalUsd: 0,
    reservedSymbols: new Set(),
    reservedBySymbol: new Map(),
    approvedEntryCount: 0,
  };
  for (const reservation of persistedReservations) {
    const notionalUsd = Number(reservation.notionalUsd);
    if (!reservation.reservationKey || !reservation.symbol || !Number.isFinite(notionalUsd) || notionalUsd < 0) continue;
    exposure.reservedNotionalUsd += notionalUsd;
    exposure.reservedSymbols.add(reservation.symbol);
    exposure.reservedBySymbol.set(reservation.symbol, (exposure.reservedBySymbol.get(reservation.symbol) ?? 0) + notionalUsd);
  }
  return exposure;
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
  totalTradeCount?: number;
  maxTradesPerCycle?: number;
}): { allowed: boolean; reasonCode?: string } {
  if (input.action !== 'HOLD' && input.maxTradesPerCycle !== undefined && input.totalTradeCount !== undefined && input.totalTradeCount >= input.maxTradesPerCycle) {
    return { allowed: false, reasonCode: 'MAX_TRADES_PER_CYCLE' };
  }
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

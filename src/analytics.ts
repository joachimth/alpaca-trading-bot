// Trading Analytics & Review engine
//
// Computes decision-quality-aware analytics from stored data only.
// Rules encoded here are contract-level guarantees:
// 1. Decision Quality uses ONLY information available at entry time
//    (decisions.reason/ai_reasoning/ta_data/confidence at decision time).
// 2. The original AI thesis (decisions.reason / ai_reasoning) is never
//    rewritten or overwritten; post-trade review text is generated
//    separately and always stored/returned as a distinct field.
// 3. No fabricated numbers: anything not objectively derivable from the
//    stored record is reported as null and surfaced as "Insufficient data"
//    by the dashboard.
// 4. Deterministic: same input rows always produce the same analysis.
//    analysisVersion identifies the scoring rules used.

export const ANALYSIS_VERSION = '1.0.0';

// ============================================================
// Input row shapes (subset of columns actually used)
// ============================================================

export interface ClosedPositionRow {
  id: number;
  ticker: string;
  side: 'long' | 'short';
  strategy: string;
  qty: number;
  avg_entry_price: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  opened_at: string;
  closed_at: string | null;
  closed_pl: number | null;
  close_reason: string | null;
}

export interface TradeRow {
  id: number;
  timestamp: string;
  ticker: string;
  side: 'buy' | 'sell';
  alpaca_order_id: string | null;
  qty: number;
  avg_fill_price: number | null;
  fill_price: number | null;
  status: string;
  strategy: string | null;
  decision_id: number | null;
  intent_stop_loss_price: number | null;
  intent_take_profit_price: number | null;
  filled_at: string | null;
}

export interface DecisionRow {
  id: number;
  timestamp: string;
  ticker: string;
  action: string;
  confidence: number;
  signal_source: string;
  reason: string | null;
  ai_reasoning: string | null;
  ta_data: string | null;
  price_at_decision: number | null;
}

export interface FeeRow {
  strategy: string | null;
  order_id: string | null;
  usd_value: number | null;
  fee_type: string | null;
}

// ============================================================
// TA snapshot fields used for entry-context classification
// ============================================================

interface TAIndicatorsLike {
  emaTrend?: string;
  macdTrend?: string;
  adx?: number;
  atrPct?: number;
  volumeRatio?: number;
  rsi?: number;
  pricePosition?: number;
  vwapDeviation?: number;
  obvTrend?: string;
}

// ============================================================
// Per-trade analysis
// ============================================================

export type DecisionQualityLabel = 'Strong' | 'Good' | 'Questionable' | 'Weak';

export interface TradeAnalysis {
  position_id: number;
  ticker: string;
  strategy: string;
  side: 'long' | 'short';
  opened_at: string;
  closed_at: string | null;
  close_reason: string | null;

  // Outcome
  pl: number | null;
  plPct: number | null;
  realizedR: number | null;
  initialRisk: number | null;
  durationMinutes: number | null;
  fees: number | null;
  /** Planned risk-reward ratio from stored intent stop/target at entry (null when unknown). */
  avgRRHint?: number | null;
  mfe: null;              // not recorded by the broker integration; never fabricated
  mae: null;

  // Entry context (available at entry time)
  marketRegime: string;
  volatilityBucket: 'low' | 'medium' | 'high' | null;
  volumeRegime: 'low' | 'normal' | 'high' | null;
  confidence: number | null;

  // Quality dimensions
  decisionQualityScore: number | null;
  decisionQualityLabel: DecisionQualityLabel | null;
  executionQualityScore: number | null;
  tradeManagementScore: number | null;
  exitQualityScore: number | null;
  slippagePct: number | null;

  strategyCompliant: boolean | null;

  // Review
  originalThesis: string | null;
  postTradeReview: string | null;
  whatWorked: string | null;
  whatCouldImprove: string | null;
  learningPoint: string | null;
  lossClassification: 'acceptable' | 'avoidable' | null;

  analysisVersion: string;
  analysisTimestamp: string;
  dataGaps: string[];
}

// ============================================================
// Aggregates
// ============================================================

export interface Kpis {
  trades: number;
  netPL: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  expectancyR: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  avgRR: number | null;
  maxDrawdown: number | null;
  avgDurationMinutes: number | null;
  fees: number | null;
  longPL: number | null;
  shortPL: number | null;
  longTrades: number;
  shortTrades: number;
  avgDecisionQuality: number | null;
  avgRealizedR: number | null;
}

export interface CalibrationBucket {
  band: string;
  trades: number;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  netPL: number;
  avgDecisionQuality: number | null;
}

export interface PatternFinding {
  factorCombo: string;
  trades: number;
  netPL: number;
  winRate: number | null;
  expectancy: number | null;
  evidence: 'Preliminary' | 'Moderate' | 'Strong';
  outOfSampleHolds: boolean | null;
}

export interface ResearchItem {
  title: string;
  observation: string;
  evidence: string;
  sampleSize: number;
  hypothesis: string;
  proposedTest: string;
  successCriteria: string;
  status: 'New';
}

export interface StrategySummary {
  strategy: string;
  kpis: Kpis;
  bestSetups: PatternFinding[];
  weakestSetups: PatternFinding[];
}

export interface StrategyComparison {
  dayTrading: StrategySummary;
  swingTrading: StrategySummary;
  differences: { dimension: string; daytrading: string; swing: string; note: string }[];
}

export interface AnalyticsResult {
  analysisVersion: string;
  analysisTimestamp: string;
  periodStart: string | null;
  periodEnd: string | null;
  kpis: Kpis;
  equityCurve: { timestamp: string; cumulativePL: number }[];
  drawdownCurve: { timestamp: string; drawdownPct: number }[];
  perTrade: TradeAnalysis[];
  calibration: CalibrationBucket[];
  calibrationVerdict: string;
  patterns: { works: PatternFinding[]; needsAttention: PatternFinding[] };
  winners: TradeAnalysis[];
  losers: TradeAnalysis[];
  acceptableLosses: number;
  avoidableLosses: number;
  comparison: StrategyComparison | null;
  researchBacklog: ResearchItem[];
  robustness: {
    sampleSize: number;
    evidence: 'Preliminary' | 'Moderate' | 'Strong';
    inSampleNote: string;
    chronologicalSplit: { firstPeriod: Kpis; secondPeriod: Kpis } | null;
  };
  dataGaps: string[];
}

// ============================================================
// Helpers
// ============================================================

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function round(value: number | null, decimals = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function parseTA(taData: string | null): TAIndicatorsLike | null {
  if (!taData) return null;
  try {
    const parsed = JSON.parse(taData);
    if (parsed && typeof parsed === 'object' && parsed.indicators) return parsed.indicators as TAIndicatorsLike;
    return null;
  } catch {
    return null;
  }
}

function volatilityBucket(atrPct: number | undefined): 'low' | 'medium' | 'high' | null {
  if (atrPct == null || !Number.isFinite(atrPct)) return null;
  if (atrPct < 2) return 'low';
  if (atrPct <= 5) return 'medium';
  return 'high';
}

function volumeRegime(volumeRatio: number | undefined): 'low' | 'normal' | 'high' | null {
  if (volumeRatio == null || !Number.isFinite(volumeRatio)) return null;
  if (volumeRatio < 0.8) return 'low';
  if (volumeRatio <= 1.5) return 'normal';
  return 'high';
}

/**
 * Market regime from the entry-time TA snapshot only. Deterministic and
 * available at decision time; never uses future bars.
 */
function classifyRegime(ta: TAIndicatorsLike | null): string {
  if (!ta) return 'unknown';
  const adx = ta.adx ?? 0;
  const ema = ta.emaTrend ?? 'flat';
  const macd = ta.macdTrend ?? 'neutral';
  if (adx >= 25 && ema === 'up' && macd === 'bullish') return 'strong_uptrend';
  if (adx >= 25 && ema === 'down' && macd === 'bearish') return 'strong_downtrend';
  if (ema === 'up' || macd === 'bullish') return 'weak_uptrend';
  if (ema === 'down' || macd === 'bearish') return 'weak_downtrend';
  return 'range';
}

function durationMinutes(openedAt: string, closedAt: string | null): number | null {
  if (!closedAt) return null;
  const start = Date.parse(openedAt.replace(' ', 'T') + 'Z');
  const end = Date.parse(closedAt.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 60000);
}

// ============================================================
// Decision Quality — entry-time information ONLY
// ============================================================

/**
 * Deterministic rule-based score (0-100) built exclusively from data
 * available when the entry decision was made: TA snapshot, confidence,
 * planned R:R from the intent stop/target, and trade/decision agreement.
 * The realized outcome never enters this score (no hindsight bias).
 */
export function scoreDecisionQuality(input: {
  ta: TAIndicatorsLike | null;
  confidence: number | null;
  action: string | null;
  side: 'long' | 'short' | null;
  plannedRR: number | null;
  orderFilled: boolean | null;
}): number | null {
  if (input.confidence == null && !input.ta) return null;
  let score = 50;
  const parts: string[] = [];

  if (input.confidence != null) {
    score += (input.confidence - 0.5) * 60; // ±30 at 1.0/0.0
  }

  const ta = input.ta;
  if (ta) {
    const trendUp = ta.emaTrend === 'up' && ta.macdTrend === 'bullish';
    const trendDown = ta.emaTrend === 'down' && ta.macdTrend === 'bearish';
    if (input.side === 'long') {
      if (trendUp) { score += 10; parts.push('trend-alignment'); }
      if (trendDown) { score -= 12; parts.push('counter-trend'); }
      if ((ta.pricePosition ?? 0.5) > 0.9) { score -= 6; parts.push('entry-at-resistance'); }
      if ((ta.vwapDeviation ?? 0) > 3) { score -= 5; parts.push('extended-above-vwap'); }
    } else if (input.side === 'short') {
      if (trendDown) { score += 10; parts.push('trend-alignment'); }
      if (trendUp) { score -= 12; parts.push('counter-trend'); }
      if ((ta.pricePosition ?? 0.5) < 0.1) { score -= 6; parts.push('entry-at-support'); }
    }
    if ((ta.adx ?? 0) >= 25) { score += 5; parts.push('adx-confirmed'); }
    if ((ta.volumeRatio ?? 1) >= 1.2) { score += 4; parts.push('volume-confirmation'); }
    if ((ta.rsi ?? 50) > 75 && input.side === 'long') { score -= 4; parts.push('overbought-entry'); }
    if ((ta.rsi ?? 50) < 25 && input.side === 'short') { score -= 4; parts.push('oversold-entry'); }
  }

  if (input.plannedRR != null) {
    if (input.plannedRR >= 2) { score += 8; parts.push('strong-planned-rr'); }
    else if (input.plannedRR < 1) { score -= 8; parts.push('weak-planned-rr'); }
  } else {
    score -= 4; // no documented risk plan on the order
  }

  if (input.orderFilled === false) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function labelDecisionQuality(score: number | null): DecisionQualityLabel | null {
  if (score == null) return null;
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 45) return 'Questionable';
  return 'Weak';
}

// ============================================================
// Per-trade analysis assembly
// ============================================================

function findEntryTrade(pos: ClosedPositionRow, trades: TradeRow[]): TradeRow | null {
  const entrySide = pos.side === 'long' ? 'buy' : 'sell';
  const candidates = trades.filter(t =>
    t.ticker === pos.ticker &&
    t.side === entrySide &&
    (t.strategy ?? '') === (pos.strategy ?? '') &&
    t.status === 'filled'
  );
  if (candidates.length === 0) return null;
  // Closest filled entry order at or before the position open time.
  const openTs = Date.parse(pos.opened_at.replace(' ', 'T') + 'Z');
  const before = candidates
    .filter(t => Date.parse((t.filled_at ?? t.timestamp).replace(' ', 'T') + 'Z') <= openTs + 3600_000)
    .sort((a, b) => Date.parse((b.filled_at ?? b.timestamp).replace(' ', 'T') + 'Z') -
                    Date.parse((a.filled_at ?? a.timestamp).replace(' ', 'T') + 'Z'));
  return before[0] ?? candidates.sort((a, b) => Date.parse(b.timestamp.replace(' ', 'T') + 'Z') - Date.parse(a.timestamp.replace(' ', 'T') + 'Z'))[0];
}

function findExitTrade(pos: ClosedPositionRow, trades: TradeRow[]): TradeRow | null {
  const exitSide = pos.side === 'long' ? 'sell' : 'buy';
  const closeTs = pos.closed_at ? Date.parse(pos.closed_at.replace(' ', 'T') + 'Z') : null;
  const candidates = trades.filter(t =>
    t.ticker === pos.ticker &&
    t.side === exitSide &&
    (t.strategy ?? '') === (pos.strategy ?? '') &&
    t.status === 'filled'
  );
  if (candidates.length === 0 || closeTs == null) return null;
  return candidates
    .map(t => ({ t, delta: Math.abs(Date.parse((t.filled_at ?? t.timestamp).replace(' ', 'T') + 'Z') - closeTs) }))
    .sort((a, b) => a.delta - b.delta)[0]?.t ?? null;
}

function analyzeTrade(
  pos: ClosedPositionRow,
  trades: TradeRow[],
  decisions: Map<number, DecisionRow>,
  feesByOrderId: Map<string, number>,
): TradeAnalysis {
  const dataGaps: string[] = [];
  const entry = findEntryTrade(pos, trades);
  const exit = findExitTrade(pos, trades);
  const decision = entry?.decision_id != null ? decisions.get(entry.decision_id) ?? null : null;
  if (decision == null) dataGaps.push('entry_decision_unlinked');
  const ta = decision ? parseTA(decision.ta_data) : null;

  // Outcome
  const pl = pos.closed_pl;
  const entryPrice = pos.avg_entry_price ?? entry?.avg_fill_price ?? null;
  const plPct = entryPrice != null && entryPrice * pos.qty !== 0 && pl != null
    ? pl / (entryPrice * pos.qty) * 100
    : null;

  // Initial risk: prefer the position's stored stop, else the entry order's intent stop.
  const stop = pos.stop_loss_price ?? entry?.intent_stop_loss_price ?? null;
  const target = pos.take_profit_price ?? entry?.intent_take_profit_price ?? null;
  const initialRiskPerShare = stop != null && entryPrice != null ? Math.abs(entryPrice - stop) : null;
  const initialRisk = initialRiskPerShare != null ? initialRiskPerShare * pos.qty : null;
  const realizedR = initialRisk != null && pl != null && initialRisk > 0 ? pl / initialRisk : null;
  const plannedRR = initialRisk != null && target != null && entryPrice != null && initialRisk > 0
    ? Math.abs(target - entryPrice) / initialRisk : null;

  // Execution: slippage proxy = fill price drift vs decision-time price.
  const decisionPrice = decision?.price_at_decision ?? null;
  const fillPrice = entry?.avg_fill_price ?? null;
  const slippagePct = decisionPrice != null && fillPrice != null && decisionPrice > 0
    ? Math.abs(fillPrice - decisionPrice) / decisionPrice * 100 : null;
  if (slippagePct == null) dataGaps.push('slippage_unavailable');

  let executionQualityScore: number | null = null;
  if (slippagePct != null) {
    const atrPct = ta?.atrPct ?? null;
    const tolerance = atrPct != null ? Math.max(0.05, atrPct * 0.25) : 0.15;
    executionQualityScore = slippagePct <= tolerance ? 85 : slippagePct <= tolerance * 2 ? 65 : 40;
  } else {
    dataGaps.push('execution_quality_unscored');
  }

  // Trade management: stop/target modifications are not currently recorded,
  // so a score is only possible when nothing contradicts plan adherence.
  let tradeManagementScore: number | null = null;
  if (stop != null && entryPrice != null && exit?.avg_fill_price != null && pl != null && initialRisk != null && initialRisk > 0) {
    // Plan adherence proxy: did the realized R stay inside the planned envelope
    // (between full stop and beyond target)? Losses worse than the planned stop
    // indicate management problems; anything else is scored neutral-good.
    const realizedRExclFees = pl / initialRisk;
    tradeManagementScore = pl < 0 && realizedRExclFees < -1.2 ? 35 : 75;
  } else {
    dataGaps.push('trade_management_insufficient_data');
  }

  // Exit quality: close_reason semantics; worse when a loss closed beyond stop
  // or a win closed far before target without a signal-based reason.
  let exitQualityScore: number | null = null;
  const reason = pos.close_reason ?? '';
  if (pl != null) {
    if (pl >= 0) {
      exitQualityScore = reason.includes('take_profit') ? 85 : reason.includes('signal') || reason.includes('eod') ? 70 : 60;
    } else {
      exitQualityScore = reason.includes('stop_loss') ? 80 : reason.includes('signal') ? 65 : 50;
    }
  }

  const decisionQualityScore = scoreDecisionQuality({
    ta,
    confidence: decision?.confidence ?? null,
    action: decision?.action ?? null,
    side: pos.side,
    plannedRR,
    orderFilled: entry ? entry.status === 'filled' : null,
  });
  const decisionQualityLabel = labelDecisionQuality(decisionQualityScore);

  const marketRegime = classifyRegime(ta);
  const compliance = decision ? (
    (decision.action === 'BUY' && pos.side === 'long') ||
    (decision.action === 'SELL' && pos.side === 'short') ||
    decision.action === 'CLOSE'
  ) : null;

  // Loss classification: acceptable when the decision was at least Good and
  // strategy-compliant; avoidable when quality was Weak/Questionable, the
  // entry violated the strategy, or slippage grossly exceeded volatility.
  let lossClassification: 'acceptable' | 'avoidable' | null = null;
  if (pl != null && pl < 0) {
    const qualityOk = decisionQualityLabel === 'Strong' || decisionQualityLabel === 'Good';
    const slipOk = slippagePct == null || ta?.atrPct == null || slippagePct <= Math.max(0.15, ta.atrPct * 0.5);
    lossClassification = qualityOk && compliance === true && slipOk ? 'acceptable' : 'avoidable';
  }

  // Review text: post-trade observations are separate from the original thesis.
  const originalThesis = decision
    ? decision.reason
      ? decision.reason
      : decision.ai_reasoning
        ? (() => { try { const r = JSON.parse(decision.ai_reasoning!); return typeof r === 'string' ? r : (r.reasoning ?? null); } catch { return decision.ai_reasoning; } })()
        : null
    : null;

  let whatWorked: string | null = null;
  let whatCouldImprove: string | null = null;
  let learningPoint: string | null = null;
  if (pl != null) {
    if (pl >= 0) {
      whatWorked = qualityOk(decisionQualityLabel)
        ? `${decisionQualityLabel} decision (${marketRegime}) with positive outcome`
        : `Positive outcome despite ${decisionQualityLabel ?? 'unscored'} decision quality`;
      if (decisionQualityLabel === 'Questionable' || decisionQualityLabel === 'Weak') {
        whatCouldImprove = 'Outcome was positive but decision quality was low; do not reinforce this pattern.';
        learningPoint = 'Profit does not validate a weak decision.';
      } else {
        whatCouldImprove = exitQualityScore != null && exitQualityScore < 70 ? 'Consider letting planned targets work instead of early exits.' : null;
        learningPoint = whatWorked!;
      }
    } else {
      whatCouldImprove = lossClassification === 'avoidable'
        ? `Avoidable loss: ${decisionQualityLabel ?? 'unscored'} decision${compliance === false ? ', strategy violation' : ''}${slippagePct != null && !slipOkRef(ta, slippagePct) ? ', high slippage' : ''}.`
        : 'Acceptable loss: strategy followed, market moved against the position.';
      whatWorked = compliance === true ? 'Entry followed the strategy signal.' : null;
      learningPoint = lossClassification === 'avoidable'
        ? 'Review entry conditions and slippage before repeating this setup.'
        : 'Strategic loss within plan; no change needed.';
    }
  }

  return {
    position_id: pos.id,
    ticker: pos.ticker,
    strategy: pos.strategy,
    side: pos.side,
    opened_at: pos.opened_at,
    closed_at: pos.closed_at,
    close_reason: pos.close_reason,
    pl: round(pl, 2),
    plPct: round(plPct, 3),
    realizedR: round(realizedR, 3),
    initialRisk: round(initialRisk, 4),
    durationMinutes: (() => { const m = durationMinutes(pos.opened_at, pos.closed_at); return m != null ? Math.round(m) : null; })(),
    fees: entry?.alpaca_order_id != null ? (feesByOrderId.get(entry.alpaca_order_id) ?? null) : null,
    mfe: null,
    mae: null,
    marketRegime,
    volatilityBucket: volatilityBucket(ta?.atrPct),
    volumeRegime: volumeRegime(ta?.volumeRatio),
    confidence: decision?.confidence ?? null,
    decisionQualityScore,
    decisionQualityLabel,
    executionQualityScore,
    tradeManagementScore,
    exitQualityScore,
    slippagePct: round(slippagePct, 3),
    strategyCompliant: compliance,
    originalThesis,
    postTradeReview: whatCouldImprove ?? whatWorked,
    whatWorked,
    whatCouldImprove,
    learningPoint,
    lossClassification,
    analysisVersion: ANALYSIS_VERSION,
    analysisTimestamp: new Date().toISOString(),
    dataGaps,
  };

  function qualityOk(label: DecisionQualityLabel | null): boolean {
    return label === 'Strong' || label === 'Good';
  }
  function slipOkRef(ta: TAIndicatorsLike | null, slip: number): boolean {
    return ta?.atrPct == null ? false : slip <= Math.max(0.15, ta.atrPct * 0.5);
  }
}

// ============================================================
// KPIs
// ============================================================

export function computeKpis(analyses: TradeAnalysis[]): Kpis {
  const closed = analyses.filter(a => a.pl != null);
  const pls = closed.map(a => a.pl!);
  const wins = pls.filter(p => p > 0);
  const losses = pls.filter(p => p <= 0);
  const grossWin = sum(wins);
  const grossLoss = Math.abs(sum(losses));
  const rs = closed.map(a => a.realizedR).filter((r): r is number => r != null);
  const rrs = closed.filter(a => a.avgRRHint != null).map(a => a.avgRRHint!);

  const drawdown = computeMaxDrawdown(pls);

  return {
    trades: closed.length,
    netPL: round(sum(pls), 2) ?? 0,
    winRate: closed.length ? round(wins.length / closed.length * 100, 1) : null,
    profitFactor: closed.length === 0 ? null : grossLoss > 0 ? round(grossWin / grossLoss, 2) : (grossWin > 0 ? null : 0),
    expectancy: closed.length ? round(mean(pls), 2) : null,
    expectancyR: rs.length ? round(mean(rs), 3) : null,
    avgWin: wins.length ? round(mean(wins), 2) : null,
    avgLoss: losses.length ? round(mean(losses), 2) : null,
    avgRR: rrs.length ? round(mean(rrs), 2) : null,
    maxDrawdown: round(drawdown, 2),
    avgDurationMinutes: (() => { const m = mean(closed.map(a => a.durationMinutes).filter((d): d is number => d != null)); return m != null ? Math.round(m) : null; })(),
    fees: (() => { const f = closed.map(a => a.fees).filter((x): x is number => x != null); return f.length ? round(sum(f), 2) : null; })(),
    longPL: round(sum(closed.filter(a => a.side === 'long').map(a => a.pl!)), 2),
    shortPL: round(sum(closed.filter(a => a.side === 'short').map(a => a.pl!)), 2),
    longTrades: closed.filter(a => a.side === 'long').length,
    shortTrades: closed.filter(a => a.side === 'short').length,
    avgDecisionQuality: (() => { const m = mean(analyses.map(a => a.decisionQualityScore).filter((x): x is number => x != null)); return m != null ? round(m, 1) : null; })(),
    avgRealizedR: rs.length ? round(mean(rs), 3) : null,
  };
}

function computeMaxDrawdown(pls: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  for (const pl of pls) {
    equity += pl;
    peak = Math.max(peak, equity);
    maxDD = Math.max(maxDD, peak - equity);
  }
  return maxDD;
}

// ============================================================
// Calibration, patterns, robustness
// ============================================================

const CONFIDENCE_BANDS: { band: string; min: number; max: number }[] = [
  { band: '<60%', min: -Infinity, max: 0.60 },
  { band: '60-69%', min: 0.60, max: 0.70 },
  { band: '70-79%', min: 0.70, max: 0.80 },
  { band: '80-89%', min: 0.80, max: 0.90 },
  { band: '90%+', min: 0.90, max: Infinity },
];

export function computeCalibration(analyses: TradeAnalysis[]): CalibrationBucket[] {
  return CONFIDENCE_BANDS.map(({ band, min, max }) => {
    const rows = analyses.filter(a => a.pl != null && a.confidence != null && a.confidence >= min && a.confidence < max);
    const pls = rows.map(a => a.pl!);
    const wins = pls.filter(p => p > 0).length;
    const grossWin = sum(pls.filter(p => p > 0));
    const grossLoss = Math.abs(sum(pls.filter(p => p <= 0)));
    return {
      band,
      trades: rows.length,
      winRate: rows.length ? round(wins / rows.length * 100, 1) : null,
      expectancy: rows.length ? round(mean(pls), 2) : null,
      profitFactor: grossLoss > 0 ? round(grossWin / grossLoss, 2) : null,
      netPL: round(sum(pls), 2) ?? 0,
      avgDecisionQuality: (() => { const m = mean(rows.map(a => a.decisionQualityScore).filter((x): x is number => x != null)); return m != null ? round(m, 1) : null; })(),
    };
  });
}

export function calibrationVerdict(buckets: CalibrationBucket[]): string {
  const withData = buckets.filter(b => b.trades >= 5);
  if (withData.length < 3) return 'Insufficient data: fewer than 3 bands have at least 5 trades.';
  const low = withData.filter(b => b.band === '<60%' || b.band === '60-69%').reduce((acc, b) => acc + (b.expectancy ?? 0), 0);
  const high = withData.filter(b => b.band === '80-89%' || b.band === '90%+').reduce((acc, b) => acc + (b.expectancy ?? 0), 0);
  if (high > low) return 'Higher confidence bands show higher expectancy: calibration is broadly consistent.';
  return 'Higher confidence does NOT currently produce better performance: calibration is off and should be highlighted for review.';
}

function evidenceLevel(n: number): 'Preliminary' | 'Moderate' | 'Strong' {
  if (n >= 30) return 'Strong';
  if (n >= 10) return 'Moderate';
  return 'Preliminary';
}

/**
 * Combination pattern search: side × regime × volatility × confidence band.
 * Only combinations with >= 3 trades are reported; evidence is tied to
 * sample size, and chronological out-of-sample validation is applied.
 */
export function findPatterns(analyses: TradeAnalysis[]): { works: PatternFinding[]; needsAttention: PatternFinding[] } {
  const combos = new Map<string, TradeAnalysis[]>();
  for (const a of analyses) {
    if (a.pl == null) continue;
    const confBand = a.confidence == null ? 'conf:unknown' : a.confidence >= 0.8 ? 'conf:high' : 'conf:low';
    const parts = [
      `side:${a.side}`,
      `regime:${a.marketRegime}`,
      a.volatilityBucket ? `vol:${a.volatilityBucket}` : null,
      confBand,
    ].filter(Boolean);
    const key = parts.join(' + ');
    if (!combos.has(key)) combos.set(key, []);
    combos.get(key)!.push(a);
  }

  const findings: PatternFinding[] = [];
  for (const [key, rows] of combos) {
    if (rows.length < 3) continue;
    const pls = rows.map(r => r.pl!);
    const exp = mean(pls)!;
    // Chronological split: first 60% vs last 40% by close time.
    const chrono = rows.slice().sort((x, y) => (x.closed_at ?? '').localeCompare(y.closed_at ?? ''));
    const splitIdx = Math.max(1, Math.floor(chrono.length * 0.6));
    const first = mean(chrono.slice(0, splitIdx).map(r => r.pl!))!;
    const second = chrono.length - splitIdx > 0 ? mean(chrono.slice(splitIdx).map(r => r.pl!))! : null;
    findings.push({
      factorCombo: key,
      trades: rows.length,
      netPL: round(sum(pls), 2)!,
      winRate: round(rows.filter(r => r.pl! > 0).length / rows.length * 100, 1),
      expectancy: round(exp, 2),
      evidence: evidenceLevel(rows.length),
      outOfSampleHolds: second == null ? null : Math.sign(second) === Math.sign(first) && Math.sign(second) === Math.sign(exp),
    });
  }

  const works = findings.filter(f => f.expectancy! > 0).sort((a, b) => b.expectancy! - a.expectancy!).slice(0, 6);
  const needsAttention = findings.filter(f => f.expectancy! < 0).sort((a, b) => a.expectancy! - b.expectancy!).slice(0, 6);
  return { works, needsAttention };
}

export function buildResearchBacklog(patterns: { works: PatternFinding[]; needsAttention: PatternFinding[] }): ResearchItem[] {
  const items: ResearchItem[] = [];
  for (const p of patterns.needsAttention.slice(0, 3)) {
    items.push({
      title: `Reduce exposure to: ${p.factorCombo}`,
      observation: `Combination shows negative expectancy of ${p.expectancy} USD across ${p.trades} trades (evidence: ${p.evidence}).`,
      evidence: `net P/L ${p.netPL} USD, win rate ${p.winRate ?? 'n/a'}%`,
      sampleSize: p.trades,
      hypothesis: 'The negative expectancy is caused by a repeatable entry/context factor, not random variation.',
      proposedTest: 'Backtest excluding this combination; then validate out-of-sample on a later chronological period before any live change.',
      successCriteria: 'Exclusion improves expectancy and does not degrade the out-of-sample period.',
      status: 'New',
    });
  }
  for (const p of patterns.works.slice(0, 3)) {
    items.push({
      title: `Expand selectively: ${p.factorCombo}`,
      observation: `Combination shows positive expectancy of ${p.expectancy} USD across ${p.trades} trades (evidence: ${p.evidence}).`,
      evidence: `net P/L ${p.netPL} USD, win rate ${p.winRate ?? 'n/a'}%`,
      sampleSize: p.trades,
      hypothesis: 'The positive expectancy persists outside the discovery period.',
      proposedTest: 'Backtest with a chronological split and confirm on the out-of-sample segment.',
      successCriteria: 'Positive expectancy holds out-of-sample with comparable win rate.',
      status: 'New',
    });
  }
  return items;
}

// ============================================================
// Top-level aggregation
// ============================================================

export function buildAnalytics(input: {
  positions: ClosedPositionRow[];
  trades: TradeRow[];
  decisions: DecisionRow[];
  fees: FeeRow[];
  periodStart: string | null;
  periodEnd: string | null;
  comparisonPositions?: { daytrading: ClosedPositionRow[]; swing: ClosedPositionRow[] } | null;
}): AnalyticsResult {
  const feesByOrderId = new Map<string, number>();
  for (const f of input.fees) {
    if (!f.order_id || f.usd_value == null) continue;
    feesByOrderId.set(f.order_id, (feesByOrderId.get(f.order_id) ?? 0) + f.usd_value);
  }
  const decisions = new Map(input.decisions.map(d => [d.id, d]));

  // Trades in scope: any fill whose ticker+strategy matches a closed position.
  const scopedTickers = new Set(input.positions.map(p => `${p.ticker}|${p.strategy}`));
  const scopedTrades = input.trades.filter(t => scopedTickers.has(`${t.ticker}|${t.strategy ?? ''}`));

  const analyses = input.positions
    .map(pos => analyzeTrade(pos, scopedTrades, decisions, feesByOrderId))
    .sort((a, b) => (a.closed_at ?? '').localeCompare(b.closed_at ?? ''));

  // Attach planned R:R onto analyses for avgRR (kept separate from realizedR).
  for (const a of analyses) {
    const pos = input.positions.find(p => p.id === a.position_id)!;
    const entry = findEntryTrade(pos, scopedTrades);
    const stop = pos.stop_loss_price ?? entry?.intent_stop_loss_price ?? null;
    const target = pos.take_profit_price ?? entry?.intent_take_profit_price ?? null;
    const entryPrice = pos.avg_entry_price ?? entry?.avg_fill_price ?? null;
    if (stop != null && target != null && entryPrice != null && Math.abs(entryPrice - stop) > 0) {
      (a as any).avgRRHint = round(Math.abs(target - entryPrice) / Math.abs(entryPrice - stop), 2);
    } else {
      (a as any).avgRRHint = null;
    }
  }

  const kpis = computeKpis(analyses);

  let cumulative = 0;
  const equityCurve = analyses.filter(a => a.pl != null).map(a => {
    cumulative += a.pl!;
    return { timestamp: a.closed_at!, cumulativePL: round(cumulative, 2)! };
  });
  let peak = 0;
  const drawdownCurve = equityCurve.map(point => {
    peak = Math.max(peak, point.cumulativePL);
    const dd = peak > 0 ? (peak - point.cumulativePL) / peak * 100 : 0;
    return { timestamp: point.timestamp, drawdownPct: round(dd, 2)! };
  });

  const calibration = computeCalibration(analyses);
  const patterns = findPatterns(analyses);

  // Winners / losers: best and worst 20% (min 1) by P/L.
  const closedSorted = analyses.filter(a => a.pl != null).sort((a, b) => b.pl! - a.pl!);
  const n = closedSorted.length;
  const topCount = Math.max(1, Math.min(Math.floor(n * 0.2), n));
  const winners = closedSorted.slice(0, topCount);
  const losers = closedSorted.slice(Math.max(0, n - topCount)).reverse();

  const acceptable = analyses.filter(a => a.lossClassification === 'acceptable').length;
  const avoidable = analyses.filter(a => a.lossClassification === 'avoidable').length;

  // Chronological split for robustness: first 60% vs last 40%.
  const chrono = analyses.slice();
  const splitIdx = Math.max(1, Math.floor(chrono.length * 0.6));
  const chronologicalSplit = chrono.length >= 8 ? {
    firstPeriod: computeKpis(chrono.slice(0, splitIdx)),
    secondPeriod: computeKpis(chrono.slice(splitIdx)),
  } : null;

  let comparison: StrategyComparison | null = null;
  if (input.comparisonPositions) {
    const dtRows = input.comparisonPositions.daytrading;
    const swRows = input.comparisonPositions.swing;
    const dtAnalyses = dtRows.map(pos => analyzeTrade(pos, scopedTrades, decisions, feesByOrderId));
    const swAnalyses = swRows.map(pos => analyzeTrade(pos, scopedTrades, decisions, feesByOrderId));
    const dtKpis = computeKpis(dtAnalyses);
    const swKpis = computeKpis(swAnalyses);
    const fmt = (v: number | null) => v == null ? 'Insufficient data' : String(v);
    comparison = {
      dayTrading: { strategy: 'daytrading', kpis: dtKpis, bestSetups: [], weakestSetups: [] },
      swingTrading: { strategy: 'swing', kpis: swKpis, bestSetups: [], weakestSetups: [] },
      differences: [
        { dimension: 'Risk per trade', daytrading: 'Intraday stops, EOD-flatten', swing: 'Multi-day stops (15% / 8% trailing)', note: 'Different loss magnitude per trade by design' },
        { dimension: 'Consistency (win rate)', daytrading: fmt(dtKpis.winRate) , swing: fmt(swKpis.winRate), note: 'Compare with sample size, not in isolation' },
        { dimension: 'Expectancy (USD)', daytrading: fmt(dtKpis.expectancy), swing: fmt(swKpis.expectancy), note: 'Absolute per-trade edge' },
        { dimension: 'Expectancy (R)', daytrading: fmt(dtKpis.expectancyR), swing: fmt(swKpis.expectancyR), note: 'Risk-normalized edge' },
        { dimension: 'Max drawdown (USD)', daytrading: fmt(dtKpis.maxDrawdown), swing: fmt(swKpis.maxDrawdown), note: 'Larger accounts for larger swing stops' },
        { dimension: 'Trading costs', daytrading: fmt(dtKpis.fees), swing: fmt(swKpis.fees), note: 'High-turnover strategies carry structurally higher costs' },
        { dimension: 'Avg duration', daytrading: dtKpis.avgDurationMinutes != null ? `${dtKpis.avgDurationMinutes} min` : 'Insufficient data', swing: swKpis.avgDurationMinutes != null ? `${swKpis.avgDurationMinutes} min` : 'Insufficient data', note: 'Different capital velocity' },
        { dimension: 'Result volatility', daytrading: fmt(stdDev(dtAnalyses)), swing: fmt(stdDev(swAnalyses)), note: 'Std dev of per-trade P/L' },
      ],
    };
  }

  const dataGaps: string[] = [];
  if (analyses.some(a => a.mfe === null)) dataGaps.push('mfe_mae_not_recorded');
  if (analyses.some(a => a.fees == null)) dataGaps.push('per_trade_fees_partially_attributable');
  if (dataGaps.length === 0) dataGaps.push('none');

  return {
    analysisVersion: ANALYSIS_VERSION,
    analysisTimestamp: new Date().toISOString(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    kpis,
    equityCurve,
    drawdownCurve,
    perTrade: analyses.reverse(),
    calibration,
    calibrationVerdict: calibrationVerdict(calibration),
    patterns,
    winners,
    losers,
    acceptableLosses: acceptable,
    avoidableLosses: avoidable,
    comparison,
    researchBacklog: buildResearchBacklog(patterns),
    robustness: {
      sampleSize: analyses.length,
      evidence: evidenceLevel(analyses.length),
      inSampleNote: 'All figures are in-sample observations. Hypotheses must be validated out-of-sample before any strategy change.',
      chronologicalSplit,
    },
    dataGaps,
  };
}

function stdDev(analyses: TradeAnalysis[]): number | null {
  const pls = analyses.filter(a => a.pl != null).map(a => a.pl!);
  if (pls.length < 2) return null;
  const m = mean(pls)!;
  const variance = sum(pls.map(p => (p - m) * (p - m))) / (pls.length - 1);
  return round(Math.sqrt(variance), 2);
}

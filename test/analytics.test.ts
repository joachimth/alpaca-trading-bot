// Trading Analytics engine contract tests.
// Guarantees under test:
// 1. Decision Quality uses ONLY entry-time information (no hindsight/outcome bias).
// 2. Original thesis is never overwritten; post-trade review is separate.
// 3. Nothing is fabricated: missing data yields null, never a number.
// 4. Aggregates (win rate, profit factor, expectancy, drawdown) are arithmetically correct.
// 5. Calibration highlights when higher confidence does not perform better.
// 6. Evidence levels follow sample size; patterns get out-of-sample checks.

import { describe, expect, test } from 'bun:test';
import {
  buildAnalytics,
  scoreDecisionQuality,
  labelDecisionQuality,
  computeKpis,
  computeCalibration,
  calibrationVerdict,
  findPatterns,
  ANALYSIS_VERSION,
  type ClosedPositionRow,
  type TradeRow,
  type DecisionRow,
} from '../src/analytics';

function decision(id: number, overrides: Partial<DecisionRow> = {}): DecisionRow {
  return {
    id,
    timestamp: '2026-09-10 14:00:00',
    ticker: 'AAPL',
    action: 'BUY',
    confidence: 0.85,
    signal_source: 'ta+ai',
    reason: 'Strong uptrend with volume confirmation',
    ai_reasoning: null,
    ta_data: JSON.stringify({
      action: 'BUY', confidence: 0.8, reasons: ['trend'],
      indicators: {
        emaTrend: 'up', macdTrend: 'bullish', adx: 30, atrPct: 2.0,
        volumeRatio: 1.4, rsi: 55, pricePosition: 0.5, vwapDeviation: 0.5,
      },
    }),
    price_at_decision: 100,
    ...overrides,
  };
}

function entryTrade(id: number, overrides: Partial<TradeRow> = {}): TradeRow {
  return {
    id, timestamp: '2026-09-10 14:00:10', alpaca_order_id: 'order-' + id,
    ticker: 'AAPL', side: 'buy', qty: 10, avg_fill_price: 100.5, fill_price: 100.5,
    status: 'filled', strategy: 'daytrading', decision_id: id,
    intent_stop_loss_price: 98, intent_take_profit_price: 106, filled_at: '2026-09-10 14:00:10',
    ...overrides,
  };
}

function closedPosition(id: number, overrides: Partial<ClosedPositionRow> = {}): ClosedPositionRow {
  return {
    id, ticker: 'AAPL', side: 'long', strategy: 'daytrading', qty: 10,
    avg_entry_price: 100, stop_loss_price: 98, take_profit_price: 106,
    opened_at: '2026-09-10 14:00:00', closed_at: '2026-09-10 16:00:00',
    closed_pl: 50, close_reason: 'take_profit',
    ...overrides,
  };
}

function build(overrides: {
  positions?: ClosedPositionRow[];
  trades?: TradeRow[];
  decisions?: DecisionRow[];
} = {}) {
  return buildAnalytics({
    positions: overrides.positions ?? [],
    trades: overrides.trades ?? [],
    decisions: overrides.decisions ?? [],
    fees: [],
    periodStart: null,
    periodEnd: null,
    comparisonPositions: null,
  });
}

describe('decision quality (entry-time info only)', () => {
  test('strong entry context scores high even when the trade loses', () => {
    const score = scoreDecisionQuality({
      ta: { emaTrend: 'up', macdTrend: 'bullish', adx: 32, volumeRatio: 1.5, rsi: 55, pricePosition: 0.4, vwapDeviation: 0.3 },
      confidence: 0.9, action: 'BUY', side: 'long', plannedRR: 2.5, orderFilled: true,
    });
    expect(score!).toBeGreaterThanOrEqual(75);
    expect(labelDecisionQuality(score)).toBe('Strong');
  });

  test('same entry context yields the SAME score regardless of outcome (no hindsight)', () => {
    const ta = { emaTrend: 'up', macdTrend: 'bullish', adx: 28, volumeRatio: 1.2, rsi: 50, pricePosition: 0.5, vwapDeviation: 0.2 };
    const winner = scoreDecisionQuality({ ta, confidence: 0.8, action: 'BUY', side: 'long', plannedRR: 2, orderFilled: true });
    const loser = scoreDecisionQuality({ ta, confidence: 0.8, action: 'BUY', side: 'long', plannedRR: 2, orderFilled: true });
    expect(winner).toBe(loser);
  });

  test('weak entry context scores low even when the trade wins (outcome bias guard)', () => {
    const score = scoreDecisionQuality({
      ta: { emaTrend: 'down', macdTrend: 'bearish', adx: 10, volumeRatio: 0.5, rsi: 80, pricePosition: 0.95, vwapDeviation: 4 },
      confidence: 0.55, action: 'BUY', side: 'long', plannedRR: 0.5, orderFilled: true,
    });
    expect(labelDecisionQuality(score)).toBe('Weak');
  });

  test('counter-trend long entries are penalized', () => {
    const aligned = scoreDecisionQuality({ ta: { emaTrend: 'up', macdTrend: 'bullish' }, confidence: 0.7, action: 'BUY', side: 'long', plannedRR: null, orderFilled: true });
    const counter = scoreDecisionQuality({ ta: { emaTrend: 'down', macdTrend: 'bearish' }, confidence: 0.7, action: 'BUY', side: 'long', plannedRR: null, orderFilled: true });
    expect(counter!).toBeLessThan(aligned!);
  });

  test('null context yields null score (never fabricated)', () => {
    expect(scoreDecisionQuality({ ta: null, confidence: null, action: null, side: null, plannedRR: null, orderFilled: null })).toBeNull();
    expect(labelDecisionQuality(null)).toBeNull();
  });
});

describe('per-trade analysis honesty', () => {
  test('original thesis and post-trade review are stored separately', () => {
    const r = build({
      positions: [closedPosition(1, { closed_pl: -20, close_reason: 'stop_loss' })],
      trades: [entryTrade(1)],
      decisions: [decision(1)],
    });
    const t = r.perTrade[0];
    expect(t.originalThesis).toBe('Strong uptrend with volume confirmation');
    expect(t.postTradeReview).not.toBe(t.originalThesis);
    expect(t.whatCouldImprove).toContain('Acceptable loss');
  });

  test('MFE/MAE are never fabricated', () => {
    const r = build({
      positions: [closedPosition(1)],
      trades: [entryTrade(1)],
      decisions: [decision(1)],
    });
    expect(r.perTrade[0].mfe).toBeNull();
    expect(r.perTrade[0].mae).toBeNull();
    expect(r.dataGaps).toContain('mfe_mae_not_recorded');
  });

  test('unlinked entry decision reports a data gap instead of inventing context', () => {
    const r = build({
      positions: [closedPosition(1)],
      trades: [entryTrade(1, { decision_id: null })],
      decisions: [],
    });
    const t = r.perTrade[0];
    expect(t.originalThesis).toBeNull();
    expect(t.decisionQualityScore).toBeNull();
    expect(t.dataGaps).toContain('entry_decision_unlinked');
  });

  test('realized R derives from stored stop and is null without one', () => {
    const withStop = build({ positions: [closedPosition(1, { closed_pl: 60 })], trades: [entryTrade(1)], decisions: [decision(1)] });
    expect(withStop.perTrade[0].realizedR).toBe(3); // $60 on $2 risk on 10 shares = 60/(10*2)=3
    const noStop = build({
      positions: [closedPosition(2, { closed_pl: 60, stop_loss_price: null, take_profit_price: null })],
      trades: [entryTrade(2, { intent_stop_loss_price: null, intent_take_profit_price: null })],
      decisions: [decision(2)],
    });
    expect(noStop.perTrade[0].realizedR).toBeNull();
  });

  test('loss classification separates acceptable from avoidable', () => {
    // Strong decision + compliant + stop_loss = acceptable.
    const acceptable = build({
      positions: [closedPosition(1, { closed_pl: -15, close_reason: 'stop_loss' })],
      trades: [entryTrade(1)],
      decisions: [decision(1)],
    });
    expect(acceptable.perTrade[0].lossClassification).toBe('acceptable');
    // Weak decision (counter-trend, low confidence, no plan) = avoidable.
    const avoidable = build({
      positions: [closedPosition(2, { closed_pl: -15, close_reason: 'stop_loss' })],
      trades: [entryTrade(2)],
      decisions: [decision(2, {
        confidence: 0.55, reason: 'Chased the move',
        ta_data: JSON.stringify({ indicators: { emaTrend: 'down', macdTrend: 'bearish', adx: 10, atrPct: 1, volumeRatio: 0.5, rsi: 82, pricePosition: 0.95, vwapDeviation: 5 } }),
      })],
    });
    expect(avoidable.perTrade[0].lossClassification).toBe('avoidable');
  });
});

describe('aggregates', () => {
  const analyses = () => build({
    positions: [
      closedPosition(1, { closed_pl: 100, closed_at: '2026-09-10 16:00:00' }),
      closedPosition(2, { closed_pl: -50, closed_at: '2026-09-11 16:00:00' }),
      closedPosition(3, { closed_pl: 30, closed_at: '2026-09-12 16:00:00' }),
      closedPosition(4, { closed_pl: -20, closed_at: '2026-09-15 16:00:00' }),
    ],
    trades: [entryTrade(1), entryTrade(2), entryTrade(3), entryTrade(4)],
    decisions: [decision(1), decision(2), decision(3), decision(4)],
  }).perTrade;

  test('KPIs are arithmetically correct', () => {
    const k = computeKpis(analyses());
    expect(k.trades).toBe(4);
    expect(k.netPL).toBe(60);
    expect(k.winRate).toBe(50);
    expect(k.avgWin).toBe(65);
    expect(k.avgLoss).toBe(-35);
    // profit factor = 130 / 70
    expect(k.profitFactor).toBeCloseTo(1.857, 2);
    expect(k.expectancy).toBe(15);
    // drawdown: equity 100, 50, 80, 60 -> peak 100, trough 50 = 50
    expect(k.maxDrawdown).toBe(50);
  });

  test('empty period reports zero trades and null ratios, never fake numbers', () => {
    const k = computeKpis([]);
    expect(k.trades).toBe(0);
    expect(k.winRate).toBeNull();
    expect(k.profitFactor).toBeNull();
  });
});

describe('confidence calibration', () => {
  test('flags miscalibration when high confidence underperforms', () => {
    const mk = (id: number, conf: number, pl: number) => ({
      ...build({
        positions: [closedPosition(id, { closed_pl: pl })],
        trades: [entryTrade(id)],
        decisions: [decision(id, { confidence: conf })],
      }).perTrade[0],
    });
    const analyses = [
      ...Array.from({ length: 6 }, (_, i) => mk(i, 0.55, 10)),
      ...Array.from({ length: 6 }, (_, i) => mk(50 + i, 0.72, 2)),
      ...Array.from({ length: 6 }, (_, i) => mk(100 + i, 0.85, -15)),
    ];
    const buckets = computeCalibration(analyses);
    const verdict = calibrationVerdict(buckets);
    expect(verdict).toContain('NOT');
    const lowBand = buckets.find(b => b.band === '<60%')!;
    const highBand = buckets.find(b => b.band === '80-89%')!;
    expect(lowBand.trades).toBe(6);
    expect(highBand.trades).toBe(6);
    expect(lowBand.netPL).toBe(60);
    expect(highBand.netPL).toBe(-90);
  });

  test('insufficient data produces an explicit verdict, not a conclusion', () => {
    const verdict = calibrationVerdict(computeCalibration([]));
    expect(verdict).toContain('Insufficient data');
  });
});

describe('patterns and robustness', () => {
  test('evidence level follows sample size and small samples are excluded', () => {
    const positions: ClosedPositionRow[] = [];
    const trades: TradeRow[] = [];
    const decisions: DecisionRow[] = [];
    for (let i = 0; i < 12; i++) {
      positions.push(closedPosition(i, { closed_pl: i % 2 === 0 ? 20 : -5, closed_at: `2026-09-${10 + (i % 5)} 16:00:0${i % 10}` }));
      trades.push(entryTrade(i));
      decisions.push(decision(i));
    }
    const r1 = build({ positions, trades, decisions });
    const patterns = [...r1.patterns.works, ...r1.patterns.needsAttention];
    for (const p of patterns) expect(p.trades).toBeGreaterThanOrEqual(3);
  });

  test('top-level result carries sample-size honesty', () => {
    const r = build({
      positions: [closedPosition(1), closedPosition(2, { ticker: 'MSFT' })],
      trades: [entryTrade(1), entryTrade(2, { ticker: 'MSFT' })],
      decisions: [decision(1), decision(2, { ticker: 'MSFT' })],
    });
    expect(r.robustness.sampleSize).toBe(2);
    expect(r.robustness.evidence).toBe('Preliminary');
    expect(r.robustness.chronologicalSplit).toBeNull();
  });
});

describe('research backlog', () => {
  test('items are hypotheses with test and success criteria, status New', () => {
    const positions: ClosedPositionRow[] = [];
    const trades: TradeRow[] = [];
    const decisions: DecisionRow[] = [];
    for (let i = 0; i < 10; i++) {
      positions.push(closedPosition(i, { closed_pl: -12, closed_at: `2026-09-${10 + (i % 5)} 16:00:0${i % 10}` }));
      trades.push(entryTrade(i));
      decisions.push(decision(i));
    }
    const r = build({ positions, trades, decisions });
    expect(r.researchBacklog.length).toBeGreaterThan(0);
    for (const item of r.researchBacklog) {
      expect(item.title).toBeTruthy();
      expect(item.observation).toBeTruthy();
      expect(item.evidence).toBeTruthy();
      expect(item.sampleSize).toBeGreaterThan(0);
      expect(item.hypothesis).toBeTruthy();
      expect(item.proposedTest).toBeTruthy();
      expect(item.successCriteria).toBeTruthy();
      expect(item.status).toBe('New');
    }
  });
});

describe('analysis versioning', () => {
  test('every analysis carries the scoring-rule version and timestamp', () => {
    const r = build({
      positions: [closedPosition(1)],
      trades: [entryTrade(1)],
      decisions: [decision(1)],
    });
    expect(r.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(r.perTrade[0].analysisVersion).toBe(ANALYSIS_VERSION);
    expect(r.perTrade[0].analysisTimestamp).toBeTruthy();
  });
});

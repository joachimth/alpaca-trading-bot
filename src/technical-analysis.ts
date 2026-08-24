// Technical Analysis Engine
// Computes indicators from price bars and generates trading signals
// This is the deterministic base layer — the AI layer refines these signals

import type { Bar } from './alpaca';

export interface TAIndicators {
  symbol: string;
  price: number;
  rsi: number;
  emaFast: number;
  emaSlow: number;
  emaTrend: 'up' | 'down' | 'flat';
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  macdTrend: 'bullish' | 'bearish' | 'neutral';
  atr: number;
  atrPct: number;       // ATR as % of price (volatility)
  volume: number;
  volumeAvg: number;
  volumeRatio: number;  // current vol / avg vol
  support: number;      // recent low
  resistance: number;   // recent high
  pricePosition: number; // 0=at support, 1=at resistance
  stochK: number;
  stochD: number;
  bbUpper: number;      // Bollinger Bands
  bbMiddle: number;
  bbLower: number;
  bbPosition: number;   // 0=at lower band, 1=at upper band
  adx: number;          // trend strength
  obv: number;          // On-Balance Volume
  obvTrend: 'up' | 'down' | 'flat';
  // Research-based additions
  shortTermReturn: number;    // return over last N bars (for reversal signal)
  shortTermReturnPeriods: number;
  gapPct: number;             // today's open gap percentage
  vwap: number;               // volume-weighted average price
  vwapDeviation: number;      // current price deviation from VWAP (%)
  intradayReturn: number;     // return since today's open
}

export interface TASignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;    // 0.0 to 1.0
  reasons: string[];
  indicators: TAIndicators;
  /** Optional calibrated gross edge in basis points; never inferred from confidence. */
  rawEdgeBps?: number;
}

// ============================================================
// Indicator Calculations
// ============================================================

export function sma(values: number[], period: number): number {
  if (values.length < period) return 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) return sma(values, values.length);

  const k = 2 / (period + 1);
  let emaPrev = sma(values.slice(0, period), period);

  for (let i = period; i < values.length; i++) {
    emaPrev = values[i] * k + emaPrev * (1 - k);
  }

  return emaPrev;
}

export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  if (values.length < period) return values.map(() => sma(values, values.length));

  const k = 2 / (period + 1);
  const result: number[] = [];
  let emaPrev = sma(values.slice(0, period), period);

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(sma(values.slice(0, i + 1), i + 1));
    } else {
      emaPrev = values[i] * k + emaPrev * (1 - k);
      result.push(emaPrev);
    }
  }

  return result;
}

export function rsi(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function macd(closes: number[], fast: number = 12, slow: number = 26, signal: number = 9): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (closes.length < slow + signal) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  const macdLine: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const signalLine = emaSeries(macdLine.slice(-slow), signal);
  const macdValue = macdLine[macdLine.length - 1];
  const signalValue = signalLine[signalLine.length - 1];

  return {
    macd: macdValue,
    signal: signalValue,
    histogram: macdValue - signalValue,
  };
}

export function atr(bars: Bar[], period: number = 14): number {
  if (bars.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].h;
    const low = bars[i].l;
    const prevClose = bars[i - 1].c;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  return sma(trueRanges, period);
}

export function bollingerBands(closes: number[], period: number = 20, stdDev: number = 2): {
  upper: number;
  middle: number;
  lower: number;
  position: number;
} {
  if (closes.length < period) {
    const price = closes[closes.length - 1] || 0;
    return { upper: price * 1.02, middle: price, lower: price * 0.98, position: 0.5 };
  }

  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
  const sd = Math.sqrt(variance);

  const upper = mean + stdDev * sd;
  const lower = mean - stdDev * sd;
  const price = closes[closes.length - 1];

  const position = upper !== lower ? (price - lower) / (upper - lower) : 0.5;

  return { upper, middle: mean, lower, position: Math.max(0, Math.min(1, position)) };
}

export function stochastic(bars: Bar[], kPeriod: number = 14, dPeriod: number = 3): { k: number; d: number } {
  if (bars.length < kPeriod) return { k: 50, d: 50 };

  const kValues: number[] = [];
  for (let i = bars.length - kPeriod - dPeriod; i < bars.length; i++) {
    if (i < kPeriod - 1) continue;
    const slice = bars.slice(Math.max(0, i - kPeriod + 1), i + 1);
    const highestHigh = Math.max(...slice.map(b => b.h));
    const lowestLow = Math.min(...slice.map(b => b.l));
    const close = bars[i].c;

    if (highestHigh === lowestLow) {
      kValues.push(50);
    } else {
      kValues.push(((close - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
  }

  const k = kValues[kValues.length - 1] || 50;
  const d = sma(kValues.slice(-dPeriod), dPeriod);

  return { k, d };
}

export function adx(bars: Bar[], period: number = 14): number {
  if (bars.length < period * 2) return 25;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].h;
    const low = bars[i].l;
    const prevHigh = bars[i - 1].h;
    const prevLow = bars[i - 1].l;
    const prevClose = bars[i - 1].c;

    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);

    tr.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));
  }

  // Smooth using Wilder's method (simplified to SMA for performance)
  const trAvg = sma(tr.slice(-period), period);
  const plusDMAvg = sma(plusDM.slice(-period), period);
  const minusDMAvg = sma(minusDM.slice(-period), period);

  if (trAvg === 0) return 25;

  const plusDI = (plusDMAvg / trAvg) * 100;
  const minusDI = (minusDMAvg / trAvg) * 100;

  if (plusDI + minusDI === 0) return 25;

  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  return dx;
}

export function obv(bars: Bar[]): { value: number; trend: 'up' | 'down' | 'flat' } {
  if (bars.length === 0) return { value: 0, trend: 'flat' };

  let obvValue = 0;
  const obvSeries: number[] = [0];

  for (let i = 1; i < bars.length; i++) {
    if (bars[i].c > bars[i - 1].c) {
      obvValue += bars[i].v;
    } else if (bars[i].c < bars[i - 1].c) {
      obvValue -= bars[i].v;
    }
    obvSeries.push(obvValue);
  }

  // Determine trend from last 10 values
  const recent = obvSeries.slice(-10);
  const firstHalf = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
  const secondHalf = recent.slice(5).reduce((a, b) => a + b, 0) / 5;
  const diff = secondHalf - firstHalf;

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (diff > obvValue * 0.001) trend = 'up';
  else if (diff < -obvValue * 0.001) trend = 'down';

  return { value: obvValue, trend };
}

// ============================================================
// Full Analysis
// ============================================================

export function analyze(bars: Bar[], symbol: string, config: {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  emaFast: number;
  emaSlow: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  volumeAvgPeriod: number;
}): TAIndicators {
  const closes = bars.map(b => b.c);
  const lastPrice = closes[closes.length - 1] || 0;

  const rsiVal = rsi(closes, config.rsiPeriod);
  const emaFastVal = ema(closes, config.emaFast);
  const emaSlowVal = ema(closes, config.emaSlow);
  const macdResult = macd(closes, config.macdFast, config.macdSlow, config.macdSignal);
  const atrVal = atr(bars, config.atrPeriod);
  const volume = bars[bars.length - 1]?.v || 0;
  const volumeAvg = sma(bars.slice(-config.volumeAvgPeriod).map(b => b.v), config.volumeAvgPeriod);
  const recentBars = bars.slice(-20);
  const support = Math.min(...recentBars.map(b => b.l));
  const resistance = Math.max(...recentBars.map(b => b.h));
  const stoch = stochastic(bars);
  const bb = bollingerBands(closes, 20, 2);
  const adxVal = adx(bars);
  const obvResult = obv(bars);

  const emaTrend = emaFastVal > emaSlowVal * 1.001 ? 'up' : emaFastVal < emaSlowVal * 0.999 ? 'down' : 'flat';
  const macdTrend = macdResult.histogram > 0 ? 'bullish' : macdResult.histogram < 0 ? 'bearish' : 'neutral';
  const pricePosition = resistance !== support ? (lastPrice - support) / (resistance - support) : 0.5;

  // Short-term return (last 12 bars ~ 1 hour on 5-min bars)
  const stReturnPeriods = Math.min(12, closes.length - 1);
  const stReturn = stReturnPeriods > 0 && closes[closes.length - 1 - stReturnPeriods] > 0
    ? ((lastPrice - closes[closes.length - 1 - stReturnPeriods]) / closes[closes.length - 1 - stReturnPeriods]) * 100
    : 0;

  // VWAP (volume-weighted average price) over recent bars
  const vwapBars = bars.slice(-Math.min(50, bars.length));
  const totalVol = vwapBars.reduce((s, b) => s + b.v, 0);
  const vwapValue = totalVol > 0
    ? vwapBars.reduce((s, b) => s + ((b.h + b.l + b.c) / 3) * b.v, 0) / totalVol
    : lastPrice;
  const vwapDeviation = vwapValue > 0 ? ((lastPrice - vwapValue) / vwapValue) * 100 : 0;

  // Gap percentage: today's first bar open vs yesterday's last close
  // Detect day boundary by looking for a gap > 2 hours in timestamps
  let gapPct = 0;
  let intradayReturn = 0;
  if (bars.length >= 2) {
    // Find today's first bar (look for largest time gap in last ~100 bars)
    let dayStartIdx = Math.max(0, bars.length - 100);
    for (let i = bars.length - 1; i > Math.max(1, bars.length - 100); i--) {
      const gap = bars[i].t - bars[i - 1].t;
      if (gap > 7200) { // > 2 hours = new day
        dayStartIdx = i;
        break;
      }
    }
    const dayOpen = bars[dayStartIdx].o;
    const prevClose = dayStartIdx > 0 ? bars[dayStartIdx - 1].c : dayOpen;
    if (prevClose > 0) {
      gapPct = ((dayOpen - prevClose) / prevClose) * 100;
      intradayReturn = ((lastPrice - dayOpen) / dayOpen) * 100;
    }
  }

  return {
    symbol,
    price: lastPrice,
    rsi: rsiVal,
    emaFast: emaFastVal,
    emaSlow: emaSlowVal,
    emaTrend,
    macd: macdResult.macd,
    macdSignal: macdResult.signal,
    macdHistogram: macdResult.histogram,
    macdTrend,
    atr: atrVal,
    atrPct: lastPrice > 0 ? (atrVal / lastPrice) * 100 : 0,
    volume,
    volumeAvg,
    volumeRatio: volumeAvg > 0 ? volume / volumeAvg : 1,
    support,
    resistance,
    pricePosition: Math.max(0, Math.min(1, pricePosition)),
    stochK: stoch.k,
    stochD: stoch.d,
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    bbPosition: bb.position,
    adx: adxVal,
    obv: obvResult.value,
    obvTrend: obvResult.trend,
    shortTermReturn: stReturn,
    shortTermReturnPeriods: stReturnPeriods,
    gapPct,
    vwap: vwapValue,
    vwapDeviation,
    intradayReturn,
  };
}

// ============================================================
// Signal Generation
// ============================================================

export function generateSignal(indicators: TAIndicators, config: {
  rsiOversold: number;
  rsiOverbought: number;
}): TASignal {
  const reasons: string[] = [];
  let bullScore = 0;
  let bearScore = 0;

  // RSI
  if (indicators.rsi < config.rsiOversold) {
    bullScore += 2;
    reasons.push(`RSI ${indicators.rsi.toFixed(1)} oversold (< ${config.rsiOversold})`);
  } else if (indicators.rsi > config.rsiOverbought) {
    bearScore += 2;
    reasons.push(`RSI ${indicators.rsi.toFixed(1)} overbought (> ${config.rsiOverbought})`);
  } else if (indicators.rsi > 50) {
    bullScore += 0.5;
  } else {
    bearScore += 0.5;
  }

  // EMA trend
  if (indicators.emaTrend === 'up') {
    bullScore += 1.5;
    reasons.push(`EMA${9}/${21} bullish crossover (uptrend)`);
  } else if (indicators.emaTrend === 'down') {
    bearScore += 1.5;
    reasons.push(`EMA${9}/${21} bearish crossover (downtrend)`);
  }

  // MACD
  if (indicators.macdTrend === 'bullish') {
    bullScore += 1.5;
    reasons.push(`MACD bullish (histogram +${indicators.macdHistogram.toFixed(4)})`);
  } else if (indicators.macdTrend === 'bearish') {
    bearScore += 1.5;
    reasons.push(`MACD bearish (histogram ${indicators.macdHistogram.toFixed(4)})`);
  }

  // Stochastic
  if (indicators.stochK < 20) {
    bullScore += 1;
    reasons.push(`Stochastic %K ${indicators.stochK.toFixed(1)} oversold`);
  } else if (indicators.stochK > 80) {
    bearScore += 1;
    reasons.push(`Stochastic %K ${indicators.stochK.toFixed(1)} overbought`);
  }

  // Bollinger Bands
  if (indicators.bbPosition < 0.1) {
    bullScore += 1;
    reasons.push(`Price at lower Bollinger Band (potential bounce)`);
  } else if (indicators.bbPosition > 0.9) {
    bearScore += 1;
    reasons.push(`Price at upper Bollinger Band (potential reversal)`);
  }

  // Volume confirmation
  if (indicators.volumeRatio > 1.5) {
    if (bullScore > bearScore) {
      bullScore += 1;
      reasons.push(`High volume ${indicators.volumeRatio.toFixed(1)}x avg confirms bullish move`);
    } else if (bearScore > bullScore) {
      bearScore += 1;
      reasons.push(`High volume ${indicators.volumeRatio.toFixed(1)}x avg confirms bearish move`);
    }
  }

  // ADX (trend strength)
  if (indicators.adx > 25) {
    if (bullScore > bearScore) {
      bullScore += 0.5;
      reasons.push(`ADX ${indicators.adx.toFixed(1)} — strong trend`);
    } else if (bearScore > bullScore) {
      bearScore += 0.5;
      reasons.push(`ADX ${indicators.adx.toFixed(1)} — strong trend`);
    }
  }

  // OBV
  if (indicators.obvTrend === 'up') {
    bullScore += 0.5;
    reasons.push(`OBV trending up (accumulation)`);
  } else if (indicators.obvTrend === 'down') {
    bearScore += 0.5;
    reasons.push(`OBV trending down (distribution)`);
  }

  // Price position in range
  if (indicators.pricePosition < 0.2) {
    bullScore += 0.5;
    reasons.push(`Price near support (${indicators.support.toFixed(2)})`);
  } else if (indicators.pricePosition > 0.8) {
    bearScore += 0.5;
    reasons.push(`Price near resistance (${indicators.resistance.toFixed(2)})`);
  }

  // === Research-based signals ===

  // Short-term reversal (Jegadeesh 1990, Lehmann 1990)
  // One of the most robust anomalies, especially in less liquid names
  // If stock dropped significantly in last ~1 hour, expect bounce (and vice versa)
  if (indicators.shortTermReturn <= -2.0) {
    bullScore += 2;
    reasons.push(`Short-term reversal: ${indicators.shortTermReturn.toFixed(1)}% over ${indicators.shortTermReturnPeriods} bars (oversold bounce)`);
  } else if (indicators.shortTermReturn >= 2.0) {
    bearScore += 2;
    reasons.push(`Short-term reversal: ${indicators.shortTermReturn.toFixed(1)}% over ${indicators.shortTermReturnPeriods} bars (overbought fade)`);
  } else if (indicators.shortTermReturn <= -1.0) {
    bullScore += 1;
    reasons.push(`Mild reversal signal: ${indicators.shortTermReturn.toFixed(1)}% pullback`);
  } else if (indicators.shortTermReturn >= 1.0) {
    bearScore += 1;
    reasons.push(`Mild reversal signal: ${indicators.shortTermReturn.toFixed(1)}% run-up`);
  }

  // VWAP deviation (institutional reference point)
  // Price below VWAP = selling pressure, above = buying pressure
  // Extreme deviations tend to revert
  if (indicators.vwapDeviation <= -1.5) {
    bullScore += 1;
    reasons.push(`Price ${indicators.vwapDeviation.toFixed(1)}% below VWAP (reversion candidate)`);
  } else if (indicators.vwapDeviation >= 1.5) {
    bearScore += 1;
    reasons.push(`Price ${indicators.vwapDeviation.toFixed(1)}% above VWAP (extension risk)`);
  }

  // Opening gap behavior
  // Large gaps tend to fill partially during the day
  if (indicators.gapPct <= -1.5) {
    bullScore += 1;
    reasons.push(`Gap down ${indicators.gapPct.toFixed(1)}% (gap fill potential)`);
  } else if (indicators.gapPct >= 1.5) {
    bearScore += 1;
    reasons.push(`Gap up ${indicators.gapPct.toFixed(1)}% (gap fade potential)`);
  }

  // Determine action
  const totalScore = bullScore + bearScore;
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 0.5;

  if (totalScore > 0) {
    const bullPct = bullScore / totalScore;
    confidence = Math.min(0.95, 0.5 + Math.abs(bullPct - 0.5) * 0.9);

    if (bullPct > 0.65 && bullScore >= 3) {
      action = 'BUY';
    } else if (bullPct < 0.35 && bearScore >= 3) {
      action = 'SELL';
    }
  }

  if (reasons.length === 0) {
    reasons.push('No strong signals — indicators neutral');
  }

  return {
    action,
    confidence,
    reasons,
    indicators,
  };
}

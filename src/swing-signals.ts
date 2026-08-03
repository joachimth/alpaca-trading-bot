// Swing Trading Signal Engine
// Cross-sectional ranking approach (Grinold & Kahn, Fundamental Law of Active Management)
// Ranks universe of stocks by composite alpha score, returns top/bottom candidates
//
// Key differences from daytrading TA engine:
// - Uses daily bars, not 5-min bars
// - Cross-sectional ranking (relative), not absolute prediction
// - Signals based on weekly/monthly anomalies, not intraday patterns
// - No LLM refinement (documented as no edge on this horizon)

import type { Bar } from './alpaca';

export interface SwingIndicators {
  symbol: string;
  price: number;
  // Returns over multiple windows (volatility-normalized)
  ret1d: number;
  ret5d: number;
  ret21d: number;
  ret63d: number;
  ret126d: number;
  ret252d: number;
  // Momentum (12-1 month, excluding recent month which contains reversal)
  momentum12_1: number;
  // 52-week high proximity (George & Hwang 2004)
  high52w: number;
  high52wProximity: number;  // 0-1, how close to 52w high
  low52w: number;
  // Volatility
  vol20d: number;
  vol60d: number;
  volRatio: number;          // vol20d / vol60d (rising vol = concern)
  // Volume
  volume20d: number;
  volumeRatio: number;       // current day vol / 20d avg
  amihudIlliquidity: number; // |return| / dollar volume
  // RSI on daily (for short-term reversal context)
  rsi14: number;
  rsi5: number;
  // Bollinger position on daily
  bbPosition: number;
  // MAX effect (maximum daily return in last 21 days — lottery-like stocks underperform)
  maxDailyReturn21d: number;
  // Beta proxy (correlation * vol ratio vs SPY-like benchmark)
  betaProxy: number;
  // Sector (placeholder — would need asset metadata)
  sector: string;
}

export interface SwingScore {
  symbol: string;
  compositeScore: number;     // z-score normalized, positive = bullish
  rank: number;               // 1 = best
  percentile: number;         // 0-100
  signals: string[];
  indicators: SwingIndicators;
  // Decomposed scores for logging
  reversalScore: number;
  momentumScore: number;
  proximityScore: number;
  volumeScore: number;
  qualityScore: number;
}

export interface SwingConfig {
  // Signal weights (sum should = 1.0 for interpretability, but not enforced)
  reversalWeight: number;      // short-term reversal (1-5 day)
  momentumWeight: number;      // 12-1 month momentum
  proximityWeight: number;     // 52-week high proximity
  volumeWeight: number;        // volume confirmation
  qualityWeight: number;       // low vol / anti-lottery
  // Reversal parameters
  reversalLookback: number;    // days for reversal signal (default 5)
  reversalThreshold: number;   // min |return| to trigger (default 2%)
  // Universe filter
  minPrice: number;            // min stock price (default $5)
  minDollarVolume: number;     // min 20d avg dollar volume (default $2M)
  minHistory: number;          // min days of history (default 252)
  // Position limits
  maxPositions: number;        // max simultaneous positions
  topPercentile: number;       // buy threshold (default 20 = top 20%)
  bottomPercentile: number;    // sell/avoid threshold (default 80 = bottom 20%)
  // Earnings policy
  earningsBlackoutDays: number; // don't enter positions within N days of earnings (0 = disabled)
}

// ============================================================
// Indicator calculations (daily bars)
// ============================================================

function dailyReturns(bars: Bar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].c > 0) {
      returns.push((bars[i].c - bars[i - 1].c) / bars[i - 1].c);
    }
  }
  return returns;
}

function realizedVol(returns: number[], period: number): number {
  if (returns.length < period) return 0;
  const slice = returns.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / slice.length;
  return Math.sqrt(variance) * Math.sqrt(252); // annualized
}

function rsiDaily(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function bollingerPositionDaily(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0.5;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + 2 * sd;
  const lower = mean - 2 * sd;
  const price = closes[closes.length - 1];
  return upper !== lower ? (price - lower) / (upper - lower) : 0.5;
}

function maxDailyReturn(returns: number[], period: number): number {
  if (returns.length < period) return 0;
  return Math.max(...returns.slice(-period));
}

function amihudIlliquidity(returns: number[], dollarVolumes: number[], period: number): number {
  if (returns.length < period) return 0;
  const retSlice = returns.slice(-period);
  const volSlice = dollarVolumes.slice(-period);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < retSlice.length; i++) {
    if (volSlice[i] > 0) {
      sum += Math.abs(retSlice[i]) / volSlice[i];
      count++;
    }
  }
  return count > 0 ? (sum / count) * 1e6 : 0; // scale for readability
}

// ============================================================
// Compute indicators for a single stock
// ============================================================

export function computeSwingIndicators(bars: Bar[], symbol: string): SwingIndicators | null {
  if (bars.length < 60) return null;

  const closes = bars.map(b => b.c);
  const volumes = bars.map(b => b.v);
  const lastPrice = closes[closes.length - 1];
  const returns = dailyReturns(bars);
  const dollarVolumes = bars.slice(1).map(b => b.v * b.c);

  // Returns over multiple windows
  const retN = (n: number): number => {
    if (closes.length <= n) return 0;
    const prev = closes[closes.length - 1 - n];
    return prev > 0 ? ((lastPrice - prev) / prev) * 100 : 0;
  };

  // 52-week high/low
  const lookback252 = Math.min(252, closes.length);
  const high52w = Math.max(...closes.slice(-lookback252));
  const low52w = Math.min(...closes.slice(-lookback252));
  const high52wProximity = high52w > 0 ? lastPrice / high52w : 0; // 1.0 = at high

  // Momentum 12-1 (12 month return excluding last month)
  // ret126 - ret21 gives ~6 month excluding last month
  const momentum12_1 = retN(126) - retN(21);

  // Volatility
  const vol20d = realizedVol(returns, 20);
  const vol60d = realizedVol(returns, 60);
  const volRatio = vol60d > 0 ? vol20d / vol60d : 1;

  // Volume
  const volume20d = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const volumeRatio = volume20d > 0 ? volumes[volumes.length - 1] / volume20d : 1;

  // Amihud illiquidity
  const illiquidity = amihudIlliquidity(returns, dollarVolumes, 20);

  // RSI
  const rsi14Val = rsiDaily(closes, 14);
  const rsi5Val = rsiDaily(closes, 5);

  // Bollinger position
  const bbPos = bollingerPositionDaily(closes, 20);

  // MAX effect
  const maxRet = maxDailyReturn(returns, 21);

  // Beta proxy: vol20d / market vol (simplified — would need SPY regression)
  // Use 1.0 as placeholder; in production, regress against SPY
  const betaProxy = vol20d > 0 ? vol20d / 0.15 : 1; // assume ~15% market vol

  return {
    symbol,
    price: lastPrice,
    ret1d: retN(1),
    ret5d: retN(5),
    ret21d: retN(21),
    ret63d: retN(63),
    ret126d: retN(126),
    ret252d: retN(252),
    momentum12_1,
    high52w,
    high52wProximity,
    low52w,
    vol20d,
    vol60d,
    volRatio,
    volume20d,
    volumeRatio,
    amihudIlliquidity: illiquidity,
    rsi14: rsi14Val,
    rsi5: rsi5Val,
    bbPosition: bbPos,
    maxDailyReturn21d: maxRet,
    betaProxy,
    sector: 'unknown',
  };
}

// ============================================================
// Cross-sectional scoring and ranking
// ============================================================

export function scoreAndRank(
  allIndicators: SwingIndicators[],
  config: SwingConfig
): SwingScore[] {
  if (allIndicators.length === 0) return [];

  // ============================================================
  // 1. Compute raw scores per stock
  // ============================================================

  const rawScores = allIndicators.map(ind => {
    const signals: string[] = [];

    // --- Short-term reversal (Jegadeesh 1990, Lehmann 1990) ---
    // Stocks that dropped over last N days tend to bounce
    let reversalScore = 0;
    const reversalReturn = ind.ret5d; // 5-day return
    if (reversalReturn <= -config.reversalThreshold) {
      reversalScore = -reversalReturn / config.reversalThreshold; // normalize: -4% = 2.0
      signals.push(`Reversal: ${reversalReturn.toFixed(1)}% over 5d (oversold)`);
    } else if (reversalReturn >= config.reversalThreshold) {
      reversalScore = -reversalReturn / config.reversalThreshold; // negative score for overbought
      signals.push(`Reversal: ${reversalReturn.toFixed(1)}% over 5d (overbought)`);
    }
    // Also use RSI5 as secondary reversal signal
    if (ind.rsi5 < 25) {
      reversalScore += 0.5;
      signals.push(`RSI5 ${ind.rsi5.toFixed(0)} deeply oversold`);
    } else if (ind.rsi5 > 75) {
      reversalScore -= 0.5;
      signals.push(`RSI5 ${ind.rsi5.toFixed(0)} deeply overbought`);
    }

    // --- Momentum (12-1 month, excluding recent month) ---
    // Positive momentum = continuation, but this is a weaker signal on week horizon
    let momentumScore = 0;
    if (ind.momentum12_1 > 5) {
      momentumScore = Math.min(2, ind.momentum12_1 / 20);
      signals.push(`Momentum 12-1: +${ind.momentum12_1.toFixed(1)}%`);
    } else if (ind.momentum12_1 < -5) {
      momentumScore = Math.max(-2, ind.momentum12_1 / 20);
      signals.push(`Momentum 12-1: ${ind.momentum12_1.toFixed(1)}%`);
    }

    // --- 52-week high proximity (George & Hwang 2004) ---
    // Stocks near 52w high tend to continue
    let proximityScore = 0;
    if (ind.high52wProximity > 0.9) {
      proximityScore = (ind.high52wProximity - 0.9) * 10; // 0.95 = 0.5, 1.0 = 1.0
      signals.push(`Near 52w high: ${(ind.high52wProximity * 100).toFixed(1)}%`);
    } else if (ind.high52wProximity < 0.5) {
      proximityScore = (ind.high52wProximity - 0.5) * 2; // negative
      signals.push(`Far from 52w high: ${(ind.high52wProximity * 100).toFixed(1)}%`);
    }

    // --- Volume confirmation ---
    let volumeScore = 0;
    if (ind.volumeRatio > 1.5 && reversalScore > 0) {
      // High volume on oversold = capitulation, potential bounce
      volumeScore = 0.5;
      signals.push(`Volume ${ind.volumeRatio.toFixed(1)}x avg on selloff (capitulation)`);
    } else if (ind.volumeRatio > 1.5 && ind.ret5d > 0) {
      // High volume on rally = conviction
      volumeScore = 0.3;
      signals.push(`Volume ${ind.volumeRatio.toFixed(1)}x avg on rally (conviction)`);
    }

    // --- Quality: low volatility, anti-lottery (MAX effect) ---
    let qualityScore = 0;
    // Low volatility premium (Frazzini & Pedersen 2014)
    if (ind.vol20d > 0 && ind.vol20d < 0.3) {
      qualityScore += 0.3;
      signals.push(`Low vol: ${(ind.vol20d * 100).toFixed(0)}% annualized`);
    } else if (ind.vol20d > 0.6) {
      qualityScore -= 0.5;
      signals.push(`High vol: ${(ind.vol20d * 100).toFixed(0)}% annualized (risky)`);
    }
    // MAX effect: stocks with extreme single-day returns underperform
    if (ind.maxDailyReturn21d > 0.1) { // >10% single day return
      qualityScore -= 0.5;
      signals.push(`MAX effect: ${(ind.maxDailyReturn21d * 100).toFixed(0)}% max daily return (lottery-like)`);
    }
    // Bollinger position as mean-reversion context
    if (ind.bbPosition < 0.15) {
      qualityScore += 0.2;
      signals.push(`At lower Bollinger Band (potential bounce)`);
    } else if (ind.bbPosition > 0.85) {
      qualityScore -= 0.2;
      signals.push(`At upper Bollinger Band (extension risk)`);
    }

    // Composite score
    const compositeRaw =
      reversalScore * config.reversalWeight +
      momentumScore * config.momentumWeight +
      proximityScore * config.proximityWeight +
      volumeScore * config.volumeWeight +
      qualityScore * config.qualityWeight;

    return {
      symbol: ind.symbol,
      compositeRaw,
      reversalScore,
      momentumScore,
      proximityScore,
      volumeScore,
      qualityScore,
      signals,
      indicators: ind,
    };
  });

  // ============================================================
  // 2. Cross-sectional z-score normalization
  // ============================================================

  const scores = rawScores.map(r => r.compositeRaw);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const stdDev = Math.sqrt(scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / scores.length) || 1;

  const normalized = rawScores.map(r => ({
    ...r,
    compositeScore: (r.compositeRaw - mean) / stdDev, // z-score
  }));

  // ============================================================
  // 3. Rank and percentile
  // ============================================================

  normalized.sort((a, b) => b.compositeScore - a.compositeScore);

  const ranked: SwingScore[] = normalized.map((r, i) => ({
    symbol: r.symbol,
    compositeScore: r.compositeScore,
    rank: i + 1,
    percentile: ((i + 1) / normalized.length) * 100,
    signals: r.signals,
    indicators: r.indicators,
    reversalScore: r.reversalScore,
    momentumScore: r.momentumScore,
    proximityScore: r.proximityScore,
    volumeScore: r.volumeScore,
    qualityScore: r.qualityScore,
  }));

  return ranked;
}

// ============================================================
// Filter universe by liquidity and data quality
// ============================================================

export function filterUniverse(
  indicators: SwingIndicators[],
  config: SwingConfig
): SwingIndicators[] {
  return indicators.filter(ind => {
    // Price filter
    if (ind.price < config.minPrice) return false;
    // Dollar volume filter (price * avg volume)
    const dollarVol = ind.price * ind.volume20d;
    if (dollarVol < config.minDollarVolume) return false;
    // Data quality: need meaningful history
    if (ind.ret252d === 0 && ind.ret126d === 0) return false; // not enough history
    return true;
  });
}

// ============================================================
// Default swing config
// ============================================================

export const DEFAULT_SWING_CONFIG: SwingConfig = {
  reversalWeight: 0.35,
  momentumWeight: 0.15,
  proximityWeight: 0.20,
  volumeWeight: 0.10,
  qualityWeight: 0.20,
  reversalLookback: 5,
  reversalThreshold: 2.0,
  minPrice: 5,
  minDollarVolume: 2000000,
  minHistory: 252,
  maxPositions: 30,
  topPercentile: 20,
  bottomPercentile: 80,
  earningsBlackoutDays: 3,
};

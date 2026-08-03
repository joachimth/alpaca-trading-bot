// Swing Trading Risk Manager
// Different risk profile from daytrading:
// - Gap risk is the primary enemy (stops don't protect against overnight gaps)
// - Position sizing based on gap distribution, not just ATR
// - Turnover control with hysteresis (don't sell just because stock dropped from top 20% to top 25%)
// - Earnings blackout policy
// - No margin by default (overnight gap risk + margin = ruin)

import type { AccountInfo, Position } from './alpaca';
import type { SwingScore } from './swing-signals';

export interface SwingRiskConfig {
  maxPositions: number;
  maxPositionPct: number;          // max % of portfolio per position (hard cap)
  targetPositionPct: number;       // target % per position (equal weight default)
  maxSectorPct: number;            // max net sector exposure (placeholder, needs sector data)
  maxGrossExposure: number;        // max total exposure as % of portfolio (100 = no margin)
  stopLossPct: number;             // emergency stop (gap protection, not primary)
  trailingStopPct: number;         // trailing stop for profit protection
  dailyLossLimitPct: number;       // stop trading if down this much on the day
  rollingDrawdownLimitPct: number; // stop if drawdown from peak exceeds this
  minConfidence: number;           // min composite z-score to buy
  exitZScore: number;              // sell if z-score drops below this (hysteresis)
  enableMargin: boolean;
  earningsBlackoutDays: number;    // don't enter within N days of earnings
  maxTurnoverPct: number;          // max % of portfolio to trade per rebalance
  minTradeSize: number;            // min trade size as % of portfolio (skip tiny rebalances)
  maxOrderRatePerMin: number;      // kill switch
}

export interface SwingRiskCheckResult {
  approved: boolean;
  reason: string;
  adjustedQty?: number;
  adjustedValue?: number;
  stopLossPrice?: number;
  estimatedCosts?: number;
  isHysteresisSkip?: boolean;      // true = position retained despite lower rank
}

export interface SwingKillSwitchState {
  tradingHalted: boolean;
  reason: string;
  triggeredAt: number | null;
  equityHistory: number[];
  orderTimestamps: number[];
}

export class SwingRiskManager {
  private config: SwingRiskConfig;
  private killState: SwingKillSwitchState;

  constructor(config: SwingRiskConfig) {
    this.config = config;
    this.killState = {
      tradingHalted: false,
      reason: '',
      triggeredAt: null,
      equityHistory: [],
      orderTimestamps: [],
    };
  }

  // ============================================================
  // Kill switch management (shared pattern with daytrading)
  // ============================================================

  updateEquitySnapshot(equity: number): void {
    this.killState.equityHistory.push(equity);
    if (this.killState.equityHistory.length > 20) {
      this.killState.equityHistory.shift();
    }
    if (this.killState.equityHistory.length >= 3) {
      const peak = Math.max(...this.killState.equityHistory);
      const drawdownPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (drawdownPct >= this.config.rollingDrawdownLimitPct) {
        this.haltTrading(`Rolling drawdown limit: ${drawdownPct.toFixed(2)}%`);
      }
    }
  }

  recordOrder(): boolean {
    const now = Date.now();
    this.killState.orderTimestamps = this.killState.orderTimestamps.filter(t => now - t < 60000);
    if (this.killState.orderTimestamps.length >= this.config.maxOrderRatePerMin) {
      this.haltTrading(`Order rate limit: ${this.killState.orderTimestamps.length}/min`);
      return false;
    }
    this.killState.orderTimestamps.push(now);
    return true;
  }

  haltTrading(reason: string): void {
    this.killState.tradingHalted = true;
    this.killState.reason = reason;
    this.killState.triggeredAt = Date.now();
    console.error(`SWING KILL SWITCH: ${reason}`);
  }

  isTradingHalted(): boolean {
    return this.killState.tradingHalted;
  }

  // ============================================================
  // Pre-trade checks for swing entries
  // ============================================================

  checkEntry(
    score: SwingScore,
    account: AccountInfo,
    positions: Position[],
    price: number
  ): SwingRiskCheckResult {
    // Kill switch
    if (this.killState.tradingHalted) {
      return { approved: false, reason: `Trading halted: ${this.killState.reason}` };
    }

    // Account blocked
    if (account.trading_blocked || account.account_blocked) {
      return { approved: false, reason: 'Account blocked' };
    }

    // Daily loss limit
    if (account.change_today_pct < 0 && Math.abs(account.change_today_pct) >= this.config.dailyLossLimitPct) {
      this.haltTrading(`Daily loss: ${account.change_today_pct.toFixed(2)}%`);
      return { approved: false, reason: `Daily loss limit: ${account.change_today_pct.toFixed(2)}%` };
    }

    // Confidence threshold (z-score based)
    if (score.compositeScore < this.config.minConfidence) {
      return { approved: false, reason: `Z-score ${score.compositeScore.toFixed(2)} below min ${this.config.minConfidence}` };
    }

    // Position count
    const currentLongs = positions.filter(p => p.side === 'long' && p.qty > 0).length;
    const existing = positions.find(p => p.symbol === score.symbol);
    if (!existing && currentLongs >= this.config.maxPositions) {
      return { approved: false, reason: `Max positions (${currentLongs}/${this.config.maxPositions})` };
    }

    // Gross exposure check
    const currentGross = positions.reduce((s, p) => s + Math.abs(p.market_value), 0);
    const currentGrossPct = account.portfolio_value > 0 ? (currentGross / account.portfolio_value) * 100 : 0;
    if (currentGrossPct >= this.config.maxGrossExposure) {
      return { approved: false, reason: `Gross exposure ${currentGrossPct.toFixed(1)}% >= max ${this.config.maxGrossExposure}%` };
    }

    // Gap-aware position sizing
    // On swing horizon, gap risk is the main enemy. Size based on volatility so
    // a worst-case gap (~3-4 sigma) doesn't destroy the position.
    const vol = score.indicators.vol20d > 0 ? score.indicators.vol20d : 0.3; // annualized
    const dailyVol = vol / Math.sqrt(252);
    // Expected worst-case gap: 3 daily sigmas
    const worstCaseGapPct = 3 * dailyVol * 100;
    // Risk budget: we accept max 1% portfolio loss per position on a gap
    const maxLossPerPosition = account.portfolio_value * 0.01;
    // Position size = maxLoss / worstCaseGap%
    const gapBasedValue = maxLossPerPosition / (worstCaseGapPct / 100);

    // Also cap at target position size and hard max
    const targetValue = account.portfolio_value * (this.config.targetPositionPct / 100);
    const maxValue = account.portfolio_value * (this.config.maxPositionPct / 100);
    const availableCash = this.config.enableMargin ? account.buying_power : account.cash;

    const positionValue = Math.min(gapBasedValue, targetValue, maxValue, availableCash * 0.95);

    if (positionValue <= 0) {
      return { approved: false, reason: `Position value is zero (gap-based: $${gapBasedValue.toFixed(0)}, target: $${targetValue.toFixed(0)})` };
    }

    const integerQty = Math.floor(positionValue / price);
    const fractionalQty = positionValue / price;
    if (fractionalQty < 0.01) {
      return { approved: false, reason: `Position too small ($${positionValue.toFixed(2)} at $${price.toFixed(2)})` };
    }
    const finalQty = integerQty >= 1 ? integerQty : Math.round(fractionalQty * 100) / 100;

    // Emergency stop loss (gap protection, not primary defense)
    // Set wider than daytrading since swings tolerate more volatility
    const stopLossPrice = price * (1 - this.config.stopLossPct / 100);

    // Transaction cost estimate
    const spreadBps = Math.min(15, Math.max(2, worstCaseGapPct * 2));
    const slippageBps = 3; // daily horizon = more liquid, less slippage
    const totalBps = spreadBps + slippageBps;
    const estimatedCosts = positionValue * (totalBps / 10000);

    // Order rate
    if (!this.recordOrder()) {
      return { approved: false, reason: 'Order rate limit' };
    }

    return {
      approved: true,
      reason: `Approved (gap-aware size: $${positionValue.toFixed(0)}, worst-case gap: ${worstCaseGapPct.toFixed(1)}%, costs: ${totalBps}bps)`,
      adjustedQty: finalQty,
      adjustedValue: positionValue,
      stopLossPrice,
      estimatedCosts,
    };
  }

  // ============================================================
  // Exit decision with hysteresis
  // ============================================================

  checkExit(
    score: SwingScore,
    position: Position,
    allScores: SwingScore[]
  ): { shouldExit: boolean; reason: string; isHysteresisSkip: boolean } {
    // Hysteresis: don't exit just because stock dropped slightly below entry threshold
    // Only exit if z-score drops below exitZScore (lower than entry threshold)
    if (score.compositeScore < this.config.exitZScore) {
      return {
        shouldExit: true,
        reason: `Z-score ${score.compositeScore.toFixed(2)} below exit threshold ${this.config.exitZScore}`,
        isHysteresisSkip: false,
      };
    }

    // Position is still above exit threshold but below entry threshold = hold (hysteresis)
    if (score.compositeScore < this.config.minConfidence && score.compositeScore >= this.config.exitZScore) {
      return {
        shouldExit: false,
        reason: `Hysteresis: z-score ${score.compositeScore.toFixed(2)} in hold zone (between exit ${this.config.exitZScore} and entry ${this.config.minConfidence})`,
        isHysteresisSkip: true,
      };
    }

    // Trailing stop: position was profitable but giving back gains
    if (position.unrealized_pl > 0 && position.unrealized_plpc < -this.config.trailingStopPct / 100) {
      return {
        shouldExit: true,
        reason: `Trailing stop: giving back ${(position.unrealized_plpc * 100).toFixed(1)}%`,
        isHysteresisSkip: false,
      };
    }

    // Hard stop loss (emergency gap protection)
    if (position.unrealized_pl < 0 && Math.abs(position.unrealized_plpc) >= this.config.stopLossPct / 100) {
      return {
        shouldExit: true,
        reason: `Stop loss: ${(position.unrealized_plpc * 100).toFixed(1)}% loss`,
        isHysteresisSkip: false,
      };
    }

    return { shouldExit: false, reason: 'Position retained', isHysteresisSkip: false };
  }

  // ============================================================
  // Turnover control
  // ============================================================

  applyTurnoverControl(
    proposedTrades: Array<{ symbol: string; side: 'buy' | 'sell'; value: number }>,
    portfolioValue: number
  ): Array<{ symbol: string; side: 'buy' | 'sell'; value: number; skipped: boolean; reason: string }> {
    const totalProposed = proposedTrades.reduce((s, t) => s + t.value, 0);
    const turnoverPct = portfolioValue > 0 ? (totalProposed / portfolioValue) * 100 : 0;

    const result = proposedTrades.map(t => {
      const tradePct = portfolioValue > 0 ? (t.value / portfolioValue) * 100 : 0;

      // Skip tiny trades (min trade size filter)
      if (tradePct < this.config.minTradeSize) {
        return { ...t, skipped: true, reason: `Below min trade size (${tradePct.toFixed(2)}% < ${this.config.minTradeSize}%)` };
      }

      return { ...t, skipped: false, reason: 'Approved' };
    });

    // If total turnover exceeds limit, prioritize sells over buys, then by score
    if (turnoverPct > this.config.maxTurnoverPct) {
      console.warn(`Turnover ${turnoverPct.toFixed(1)}% exceeds max ${this.config.maxTurnoverPct}% — applying throttle`);
    }

    return result;
  }

  // ============================================================
  // Earnings blackout check
  // ============================================================

  isEarningsBlackout(symbol: string, earningsCalendar: Map<string, string>): boolean {
    if (this.config.earningsBlackoutDays <= 0) return false;
    const earningsDate = earningsCalendar.get(symbol);
    if (!earningsDate) return false;

    const now = new Date();
    const earnings = new Date(earningsDate);
    const daysToEarnings = (earnings.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    return daysToEarnings <= this.config.earningsBlackoutDays && daysToEarnings >= -1;
  }

  // ============================================================
  // Reconciliation (shared pattern)
  // ============================================================

  checkDivergence(
    brokerPositions: Position[],
    internalPositions: Array<{ ticker: string; qty: number; side: string }>
  ): { divergent: boolean; details: string[] } {
    const details: string[] = [];
    const brokerMap = new Map(brokerPositions.map(p => [p.symbol, p]));
    const internalMap = new Map(internalPositions.map(p => [p.ticker, p]));

    for (const [symbol, bPos] of brokerMap) {
      const iPos = internalMap.get(symbol);
      if (!iPos) {
        details.push(`${symbol}: in broker but not internal (qty: ${bPos.qty})`);
      } else if (Math.abs(iPos.qty - bPos.qty) > 0.001) {
        details.push(`${symbol}: qty mismatch (internal: ${iPos.qty}, broker: ${bPos.qty})`);
      }
    }

    for (const [symbol, iPos] of internalMap) {
      if (!brokerMap.has(symbol)) {
        details.push(`${symbol}: in internal but not broker (qty: ${iPos.qty})`);
      }
    }

    return { divergent: details.length > 0, details };
  }

  // ============================================================
  // Portfolio heat
  // ============================================================

  getPortfolioHeat(positions: Position[], account: AccountInfo): number {
    const totalExposure = positions.reduce((sum, p) => sum + Math.abs(p.market_value), 0);
    return account.portfolio_value > 0 ? (totalExposure / account.portfolio_value) * 100 : 0;
  }

  isTradingHalted(): boolean {
    return this.killState.tradingHalted;
  }
}

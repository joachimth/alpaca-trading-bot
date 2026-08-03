// Risk Manager
// Enforces hard risk rules that override all AI/TA decisions
// This is the safety net — no trade executes without passing these checks

import type { AccountInfo, Position } from './alpaca';
import type { AIDecision } from './ai-decision';

export interface RiskConfig {
  maxPositions: number;
  maxPositionPct: number;       // max % of portfolio per single position
  stopLossPct: number;          // stop loss percentage
  takeProfitPct: number;        // take profit percentage
  trailingStopPct: number;      // trailing stop percentage
  dailyLossLimitPct: number;    // stop trading if down this much on the day
  minConfidence: number;        // minimum AI confidence to act
  enableMargin: boolean;
  eodFlatten: boolean;          // close all positions before EOD
}

export interface RiskCheckResult {
  approved: boolean;
  reason: string;
  adjustedQty?: number;         // if position size needs reduction
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPct?: number;
}

export class RiskManager {
  private config: RiskConfig;

  constructor(config: RiskConfig) {
    this.config = config;
  }

  // ============================================================
  // Pre-trade checks
  // ============================================================

  checkTrade(
    decision: AIDecision,
    account: AccountInfo,
    positions: Position[],
    price: number
  ): RiskCheckResult {
    // 1. Account blocked?
    if (account.trading_blocked || account.account_blocked) {
      return { approved: false, reason: 'Account is blocked from trading' };
    }

    // 2. Daily loss limit hit?
    if (account.change_today_pct < 0 && Math.abs(account.change_today_pct) >= this.config.dailyLossLimitPct) {
      return { approved: false, reason: `Daily loss limit reached (${account.change_today_pct.toFixed(2)}%)` };
    }

    // 3. Confidence threshold
    if (decision.confidence < this.config.minConfidence) {
      return { approved: false, reason: `Confidence ${decision.confidence.toFixed(2)} below minimum ${this.config.minConfidence}` };
    }

    // 4. Position count limit (for new buys)
    if (decision.action === 'BUY') {
      const currentLongs = positions.filter(p => p.side === 'long' && p.qty > 0).length;
      const existingPosition = positions.find(p => p.symbol === decision.taSignal.indicators.symbol);

      if (!existingPosition && currentLongs >= this.config.maxPositions) {
        return { approved: false, reason: `Max positions reached (${currentLongs}/${this.config.maxPositions})` };
      }
    }

    // 5. Position size calculation
    const maxPositionValue = account.portfolio_value * (this.config.maxPositionPct / 100);
    const availableCash = this.config.enableMargin ? account.buying_power : account.cash;

    if (availableCash <= 0) {
      return { approved: false, reason: 'No available cash/buying power' };
    }

    // Calculate position size based on risk
    const riskAmount = Math.min(maxPositionValue, availableCash * 0.95);
    const maxQty = Math.floor(riskAmount / price);

    if (maxQty < 1) {
      // Try fractional shares
      const fractionalQty = riskAmount / price;
      if (fractionalQty < 0.01) {
        return { approved: false, reason: `Position size too small (max $${riskAmount.toFixed(2)} at $${price.toFixed(2)}` };
      }
    }

    // 6. Stop loss and take profit
    const stopLossPrice = decision.action === 'BUY'
      ? price * (1 - this.config.stopLossPct / 100)
      : undefined;
    const takeProfitPrice = decision.action === 'BUY'
      ? price * (1 + this.config.takeProfitPct / 100)
      : undefined;

    return {
      approved: true,
      reason: 'Approved',
      adjustedQty: Math.max(0.01, maxQty),
      stopLossPrice,
      takeProfitPrice,
      trailingStopPct: this.config.trailingStopPct,
    };
  }

  // ============================================================
  // Position management: check if positions need to be closed
  // ============================================================

  checkPositions(positions: Position[]): Array<{ symbol: string; reason: string; priority: 'critical' | 'high' | 'medium' }> {
    const actions: Array<{ symbol: string; reason: string; priority: 'critical' | 'high' | 'medium' }> = [];

    for (const pos of positions) {
      if (pos.qty <= 0) continue;

      // Stop loss check
      const stopLossPct = this.config.stopLossPct / 100;
      const lossPct = Math.abs(pos.unrealized_plpc);
      if (pos.unrealized_pl < 0 && lossPct >= stopLossPct) {
        actions.push({
          symbol: pos.symbol,
          reason: `Stop loss triggered: ${lossPct >= 1 ? (lossPct * 100).toFixed(1) : (lossPct * 100).toFixed(1)}% loss`,
          priority: 'critical',
        });
        continue;
      }

      // Take profit check
      const takeProfitPct = this.config.takeProfitPct / 100;
      if (pos.unrealized_pl > 0 && pos.unrealized_plpc >= takeProfitPct) {
        actions.push({
          symbol: pos.symbol,
          reason: `Take profit triggered: +${(pos.unrealized_plpc * 100).toFixed(1)}% gain`,
          priority: 'high',
        });
        continue;
      }

      // Trailing stop: if position was up significantly and now giving back gains
      if (pos.unrealized_pl > 0 && pos.change_today_pct < -this.config.trailingStopPct) {
        actions.push({
          symbol: pos.symbol,
          reason: `Trailing stop: giving back ${pos.change_today_pct.toFixed(1)}% today`,
          priority: 'high',
        });
        continue;
      }

      // Stale position (held too long for daytrading)
      // We'll let the AI decide on these, but flag them
      if (pos.unrealized_plpc > -0.02 && pos.unrealized_plpc < 0.02) {
        actions.push({
          symbol: pos.symbol,
          reason: `Position flat (${(pos.unrealized_plpc * 100).toFixed(1)}%) — review for exit`,
          priority: 'medium',
        });
      }
    }

    return actions;
  }

  // ============================================================
  // EOD flatten: close all positions before market close
  // ============================================================

  shouldFlattenEOD(minutesToClose: number): boolean {
    if (!this.config.eodFlatten) return false;
    return minutesToClose <= 15; // Start closing 15 min before market close
  }

  // ============================================================
  // Portfolio heat: total risk exposure
  // ============================================================

  getPortfolioHeat(positions: Position[], account: AccountInfo): number {
    const totalExposure = positions.reduce((sum, p) => sum + Math.abs(p.market_value), 0);
    return account.portfolio_value > 0 ? (totalExposure / account.portfolio_value) * 100 : 0;
  }

  // ============================================================
  // Validate config
  // ============================================================

  validateConfig(): string[] {
    const errors: string[] = [];
    if (this.config.maxPositions < 1) errors.push('maxPositions must be >= 1');
    if (this.config.maxPositionPct < 1 || this.config.maxPositionPct > 100) errors.push('maxPositionPct must be 1-100');
    if (this.config.stopLossPct < 1 || this.config.stopLossPct > 50) errors.push('stopLossPct must be 1-50');
    if (this.config.takeProfitPct < 1) errors.push('takeProfitPct must be >= 1');
    if (this.config.dailyLossLimitPct < 1 || this.config.dailyLossLimitPct > 50) errors.push('dailyLossLimitPct must be 1-50');
    if (this.config.minConfidence < 0 || this.config.minConfidence > 1) errors.push('minConfidence must be 0-1');
    return errors;
  }
}

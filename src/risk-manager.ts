// Risk Manager
// Enforces hard risk rules that override all AI/TA decisions
// This is the safety net — no trade executes without passing these checks
//
// Research-based design (López de Prado, Carver):
// - ATR-scaled stop loss/take profit (not fixed percentages)
// - Volatility-targeting for position sizing
// - Transaction cost estimation before every trade
// - Multiple kill switches including rolling drawdown and position divergence

import type { AccountInfo, Position } from './alpaca';
import type { AIDecision } from './ai-decision';
import type { TAIndicators } from './technical-analysis';

export interface RiskConfig {
  maxPositions: number;
  maxPositionPct: number;         // max % of trading capital per single position (hard cap)
  stopLossATRMultiplier: number;  // stop loss = entry - X * ATR (default 1.5)
  takeProfitATRMultiplier: number;// take profit = entry + X * ATR (default 2.0)
  trailingStopPct: number;        // trailing stop percentage (simplified, not ATR)
  dailyLossLimitPct: number;      // stop trading if down this much on the day
  rollingDrawdownLimitPct: number;// stop trading if 20-period drawdown exceeds this
  minConfidence: number;          // minimum AI confidence to act
  enableMargin: boolean;
  eodFlatten: boolean;            // close all positions before EOD
  targetVolatilityPct: number;    // target daily portfolio vol (for position sizing)
  maxOrderRatePerMin: number;     // kill switch: max orders per minute
  minEdgeAfterCosts: number;      // minimum expected return after estimated costs (bps)
  observedFeeBps?: number;         // broker-observed fee rate added to estimated costs
  maxCapitalUsd: number;          // hard cap on total daytrading capital (0 = use full account)
}

export interface RiskCheckResult {
  approved: boolean;
  reason: string;
  adjustedQty?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPct?: number;
  estimatedCosts?: number;        // estimated transaction costs in $
  edgeAfterCosts?: number;        // expected edge after costs in $
}

export interface KillSwitchState {
  tradingHalted: boolean;
  reason: string;
  triggeredAt: number | null;
  // Rolling tracking
  equityHistory: number[];        // recent equity snapshots for drawdown calc
  orderTimestamps: number[];      // recent order submission times
}

export class RiskManager {
  private config: RiskConfig;
  private killState: KillSwitchState;

  constructor(config: RiskConfig) {
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
  // Kill switch management
  // ============================================================

  updateEquitySnapshot(equity: number): void {
    this.killState.equityHistory.push(equity);
    // Keep last 20 snapshots (~100 minutes at 5-min cadence)
    if (this.killState.equityHistory.length > 20) {
      this.killState.equityHistory.shift();
    }

    // Check rolling drawdown
    if (this.killState.equityHistory.length >= 5) {
      const peak = Math.max(...this.killState.equityHistory);
      const current = equity;
      const drawdownPct = peak > 0 ? ((peak - current) / peak) * 100 : 0;

      if (drawdownPct >= this.config.rollingDrawdownLimitPct) {
        this.haltTrading(`Rolling drawdown limit reached: ${drawdownPct.toFixed(2)}%`);
      }
    }
  }

  recordOrder(): boolean {
    const now = Date.now();
    // Clean old timestamps (older than 60 seconds)
    this.killState.orderTimestamps = this.killState.orderTimestamps.filter(
      t => now - t < 60000
    );

    // Check rate limit
    if (this.killState.orderTimestamps.length >= this.config.maxOrderRatePerMin) {
      this.haltTrading(`Order rate limit exceeded: ${this.killState.orderTimestamps.length} orders/min`);
      return false;
    }

    this.killState.orderTimestamps.push(now);
    return true;
  }

  haltTrading(reason: string): void {
    this.killState.tradingHalted = true;
    this.killState.reason = reason;
    this.killState.triggeredAt = Date.now();
    console.error(`KILL SWITCH TRIGGERED: ${reason}`);
  }

  isTradingHalted(): boolean {
    return this.killState.tradingHalted;
  }

  getKillState(): KillSwitchState {
    return { ...this.killState };
  }

  // ============================================================
  // Pre-trade checks
  // ============================================================

  checkTrade(
    decision: AIDecision,
    account: AccountInfo,
    positions: Position[],
    indicators: TAIndicators
  ): RiskCheckResult {
    const price = indicators.price;

    // 0. Kill switch check
    if (this.killState.tradingHalted) {
      return { approved: false, reason: `Trading halted: ${this.killState.reason}` };
    }

    // 1. Account blocked?
    if (account.trading_blocked || account.account_blocked) {
      return { approved: false, reason: 'Account is blocked from trading' };
    }

    // 2. Daily loss limit hit?
    if (account.change_today_pct < 0 && Math.abs(account.change_today_pct) >= this.config.dailyLossLimitPct) {
      this.haltTrading(`Daily loss limit reached (${account.change_today_pct.toFixed(2)}%)`);
      return { approved: false, reason: `Daily loss limit reached (${account.change_today_pct.toFixed(2)}%)` };
    }

    // 3. Confidence threshold
    if (decision.confidence < this.config.minConfidence) {
      return { approved: false, reason: `Confidence ${decision.confidence.toFixed(2)} below minimum ${this.config.minConfidence}` };
    }

    // 4. Position count limit (for new buys)
    if (decision.action === 'BUY') {
      const currentLongs = positions.filter(p => p.side === 'long' && p.qty > 0).length;
      const existingPosition = positions.find(p => p.symbol === indicators.symbol);

      if (!existingPosition && currentLongs >= this.config.maxPositions) {
        return { approved: false, reason: `Max positions reached (${currentLongs}/${this.config.maxPositions})` };
      }
    }

    // 5. Transaction cost estimation. The bps gate is evaluated before sizing,
    // while the dollar amount is recalculated after the final quantity exists.
    const costRate = this.estimateTransactionCosts(price, indicators, 1);
    const edgeBps = decision.confidence * 100; // conservative confidence-derived edge proxy
    const edgeAfterCosts = edgeBps - costRate.bps;

    if (edgeAfterCosts < this.config.minEdgeAfterCosts) {
      return {
        approved: false,
        reason: `Edge after costs insufficient: ${edgeAfterCosts.toFixed(1)}bps < ${this.config.minEdgeAfterCosts}bps (est. costs: ${costRate.bps}bps)`,
        estimatedCosts: costRate.dollar,
        edgeAfterCosts,
      };
    }

    // 6. Volatility-targeting position sizing
    // Determine trading capital: use maxCapitalUsd if set, otherwise full account
    const tradingCapital = this.config.maxCapitalUsd > 0
      ? Math.min(this.config.maxCapitalUsd, account.portfolio_value)
      : account.portfolio_value;

    const maxPositionValue = tradingCapital * (this.config.maxPositionPct / 100);
    // Available cash: respect the capital cap
    const currentGross = positions.reduce((s, p) => s + Math.abs(p.market_value), 0);
    const capRemaining = this.config.maxCapitalUsd > 0
      ? Math.max(0, this.config.maxCapitalUsd - currentGross)
      : Infinity;
    const availableCash = this.config.enableMargin
      ? Math.min(account.buying_power, capRemaining)
      : Math.min(account.cash, capRemaining);

    if (availableCash <= 0) {
      return { approved: false, reason: 'No available cash within capital cap' };
    }

    // Volatility-targeting: size inversely proportional to ATR%
    // Higher volatility = smaller position. Target constant risk.
    const atrPct = indicators.atrPct > 0 ? indicators.atrPct : 2.0; // fallback 2%
    const volScale = Math.min(1.0, this.config.targetVolatilityPct / atrPct);
    const volScaledValue = maxPositionValue * volScale;
    const riskAmount = Math.min(volScaledValue, availableCash * 0.95);

    if (riskAmount <= 0) {
      return { approved: false, reason: `Position value after vol-scaling is zero (ATR%: ${atrPct.toFixed(2)}, target vol: ${this.config.targetVolatilityPct}%, cap remaining: $${capRemaining.toFixed(0)})` };
    }

    const integerQty = Math.floor(riskAmount / price);
    const fractionalQty = riskAmount / price;

    if (fractionalQty < 0.01) {
      return { approved: false, reason: `Position size too small (max $${riskAmount.toFixed(2)} at $${price.toFixed(2)}` };
    }

    const finalQty = integerQty >= 1 ? integerQty : Math.round(fractionalQty * 100) / 100;

    // 7. ATR-scaled stop loss and take profit
    // Stop = entry - (ATR multiplier * ATR)
    // Target = entry + (ATR multiplier * ATR)
    // This adapts to current volatility regime
    const atrValue = indicators.atr > 0 ? indicators.atr : price * 0.02; // fallback 2% of price
    const stopLossPrice = decision.action === 'BUY'
      ? price - (this.config.stopLossATRMultiplier * atrValue)
      : undefined;
    const takeProfitPrice = decision.action === 'BUY'
      ? price + (this.config.takeProfitATRMultiplier * atrValue)
      : undefined;

    const estimatedCosts = this.estimateTransactionCosts(price, indicators, finalQty);

    // 8. Order rate check
    if (!this.recordOrder()) {
      return { approved: false, reason: 'Order rate limit exceeded' };
    }

    return {
      approved: true,
      reason: `Approved (vol-scaled ${(volScale * 100).toFixed(0)}%, ATR stop ${this.config.stopLossATRMultiplier}x, costs ${estimatedCosts.bps.toFixed(1)}bps / $${estimatedCosts.dollar.toFixed(2)})`,
      adjustedQty: finalQty,
      stopLossPrice,
      takeProfitPrice,
      trailingStopPct: this.config.trailingStopPct,
      estimatedCosts: estimatedCosts.dollar,
      edgeAfterCosts,
    };
  }

  /**
   * Evaluate a discretionary exit against the estimated exit cost. Losing
   * positions remain eligible for risk reduction; profitable exits are not
   * approved when the expected exit fee/slippage consumes the gross profit.
   */
  checkExitCost(position: Position, indicators: TAIndicators, protective = false): RiskCheckResult {
    const estimatedCosts = this.estimateTransactionCosts(indicators.price, indicators, position.qty);
    const edgeAfterCosts = position.unrealized_pl - estimatedCosts.dollar;
    if (!protective && position.unrealized_pl > 0 && edgeAfterCosts <= 0) {
      return {
        approved: false,
        reason: `Exit skipped: gross P&L $${position.unrealized_pl.toFixed(2)} does not cover estimated exit costs $${estimatedCosts.dollar.toFixed(2)}`,
        estimatedCosts: estimatedCosts.dollar,
        edgeAfterCosts,
      };
    }
    return {
      approved: true,
      reason: `${protective ? 'Protective' : 'Discretionary'} exit cost check: est. $${estimatedCosts.dollar.toFixed(2)}, net mark $${edgeAfterCosts.toFixed(2)}`,
      estimatedCosts: estimatedCosts.dollar,
      edgeAfterCosts,
    };
  }

  // ============================================================
  // Transaction cost estimation
  // ============================================================

  private estimateTransactionCosts(price: number, indicators: TAIndicators, qty = 1): { bps: number; dollar: number } {
    // Spread cost: estimate from ATR (higher vol = wider spread)
    // Typical US large cap spread: 1-5 bps. Scale with volatility.
    const spreadBps = Math.min(10, Math.max(1, indicators.atrPct * 1.5));

    // Slippage: depends on order size relative to volume
    // Without ADV data, use volume ratio as proxy
    const slippageBps = indicators.volumeRatio > 2 ? 2 : 5;

    // Alpaca commission: $0 for US equities
    const commissionBps = 0;

    // SEC/FINRA fees: ~$0.01 per $10k traded = ~0.1 bps
    const regulatoryBps = 0.1;
    const observedFeeBps = this.config.observedFeeBps ?? 0;

    // Include broker-observed fees in addition to spread/slippage assumptions.
    const totalBps = spreadBps + slippageBps + commissionBps + regulatoryBps + observedFeeBps;

    // Convert the rate into the total estimated order cost.
    const dollar = Math.abs(price * qty) * (totalBps / 10000);

    return { bps: totalBps, dollar };
  }

  // ============================================================
  // Position management: check if positions need to be closed
  // Uses ATR-scaled thresholds from DB-stored stop/target prices
  // ============================================================

  checkPositions(
    positions: Position[],
    dbPositions: Array<{ ticker: string; stop_loss_price: number | null; take_profit_price: number | null; opened_at: string }>
  ): Array<{ symbol: string; reason: string; priority: 'critical' | 'high' | 'medium' }> {
    const actions: Array<{ symbol: string; reason: string; priority: 'critical' | 'high' | 'medium' }> = [];

    // Build lookup for DB-stored stop/target
    const stopMap = new Map(dbPositions.map(p => [p.ticker, p]));

    for (const pos of positions) {
      if (pos.qty <= 0) continue;

      const dbPos = stopMap.get(pos.symbol);
      const stopLossPrice = dbPos?.stop_loss_price;
      const takeProfitPrice = dbPos?.take_profit_price;

      // ATR-based stop loss: check if current price hits stored stop
      if (stopLossPrice && pos.current_price <= stopLossPrice) {
        actions.push({
          symbol: pos.symbol,
          reason: `ATR stop loss hit: price $${pos.current_price.toFixed(2)} <= stop $${stopLossPrice.toFixed(2)}`,
          priority: 'critical',
        });
        continue;
      }

      // ATR-based take profit: check if current price hits stored target
      if (takeProfitPrice && pos.current_price >= takeProfitPrice) {
        actions.push({
          symbol: pos.symbol,
          reason: `ATR take profit hit: price $${pos.current_price.toFixed(2)} >= target $${takeProfitPrice.toFixed(2)}`,
          priority: 'high',
        });
        continue;
      }

      // Fallback: percentage-based stop loss (if no ATR stop stored)
      if (!stopLossPrice) {
        const lossPct = Math.abs(pos.unrealized_plpc);
        if (pos.unrealized_pl < 0 && lossPct >= 0.08) {
          actions.push({
            symbol: pos.symbol,
            reason: `Fallback stop loss: ${(lossPct * 100).toFixed(1)}% loss`,
            priority: 'critical',
          });
          continue;
        }
      }

      // Trailing stop: giving back gains intraday
      if (pos.unrealized_pl > 0 && pos.change_today_pct < -this.config.trailingStopPct) {
        actions.push({
          symbol: pos.symbol,
          reason: `Trailing stop: giving back ${pos.change_today_pct.toFixed(1)}% today`,
          priority: 'high',
        });
        continue;
      }

      // Stale position flag
      if (pos.unrealized_plpc > -0.02 && pos.unrealized_plpc < 0.02) {
        actions.push({
          symbol: pos.symbol,
          reason: `Position flat (${(pos.unrealized_plpc * 100).toFixed(1)}%) - review for exit`,
          priority: 'medium',
        });
      }
    }

    return actions;
  }

  // ============================================================
  // Position divergence detection (reconciliation)
  // ============================================================

  checkDivergence(
    brokerPositions: Position[],
    internalPositions: Array<{ ticker: string; qty: number; side: string }>
  ): { divergent: boolean; details: string[] } {
    const details: string[] = [];
    const brokerMap = new Map(brokerPositions.map(p => [p.symbol, p]));
    const internalMap = new Map(internalPositions.map(p => [p.ticker, p]));

    // Check: in broker but not in internal
    for (const [symbol, bPos] of brokerMap) {
      const iPos = internalMap.get(symbol);
      if (!iPos) {
        details.push(`${symbol}: in broker but not internal (qty: ${bPos.qty})`);
      } else if (Math.abs(iPos.qty - bPos.qty) > 0.001) {
        details.push(`${symbol}: qty mismatch (internal: ${iPos.qty}, broker: ${bPos.qty})`);
      }
    }

    // Check: in internal but not in broker
    for (const [symbol, iPos] of internalMap) {
      if (!brokerMap.has(symbol)) {
        details.push(`${symbol}: in internal but not broker (qty: ${iPos.qty})`);
      }
    }

    return { divergent: details.length > 0, details };
  }

  // ============================================================
  // EOD flatten
  // ============================================================

  shouldFlattenEOD(minutesToClose: number): boolean {
    if (!this.config.eodFlatten) return false;
    return minutesToClose <= 15;
  }

  // ============================================================
  // Portfolio heat
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
    if (this.config.stopLossATRMultiplier < 0.5 || this.config.stopLossATRMultiplier > 5) errors.push('stopLossATRMultiplier must be 0.5-5');
    if (this.config.takeProfitATRMultiplier < 0.5 || this.config.takeProfitATRMultiplier > 10) errors.push('takeProfitATRMultiplier must be 0.5-10');
    if (this.config.dailyLossLimitPct < 1 || this.config.dailyLossLimitPct > 50) errors.push('dailyLossLimitPct must be 1-50');
    if (this.config.rollingDrawdownLimitPct < 1 || this.config.rollingDrawdownLimitPct > 50) errors.push('rollingDrawdownLimitPct must be 1-50');
    if (this.config.minConfidence < 0 || this.config.minConfidence > 1) errors.push('minConfidence must be 0-1');
    if (this.config.targetVolatilityPct < 0.5 || this.config.targetVolatilityPct > 10) errors.push('targetVolatilityPct must be 0.5-10');
    if (this.config.maxOrderRatePerMin < 1) errors.push('maxOrderRatePerMin must be >= 1');
    return errors;
  }
}

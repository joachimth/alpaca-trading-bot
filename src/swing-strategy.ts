// Swing Trading Strategy Cycle
// Runs once daily after US market close
// Cross-sectional ranking: computes alpha scores for entire universe, rebalances portfolio

import { AlpacaClient } from './alpaca';
import { Database } from './database';
import { UniverseScanner } from './scanner';
import {
  computeSwingIndicators,
  scoreAndRank,
  filterUniverse,
  DEFAULT_SWING_CONFIG,
  type SwingConfig,
  type SwingScore,
} from './swing-signals';
import { SwingRiskManager, type SwingRiskConfig } from './swing-risk';
import { projectBrokerPositions, summarizeByCategory } from './position-projection';
import type { Env } from './index';

const SWING_FALLBACK_CONFIG = {
  ...DEFAULT_SWING_CONFIG,
  // Risk config
  maxPositions: 30,
  maxPositionPct: 5,        // 5% max per position (gap protection via diversification)
  targetPositionPct: 3.33,  // ~30 positions = 3.33% each
  maxGrossExposure: 100,    // no margin on swing by default
  stopLossPct: 15,          // wider stop (overnight gaps)
  trailingStopPct: 8,
  dailyLossLimitPct: 5,
  rollingDrawdownLimitPct: 15,
  minConfidence: 0.5,       // z-score threshold for entry
  exitZScore: -0.5,         // hysteresis: exit below -0.5 sigma
  enableMargin: false,      // no margin on swing (gap risk + margin = ruin)
  earningsBlackoutDays: 3,
  maxTurnoverPct: 30,       // max 30% of portfolio traded per rebalance
  minTradeSize: 0.25,       // skip trades < 0.25% of portfolio
  maxOrderRatePerMin: 15,
  maxCapitalUsd: 3700,      // ~25,000 DKK cap for swing strategy
};

export async function runSwingCycle(env: Env, trigger: string): Promise<void> {
  const owner = `swing:${trigger}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const leaseDb = new Database(env.DB);
  if (!await leaseDb.acquireCycleLease(owner)) {
    console.log(`Skipping ${trigger}: another strategy cycle holds the global lease`);
    return;
  }
  try {
    await runSwingCycleInner(env, trigger);
  } finally {
    await leaseDb.releaseCycleLease(owner);
  }
}

async function runSwingCycleInner(env: Env, trigger: string): Promise<void> {
  void trigger;
  const startTime = Date.now();
  const db = new Database(env.DB);
  const errors: string[] = [];
  let decisionsMade = 0;
  let tradesExecuted = 0;

  try {
    const alpaca = new AlpacaClient({
      apiKey: env.ALPACA_API_KEY,
      apiSecret: env.ALPACA_API_SECRET,
      baseUrl: env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });

    // Load swing config from D1 (merge with fallback)
    const dbConfig = await db.getConfig();
    const config = { ...SWING_FALLBACK_CONFIG };
    for (const [key, value] of Object.entries(dbConfig)) {
      if (key.startsWith('swing_')) {
        const cleanKey = key.replace('swing_', '');
        const numVal = parseFloat(value);
        if (!isNaN(numVal) && cleanKey in config) {
          (config as any)[cleanKey] = numVal;
        } else if (value === 'true' && cleanKey in config) {
          (config as any)[cleanKey] = true;
        } else if (value === 'false' && cleanKey in config) {
          (config as any)[cleanKey] = false;
        }
      }
    }

    // Check market status — swing runs after close
    const clock = await alpaca.getClock();
    // Swing can run whether market is open or closed (we compute after close)
    // But we only run once per day — check if we already ran today
    const today = new Date().toISOString().split('T')[0];
    const recentRuns = await db.getRecentRuns(5);
    const alreadyRanToday = recentRuns.some((r: any) =>
      (r.trigger === 'swing_cron' || r.trigger === 'manual_swing') && r.timestamp.startsWith(today) && r.status === 'ok'
    );
    if (alreadyRanToday) {
      console.log('Swing: already ran today, skipping');
      await db.logRun({
        trigger: 'swing_cron',
        market_open: clock.is_open ? 1 : 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: 0,
        error_details: null,
        status: 'skipped',
      });
      return;
    }

    // Reconcile broker orders before evaluating swing positions.
    await db.reconcileOrders(await alpaca.getRecentOrders(100));

    // Swing may only manage positions explicitly tagged as swing.
    const account = await alpaca.getAccount();
    const allBrokerPositions = await alpaca.getPositions();
    const allDbPositions = await db.getOpenPositions();
    const swingSymbols = new Set(allDbPositions.filter(p => p.strategy === 'swing').map(p => p.ticker));
    const positions = allBrokerPositions.filter(p => swingSymbols.has(p.symbol));

    // Log performance snapshot (shared table, tagged via trigger)
    await db.logSnapshot({
      account_id: account.id,
      equity: account.equity,
      cash: account.cash,
      buying_power: account.buying_power,
      portfolio_value: account.portfolio_value,
      long_market_value: account.long_market_value,
      short_market_value: account.short_market_value,
      positions_count: positions.length,
      daily_pl: account.change_today,
      daily_plpc: account.change_today_pct,
      total_pl: account.equity - account.last_equity,
      total_plpc: account.last_equity > 0 ? ((account.equity - account.last_equity) / account.last_equity) * 100 : 0,
    });

    // Log per-category market value & P&L from broker-authoritative
    // positions (non-fatal — must not block the swing cycle itself).
    try {
      const categoryProjections = projectBrokerPositions(allBrokerPositions, allDbPositions);
      await db.logCategorySnapshots(summarizeByCategory(categoryProjections));
    } catch (e) {
      console.error('Category snapshot logging failed:', e);
    }

    // Initialize risk manager
    const riskConfig: SwingRiskConfig = {
      maxPositions: config.maxPositions,
      maxPositionPct: config.maxPositionPct,
      targetPositionPct: config.targetPositionPct,
      maxSectorPct: 20,
      maxGrossExposure: config.maxGrossExposure,
      stopLossPct: config.stopLossPct,
      trailingStopPct: config.trailingStopPct,
      dailyLossLimitPct: config.dailyLossLimitPct,
      rollingDrawdownLimitPct: config.rollingDrawdownLimitPct,
      minConfidence: config.minConfidence,
      exitZScore: config.exitZScore,
      enableMargin: config.enableMargin,
      earningsBlackoutDays: config.earningsBlackoutDays,
      maxTurnoverPct: config.maxTurnoverPct,
      minTradeSize: config.minTradeSize,
      maxOrderRatePerMin: config.maxOrderRatePerMin,
      maxCapitalUsd: config.maxCapitalUsd || 0,
    };
    const riskManager = new SwingRiskManager(riskConfig);
    riskManager.updateEquitySnapshot(account.equity);

    // Reconciliation
    const dbPositions = allDbPositions.filter(p => p.strategy === 'swing');
    const divergence = riskManager.checkDivergence(
      positions,
      dbPositions.map(p => ({ ticker: p.ticker, qty: p.qty, side: p.side }))
    );
    if (divergence.divergent) {
      errors.push(`Position divergence: ${divergence.details.join('; ')}`);
      riskManager.haltTrading(`Divergence: ${divergence.details.join('; ')}`);
    }

    if (riskManager.isTradingHalted()) {
      console.error(`Swing: trading halted — ${riskManager.isTradingHalted()}`);
      await db.logRun({
        trigger: 'swing_cron',
        market_open: clock.is_open ? 1 : 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: errors.length,
        error_details: errors.length > 0 ? JSON.stringify(errors) : null,
        status: 'error',
      });
      return;
    }

    // Scan universe — swing uses daily bars, needs more history
    const scanner = new UniverseScanner(alpaca, config.maxPositions * 5); // scan 5x what we'll hold
    const candidates = await scanner.scan();
    console.log(`Swing: scanning ${candidates.length} candidates`);

    // Compute swing indicators for all candidates (parallel, daily bars, 300 bars = ~1.2 years)
    const indicatorPromises = candidates.map(async symbol => {
      try {
        const bars = await alpaca.getBars(symbol, '1Day', 300);
        if (bars.length < 60) return null;
        return computeSwingIndicators(bars, symbol);
      } catch (e) {
        console.error(`Swing: indicator failed for ${symbol}:`, e);
        return null;
      }
    });

    const indicatorResults = await Promise.all(indicatorPromises);
    const validIndicators = indicatorResults.filter((i): i is NonNullable<typeof i> => i !== null);

    // Filter universe by liquidity
    const filtered = filterUniverse(validIndicators, config);
    console.log(`Swing: ${filtered.length} stocks passed universe filter`);

    if (filtered.length < 20) {
      errors.push(`Universe too small after filtering: ${filtered.length} stocks`);
      await db.logRun({
        trigger: 'swing_cron',
        market_open: clock.is_open ? 1 : 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: errors.length,
        error_details: JSON.stringify(errors),
        status: 'error',
      });
      return;
    }

    // Cross-sectional ranking
    const ranked = scoreAndRank(filtered, config);
    console.log(`Swing: ranked ${ranked.length} stocks. Top: ${ranked.slice(0, 5).map(s => `${s.symbol}(${s.compositeScore.toFixed(2)})`).join(', ')}`);

    // Determine buy candidates (top percentile) and exit candidates
    const buyCandidates = ranked.filter(s => s.percentile <= config.topPercentile);
    const allScores = new Map(ranked.map(s => [s.symbol, s]));

    // ============================================================
    // Phase 1: Check exits for held positions
    // ============================================================

    const proposedSells: Array<{ symbol: string; value: number; reason: string }> = [];

    for (const pos of positions) {
      if (pos.qty <= 0) continue;
      const score = allScores.get(pos.symbol);

      if (!score) {
        // Stock not in current universe (could be delisted, illiquid, etc.) — exit
        proposedSells.push({ symbol: pos.symbol, value: Math.abs(pos.market_value), reason: 'Not in current universe' });
        decisionsMade++;
        continue;
      }

      const exitCheck = riskManager.checkExit(score, pos, ranked);
      decisionsMade++;

      // Log decision
      await db.logDecision({
        ticker: pos.symbol,
        action: exitCheck.shouldExit ? 'SELL' : 'HOLD',
        confidence: score.compositeScore,
        signal_source: 'swing',
        reason: exitCheck.reason,
        ta_data: JSON.stringify(score.indicators),
        ai_reasoning: JSON.stringify({
          rank: score.rank,
          percentile: score.percentile,
          signals: score.signals,
          reversal: score.reversalScore,
          momentum: score.momentumScore,
          proximity: score.proximityScore,
          isHysteresis: exitCheck.isHysteresisSkip,
        }),
        price_at_decision: pos.current_price,
        executed: 0,
        execution_reason: '',
      });

      if (exitCheck.shouldExit) {
        proposedSells.push({ symbol: pos.symbol, value: Math.abs(pos.market_value), reason: exitCheck.reason });
      }
    }

    // Execute sells
    for (const sell of proposedSells) {
      try {
        const pos = positions.find(p => p.symbol === sell.symbol);
        const order = await alpaca.closePosition(sell.symbol);
        await db.logOrderTrade(order, { strategy: 'swing' });
        if (pos && alpaca.isOrderFullyFilled(order)) {
          await db.closePosition(sell.symbol, pos.unrealized_pl, sell.reason);
          tradesExecuted++;
        } else if (pos) {
          errors.push(`Swing exit not fully filled ${sell.symbol}: ${order.status}`);
        }

        console.log(`Swing SELL ${sell.symbol}: ${sell.reason}`);
      } catch (e) {
        errors.push(`Swing sell failed ${sell.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // ============================================================
    // Phase 2: Execute buys for top-ranked candidates
    // ============================================================

    // Refresh account after sells
    const updatedAccount = await alpaca.getAccount();
    const updatedAllPositions = await alpaca.getPositions();
    const updatedPositions = updatedAllPositions.filter(p => swingSymbols.has(p.symbol));
    // Never buy a symbol already held by another strategy.
    const heldSymbols = new Set(updatedAllPositions.map(p => p.symbol));

    const proposedBuys: Array<{ symbol: string; value: number; score: SwingScore }> = [];

    for (const score of buyCandidates) {
      // Skip if already holding
      if (heldSymbols.has(score.symbol)) continue;

      // Earnings blackout (placeholder — would need earnings calendar API)
      // const earningsCal = new Map(); // TODO: integrate earnings calendar
      // if (riskManager.isEarningsBlackout(score.symbol, earningsCal)) continue;

      const price = score.indicators.price;
      const riskCheck = riskManager.checkEntry(score, updatedAccount, updatedPositions, price);
      decisionsMade++;

      if (riskCheck.approved && riskCheck.adjustedQty) {
        proposedBuys.push({ symbol: score.symbol, value: riskCheck.adjustedValue || 0, score });
      }
    }

    // Apply turnover control
    const allProposedTrades = [
      ...proposedSells.map(s => ({ symbol: s.symbol, side: 'sell' as const, value: s.value })),
      ...proposedBuys.map(b => ({ symbol: b.symbol, side: 'buy' as const, value: b.value })),
    ];
    // Use swing capital for turnover calculation if cap is set
    const turnoverBase = config.maxCapitalUsd > 0
      ? Math.min(config.maxCapitalUsd, updatedAccount.portfolio_value)
      : updatedAccount.portfolio_value;
    const turnoverFiltered = riskManager.applyTurnoverControl(allProposedTrades, turnoverBase);

    // Execute buys (respecting turnover control)
    const buyTradeMap = new Map(turnoverFiltered.filter(t => t.side === 'buy').map(t => [t.symbol, t]));

    for (const buy of proposedBuys) {
      const tradeInfo = buyTradeMap.get(buy.symbol);
      if (tradeInfo?.skipped) {
        console.log(`Swing: skip buy ${buy.symbol}: ${tradeInfo.reason}`);
        continue;
      }

      const price = buy.score.indicators.price;
      const qty = Math.floor((buy.value) / price) || Math.round((buy.value / price) * 100) / 100;
      if (qty < 0.01) continue;

      try {
        const order = await alpaca.submitOrder({
          symbol: buy.symbol,
          qty: qty,
          side: 'buy',
          type: 'market',
          time_in_force: 'day',
          client_order_id: `swing_${Date.now()}_${buy.symbol}`,
        });

        await db.logTrade({
          alpaca_order_id: order.id,
          ticker: buy.symbol,
          side: 'buy',
          qty: qty,
          fill_price: null,
          avg_fill_price: null,
          status: order.status,
          order_type: 'market',
          limit_price: null,
          stop_price: null,
          estimated_value: qty * price,
          decision_id: null,
          error_message: null,
          strategy: 'swing',
        });

        // Update position in DB
        await db.upsertPosition({
          ticker: buy.symbol,
          side: 'long',
          qty: qty,
          avg_entry_price: price,
          current_price: price,
          market_value: qty * price,
          unrealized_pl: 0,
          unrealized_plpc: 0,
          stop_loss_price: price * (1 - config.stopLossPct / 100),
          take_profit_price: null, // swing uses signal-based exit, not fixed TP
          strategy: 'swing',
        });

        tradesExecuted++;
        console.log(`Swing BUY ${buy.symbol}: ${qty} shares @ ~$${price.toFixed(2)} (rank #${buy.score.rank}, z=${buy.score.compositeScore.toFixed(2)})`);
      } catch (e) {
        errors.push(`Swing buy failed ${buy.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // Sync positions
    const finalPositions = (await alpaca.getPositions()).filter(p => {
      const existing = allDbPositions.find(x => x.ticker === p.symbol);
      return existing?.strategy === 'swing';
    });
    const syncDbPositions = await db.getOpenPositions();
    const dbPositionMap = new Map(syncDbPositions.filter(p => p.strategy === 'swing').map(p => [p.ticker, p]));

    for (const pos of finalPositions) {
      const existing = dbPositionMap.get(pos.symbol);
      await db.upsertPosition({
        ticker: pos.symbol,
        side: pos.side,
        qty: pos.qty,
        avg_entry_price: pos.avg_entry_price,
        current_price: pos.current_price,
        market_value: pos.market_value,
        unrealized_pl: pos.unrealized_pl,
        unrealized_plpc: pos.unrealized_plpc,
        stop_loss_price: existing?.stop_loss_price ?? null,
        take_profit_price: existing?.take_profit_price ?? null,
      });
    }

    // Log run
    await db.logRun({
      trigger: 'swing_cron',
      market_open: clock.is_open ? 1 : 0,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: errors.length > 0 ? JSON.stringify(errors) : null,
      status: errors.length > 5 ? 'error' : 'ok',
    });

    console.log(`Swing cycle complete: ${decisionsMade} decisions, ${tradesExecuted} trades, ${errors.length} errors, ${Date.now() - startTime}ms`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Fatal: ${errMsg}`);
    console.error('Swing cycle failed:', error);

    await db.logRun({
      trigger: 'swing_cron',
      market_open: 0,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: JSON.stringify(errors),
      status: 'error',
    });
  }
}

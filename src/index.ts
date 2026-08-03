// Main Worker Entry Point
// Handles cron triggers, manual API calls, and the full trading cycle

import { AlpacaClient } from './alpaca';
import { analyze, generateSignal, ema, atr } from './technical-analysis';
import { refineWithLLM, detectMarketRegime, type AIMarketContext } from './ai-decision';
import { RiskManager, type RiskConfig } from './risk-manager';
import { Database } from './database';
import { UniverseScanner } from './scanner';
import { DashboardAPI } from './api';
import { runSwingCycle } from './swing-strategy';

export interface Env {
  DB: D1Database;
  ALPACA_API_KEY: string;
  ALPACA_API_SECRET: string;
  ALPACA_BASE_URL: string;
  LLM_API_KEY: string;
}

// Default fallback config if D1 is empty
const FALLBACK_CONFIG = {
  maxPositions: 15,
  maxPositionPct: 20,
  stopLossPct: 8,
  takeProfitPct: 15,
  trailingStopPct: 5,
  dailyLossLimitPct: 15,
  rollingDrawdownLimitPct: 10,
  minConfidence: 0.6,
  scanUniverseSize: 100,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  emaFast: 9,
  emaSlow: 21,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,
  volumeAvgPeriod: 20,
  stopLossATRMultiplier: 1.5,
  takeProfitATRMultiplier: 2.0,
  targetVolatilityPct: 2.0,
  maxOrderRatePerMin: 10,
  minEdgeAfterCosts: 5,
  useAiRefinement: true,
  llmModel: 'accounts/fireworks/models/glm-5p2',
  llmTemperature: 0.3,
  enableMargin: true,
  eodFlatten: true,
};

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Dual-cron routing: Cloudflare's event.cron tells us which trigger fired
    if (event.cron === '0 22 * * 1-5') {
      // Swing trading: once daily after market close
      ctx.waitUntil(runSwingCycle(env, 'swing_cron'));
    } else {
      // Daytrading: every 5 minutes during market hours
      ctx.waitUntil(runTradingCycle(env, 'cron'));
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const api = new DashboardAPI(env);
    return api.handle(request);
  },
};

// ============================================================
// Main Trading Cycle
// ============================================================

async function runTradingCycle(env: Env, trigger: string): Promise<void> {
  const startTime = Date.now();
  const db = new Database(env.DB);
  const errors: string[] = [];
  let decisionsMade = 0;
  let tradesExecuted = 0;

  try {
    // 1. Initialize clients
    const alpaca = new AlpacaClient({
      apiKey: env.ALPACA_API_KEY,
      apiSecret: env.ALPACA_API_SECRET,
      baseUrl: env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });

    // 2. Load config
    const dbConfig = await db.getConfig();
    const config = { ...FALLBACK_CONFIG };
    for (const [key, value] of Object.entries(dbConfig)) {
      if (key in config) {
        const numVal = parseFloat(value);
        if (!isNaN(numVal)) (config as any)[key] = numVal;
        else if (value === 'true') (config as any)[key] = true;
        else if (value === 'false') (config as any)[key] = false;
        else (config as any)[key] = value;
      }
    }

    // 3. Check market status
    const clock = await alpaca.getClock();
    if (!clock.is_open) {
      console.log('Market closed, skipping cycle');
      await db.logRun({
        trigger,
        market_open: 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: 0,
        error_details: null,
        status: 'skipped',
      });
      return;
    }

    // 4. Get account and positions
    const account = await alpaca.getAccount();
    const positions = await alpaca.getPositions();

    // Log performance snapshot
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

    // 5. Initialize risk manager with ATR-scaled parameters
    const riskConfig: RiskConfig = {
      maxPositions: config.maxPositions,
      maxPositionPct: config.maxPositionPct,
      stopLossATRMultiplier: config.stopLossATRMultiplier || 1.5,
      takeProfitATRMultiplier: config.takeProfitATRMultiplier || 2.0,
      trailingStopPct: config.trailingStopPct,
      dailyLossLimitPct: config.dailyLossLimitPct,
      rollingDrawdownLimitPct: config.rollingDrawdownLimitPct || 10,
      minConfidence: config.minConfidence,
      enableMargin: config.enableMargin,
      eodFlatten: config.eodFlatten,
      targetVolatilityPct: config.targetVolatilityPct || 2.0,
      maxOrderRatePerMin: config.maxOrderRatePerMin || 10,
      minEdgeAfterCosts: config.minEdgeAfterCosts || 5,
    };
    const riskManager = new RiskManager(riskConfig);

    // Update kill switch with equity snapshot
    riskManager.updateEquitySnapshot(account.equity);

    // 5b. Reconciliation: check for position divergence
    const dbPositions = await db.getOpenPositions();
    const divergence = riskManager.checkDivergence(positions, dbPositions.map(p => ({ ticker: p.ticker, qty: p.qty, side: p.side })));
    if (divergence.divergent) {
      const details = divergence.details.join('; ');
      errors.push(`Position divergence detected: ${details}`);
      riskManager.haltTrading(`Position divergence: ${details}`);
      console.error(`DIVERGENCE: ${details}`);
    }

    // 6. Check existing positions for stop loss / take profit (ATR-based)
    const positionActions = riskManager.checkPositions(positions, dbPositions);
    for (const action of positionActions) {
      if (action.priority === 'critical' || action.priority === 'high') {
        try {
          console.log(`Closing ${action.symbol}: ${action.reason}`);
          await alpaca.closePosition(action.symbol);
          const pos = positions.find(p => p.symbol === action.symbol);
          if (pos) {
            await db.closePosition(action.symbol, pos.unrealized_pl, action.reason);
          }
          tradesExecuted++;
        } catch (e) {
          errors.push(`Failed to close ${action.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
    }

    // 7. EOD flatten check
    const now = new Date(clock.timestamp);
    const marketClose = new Date(clock.next_close);
    const minutesToClose = (marketClose.getTime() - now.getTime()) / 60000;

    if (riskManager.shouldFlattenEOD(minutesToClose)) {
      console.log(`EOD flatten: ${minutesToClose.toFixed(0)} min to close. Liquidating all positions.`);
      try {
        await alpaca.closeAllPositions();
        for (const pos of positions) {
          await db.closePosition(pos.symbol, pos.unrealized_pl, 'eod_flatten');
        }
        tradesExecuted += positions.length;
      } catch (e) {
        errors.push(`EOD flatten failed: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // 8. Scan universe for candidates
    const scanner = new UniverseScanner(alpaca, config.scanUniverseSize);
    const candidates = await scanner.scan();
    console.log(`Scanned universe: ${candidates.length} candidates`);

    // 8b. Detect market regime using SPY (S&P 500 ETF)
    let marketRegime = 'choppy';
    try {
      const spyBars = await alpaca.getBars('SPY', '5Min', 50);
      if (spyBars.length >= 21) {
        const spyCloses = spyBars.map(b => b.c);
        const spyEmaFast = ema(spyCloses, 9);
        const spyEmaSlow = ema(spyCloses, 21);
        const spyTrend = spyEmaFast > spyEmaSlow ? 1 : spyEmaFast < spyEmaSlow ? -1 : 0;
        // Approximate VIX from ATR of SPY (higher ATR% = more volatile)
        const spyAtr = atr(spyBars, 14);
        const spyPrice = spyCloses[spyCloses.length - 1];
        const volatilityPct = spyPrice > 0 ? (spyAtr / spyPrice) * 100 : 0;
        // Map volatility to VIX-like scale: 0.5% daily = ~12 VIX, 2% = ~30 VIX
        const approxVix = volatilityPct * 15;
        marketRegime = detectMarketRegime({ spyTrend, vixLevel: approxVix, breadth: 0.5 });
        console.log(`Market regime: ${marketRegime} (SPY trend: ${spyTrend}, approx VIX: ${approxVix.toFixed(1)})`);
      }
    } catch (e) {
      console.error('Market regime detection failed, using choppy:', e);
    }

    // 9. Analyze each candidate with TA
    const taConfig = {
      rsiPeriod: config.rsiPeriod,
      rsiOversold: config.rsiOversold,
      rsiOverbought: config.rsiOverbought,
      emaFast: config.emaFast,
      emaSlow: config.emaSlow,
      macdFast: config.macdFast,
      macdSlow: config.macdSlow,
      macdSignal: config.macdSignal,
      atrPeriod: config.atrPeriod,
      volumeAvgPeriod: config.volumeAvgPeriod,
    };

    const signals: TASignal[] = [];
    const analyzedSymbols = new Set(positions.map(p => p.symbol));

    // Analyze held positions first (for exit signals) - parallel
    const heldPositionBarPromises = positions.map(async pos => {
      try {
        const bars = await alpaca.getBars(pos.symbol, '5Min', 200);
        if (bars.length < 30) return null;
        const indicators = analyze(bars, pos.symbol, taConfig);
        return generateSignal(indicators, { rsiOversold: config.rsiOversold, rsiOverbought: config.rsiOverbought });
      } catch (e) {
        errors.push(`TA failed for ${pos.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
        return null;
      }
    });

    const heldSignals = await Promise.all(heldPositionBarPromises);
    for (const s of heldSignals) {
      if (s) {
        signals.push(s);
        analyzedSymbols.add(s.indicators.symbol);
      }
    }

    // Analyze new candidates (skip already analyzed) - parallel, limited per cycle
    const newCandidates = candidates.filter(s => !analyzedSymbols.has(s));
    const scanLimit = Math.min(newCandidates.length, 20); // Reduced from 30 to avoid timeout

    const candidateBarPromises = newCandidates.slice(0, scanLimit).map(async symbol => {
      try {
        const bars = await alpaca.getBars(symbol, '5Min', 200);
        if (bars.length < 30) return null;
        const indicators = analyze(bars, symbol, taConfig);
        return generateSignal(indicators, { rsiOversold: config.rsiOversold, rsiOverbought: config.rsiOverbought });
      } catch (e) {
        console.error(`TA failed for ${symbol}:`, e);
        return null;
      }
    });

    const candidateSignals = await Promise.all(candidateBarPromises);
    for (const s of candidateSignals) {
      if (s) signals.push(s);
    }

    // 10. Filter to actionable signals
    const actionableSignals = signals.filter(s => s.action !== 'HOLD' || s.confidence > 0.7);
    // For held positions, also include HOLD signals (potential CLOSE)
    const heldPositionSignals = signals.filter(s => positions.some(p => p.symbol === s.indicators.symbol));
    const signalsToProcess = [...new Set([...actionableSignals, ...heldPositionSignals])];

    console.log(`TA complete: ${signals.length} analyzed, ${signalsToProcess.length} to process`);

    // 11. AI refinement
    const marketContext: AIMarketContext = {
      account: {
        equity: account.equity,
        cash: account.cash,
        positionsCount: positions.length,
        dailyPlPct: account.change_today_pct,
      },
      marketRegime: marketRegime,
      topMovers: { gainers: [], losers: [] },
      positions,
    };

    // Process top signals with AI (limit to top 10 by confidence)
    const sortedSignals = signalsToProcess.sort((a, b) => b.confidence - a.confidence).slice(0, 10);

    for (const signal of sortedSignals) {
      let decision;
      if (config.useAiRefinement && env.LLM_API_KEY) {
        decision = await refineWithLLM(signal, marketContext, {
          apiKey: env.LLM_API_KEY,
          model: config.llmModel,
          temperature: config.llmTemperature,
          minConfidence: config.minConfidence,
        });
      } else {
        // Pure TA mode
        decision = {
          action: signal.action,
          confidence: signal.confidence,
          reasoning: signal.reasons.join('; '),
          factors: signal.reasons,
          adjustedFromTA: false,
          taSignal: signal,
        };
      }

      decisionsMade++;

      // Log decision
      const decisionId = await db.logDecision({
        ticker: signal.indicators.symbol,
        action: decision.action,
        confidence: decision.confidence,
        signal_source: config.useAiRefinement ? 'ta+ai' : 'ta',
        reason: decision.reasoning,
        ta_data: JSON.stringify(signal.indicators),
        ai_reasoning: JSON.stringify({ factors: decision.factors, adjusted: decision.adjustedFromTA }),
        price_at_decision: signal.indicators.price,
        executed: 0,
        execution_reason: '',
      });

      // Skip HOLD
      if (decision.action === 'HOLD') {
        await db.updateDecisionStatus(decisionId, 2, 'HOLD — no action needed');
        continue;
      }

      // CLOSE: close existing position
      if (decision.action === 'CLOSE') {
        const existingPos = positions.find(p => p.symbol === signal.indicators.symbol);
        if (existingPos) {
          try {
            await alpaca.closePosition(signal.indicators.symbol);
            await db.closePosition(signal.indicators.symbol, existingPos.unrealized_pl, 'ai_signal');
            await db.updateDecisionStatus(decisionId, 1, 'Position closed');
            tradesExecuted++;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'unknown';
            await db.updateDecisionStatus(decisionId, 3, `Close failed: ${errMsg}`);
            errors.push(`Close failed for ${signal.indicators.symbol}: ${errMsg}`);
          }
        }
        continue;
      }

      // BUY / SELL: risk check then execute
      const riskCheck = riskManager.checkTrade(decision, account, positions, signal.indicators);
      if (!riskCheck.approved) {
        await db.updateDecisionStatus(decisionId, 2, riskCheck.reason);
        console.log(`Skipped ${signal.indicators.symbol}: ${riskCheck.reason}`);
        continue;
      }

      // SELL: close existing long position
      if (decision.action === 'SELL') {
        const existingPos = positions.find(p => p.symbol === signal.indicators.symbol);
        if (existingPos) {
          try {
            await alpaca.closePosition(signal.indicators.symbol);
            await db.closePosition(signal.indicators.symbol, existingPos.unrealized_pl, 'ai_signal');
            await db.updateDecisionStatus(decisionId, 1, 'Position closed (sell signal)');
            tradesExecuted++;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'unknown';
            await db.updateDecisionStatus(decisionId, 3, `Sell failed: ${errMsg}`);
            errors.push(`Sell failed for ${signal.indicators.symbol}: ${errMsg}`);
          }
        }
        continue;
      }

      // BUY: submit new order
      if (decision.action === 'BUY' && riskCheck.adjustedQty) {
        const qty = riskCheck.adjustedQty;
        try {
          // Submit market order
          const order = await alpaca.submitOrder({
            symbol: signal.indicators.symbol,
            qty: qty,
            side: 'buy',
            type: 'market',
            time_in_force: 'day',
            client_order_id: `bot_${decisionId}_${Date.now()}`,
          });

          await db.logTrade({
            alpaca_order_id: order.id,
            ticker: signal.indicators.symbol,
            side: 'buy',
            qty: qty,
            fill_price: null,
            avg_fill_price: null,
            status: order.status,
            order_type: 'market',
            limit_price: null,
            stop_price: null,
            estimated_value: qty * signal.indicators.price,
            decision_id: decisionId,
            error_message: null,
          });

          // Update position in DB
          await db.upsertPosition({
            ticker: signal.indicators.symbol,
            side: 'long',
            qty: qty,
            avg_entry_price: signal.indicators.price,
            current_price: signal.indicators.price,
            market_value: qty * signal.indicators.price,
            unrealized_pl: 0,
            unrealized_plpc: 0,
            stop_loss_price: riskCheck.stopLossPrice || null,
            take_profit_price: riskCheck.takeProfitPrice || null,
          });

          await db.updateDecisionStatus(decisionId, 1, `Order submitted: ${qty} shares`);
          tradesExecuted++;
          console.log(`BUY ${signal.indicators.symbol}: ${qty} shares @ ~$${signal.indicators.price.toFixed(2)}`);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'unknown';
          await db.updateDecisionStatus(decisionId, 3, `Order failed: ${errMsg}`);
          errors.push(`Buy failed for ${signal.indicators.symbol}: ${errMsg}`);
        }
      }
    }

    // 12. Sync positions from Alpaca to DB (preserve stop/take profit from DB)
    const finalPositions = await alpaca.getPositions();
    const syncDbPositions = await db.getOpenPositions();
    const dbPositionMap = new Map(syncDbPositions.map(p => [p.ticker, p]));

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

    // 13. Log run
    await db.logRun({
      trigger,
      market_open: 1,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: errors.length > 0 ? JSON.stringify(errors) : null,
      status: errors.length > 5 ? 'error' : 'ok',
    });

    console.log(`Cycle complete: ${decisionsMade} decisions, ${tradesExecuted} trades, ${errors.length} errors, ${Date.now() - startTime}ms`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'unknown error';
    errors.push(`Fatal: ${errMsg}`);
    console.error('Trading cycle failed:', error);

    await db.logRun({
      trigger,
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

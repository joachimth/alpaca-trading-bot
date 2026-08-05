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
import { runCryptoCycle } from './crypto-strategy';
import { projectBrokerPositions, summarizeByCategory } from './position-projection';

export interface Env {
  DB: D1Database;
  ALPACA_API_KEY: string;
  ALPACA_API_SECRET: string;
  ALPACA_BASE_URL: string;
  LLM_API_KEY: string;
}

// Default fallback config if D1 is empty
const CRYPTO_SYMBOLS = new Set([
  'BTCUSD','ETHUSD','SOLUSD','AVAXUSD','LINKUSD','MATICUSD','DOTUSD','UNIUSD',
  'ATOMUSD','LTCUSD','BCHUSD','NEARUSD','AAVEUSD','XLMUSD','ALGOUSD',
]);

const FALLBACK_CONFIG = {
    maxPositions: 15,
    maxPositionPct: 20,
    stopLossPct: 8,
    takeProfitPct: 15,
    trailingStopPct: 5,
    dailyLossLimitPct: 15,
    rollingDrawdownLimitPct: 10,
    minConfidence: 0.7,
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
    minHoldMinutes: 15,        // don't sell a position held < N minutes (unless stop loss)
    reentryCooldownMinutes: 30, // don't re-buy a symbol sold < N minutes ago
    maxTradesPerCycle: 3,      // max new trades per 5-min cycle
    maxCapitalUsd: 5000,       // daytrading capital cap (~33,000 DKK)
  };

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Self-migration: add strategy column if missing (idempotent)
    try { await env.DB.prepare('ALTER TABLE positions ADD COLUMN strategy TEXT').run(); } catch (_) {}
    // Cloudflare passes the configured cron expression verbatim.
    if (event.cron === '0 22 * * 1-5') {
      ctx.waitUntil(runSwingCycle(env, 'swing_cron'));
    } else if (event.cron === '7-59/30 * * * *') {
      ctx.waitUntil(runCryptoCycle(env, 'crypto_cron'));
    } else if (event.cron === '*/5 13-21 * * 1-5') {
      ctx.waitUntil(runTradingCycleWithLease(env, 'cron'));
    } else {
      console.warn(`Ignoring unknown cron expression: ${event.cron}`);
    }
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Self-migration: add strategy column if missing (idempotent)
    try { await env.DB.prepare('ALTER TABLE positions ADD COLUMN strategy TEXT').run(); } catch (_) {}
    const api = new DashboardAPI(env);
    return api.handle(request);
  },
};

// ============================================================
// Main Trading Cycle
// ============================================================

async function runTradingCycleWithLease(env: Env, trigger: string): Promise<void> {
  const owner = `daytrading:${trigger}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const db = new Database(env.DB);
  if (!await db.acquireCycleLease(owner)) {
    console.log(`Skipping ${trigger}: another strategy cycle holds the global lease`);
    return;
  }
  try {
    await runTradingCycle(env, trigger);
  } finally {
    await db.releaseCycleLease(owner);
  }
}

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

    // Reconcile broker orders before reading positions or generating signals.
    await db.reconcileOrders(await alpaca.getRecentOrders(100));

    // 4. Get account and stock positions only. Crypto and swing positions are
    // owned by their respective strategies and must not enter this risk loop.
    const account = await alpaca.getAccount();
    const allBrokerPositions = await alpaca.getPositions();
    const allDbPositions = await db.getOpenPositions();
    const daySymbols = new Set(allDbPositions.filter(p =>
      p.strategy === 'daytrading' || (!p.strategy && !CRYPTO_SYMBOLS.has(p.ticker))
    ).map(p => p.ticker));
    const taggedSymbols = new Set(allDbPositions.map(p => p.ticker));
    const positions = allBrokerPositions.filter(p =>
      !CRYPTO_SYMBOLS.has(p.symbol) && (daySymbols.has(p.symbol) || !taggedSymbols.has(p.symbol))
    );

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

    // Log per-category (daytrading/swing/crypto) market value & P&L from
    // broker-authoritative positions. Non-fatal: a failure here must not
    // block the trading cycle itself.
    try {
      const categoryProjections = projectBrokerPositions(allBrokerPositions, allDbPositions);
      await db.logCategorySnapshots(summarizeByCategory(categoryProjections));
    } catch (e) {
      console.error('Category snapshot logging failed:', e);
    }

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
      maxCapitalUsd: config.maxCapitalUsd || 0,
    };
    const riskManager = new RiskManager(riskConfig);

    // Update kill switch with equity snapshot
    riskManager.updateEquitySnapshot(account.equity);

    // 5b. Reconciliation: check for position divergence
    const dbPositions = (await db.getOpenPositions()).filter(p =>
      p.strategy === 'daytrading' || (!p.strategy && !CRYPTO_SYMBOLS.has(p.ticker))
    );
    const divergence = riskManager.checkDivergence(positions, dbPositions.map(p => ({ ticker: p.ticker, qty: p.qty, side: p.side })));
    if (divergence.divergent) {
      const details = divergence.details.join('; ');
      // Auto-reconcile: sync broker positions to DB instead of halting
      // Only halt on qty mismatch (serious), not on "in broker but not internal" (fixable)
      const hasQtyMismatch = divergence.details.some(d => d.includes('qty mismatch'));
      if (hasQtyMismatch) {
        errors.push(`Position divergence (qty mismatch): ${details}`);
        riskManager.haltTrading(`Qty mismatch: ${details}`);
        console.error(`DIVERGENCE (halted): ${details}`);
      } else {
        // Auto-reconcile: upsert all broker positions into DB
        console.warn(`DIVERGENCE (auto-reconciling): ${details}`);
        errors.push(`Auto-reconciled: ${details}`);
        for (const pos of positions) {
          const existing = dbPositions.find(p => p.ticker === pos.symbol);
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
        // Also close DB positions that no longer exist in broker
        const brokerSymbols = new Set(positions.map(p => p.symbol));
        for (const dbPos of dbPositions) {
          if (!brokerSymbols.has(dbPos.ticker)) {
            await db.closePosition(dbPos.ticker, 0, 'auto_reconcile_not_in_broker');
          }
        }
      }
    }

    // 6. Check existing positions for stop loss / take profit (ATR-based)
    const positionActions = riskManager.checkPositions(positions, dbPositions);
    for (const action of positionActions) {
      if (action.priority === 'critical' || action.priority === 'high') {
        try {
          console.log(`Closing ${action.symbol}: ${action.reason}`);
          const order = await alpaca.closePosition(action.symbol);
          await db.logOrderTrade(order, { strategy: dbPositions.find(p => p.ticker === action.symbol)?.strategy ?? 'daytrading' });
          const pos = positions.find(p => p.symbol === action.symbol);
          if (pos && alpaca.isOrderFullyFilled(order)) {
            await db.closePosition(action.symbol, pos.unrealized_pl, action.reason);
          } else if (pos) {
            errors.push(`Exit order for ${action.symbol} not fully filled: ${order.status}`);
          }

        } catch (e) {
          errors.push(`Failed to close ${action.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
    }

    // 7. EOD flatten check
    const now = new Date(clock.timestamp);
    const marketClose = new Date(clock.next_close);
    const minutesToClose = (marketClose.getTime() - now.getTime()) / 60000;

    const noNewEntries = Boolean(config.eodFlatten) && minutesToClose <= 15;
    if (riskManager.shouldFlattenEOD(minutesToClose)) {
      console.log(`EOD flatten: ${minutesToClose.toFixed(0)} min to close. Liquidating all positions.`);
      try {
        const closeOrders = [];
        for (const pos of positions) {
          const order = await alpaca.closePosition(pos.symbol);
          closeOrders.push(order);
          await db.logOrderTrade(order, { strategy: 'daytrading' });
          if (alpaca.isOrderFullyFilled(order)) {
            await db.closePosition(pos.symbol, pos.unrealized_pl, 'eod_flatten');
          } else {
            errors.push(`EOD exit for ${pos.symbol} not fully filled`);
          }
        }

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

    // Anti-churn: get recently sold symbols for re-entry cooldown
    const cooldownMin = config.reentryCooldownMinutes || 30;
    const recentlySold = await db.getRecentlyClosedSymbols(cooldownMin);
    if (recentlySold.size > 0) {
      console.log(`Re-entry cooldown (${cooldownMin}min): ${Array.from(recentlySold).join(', ')}`);
    }

    // Anti-churn: build a map of position entry times for min hold check
    const dbPosMap = new Map(dbPositions.map(p => [p.ticker, p]));
    const minHoldMin = config.minHoldMinutes || 15;
    const nowMs = Date.now();
    const isWithinMinHold = (symbol: string): boolean => {
      const dbPos = dbPosMap.get(symbol);
      if (!dbPos || !dbPos.opened_at) return false;
      const openedMs = new Date(dbPos.opened_at + 'Z').getTime();
      const heldMin = (nowMs - openedMs) / 60000;
      return heldMin < minHoldMin;
    };

    // Track trades per cycle
    let cycleTradeCount = 0;
    const maxTradesPerCycle = config.maxTradesPerCycle || 3;

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
        signal_source: config.useAiRefinement && env.LLM_API_KEY ? 'ta+ai' : 'ta',
        reason: decision.reasoning,
        ta_data: JSON.stringify(signal.indicators),
        ai_reasoning: decision.reasoning + (decision.factors && decision.factors.length > 0 ? ' | Factors: ' + decision.factors.join('; ') : ''),
        price_at_decision: signal.indicators.price,
        executed: 0,
        execution_reason: '',
      });

      // Skip HOLD
      if (decision.action === 'HOLD') {
        await db.updateDecisionStatus(decisionId, 2, 'HOLD — no action needed');
        continue;
      }

      // Anti-churn: max trades per cycle limit
      if (cycleTradeCount >= maxTradesPerCycle) {
        await db.updateDecisionStatus(decisionId, 2, `Max trades per cycle reached (${maxTradesPerCycle})`);
        continue;
      }

      // CLOSE: close existing position
      if (decision.action === 'CLOSE') {
        const existingPos = positions.find(p => p.symbol === signal.indicators.symbol);
        if (existingPos) {
          // Anti-churn: check minimum hold time (unless stop loss was hit via checkPositions already)
          if (isWithinMinHold(signal.indicators.symbol)) {
            await db.updateDecisionStatus(decisionId, 2, `Min hold time not reached (${minHoldMin}min)`);
            console.log(`Skip CLOSE ${signal.indicators.symbol}: held < ${minHoldMin} min`);
            continue;
          }
          try {
            const order = await alpaca.closePosition(signal.indicators.symbol);
            await db.logOrderTrade(order, { decisionId, strategy: 'daytrading' });
            if (alpaca.isOrderFullyFilled(order)) {
              await db.closePosition(signal.indicators.symbol, existingPos.unrealized_pl, 'ai_signal');
              await db.updateDecisionStatus(decisionId, 1, 'Position closed');
              tradesExecuted++;
            } else {
              await db.updateDecisionStatus(decisionId, 0, `Exit order pending: ${order.status}`);
            }
            cycleTradeCount++;
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
          // Anti-churn: check minimum hold time
          if (isWithinMinHold(signal.indicators.symbol)) {
            await db.updateDecisionStatus(decisionId, 2, `Min hold time not reached (${minHoldMin}min)`);
            console.log(`Skip SELL ${signal.indicators.symbol}: held < ${minHoldMin} min`);
            continue;
          }
          try {
            const order = await alpaca.closePosition(signal.indicators.symbol);
            await db.logOrderTrade(order, { decisionId, strategy: 'daytrading' });
            if (alpaca.isOrderFullyFilled(order)) {
              await db.closePosition(signal.indicators.symbol, existingPos.unrealized_pl, 'ai_signal');
              await db.updateDecisionStatus(decisionId, 1, 'Position closed (sell signal)');
              tradesExecuted++;
            } else {
              await db.updateDecisionStatus(decisionId, 0, `Exit order pending: ${order.status}`);
            }
            cycleTradeCount++;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'unknown';
            await db.updateDecisionStatus(decisionId, 3, `Sell failed: ${errMsg}`);
            errors.push(`Sell failed for ${signal.indicators.symbol}: ${errMsg}`);
          }
        } else {
          await db.updateDecisionStatus(decisionId, 0, 'No existing position to sell — skipped (long-only bot)');
          console.log(`Skip SELL ${signal.indicators.symbol}: no position held`);
        }
        continue;
      }

      // BUY: submit new order
      if (decision.action === 'BUY' && riskCheck.adjustedQty) {
        if (noNewEntries) {
          await db.updateDecisionStatus(decisionId, 2, 'No new BUY entries during EOD flatten window');
          console.log(`Skip BUY ${signal.indicators.symbol}: EOD no-entry cutoff active`);
          continue;
        }
        // Anti-churn: re-entry cooldown check
        if (recentlySold.has(signal.indicators.symbol)) {
          await db.updateDecisionStatus(decisionId, 2, `Re-entry cooldown active (${cooldownMin}min)`);
          console.log(`Skip BUY ${signal.indicators.symbol}: sold within last ${cooldownMin} min`);
          continue;
        }

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
            strategy: 'daytrading',
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
            strategy: 'daytrading',
          });

          await db.updateDecisionStatus(decisionId, 1, `Order submitted: ${qty} shares`);
          tradesExecuted++;
          cycleTradeCount++;
          console.log(`BUY ${signal.indicators.symbol}: ${qty} shares @ ~$${signal.indicators.price.toFixed(2)}`);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'unknown';
          await db.updateDecisionStatus(decisionId, 3, `Order failed: ${errMsg}`);
          errors.push(`Buy failed for ${signal.indicators.symbol}: ${errMsg}`);
        }
      }
    }

    // 12. Sync positions from Alpaca to DB (preserve stop/take profit from DB)
    const finalPositions = (await alpaca.getPositions()).filter(p => !CRYPTO_SYMBOLS.has(p.symbol));
    const syncDbPositions = await db.getOpenPositions();
    const dbPositionMap = new Map(syncDbPositions.filter(p => p.strategy === 'daytrading' || (!p.strategy && !CRYPTO_SYMBOLS.has(p.ticker))).map(p => [p.ticker, p]));

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

// Crypto Trading Strategy
// 24/7 operation, no market hours, no gap risk, no PDT rule
// Reuses TA engine (RSI, MACD, EMA, ATR, Bollinger) on crypto bars
// Key differences from daytrading:
// - Runs every 15 min (crypto moves fast but 24/7 = more cycles)
// - No EOD flatten (crypto never closes)
// - No gap risk (continuous market)
// - Wider stops (crypto is more volatile)
// - Smaller universe (~15 major coins)
// - Separate capital cap

import { AlpacaClient } from './alpaca';
import { analyze, generateSignal, type TAIndicators } from './technical-analysis';
import { refineWithLLM } from './ai-decision';
import { RiskManager, type RiskConfig } from './risk-manager';
import { Database } from './database';
import type { Env } from './index';

// Curated crypto universe — major liquid coins on Alpaca
const CRYPTO_UNIVERSE = [
  'BTCUSD',   // Bitcoin
  'ETHUSD',   // Ethereum
  'SOLUSD',   // Solana
  'AVAXUSD',  // Avalanche
  'LINKUSD',  // Chainlink
  'MATICUSD', // Polygon
  'DOTUSD',   // Polkadot
  'UNIUSD',   // Uniswap
  'ATOMUSD',  // Cosmos
  'LTCUSD',   // Litecoin
  'BCHUSD',   // Bitcoin Cash
  'NEARUSD',  // Near
  'AAVEUSD',  // Aave
  'XLMUSD',   // Stellar
  'ALGOUSD',  // Algorand
];

const CRYPTO_FALLBACK_CONFIG = {
  maxPositions: 5,
  maxPositionPct: 25,          // 25% of crypto capital per position (5 positions = 100%)
  stopLossPct: 12,             // wider stops for crypto volatility
  takeProfitPct: 25,
  trailingStopPct: 8,
  dailyLossLimitPct: 15,
  rollingDrawdownLimitPct: 20, // crypto is more volatile, wider drawdown limit
  minConfidence: 0.7,
  scanUniverseSize: 15,
  stopLossATRMultiplier: 2.0,  // 2x ATR (vs 1.5x stocks) — crypto is wilder
  takeProfitATRMultiplier: 3.0,
  targetVolatilityPct: 3.0,    // higher target vol for crypto
  maxOrderRatePerMin: 5,
  minEdgeAfterCosts: 8,        // higher bar — crypto has wider spreads
  useAiRefinement: true,
  llmModel: 'accounts/fireworks/models/glm-5p2',
  llmTemperature: 0.3,
  enableMargin: false,         // no margin on crypto (24/7 + margin = ruin)
  eodFlatten: false,           // crypto never closes
  minHoldMinutes: 30,          // 30 min min hold (2 cycles)
  reentryCooldownMinutes: 60,  // 1 hour cooldown after selling
  maxTradesPerCycle: 2,        // max 2 trades per 15-min cycle
  maxCapitalUsd: 2000,         // ~13,000 DKK cap for crypto
};

export async function runCryptoCycle(env: Env, trigger: string): Promise<void> {
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

    // Load crypto config from D1 (crypto_ prefixed keys)
    const dbConfig = await db.getConfig();
    const config = { ...CRYPTO_FALLBACK_CONFIG };
    for (const [key, value] of Object.entries(dbConfig)) {
      if (key.startsWith('crypto_')) {
        const cleanKey = key.replace('crypto_', '');
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

    // No market hours check — crypto trades 24/7

    // Get account and positions
    const account = await alpaca.getAccount();
    const positions = await alpaca.getPositions();

    // Only filter crypto positions (symbols ending in USD that aren't stock symbols)
    // Alpaca returns crypto positions with same format as stock positions
    const cryptoPositions = positions.filter(p =>
      CRYPTO_UNIVERSE.includes(p.symbol)
    );

    // Log snapshot
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

    // Initialize risk manager with crypto-specific config
    const riskConfig: RiskConfig = {
      maxPositions: config.maxPositions,
      maxPositionPct: config.maxPositionPct,
      stopLossATRMultiplier: config.stopLossATRMultiplier || 2.0,
      takeProfitATRMultiplier: config.takeProfitATRMultiplier || 3.0,
      trailingStopPct: config.trailingStopPct,
      dailyLossLimitPct: config.dailyLossLimitPct,
      rollingDrawdownLimitPct: config.rollingDrawdownLimitPct || 20,
      minConfidence: config.minConfidence,
      enableMargin: config.enableMargin,
      eodFlatten: config.eodFlatten,
      targetVolatilityPct: config.targetVolatilityPct || 3.0,
      maxOrderRatePerMin: config.maxOrderRatePerMin || 5,
      minEdgeAfterCosts: config.minEdgeAfterCosts || 8,
      maxCapitalUsd: config.maxCapitalUsd || 0,
    };
    const riskManager = new RiskManager(riskConfig);
    riskManager.updateEquitySnapshot(account.equity);

    if (riskManager.isTradingHalted()) {
      console.error(`Crypto: trading halted — ${riskManager.isTradingHalted()}`);
      await db.logRun({
        trigger: 'crypto_cron',
        market_open: 1, // crypto always "open"
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: 0,
        error_details: null,
        status: 'error',
      });
      return;
    }

    // Check stop losses on existing crypto positions
    for (const pos of cryptoPositions) {
      const stopLoss = -config.stopLossPct / 100;
      const trailingStop = -config.trailingStopPct / 100;

      if (pos.unrealized_pl < 0 && pos.unrealized_plpc <= stopLoss) {
        try {
          await alpaca.closePosition(pos.symbol);
          await db.closePosition(pos.symbol, pos.unrealized_pl, 'crypto_stop_loss');
          await db.logDecision({
            ticker: pos.symbol,
            action: 'CLOSE',
            confidence: 1.0,
            signal_source: 'crypto',
            reason: `Stop loss: ${(pos.unrealized_plpc * 100).toFixed(1)}% loss`,
            ta_data: '{}',
            ai_reasoning: '{}',
            price_at_decision: pos.current_price,
            executed: 1,
            execution_reason: 'crypto_stop_loss',
          });
          tradesExecuted++;
          console.log(`Crypto STOP LOSS ${pos.symbol}: ${(pos.unrealized_plpc * 100).toFixed(1)}%`);
        } catch (e) {
          errors.push(`Crypto stop loss failed ${pos.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
        continue;
      }

      if (pos.unrealized_pl > 0 && pos.unrealized_plpc <= trailingStop) {
        try {
          await alpaca.closePosition(pos.symbol);
          await db.closePosition(pos.symbol, pos.unrealized_pl, 'crypto_trailing_stop');
          await db.logDecision({
            ticker: pos.symbol,
            action: 'CLOSE',
            confidence: 0.8,
            signal_source: 'crypto',
            reason: `Trailing stop: giving back ${(pos.unrealized_plpc * 100).toFixed(1)}%`,
            ta_data: '{}',
            ai_reasoning: '{}',
            price_at_decision: pos.current_price,
            executed: 1,
            execution_reason: 'crypto_trailing_stop',
          });
          tradesExecuted++;
          console.log(`Crypto TRAILING STOP ${pos.symbol}: ${(pos.unrealized_plpc * 100).toFixed(1)}%`);
        } catch (e) {
          errors.push(`Crypto trailing stop failed ${pos.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }
    }

    // Refresh positions after stops
    const updatedPositions = await alpaca.getPositions();
    const updatedCryptoPositions = updatedPositions.filter(p => CRYPTO_UNIVERSE.includes(p.symbol));

    // Scan crypto universe — get 15-min bars and compute TA
    const symbolsToScan = CRYPTO_UNIVERSE.slice(0, config.scanUniverseSize);
    console.log(`Crypto: scanning ${symbolsToScan.length} coins`);

    const taPromises = symbolsToScan.map(async symbol => {
      try {
        const bars = await alpaca.getCryptoBars(symbol, '15Min', 200);
        if (bars.length < 50) return null;
        const indicators = analyze(bars, {
          rsiPeriod: 14, emaFast: 9, emaSlow: 21,
          macdFast: 12, macdSlow: 26, macdSignal: 9,
          atrPeriod: 14, volumeAvgPeriod: 20,
        });
        if (!indicators) return null;
        return { symbol, indicators };
      } catch (e) {
        console.error(`Crypto TA failed for ${symbol}:`, e);
        return null;
      }
    });

    const taResults = await Promise.all(taPromises);
    const validTA = taResults.filter((r): r is NonNullable<typeof r> => r !== null);
    console.log(`Crypto: ${validTA.length} coins with valid TA`);

    if (validTA.length < 3) {
      errors.push(`Too few crypto coins with valid TA: ${validTA.length}`);
      await db.logRun({
        trigger: 'crypto_cron',
        market_open: 1,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: errors.length,
        error_details: JSON.stringify(errors),
        status: 'error',
      });
      return;
    }

    // Generate signals
    const signals = validTA.map(({ symbol, indicators }) => {
      const signal = generateSignal(indicators, {
        rsiOversold: 30, rsiOverbought: 70,
      });
      return { symbol, indicators, signal };
    });

    // AI refinement (optional, same as daytrading)
    const actionable = signals.filter(s => s.signal.action !== 'HOLD' || s.signal.confidence > 0.7);
    const heldCryptoSymbols = new Set(updatedCryptoPositions.map(p => p.symbol));
    const heldSignals = signals.filter(s => heldCryptoSymbols.has(s.symbol));
    const signalsToProcess = [...new Set([...actionable, ...heldSignals])];

    console.log(`Crypto: ${signals.length} analyzed, ${signalsToProcess.length} to process`);

    // Anti-churn: recently sold symbols
    const cooldownMin = config.reentryCooldownMinutes || 60;
    const recentlySold = await db.getRecentlyClosedSymbols(cooldownMin);

    // Min hold time check
    const dbPositions = await db.getOpenPositions();
    const dbPosMap = new Map(dbPositions.map(p => [p.ticker, p]));
    const minHoldMin = config.minHoldMinutes || 30;
    const nowMs = Date.now();
    const isWithinMinHold = (symbol: string): boolean => {
      const dbPos = dbPosMap.get(symbol);
      if (!dbPos || !dbPos.opened_at) return false;
      const openedMs = new Date(dbPos.opened_at + 'Z').getTime();
      return (nowMs - openedMs) / 60000 < minHoldMin;
    };

    let cycleTradeCount = 0;
    const maxTradesPerCycle = config.maxTradesPerCycle || 2;

    // Process signals
    for (const { symbol, indicators, signal } of signalsToProcess) {
      // AI refinement
      let decision = signal;
      if (config.useAiRefinement && signal.action !== 'HOLD' && signal.confidence > 0.5) {
        try {
          const refined = await refineWithLLM(signal, indicators, {
            apiKey: env.LLM_API_KEY || env.FIREWORKS_API_KEY,
            model: config.llmModel,
            temperature: config.llmTemperature,
            marketRegime: 'crypto',
          });
          if (refined) decision = refined;
        } catch (e) {
          console.error(`Crypto AI refinement failed for ${symbol}:`, e);
        }
      }

      decisionsMade++;
      const decisionId = await db.logDecision({
        ticker: symbol,
        action: decision.action,
        confidence: decision.confidence,
        signal_source: 'crypto',
        reason: decision.reason,
        ta_data: JSON.stringify(indicators),
        ai_reasoning: decision.aiReasoning || '',
        price_at_decision: indicators.price,
        executed: 0,
        execution_reason: '',
      });

      if (decision.action === 'HOLD') {
        await db.updateDecisionStatus(decisionId, 2, 'HOLD');
        continue;
      }

      if (cycleTradeCount >= maxTradesPerCycle) {
        await db.updateDecisionStatus(decisionId, 2, `Max trades per cycle (${maxTradesPerCycle})`);
        continue;
      }

      // CLOSE/SELL: exit existing crypto position
      if (decision.action === 'CLOSE' || decision.action === 'SELL') {
        const existingPos = updatedCryptoPositions.find(p => p.symbol === symbol);
        if (existingPos) {
          if (isWithinMinHold(symbol)) {
            await db.updateDecisionStatus(decisionId, 2, `Min hold time not reached (${minHoldMin}min)`);
            continue;
          }
          try {
            await alpaca.closePosition(symbol);
            await db.closePosition(symbol, existingPos.unrealized_pl, 'crypto_signal');
            await db.updateDecisionStatus(decisionId, 1, 'Position closed');
            tradesExecuted++;
            cycleTradeCount++;
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'unknown';
            await db.updateDecisionStatus(decisionId, 3, `Close failed: ${errMsg}`);
            errors.push(`Crypto close failed ${symbol}: ${errMsg}`);
          }
        }
        continue;
      }

      // BUY: risk check then execute
      if (decision.action === 'BUY') {
        if (recentlySold.has(symbol)) {
          await db.updateDecisionStatus(decisionId, 2, `Re-entry cooldown (${cooldownMin}min)`);
          continue;
        }

        const riskCheck = riskManager.checkTrade(decision, account, updatedCryptoPositions, indicators);
        if (!riskCheck.approved) {
          await db.updateDecisionStatus(decisionId, 2, riskCheck.reason);
          continue;
        }

        if (riskCheck.adjustedQty) {
          try {
            const order = await alpaca.submitOrder({
              symbol,
              qty: riskCheck.adjustedQty,
              side: 'buy',
              type: 'market',
              time_in_force: 'gtc', // GTC for crypto (24/7 market)
              client_order_id: `crypto_${Date.now()}_${symbol}`,
            });

            await db.logTrade({
              alpaca_order_id: order.id,
              ticker: symbol,
              side: 'buy',
              qty: riskCheck.adjustedQty,
              fill_price: null,
              avg_fill_price: null,
              status: order.status,
              order_type: 'market',
              limit_price: null,
              stop_price: riskCheck.stopLossPrice,
              estimated_value: riskCheck.adjustedQty * indicators.price,
              decision_id: decisionId,
              error_message: null,
            });

            await db.upsertPosition({
              ticker: symbol,
              side: 'long',
              qty: riskCheck.adjustedQty,
              avg_entry_price: indicators.price,
              current_price: indicators.price,
              market_value: riskCheck.adjustedQty * indicators.price,
              unrealized_pl: 0,
              unrealized_plpc: 0,
              stop_loss_price: riskCheck.stopLossPrice,
              take_profit_price: riskCheck.takeProfitPrice,
            });

            await db.updateDecisionStatus(decisionId, 1, `Order: ${riskCheck.adjustedQty} units`);
            tradesExecuted++;
            cycleTradeCount++;
            console.log(`Crypto BUY ${symbol}: ${riskCheck.adjustedQty} @ ~$${indicators.price.toFixed(2)}`);
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'unknown';
            await db.updateDecisionStatus(decisionId, 3, `Buy failed: ${errMsg}`);
            errors.push(`Crypto buy failed ${symbol}: ${errMsg}`);
          }
        }
      }
    }

    // Sync positions
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

    await db.logRun({
      trigger: 'crypto_cron',
      market_open: 1,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: errors.length > 0 ? JSON.stringify(errors) : null,
      status: errors.length > 5 ? 'error' : 'ok',
    });

    console.log(`Crypto cycle: ${decisionsMade} decisions, ${tradesExecuted} trades, ${errors.length} errors, ${Date.now() - startTime}ms`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Fatal: ${errMsg}`);
    console.error('Crypto cycle failed:', error);
    await db.logRun({
      trigger: 'crypto_cron',
      market_open: 1,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: JSON.stringify(errors),
      status: 'error',
    });
  }
}

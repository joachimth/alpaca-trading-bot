// Crypto Trading Strategy
// 24/7 operation, no market hours, no gap risk, no PDT rule
// Reuses TA engine (RSI, MACD, EMA, ATR, Bollinger) on crypto bars
// Key differences from daytrading:
// - Runs every 30 min at :07/:37 UTC (24/7 cadence)
// - No EOD flatten (crypto never closes)
// - No gap risk (continuous market)
// - Wider stops (crypto is more volatile)
// - Smaller universe (~15 major coins)
// - Separate capital cap

import { AlpacaClient } from './alpaca';
import { analyze, generateSignal } from './technical-analysis';
import { refineWithLLM } from './ai-decision';
import { getCryptoSentiment, formatSentimentForPrompt } from './crypto-sentiment';
import { RiskManager, type RiskConfig } from './risk-manager';
import { Database } from './database';
import { projectBrokerPositions, summarizeByCategory } from './position-projection';
import type { Env } from './index';
import { SkipReasonCollector, serializeRunDetails, runStatus } from './skip-reasons';
import { syncBrokerLedger } from './broker-ledger';
import { reconcileBrokerOrders } from './order-reconciliation';
import { classifyCryptoSkip, createCycleExposure, cryptoBudgetDecision, evaluateCryptoProtectiveExit, projectedPositions, rankCryptoCandidates, reserveEntry, resolveCryptoConfig, type FeeTelemetry } from './crypto-runtime';

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
  maxEntriesPerCycle: 1,       // conservative while net-edge calibration is pending
  maxDiscretionaryExitsPerCycle: 2,
  minEdgeAfterCosts: 8,        // telemetry/config gate; no confidence-to-edge conversion
  useAiRefinement: true,
  llmModel: 'accounts/fireworks/models/glm-5p2',
  llmTemperature: 0.3,
  enableMargin: false,         // no margin on crypto (24/7 + margin = ruin)
  eodFlatten: false,           // crypto never closes
  minHoldMinutes: 30,          // 30 min min hold (2 cycles)
  reentryCooldownMinutes: 60,  // 1 hour cooldown after selling
  maxTradesPerCycle: 2,        // max 2 trades per 30-min cycle
  maxCapitalUsd: 2000,         // ~13,000 DKK cap for crypto
};

export async function runCryptoCycle(env: Env, trigger: string): Promise<void> {
  const leaseStart = Date.now();
  const owner = `crypto:${trigger}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const leaseDb = new Database(env.DB);
  const leaseKey = 'crypto';
  if (!await leaseDb.acquireCycleLease(owner, undefined, leaseKey)) {
    const skips = new SkipReasonCollector();
    skips.add('CYCLE_LEASE_HELD', 'cycle', 'Skipped because another crypto cycle holds the crypto lease', { strategy: 'crypto', trigger });
    console.log(`Skipping ${trigger}: another crypto cycle holds the crypto lease`);
    await leaseDb.logRun({ trigger, market_open: 1, duration_ms: Date.now() - leaseStart, decisions_made: 0, trades_executed: 0, errors: 0, error_details: serializeRunDetails([], skips), status: 'skipped' });
    return;
  }
  try {
    await runCryptoCycleInner(env, trigger);
  } finally {
    await leaseDb.releaseCycleLease(owner, leaseKey);
  }
}

async function runCryptoCycleInner(env: Env, trigger: string): Promise<void> {
  const startTime = Date.now();
  const db = new Database(env.DB);
  const errors: string[] = [];
  const skips = new SkipReasonCollector();
  let decisionsMade = 0;
  let tradesExecuted = 0;

  try {
    const alpaca = new AlpacaClient({
      apiKey: env.ALPACA_API_KEY,
      apiSecret: env.ALPACA_API_SECRET,
      baseUrl: env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });

    let feeLedgerSyncFailed = false;
    try {
      const ledger = await syncBrokerLedger(db, alpaca);
      console.log(`Broker ledger synced: ${ledger.activities} activities, ${ledger.fills} fills, ${ledger.fees} fees`);
    } catch (error) {
      feeLedgerSyncFailed = true;
      errors.push(`Broker ledger sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Load crypto config from D1 (crypto_ prefixed keys)
    const dbConfig = await db.getConfig();
    const config = resolveCryptoConfig(dbConfig, CRYPTO_FALLBACK_CONFIG);

    // No market hours check — crypto trades 24/7.
    const reconciliation = await reconcileBrokerOrders(db, alpaca);
    console.log(`Crypto order reconciliation: ${reconciliation.brokerOrders} broker orders, ${reconciliation.pendingLookups} pending lookups, ${reconciliation.lookupFailures} lookup failures`);

    // Get account and crypto positions
    const account = await alpaca.getAccount();
    const positions = await alpaca.getPositions();
    const allDbPositions = await db.getOpenPositions();

    // Only filter crypto positions (symbols ending in USD that aren't stock symbols)
    // Alpaca returns crypto positions with same format as stock positions
    const cryptoPositions = positions.filter(p =>
      CRYPTO_UNIVERSE.includes(p.symbol)
    );

    // Fetch crypto market sentiment (Fear & Greed Index + trending coins)
    let sentiment = null;
    let sentimentText = 'Sentiment data unavailable';
    try {
      sentiment = await getCryptoSentiment();
      sentimentText = formatSentimentForPrompt(sentiment);
      if (sentiment) {
        console.log(`Crypto sentiment: F&G ${sentiment.fearGreedValue} (${sentiment.fearGreedLabel}), trending: ${sentiment.trendingCoins.join(', ')}`);
      }
    } catch (e) {
      console.error('Crypto sentiment failed (non-fatal):', e);
    }

    // Log snapshot
    await db.logSnapshot({
      account_id: account.id,
      equity: account.equity,
      cash: account.cash,
      buying_power: account.buying_power,
      portfolio_value: account.portfolio_value,
      long_market_value: account.long_market_value,
      short_market_value: account.short_market_value,
      positions_count: cryptoPositions.length,
      daily_pl: account.change_today,
      daily_plpc: account.change_today_pct,
      total_pl: account.equity - account.last_equity,
      total_plpc: account.last_equity > 0 ? ((account.equity - account.last_equity) / account.last_equity) * 100 : 0,
    });

    // Log per-category market value & P&L from broker-authoritative
    // positions (non-fatal — must not block the crypto cycle itself).
    try {
      const categoryProjections = projectBrokerPositions(positions, allDbPositions);
      await db.logCategorySnapshots(summarizeByCategory(categoryProjections));
    } catch (e) {
      console.error('Category snapshot logging failed:', e);
    }

    // Initialize risk manager with crypto-specific config
    let feeSummary: Awaited<ReturnType<Database['getBrokerFeeSummary']>> | null = null;
    try {
      feeSummary = await db.getBrokerFeeSummary();
    } catch (error) {
      errors.push(`Broker fee summary failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    const feeTelemetry: FeeTelemetry = feeLedgerSyncFailed || !feeSummary
      ? { status: 'unavailable', reason: feeLedgerSyncFailed ? 'broker fee ledger sync failed this cycle' : 'broker fee summary unavailable' }
      : feeSummary.cryptoFeeTelemetryStatus === 'available' && feeSummary.cryptoRateBps !== null && Number.isFinite(feeSummary.cryptoRateBps) && feeSummary.cryptoRateBps > 0 && feeSummary.cryptoFeeAsOf
        ? { status: 'available', rateBps: feeSummary.cryptoRateBps, sampleCount: feeSummary.cryptoFeeSampleCount, notionalUsd: feeSummary.cryptoTradedNotionalUsd, asOf: feeSummary.cryptoFeeAsOf }
        : feeSummary.cryptoFeeTelemetryStatus === 'insufficient'
          ? { status: 'insufficient', reason: 'insufficient or invalid crypto fee samples' }
          : { status: 'unavailable', reason: 'crypto fee telemetry unavailable, stale, or non-positive' };
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
      observedFeeBps: feeTelemetry.status === 'available' ? feeTelemetry.rateBps : undefined,
      feeTelemetryStatus: feeTelemetry.status,
      requireFeeTelemetry: true,
      maxCapitalUsd: config.maxCapitalUsd || 0,
    };
    const riskManager = new RiskManager(riskConfig);
    riskManager.updateEquitySnapshot(account.equity);

    // Protective exits are evaluated before discretionary risk halts. A halt
    // blocks new exposure, but must never leave an existing loss unmanaged.
    const dbCryptoPositions = allDbPositions.filter(position => position.strategy === 'crypto');
    const dbCryptoPositionMap = new Map(dbCryptoPositions.map(position => [position.ticker, position]));
    for (const pos of cryptoPositions) {
      const protectiveExit = evaluateCryptoProtectiveExit(
        pos,
        dbCryptoPositionMap.get(pos.symbol),
        config.stopLossPct,
        config.trailingStopPct,
      );
      if (!protectiveExit) continue;

      try {
        const order = await alpaca.closePosition(pos.symbol);
        await db.logOrderTrade(order, { strategy: 'crypto' });
        if (alpaca.isOrderFullyFilled(order)) {
          await db.closePosition(pos.symbol, pos.unrealized_pl, `crypto_${protectiveExit.kind}`);
          await db.logDecision({
            ticker: pos.symbol,
            action: 'CLOSE',
            confidence: 1.0,
            signal_source: 'crypto',
            reason: protectiveExit.reason,
            ta_data: '{}',
            ai_reasoning: '{}',
            price_at_decision: pos.current_price,
            executed: 1,
            execution_reason: `crypto_${protectiveExit.kind}`,
          });
          tradesExecuted++;
        } else {
          errors.push(`Crypto ${protectiveExit.kind} exit not fully filled ${pos.symbol}: ${order.status}`);
        }
        console.log(`Crypto ${protectiveExit.kind.toUpperCase()} ${pos.symbol}: ${protectiveExit.reason}`);
      } catch (e) {
        errors.push(`Crypto ${protectiveExit.kind} failed ${pos.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    const riskHaltReason = riskManager.isTradingHalted() ? riskManager.getKillState().reason : null;
    if (riskHaltReason) {
      skips.add('RISK_HALTED', 'cycle', 'Crypto discretionary trading is halted by risk controls after protective exits were processed', { reason: riskHaltReason });
      console.error(`Crypto: discretionary trading halted — ${riskHaltReason}`);
      await db.logRun({
        trigger,
        market_open: 1,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: tradesExecuted,
        errors: errors.length,
        error_details: serializeRunDetails(errors, skips),
        status: runStatus(errors, skips, false, tradesExecuted),
      });
      return;
    }

    // Refresh positions after stops. Broker state is authoritative; the cycle
    // projection below additionally reserves submitted entries conservatively.
    const updatedPositions = await alpaca.getPositions();
    const updatedCryptoPositions = updatedPositions.filter(p => CRYPTO_UNIVERSE.includes(p.symbol));
    const exposure = createCycleExposure(updatedCryptoPositions);

    // Scan crypto universe — get 15-min bars and compute TA
    const symbolsToScan = CRYPTO_UNIVERSE.slice(0, config.scanUniverseSize);
    console.log(`Crypto: scanning ${symbolsToScan.length} coins`);

    const taPromises = symbolsToScan.map(async symbol => {
      try {
        const bars = await alpaca.getCryptoBars(symbol, '15Min', 200);
        if (bars.length < 50) return null;
        const indicators = analyze(bars, symbol, {
          rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
          emaFast: 9, emaSlow: 21,
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
      skips.add('CRYPTO_DATA_INSUFFICIENT', 'cycle', 'Crypto decision cycle skipped because too few coins had valid technical analysis', { validTA: validTA.length, required: 3 });

      await db.logRun({
        trigger,
        market_open: 1,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: errors.length,
        error_details: serializeRunDetails(errors, skips),
        status: runStatus(errors, skips, false, tradesExecuted),
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
    const signalsToProcess = rankCryptoCandidates(
      [...new Map([...actionable, ...heldSignals].map(candidate => [candidate.symbol, candidate])).values()]
        .map(candidate => ({ ...candidate, feeTelemetryStatus: feeTelemetry.status }))
    );

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
    const maxEntriesPerCycle = config.maxEntriesPerCycle || 1;
    const maxDiscretionaryExitsPerCycle = config.maxDiscretionaryExitsPerCycle || config.maxTradesPerCycle || 2;
    let entryCount = 0;
    let discretionaryExitCount = 0;

    // Process signals in deterministic ranked order. No uncalibrated edge is
    // invented from confidence; ranking falls back to fee status, confidence,
    // and symbol order.
    // Process signals
    for (const { symbol, indicators, signal } of signalsToProcess) {
      // AI refinement
        let decision: any = signal;
        if (config.useAiRefinement && signal.action !== 'HOLD' && signal.confidence > 0.5 && env.LLM_API_KEY) {
          try {
            const refined = await refineWithLLM(signal, {
              account: {
                equity: account.equity,
                cash: account.cash,
                positionsCount: cryptoPositions.length,
                dailyPlPct: account.change_today_pct || 0,
              },
              marketRegime: 'crypto',
              topMovers: { gainers: [], losers: [] },
              positions: cryptoPositions,
              sentiment: sentimentText,
            }, {
              apiKey: env.LLM_API_KEY,
              model: config.llmModel,
              temperature: config.llmTemperature,
              minConfidence: config.minConfidence,
            });
            if (refined) decision = { ...signal, ...refined, reason: refined.reasoning };
          } catch (e) {
            console.error(`Crypto AI refinement failed for ${symbol}:`, e);
          }
        }

      decisionsMade++;
      const decisionId = await db.logDecision({
        ticker: symbol,
        action: decision.action,
        confidence: decision.confidence,
        signal_source: env.LLM_API_KEY ? 'crypto+ai' : 'crypto',
        reason: decision.reason || decision.reasoning || (signal.reasons ? signal.reasons.join('; ') : ''),
        ta_data: JSON.stringify(indicators),
        ai_reasoning: decision.reasoning || decision.reason || (decision.factors ? decision.factors.join('; ') : ''),
        price_at_decision: indicators.price,
        executed: 0,
        execution_reason: '',
      });

      if (decision.action === 'HOLD') {
        await db.updateDecisionStatus(decisionId, 2, 'HOLD');
        skips.add('DECISION_HOLD', 'decision', 'Crypto decision was HOLD; no order was needed', { symbol });
        continue;
      }

      // Protective exits ran before this loop and never consume either
      // discretionary budget. Entries and discretionary exits have separate
      // limits so one class cannot starve the other.
      const budget = cryptoBudgetDecision({
        action: decision.action,
        entryCount,
        maxEntriesPerCycle,
        discretionaryExitCount,
        maxDiscretionaryExitsPerCycle,
      });
      if (!budget.allowed) {
        const limit = decision.action === 'BUY' ? maxEntriesPerCycle : maxDiscretionaryExitsPerCycle;
        await db.updateDecisionStatus(decisionId, 2, `${budget.reasonCode} (${limit})`);
        skips.add(budget.reasonCode ?? 'BUDGET_LIMIT', 'decision', 'Crypto decision skipped because its independent cycle budget was reached', { symbol, limit });
        continue;
      }

      // CLOSE/SELL: exit existing crypto position
      if (decision.action === 'CLOSE' || decision.action === 'SELL') {
        const existingPos = updatedCryptoPositions.find(p => p.symbol === symbol);
        if (existingPos) {
          if (isWithinMinHold(symbol)) {
            await db.updateDecisionStatus(decisionId, 2, `Min hold time not reached (${minHoldMin}min)`);
            skips.add('MIN_HOLD_TIME', 'decision', 'Crypto exit skipped because the position has not reached its minimum hold time', { symbol, minutes: minHoldMin });
            continue;
          }
          const exitCostCheck = riskManager.checkExitCost(existingPos, indicators);
          if (!exitCostCheck.approved) {
            await db.updateDecisionStatus(decisionId, 2, exitCostCheck.reason);
            skips.add('EXIT_COST_GATE', 'decision', 'Crypto discretionary exit skipped because estimated exit costs consumed the gross edge', { symbol, reason: exitCostCheck.reason });
            continue;
          }
          try {
            const order = await alpaca.closePosition(symbol);
            await db.logOrderTrade(order, { decisionId, strategy: 'crypto' });
            if (alpaca.isOrderFullyFilled(order)) {
              await db.closePosition(symbol, existingPos.unrealized_pl, 'crypto_signal');
              await db.updateDecisionStatus(decisionId, 1, 'Position closed');
              tradesExecuted++;
              cycleTradeCount++;
              discretionaryExitCount++;
            } else {
              await db.updateDecisionStatus(decisionId, 0, `Exit order pending: ${order.status}`);
            }
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : 'unknown';
            await db.updateDecisionStatus(decisionId, 3, `Close failed: ${errMsg}`);
            errors.push(`Crypto close failed ${symbol}: ${errMsg}`);
          }
        } else {
          await db.updateDecisionStatus(decisionId, 0, 'No existing position to sell — skipped');
          skips.add('NO_POSITION_TO_EXIT', 'decision', 'Crypto exit skipped because no existing position was found', { symbol });
        }
        continue;
      }

      // BUY: risk check then execute
      if (decision.action === 'BUY') {
        if (recentlySold.has(symbol)) {
          await db.updateDecisionStatus(decisionId, 2, `Re-entry cooldown (${cooldownMin}min)`);
          skips.add('REENTRY_COOLDOWN', 'decision', 'Crypto entry skipped because the symbol was recently sold', { symbol, minutes: cooldownMin });
          continue;
        }

        let recentEntryOrders = 0;
        try {
          recentEntryOrders = await db.countRecentSubmittedOrders('crypto', 'buy', 60);
        } catch (error) {
          await db.updateDecisionStatus(decisionId, 2, 'Persistent entry order-rate state unavailable');
          skips.add('ORDER_RATE_STATE_UNAVAILABLE', 'decision', 'Crypto entry skipped because persistent order-rate state could not be read', { symbol, reason: error instanceof Error ? error.message : String(error) });
          continue;
        }
        if (recentEntryOrders >= (config.maxOrderRatePerMin || 5)) {
          await db.updateDecisionStatus(decisionId, 2, `Persistent entry order-rate limit reached (${recentEntryOrders}/${config.maxOrderRatePerMin || 5})`);
          skips.add('ORDER_RATE_LIMIT', 'decision', 'Crypto entry skipped by persistent D1 order-rate protection', { symbol, recentEntryOrders, limit: config.maxOrderRatePerMin || 5 });
          continue;
        }

        const projected = projectedPositions(exposure);
        const riskCheck = riskManager.checkTrade(decision, account, projected, indicators, exposure.reservedNotionalUsd);
        if (!riskCheck.approved) {
          await db.updateDecisionStatus(decisionId, 2, riskCheck.reason);
          skips.add(classifyCryptoSkip(riskCheck.reason), 'decision', 'Crypto entry skipped by risk controls', { symbol, reason: riskCheck.reason, decisionId });
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

            const terminalRejected = order.status === 'rejected' || order.status === 'canceled' || order.status === 'expired';
            if (!terminalRejected) {
              // Reserve only accepted/pending orders; terminal rejection does not
              // consume cycle exposure or capital.
              reserveEntry(exposure, symbol, riskCheck.adjustedQty * indicators.price);
            }

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
              stop_price: riskCheck.stopLossPrice ?? null,
              estimated_value: riskCheck.adjustedQty * indicators.price,
              decision_id: decisionId,
              error_message: null,
              strategy: 'crypto',
            });

            const accepted = !terminalRejected;
            await db.updateDecisionStatus(decisionId, accepted ? 0 : 2, accepted
              ? `Order submitted: ${riskCheck.adjustedQty} units; broker status ${order.status}`
              : `Order not accepted: ${order.status}`);
            if (accepted) {
              tradesExecuted++;
              cycleTradeCount++;
              entryCount++;
            }
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
    const finalPositions = (await alpaca.getPositions()).filter(p => CRYPTO_UNIVERSE.includes(p.symbol));
    const syncDbPositions = await db.getOpenPositions();
    const dbPositionMap = new Map(syncDbPositions.filter(p => p.strategy === 'crypto').map(p => [p.ticker, p]));
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
      trigger,
      market_open: 1,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: serializeRunDetails(errors, skips),
      status: runStatus(errors, skips, false, tradesExecuted),
    });

    console.log(`Crypto cycle: ${decisionsMade} decisions, ${tradesExecuted} trades, ${errors.length} errors, ${Date.now() - startTime}ms`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Fatal: ${errMsg}`);
    console.error('Crypto cycle failed:', error);
    await db.logRun({
      trigger,
      market_open: 1,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: serializeRunDetails(errors, skips),
      status: 'error',
    });
  }
}

// Swing Trading Strategy Cycle
// Runs once daily after US market close
// Cross-sectional ranking: computes alpha scores for entire universe, rebalances portfolio

import { AlpacaClient, type Bar } from './alpaca';
import { Database } from './database';
import { UniverseScanner } from './scanner';
import {
  computeSwingIndicators,
  scoreAndRank,
  filterUniverse,
  DEFAULT_SWING_CONFIG,
  type SwingScore,
} from './swing-signals';
import { SwingRiskManager, type SwingRiskConfig } from './swing-risk';
import { projectBrokerPositions, summarizeByCategory } from './position-projection';
import type { Env } from './index';
import { SkipReasonCollector, serializeRunDetails, runStatus } from './skip-reasons';
import { syncBrokerLedger } from './broker-ledger';
import { reconcileBrokerOrders } from './order-reconciliation';
import { closeBrokerAbsentPositions, reconcileBrokerQuantityMismatches } from './position-reconciliation';
import { resolveCapitalCapOverride } from './capital-caps';
import {
  assessSwingBars,
  getSwingBarsWindow,
  isSwingEntryDataDegraded,
  SWING_BAR_LIMIT,
} from './swing-data';

export const SWING_FALLBACK_CONFIG = {
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
  minEdgeAfterCosts: 5,     // minimum expected edge after spread/slippage/fees
  expectedEdgeBps: 0,        // disabled until swing edge calibration is available
  exitZScore: -0.5,         // hysteresis: exit below -0.5 sigma
  enableMargin: false,      // no margin on swing (gap risk + margin = ruin)
  earningsBlackoutDays: 3,
  maxTurnoverPct: 30,       // max 30% of portfolio traded per rebalance
  minTradeSize: 0.25,       // skip trades < 0.25% of portfolio
  maxOrderRatePerMin: 15,
  maxCapitalUsd: 3700,      // ~25,000 DKK cap for swing strategy
};

export function resolveSwingConfig(dbConfig: Record<string, string>) {
  const config = { ...SWING_FALLBACK_CONFIG };
  for (const [key, value] of Object.entries(dbConfig)) {
    if (!key.startsWith('swing_')) continue;
    const cleanKey = key.replace('swing_', '');
    if (cleanKey === 'maxCapitalUsd' || cleanKey === 'max_capital_usd') continue;
    const numVal = parseFloat(value);
    if (!isNaN(numVal) && cleanKey in config) {
      (config as any)[cleanKey] = numVal;
    } else if (value === 'true' && cleanKey in config) {
      (config as any)[cleanKey] = true;
    } else if (value === 'false' && cleanKey in config) {
      (config as any)[cleanKey] = false;
    }
  }
  const cap = resolveCapitalCapOverride(dbConfig, 'swing');
  if (cap !== undefined) config.maxCapitalUsd = cap;
  return config;
}

export async function runSwingCycle(env: Env, trigger: string): Promise<void> {
  const leaseStart = Date.now();
  const owner = `swing:${trigger}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const leaseDb = new Database(env.DB);
  const leaseKey = 'swing';
  if (!await leaseDb.acquireCycleLease(owner, undefined, leaseKey)) {
    const skips = new SkipReasonCollector();
    skips.add('CYCLE_LEASE_HELD', 'cycle', 'Skipped because another swing cycle holds the swing lease', { strategy: 'swing', trigger });
    console.log(`Skipping ${trigger}: another swing cycle holds the swing lease`);
    await leaseDb.logRun({ trigger, market_open: 0, duration_ms: Date.now() - leaseStart, decisions_made: 0, trades_executed: 0, errors: 0, error_details: serializeRunDetails([], skips), status: 'skipped' });
    return;
  }
  try {
    await runSwingCycleInner(env, trigger);
  } finally {
    await leaseDb.releaseCycleLease(owner, leaseKey);
  }
}

async function runSwingCycleInner(env: Env, trigger: string): Promise<void> {
  const startTime = Date.now();
  const db = new Database(env.DB);
  const errors: string[] = [];
  const skips = new SkipReasonCollector();
  let decisionsMade = 0;
  let tradesExecuted = 0;
  const findPendingSwingExit = async (symbol: string, context: Record<string, unknown> = {}) => {
    const pending = await db.findNonTerminalExitBySymbol('swing', symbol);
    if (!pending) return undefined;
    skips.add('PENDING_EXIT_EXISTS', 'cycle', 'Swing exit skipped because a non-terminal sell order already exists', {
      strategy: 'swing',
      symbol,
      tradeId: pending.tradeId,
      status: pending.status,
      qty: pending.qty,
      filledQty: pending.filledQty,
      leavesQty: pending.leavesQty,
      alpacaOrderId: pending.alpacaOrderId,
      clientOrderId: pending.clientOrderId,
      brokerUpdatedAt: pending.brokerUpdatedAt,
      lastReconciledAt: pending.lastReconciledAt,
      ...context,
    });
    return pending;
  };

  try {
    await db.assertPositionsStrategySchema();
    const alpaca = new AlpacaClient({
      apiKey: env.ALPACA_API_KEY,
      apiSecret: env.ALPACA_API_SECRET,
      baseUrl: env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });

    try {
      const ledger = await syncBrokerLedger(db, alpaca);
      console.log(`Broker ledger synced: ${ledger.activities} activities, ${ledger.fills} fills, ${ledger.fees} fees`);
    } catch (error) {
      errors.push(`Broker ledger sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Load swing config from D1 (merge with fallback)
    const dbConfig = await db.getConfig();
    const config = resolveSwingConfig(dbConfig);

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
      skips.add('ONCE_PER_DAY', 'cycle', 'Swing already completed a successful run for this UTC day', { trigger, date: today });
      console.log('Swing: already ran today, skipping');
      await db.logRun({
        trigger,
        market_open: clock.is_open ? 1 : 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: 0,
        error_details: serializeRunDetails([], skips),
        status: runStatus(errors, skips, false, tradesExecuted),
      });
      return;
    }

    // Read-only broker status reconciliation before evaluating swing positions.
    const reconciliation = await reconcileBrokerOrders(db, alpaca);
    console.log(`Swing order reconciliation: ${reconciliation.brokerOrders} broker orders, ${reconciliation.pendingLookups} pending lookups, ${reconciliation.lookupFailures} lookup failures`);

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
      // Shared account snapshot: keep swing filtering for risk logic, but
      // count every broker-authoritative position in the account.
      positions_count: allBrokerPositions.length,
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

    // Initialize risk manager. Broker CFEE is crypto-specific; stock FEE
    // remains account-level and is not fabricated into swing attribution.
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
      minEdgeAfterCosts: config.minEdgeAfterCosts || 5,
      expectedEdgeBps: config.expectedEdgeBps || 0,
      observedFeeBps: 0,
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
    const hasQtyMismatch = divergence.details.some(detail => detail.includes('qty mismatch'));
    const internalOnlySymbols = new Set(
      divergence.details
        .filter(detail => detail.includes('in internal but not broker'))
        .map(detail => detail.split(':', 1)[0]),
    );
    if (internalOnlySymbols.size > 0) {
      const pendingSwingSymbols = new Set((await db.getTradesNeedingSync(200))
        .filter(trade => trade.strategy === 'swing')
        .map(trade => String(trade.ticker)));
      const stalePositions = dbPositions.filter(position => internalOnlySymbols.has(position.ticker));
      const closed = await closeBrokerAbsentPositions(db, allBrokerPositions, stalePositions, pendingSwingSymbols);
      if (closed.length > 0) {
        skips.add('BROKER_AUTHORITATIVE_SYNC_ABSENT', 'reconciliation', 'Closed stale swing D1 rows absent from the broker snapshot', {
          strategy: 'swing',
          closed: closed.length,
          symbols: closed,
          pendingExcluded: pendingSwingSymbols.size,
        });
      }
    }
    if (divergence.divergent) {
      const details = divergence.details.join('; ');
      if (hasQtyMismatch) {
        try {
          const reconciled = await reconcileBrokerQuantityMismatches(db, positions, dbPositions);
          if (reconciled > 0) {
            errors.push(`Broker-authoritative quantity persisted for ${reconciled} mismatched position(s)`);
          }
        } catch (error) {
          errors.push(`Broker quantity reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        skips.add('POSITION_QTY_MISMATCH', 'cycle', 'New swing BUY entries blocked by broker/internal quantity mismatch; risk-reducing exits remain eligible', {
          strategy: 'swing',
          mismatchCount: divergence.details.filter(detail => detail.includes('qty mismatch')).length,
          details: divergence.details,
        });
        errors.push(`Broker/internal quantity mismatch detected; new swing entries blocked for this cycle: ${details}`);
        riskManager.haltTrading(`New swing entries blocked by broker/internal quantity mismatch: ${details}`);
      }
    }

    if (riskManager.isTradingHalted() && !hasQtyMismatch) {
      skips.add('RISK_HALTED', 'cycle', 'Swing trading is halted by risk controls', { reason: riskManager.isTradingHalted() });
      console.error(`Swing: trading halted — ${riskManager.isTradingHalted()}`);
      await db.logRun({
        trigger,
        market_open: clock.is_open ? 1 : 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: errors.length,
        error_details: serializeRunDetails(errors, skips),
        status: runStatus(errors, skips, false, tradesExecuted),
      });
      return;
    }

    // Scan universe — swing uses daily bars and an explicit completed-session
    // window. Alpaca's bars endpoint otherwise defaults to the current day;
    // on a post-close cron that can yield empty/partial data.
    const scanner = new UniverseScanner(alpaca, config.maxPositions * 5); // scan 5x what we'll hold
    const candidates = await scanner.scan();
    const barsWindow = getSwingBarsWindow();
    console.log(`Swing: scanning ${candidates.length} candidates; daily bars ${barsWindow.start}..${barsWindow.end}`);

    const diagnostics = {
      candidates: candidates.length,
      barsRequested: SWING_BAR_LIMIT,
      barsPages: 0,
      barsSymbolsWithData: 0,
      barsSymbolsMissing: 0,
      barsWindowStart: barsWindow.start,
      barsWindowEnd: barsWindow.end,
      barsOk: 0,
      barsEmpty: 0,
      barsInvalid: 0,
      barsStale: 0,
      barsShort: 0,
      indicatorFailures: 0,
      filtered: 0,
    };

    // Fetch all candidate histories through Alpaca's multi-symbol endpoint.
    // The old one-request-per-symbol loop could exceed Cloudflare's external
    // subrequest budget before the strategy reached the decision phase.
    let barsBySymbol: Map<string, Bar[]>;
    try {
      const batchBars = await alpaca.getBarsBatch(candidates, '1Day', SWING_BAR_LIMIT, {
        start: barsWindow.start,
        end: barsWindow.end,
      });
      barsBySymbol = batchBars.barsBySymbol;
      diagnostics.barsPages = batchBars.pages;
      diagnostics.barsSymbolsWithData = candidates.filter(symbol => (barsBySymbol.get(symbol) || []).length > 0).length;
      diagnostics.barsSymbolsMissing = candidates.length - diagnostics.barsSymbolsWithData;
    } catch (e) {
      diagnostics.indicatorFailures = candidates.length;
      diagnostics.barsSymbolsMissing = candidates.length;
      const reason = e instanceof Error ? e.message : 'unknown batch-bars failure';
      skips.add('SWING_BARS_BATCH_FAILED', 'cycle', 'Swing historical-bars batch failed; new entries remain blocked until fresh data is available', {
        reason,
        candidates: candidates.length,
        maxPages: 8,
      });
      console.error('Swing: batch bars request failed:', e);
      barsBySymbol = new Map(candidates.map(symbol => [symbol, []]));
    }

    // Compute swing indicators for all candidates. Data quality is assessed
    // before indicators; no stale/partial series can create an entry.
    const indicatorResults = candidates.map(symbol => {
      try {
        const rawBars = barsBySymbol.get(symbol) || [];
        const assessment = assessSwingBars(rawBars, barsWindow.endDate);
        if (assessment.quality === 'ok') diagnostics.barsOk++;
        else if (assessment.quality === 'empty') diagnostics.barsEmpty++;
        else if (assessment.quality === 'invalid') diagnostics.barsInvalid++;
        else if (assessment.quality === 'stale') diagnostics.barsStale++;
        else diagnostics.barsShort++;
        if (assessment.quality !== 'ok') {
          console.warn(`Swing: ${symbol} data ${assessment.quality} (received=${assessment.received}, valid=${assessment.valid}, latest=${assessment.latestBarAt}, staleDays=${assessment.staleDays})`);
          return null;
        }
        return computeSwingIndicators(assessment.bars, symbol);
      } catch (e) {
        diagnostics.indicatorFailures++;
        console.error(`Swing: indicator failed for ${symbol}:`, e);
        return null;
      }
    });
    const validIndicators = indicatorResults.filter((i): i is NonNullable<typeof i> => i !== null);

    // Filter universe by liquidity; existing price/volume/history thresholds
    // remain unchanged.
    const filtered = filterUniverse(validIndicators, config);
    diagnostics.filtered = filtered.length;
    console.log(`Swing: universe diagnostics ${JSON.stringify(diagnostics)}`);

    const entryDataDegraded = isSwingEntryDataDegraded(filtered.length);
    if (entryDataDegraded) {
      const degradedStatus = {
        code: 'SWING_DATA_DEGRADED',
        message: 'Insufficient fresh, valid candidates for new swing entries',
        ...diagnostics,
        requiredFilteredCandidates: 20,
      };
      skips.add('SWING_DATA_DEGRADED', 'cycle', degradedStatus.message, diagnostics);

      console.warn(`Swing: ${JSON.stringify(degradedStatus)}`);

      // Protective handling is deliberately preserved: existing positions
      // still run through the exit phase using the valid ranked universe.
      // New entries are skipped because the cross-sectional sample is unsafe.
      // With no valid universe at all, there are no new-entry decisions.
      if (filtered.length === 0) {
        await db.logRun({
          trigger,
          market_open: clock.is_open ? 1 : 0,
          duration_ms: Date.now() - startTime,
          decisions_made: 0,
          trades_executed: 0,
          errors: errors.length,
          error_details: serializeRunDetails(errors, skips),
          status: runStatus(errors, skips, true),
        });
        return;
      }
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

    const proposedSells: Array<{ symbol: string; value: number; reason: string; exitType: 'protective' | 'discretionary' }> = [];

    for (const pos of positions) {
      if (pos.qty <= 0) continue;
      const score = allScores.get(pos.symbol);

      if (!score) {
        // A degraded data window must not turn missing bars into a sell
        // signal. Preserve the existing position until a complete, fresh
        // cross-section is available again.
        if (entryDataDegraded) {
          skips.add('HELD_DEGRADED_DATA', 'position', 'Held position preserved because no fresh score was available during a degraded run', { symbol: pos.symbol });
          console.warn(`Swing: preserving ${pos.symbol}; no fresh score during degraded data run`);
          continue;
        }
        skips.add('HELD_NO_SCORE', 'position', 'Held position has no current score; it was preserved only when data was degraded', { symbol: pos.symbol });
        // Stock not in current universe (could be delisted, illiquid, etc.) — exit
        const reason = 'Protective data-integrity exit: held symbol has no current score';
        skips.add('HELD_NO_SCORE_EXIT', 'position', reason, { symbol: pos.symbol, exitType: 'protective' });
        proposedSells.push({ symbol: pos.symbol, value: Math.abs(pos.market_value), reason, exitType: 'protective' });
        decisionsMade++;
        continue;
      }

      const exitCheck = riskManager.checkExit(score, pos);
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
          exitType: exitCheck.exitType,
        }),
        price_at_decision: pos.current_price,
        executed: 0,
        execution_reason: '',
      });

      if (exitCheck.shouldExit) {
        proposedSells.push({ symbol: pos.symbol, value: Math.abs(pos.market_value), reason: exitCheck.reason, exitType: exitCheck.exitType === 'protective' ? 'protective' : 'discretionary' });
      }
    }

    // Execute sells
    for (const sell of proposedSells) {
      try {
        const pendingExit = await findPendingSwingExit(sell.symbol, { exitType: sell.exitType, reason: sell.reason });
        if (pendingExit) continue;
        const pos = positions.find(p => p.symbol === sell.symbol);
        const order = await alpaca.closePosition(sell.symbol);
        await db.logOrderTrade(order, { strategy: 'swing' });
        console.log(`Swing ${sell.exitType} exit ${sell.symbol}: ${sell.reason}`);
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

    const proposedBuys: Array<{ symbol: string; value: number; score: SwingScore; decisionId: number }> = [];
    let plannedEntryNotionalUsd = 0;
    const submittedSwingEntrySymbols = new Set<string>();

    for (const score of entryDataDegraded ? [] : buyCandidates) {
      // Skip if already holding
      if (heldSymbols.has(score.symbol)) {
        skips.add('HELD_POSITION', 'decision', 'Entry skipped because the symbol is already held', { symbol: score.symbol });
        continue;
      }

      // Earnings blackout (placeholder — would need earnings calendar API)
      // const earningsCal = new Map(); // TODO: integrate earnings calendar
      // if (riskManager.isEarningsBlackout(score.symbol, earningsCal)) continue;

      const price = score.indicators.price;
      const riskCheck = riskManager.checkEntry(score, updatedAccount, updatedPositions, price, plannedEntryNotionalUsd);
      decisionsMade++;

      const decisionId = await db.logDecision({
        ticker: score.symbol,
        action: 'BUY',
        confidence: Math.max(0, Math.min(1, score.percentile / 100)),
        signal_source: 'swing',
        reason: riskCheck.reason,
        ta_data: JSON.stringify(score.indicators),
        ai_reasoning: JSON.stringify({ rank: score.rank, percentile: score.percentile, signals: score.signals }),
        price_at_decision: price,
        executed: 0,
        execution_reason: '',
      });

      if (riskCheck.approved && riskCheck.adjustedQty) {
        const proposedValue = riskCheck.adjustedValue || 0;
        plannedEntryNotionalUsd += proposedValue;
        proposedBuys.push({ symbol: score.symbol, value: proposedValue, score, decisionId });
      } else {
        await db.updateDecisionStatus(decisionId, 2, riskCheck.reason);
        const skipCode = riskCheck.reason.includes('capital cap') ? 'CAPITAL_CAP' : 'NO_ENTRY_RISK';
        skips.add(skipCode, 'decision', 'Swing entry skipped by risk controls', { symbol: score.symbol, reason: riskCheck.reason, plannedEntryNotionalUsd });
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

    // Execute buys (respecting turnover control). A degraded cross-sectional
    // sample may still support protective exits, but never new entries.
    const buyTradeMap = new Map(turnoverFiltered.filter(t => t.side === 'buy').map(t => [t.symbol, t]));

    if (entryDataDegraded) {
      skips.add('SWING_NO_ENTRY_DEGRADED', 'cycle', 'All new swing entries skipped because the fresh filtered universe is below 20 candidates', { filtered: filtered.length, required: 20 });
      console.warn('Swing: skipping all new entries because the fresh filtered universe is below 20 candidates');
    }

    for (const buy of entryDataDegraded ? [] : proposedBuys) {
      const tradeInfo = buyTradeMap.get(buy.symbol);
      if (tradeInfo?.skipped) {
        skips.add('TURNOVER_LIMIT', 'decision', 'Entry skipped by swing turnover control', { symbol: buy.symbol, reason: tradeInfo.reason });
        console.log(`Swing: skip buy ${buy.symbol}: ${tradeInfo.reason}`);
        continue;
      }

      const price = buy.score.indicators.price;
      const qty = Math.floor((buy.value) / price) || Math.round((buy.value / price) * 100) / 100;
      if (qty < 0.01) {
        skips.add('MIN_ORDER_SIZE', 'decision', 'Entry skipped because calculated quantity is below minimum order size', { symbol: buy.symbol, qty });
        continue;
      }

      const clientOrderId = `swing_${buy.decisionId}_${buy.symbol}`;
      // Deterministic client order ID lets a retry of the same decision be
      // identified and skipped before it reaches the broker. A non-terminal
      // existing trade means this order is already open/accepted/filled.
      const existingTrade = await db.findNonTerminalTradeByClientOrderId(clientOrderId);
      if (existingTrade) {
        skips.add('DUPLICATE_ORDER_PREVENTED', 'decision', 'Swing BUY skipped because a non-terminal order with the same client order ID already exists', { symbol: buy.symbol, decisionId: buy.decisionId, tradeId: existingTrade.tradeId, status: existingTrade.status });
        await db.updateDecisionStatus(buy.decisionId, 2, `Duplicate swing BUY skipped: order already open (status ${existingTrade.status})`);
        console.log(`Swing: skip buy ${buy.symbol}: duplicate client_order_id ${clientOrderId}`);
        continue;
      }

      try {
        const order = await alpaca.submitOrder({
          symbol: buy.symbol,
          qty: qty,
          side: 'buy',
          type: 'market',
          time_in_force: 'day',
          client_order_id: clientOrderId,
        });

        await db.logOrderTrade(order, {
          decisionId: buy.decisionId,
          estimatedValue: qty * price,
          strategy: 'swing',
        });

        // Position is deliberately not upserted here. Broker-confirmed sync below
        // creates/updates the current position using actual filled quantity.
        submittedSwingEntrySymbols.add(buy.symbol);
        const terminalRejected = ['rejected', 'canceled', 'cancelled', 'expired', 'done_for_day', 'stopped'].includes(order.status);
        const fullyFilled = order.status === 'filled' && order.filled_qty > 0 && order.filled_qty >= order.qty * 0.999;
        await db.updateDecisionStatus(buy.decisionId, fullyFilled ? 1 : terminalRejected ? 2 : 0, fullyFilled
          ? `Broker confirmed fill: ${order.filled_qty}/${order.qty} @ ${order.filled_avg_price ?? 'unknown'}`
          : terminalRejected
            ? `Broker order terminal status: ${order.status}`
            : `Broker order status: ${order.status}; filled ${order.filled_qty}/${order.qty}`);
        if (fullyFilled) tradesExecuted++;
        console.log(`Swing BUY ${buy.symbol}: ${qty} shares @ ~$${price.toFixed(2)} (rank #${buy.score.rank}, z=${buy.score.compositeScore.toFixed(2)})`);
      } catch (e) {
        errors.push(`Swing buy failed ${buy.symbol}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // Sync positions
    const knownSwingTrades = await db.getRecentTradesByStrategy('swing', 200);
    const knownSwingBuySymbols = new Set(knownSwingTrades
      .filter(trade => trade.side === 'buy' && !['rejected', 'canceled', 'cancelled', 'expired', 'replaced', 'done_for_day', 'stopped'].includes(String(trade.status || '').toLowerCase()))
      .map(trade => String(trade.ticker)));
    const finalPositions = (await alpaca.getPositions()).filter(p => {
      const existing = allDbPositions.find(x => x.ticker === p.symbol);
      return existing?.strategy === 'swing' || submittedSwingEntrySymbols.has(p.symbol) || knownSwingBuySymbols.has(p.symbol);
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
        strategy: 'swing',
      });
    }

    const pendingSwingSymbols = new Set((await db.getTradesNeedingSync(200))
      .filter(trade => trade.strategy === 'swing')
      .map(trade => String(trade.ticker)));
    const finalBrokerSymbols = new Set(finalPositions.map(pos => pos.symbol));
    for (const dbPos of syncDbPositions.filter(position => position.strategy === 'swing')) {
      if (!finalBrokerSymbols.has(dbPos.ticker) && !pendingSwingSymbols.has(dbPos.ticker)) {
        await db.closePosition(dbPos.ticker, 0, 'broker_authoritative_sync_absent');
      }
    }

    // Log run
    await db.logRun({
      trigger,
      market_open: clock.is_open ? 1 : 0,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: serializeRunDetails(errors, skips),
      status: runStatus(errors, skips, entryDataDegraded, tradesExecuted),
    });

    console.log(`Swing cycle complete: ${decisionsMade} decisions, ${tradesExecuted} trades, ${errors.length} errors, ${Date.now() - startTime}ms`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'unknown';
    errors.push(`Fatal: ${errMsg}`);
    console.error('Swing cycle failed:', error);

    await db.logRun({
      trigger,
      market_open: 0,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: serializeRunDetails(errors, skips),
      status: 'error',
    });
  }
}

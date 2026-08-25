// Main Worker Entry Point
// Handles cron triggers, manual API calls, and the full trading cycle

import { AlpacaClient } from './alpaca';
import { analyze, generateSignal, ema, atr, type TASignal } from './technical-analysis';
import { refineWithLLM, detectMarketRegime, type AIMarketContext } from './ai-decision';
import { RiskManager, type RiskConfig, type RiskCheckResult } from './risk-manager';
import { Database } from './database';
import { UniverseScanner } from './scanner';
import { DashboardAPI } from './api';
import { runSwingCycle } from './swing-strategy';
import { runCryptoCycle } from './crypto-strategy';
import { projectBrokerPositions, summarizeByCategory } from './position-projection';
import { SkipReasonCollector, serializeDecisionSkip, serializeRunDetails, runStatus } from './skip-reasons';
import { syncBrokerLedger } from './broker-ledger';
import { reconcileBrokerOrders } from './order-reconciliation';
import { reconcileBrokerQuantityMismatches } from './position-reconciliation';
import { resolveCapitalCapOverride } from './capital-caps';
import { assessIntradayBars, DAYTRADING_BAR_INTERVAL_SECONDS, DAYTRADING_MAX_BAR_STALE_INTERVALS } from './market-data-quality';
import { accountWithEquityDirection, resolveEquityDirection } from './equity-observability';

export interface Env {
  DB: D1Database;
  ALPACA_API_KEY: string;
  ALPACA_API_SECRET: string;
  ALPACA_BASE_URL: string;
  LLM_API_KEY: string;
}

/**
 * Keep daytrading RiskManager rejections durable in the shared structured skip
 * stream without changing the existing decision reason or broker path.
 */
export function daytradingRiskSkipCode(reason: string): string {
  return reason.toLowerCase().includes('capital cap') || reason.toLowerCase().includes('available cash')
    ? 'CAPITAL_CAP'
    : 'NO_ENTRY_RISK';
}

export function daytradingRiskSkipContext(input: {
  symbol: string;
  decisionId: number;
  action: 'BUY' | 'SELL';
  riskCheck: RiskCheckResult;
}): Record<string, unknown> {
  const context: Record<string, unknown> = {
    strategy: 'daytrading',
    symbol: input.symbol,
    decision_id: input.decisionId,
    action: input.action,
    reason: input.riskCheck.reason,
  };
  if (Number.isFinite(input.riskCheck.estimatedCostBps)) context.estimated_cost_bps = input.riskCheck.estimatedCostBps;
  if (Number.isFinite(input.riskCheck.estimatedCosts)) context.estimated_cost_usd = input.riskCheck.estimatedCosts;
  if (Number.isFinite(input.riskCheck.edgeAfterCosts)) context.edge_after_costs = input.riskCheck.edgeAfterCosts;
  return context;
}

/** Alpaca's confirmed minimum notional for daytrading stock BUY submissions. */
export const DAYTRADING_MIN_ORDER_NOTIONAL_USD = 1;

export interface DaytradingBuyNotionalCheck {
  approved: boolean;
  estimatedNotionalUsd: number;
  minimumNotionalUsd: number;
  reason: string;
}

/**
 * Read-only preflight for the broker's minimum stock order notional. This is
 * intentionally limited to daytrading BUY entries; exits and protective
 * orders remain broker-authoritative and are never routed through this check.
 */
export function checkDaytradingBuyMinimumNotional(
  qty: number,
  price: number,
  minimumNotionalUsd = DAYTRADING_MIN_ORDER_NOTIONAL_USD,
): DaytradingBuyNotionalCheck {
  const estimatedNotionalUsd = qty * price;
  const approved = Number.isFinite(estimatedNotionalUsd) && estimatedNotionalUsd >= minimumNotionalUsd;
  return {
    approved,
    estimatedNotionalUsd,
    minimumNotionalUsd,
    reason: approved
      ? 'Daytrading BUY meets the broker minimum order notional'
      : `Daytrading BUY estimated notional $${Number.isFinite(estimatedNotionalUsd) ? estimatedNotionalUsd.toFixed(2) : 'invalid'} is below the broker minimum order notional $${minimumNotionalUsd.toFixed(2)}`,
  };
}

/** Read-only order-record estimate for a daytrading position exit. */
export function daytradingExitEstimatedValue(
  order: { qty: number; filled_avg_price: number | null },
  position: { qty: number; current_price: number; market_value: number },
): number | undefined {
  const price = Number.isFinite(position.current_price) && position.current_price > 0
    ? position.current_price
    : position.qty > 0 && Number.isFinite(position.market_value) && position.market_value > 0
      ? position.market_value / position.qty
      : undefined;
  return price !== undefined && Number.isFinite(order.qty) && order.qty > 0 ? order.qty * price : undefined;
}

// Default fallback config if D1 is empty
const CRYPTO_SYMBOLS = new Set([
  'BTCUSD','ETHUSD','SOLUSD','AVAXUSD','LINKUSD','MATICUSD','DOTUSD','UNIUSD',
  'ATOMUSD','LTCUSD','BCHUSD','NEARUSD','AAVEUSD','XLMUSD','ALGOUSD',
]);

export const FALLBACK_CONFIG = {
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

export function resolveDaytradingConfig(dbConfig: Record<string, string>) {
  const config = { ...FALLBACK_CONFIG };
  for (const [key, value] of Object.entries(dbConfig)) {
    if (key === 'maxCapitalUsd' || key === 'max_capital_usd') continue;
    if (key in config) {
      const numVal = parseFloat(value);
      if (!isNaN(numVal)) (config as any)[key] = numVal;
      else if (value === 'true') (config as any)[key] = true;
      else if (value === 'false') (config as any)[key] = false;
      else (config as any)[key] = value;
    }
  }
  const cap = resolveCapitalCapOverride(dbConfig, 'daytrading');
  if (cap !== undefined) config.maxCapitalUsd = cap;
  return config;
}

export async function positionsStrategySchemaReady(db: D1Database): Promise<boolean> {
  try {
    const column = await db.prepare(
      `SELECT 1 FROM pragma_table_info('positions') WHERE name = ? LIMIT 1`
    ).bind('strategy').first();
    return Boolean(column);
  } catch (error) {
    console.error('Required positions schema check failed:', error);
    return false;
  }
}

async function logSchemaBlockedRun(env: Env, trigger: string): Promise<void> {
  const skips = new SkipReasonCollector();
  skips.add(
    'REQUIRED_SCHEMA_MISSING',
    'schema',
    'Strategy cycle skipped because positions.strategy is unavailable; apply positions-strategy-column-migration.sql before enabling strategy cycles',
    { required: 'positions.strategy', migration: 'positions-strategy-column-migration.sql', failClosed: true },
  );
  try {
    await env.DB.prepare(
      `INSERT INTO run_log (trigger, market_open, duration_ms, decisions_made, trades_executed, errors, error_details, status)
       VALUES (?, 0, 0, 0, 0, 0, ?, 'skipped')`
    ).bind(
      trigger,
      serializeRunDetails([], skips),
    ).run();
  } catch (error) {
    console.error('Unable to record schema-blocked strategy run:', error);
  }
}

async function runStrategyWithSchemaGate(env: Env, trigger: string, cycle: (env: Env, trigger: string) => Promise<void>): Promise<void> {
  if (!await positionsStrategySchemaReady(env.DB)) {
    await logSchemaBlockedRun(env, trigger);
    return;
  }
  await cycle(env, trigger);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Schema changes are explicit migrations, not per-cron side effects. Strategy
    // cycles are gated by a read-only readiness check and fail closed if legacy
    // D1 has not yet received positions-strategy-column-migration.sql.
    if (event.cron === '0 22 * * 1-5') {
      ctx.waitUntil(runStrategyWithSchemaGate(env, 'swing_cron', runSwingCycle));
    } else if (event.cron === '7-59/30 * * * *') {
      ctx.waitUntil(runStrategyWithSchemaGate(env, 'crypto_cron', runCryptoCycle));
    } else if (event.cron === '*/5 13-21 * * 1-5') {
      ctx.waitUntil(runStrategyWithSchemaGate(env, 'cron', runTradingCycleWithLease));
    } else if (event.cron === '*/10 * * * *') {
      ctx.waitUntil(runScheduledMaintenance(env, 'reconcile_cron'));
    } else {
      console.warn(`Ignoring unknown cron expression: ${event.cron}`);
    }
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const api = new DashboardAPI(env);
    return api.handle(request);
  },
};

/**
 * Lease-protected, read-only broker maintenance. This path deliberately does
 * not evaluate signals or submit/cancel/retry orders. It only imports recent
 * broker order state and the fee/fill ledger, then records a structured run.
 */
export async function runScheduledMaintenance(env: Env, trigger = 'maintenance'): Promise<void> {
  const started = Date.now();
  const owner = `maintenance:${trigger}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const db = new Database(env.DB);
  const leaseKey = 'maintenance';
  const skips = new SkipReasonCollector();
  const errors: string[] = [];
  let ledgerDegraded = false;
  let reconciliationDegraded = false;
  if (!await db.acquireCycleLease(owner, undefined, leaseKey)) {
    skips.add('CYCLE_LEASE_HELD', 'maintenance', 'Maintenance skipped because another maintenance run holds the maintenance lease', { trigger });
    console.log(JSON.stringify({ event: 'maintenance_skipped', trigger, reason: 'cycle_lease_held' }));
    await db.logRun({
      trigger,
      market_open: 0,
      duration_ms: Date.now() - started,
      decisions_made: 0,
      trades_executed: 0,
      errors: 0,
      error_details: serializeRunDetails([], skips),
      status: 'skipped',
    });
    return;
  }

  try {
    const alpaca = new AlpacaClient({
      apiKey: env.ALPACA_API_KEY,
      apiSecret: env.ALPACA_API_SECRET,
      baseUrl: env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });
    const reconciliation = await reconcileBrokerOrders(db, alpaca);
    if (reconciliation.lookupFailures > 0) {
      reconciliationDegraded = true;
      skips.add('BROKER_ORDER_LOOKUP_DEGRADED', 'reconciliation', 'One or more broker order lookups failed; unresolved local orders remain for a later read-only pass', {
        lookupFailures: reconciliation.lookupFailures,
        pendingLookups: reconciliation.pendingLookups,
      });
    }
    let ledger: Awaited<ReturnType<typeof syncBrokerLedger>> | null = null;
    try {
      ledger = await syncBrokerLedger(db, alpaca);
    } catch (error) {
      errors.push(`Broker ledger sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // D1 free-tier optimization: prune old data once per day to keep table
    // scans bounded. Uses a date watermark so it only runs on the first
    // maintenance cycle after 00:00 UTC.
    try {
      const today = new Date().toISOString().slice(0, 10);
      const lastPrune = await db.getConfigValue('last_prune_date');
      if (lastPrune !== today) {
        const pruneResult = await db.pruneOldData();
        await db.setConfig('last_prune_date', today);
        console.log(JSON.stringify({ event: 'retention_prune_complete', trigger, ...pruneResult }));
      }
    } catch (pruneError) {
      console.log(JSON.stringify({ event: 'retention_prune_failed', trigger, error: pruneError instanceof Error ? pruneError.message : String(pruneError) }));
    }
    if (errors.length === 0) {
      if (ledger?.degraded) {
        ledgerDegraded = true;
        skips.add('BROKER_LEDGER_DEGRADED', 'reconciliation', 'Broker activity import reached its explicit page budget; the next scheduled overlap will continue convergence', {
          pages: ledger.pages,
          pageBudget: ledger.pageBudget,
          activities: ledger.activities,
        });
      }
      skips.add('MAINTENANCE_ONLY', 'maintenance', 'Scheduled maintenance reconciled broker state without running a trading strategy', {
        brokerOrders: reconciliation.brokerOrders,
        imported: reconciliation.imported,
        pendingLookups: reconciliation.pendingLookups,
        lookupFailures: reconciliation.lookupFailures,
        ledgerActivities: ledger?.activities ?? 0,
        ledgerPages: ledger?.pages ?? 0,
        ledgerPageBudget: ledger?.pageBudget ?? 0,
        ledgerTruncated: ledger?.truncated ?? false,
        ledgerDegraded: ledger?.degraded ?? false,
      });
    }
    console.log(JSON.stringify({ event: 'maintenance_complete', trigger, reconciliation, ledger, errors }));
  } catch (error) {
    errors.push(`Order reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error(JSON.stringify({ event: 'maintenance_error', trigger, errors }));
  } finally {
    try {
      await db.logRun({
        trigger,
        market_open: 0,
        duration_ms: Date.now() - started,
        decisions_made: 0,
        trades_executed: 0,
        errors: errors.length,
        error_details: serializeRunDetails(errors, skips),
        status: errors.length > 0 ? 'error' : (ledgerDegraded || reconciliationDegraded) ? 'degraded' : 'ok',
      });
    } finally {
      await db.releaseCycleLease(owner, leaseKey);
    }
  }
}

// ============================================================
// Main Trading Cycle


async function runTradingCycleWithLease(env: Env, trigger: string): Promise<void> {
  const leaseStart = Date.now();
  const owner = `daytrading:${trigger}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const db = new Database(env.DB);
  const leaseKey = 'daytrading';
  if (!await db.acquireCycleLease(owner, undefined, leaseKey)) {
    const skips = new SkipReasonCollector();
    skips.add('CYCLE_LEASE_HELD', 'cycle', 'Skipped because another daytrading cycle holds the daytrading lease', { strategy: 'daytrading', trigger });
    console.log(`Skipping ${trigger}: another daytrading cycle holds the daytrading lease`);
    await db.logRun({ trigger, market_open: 0, duration_ms: Date.now() - leaseStart, decisions_made: 0, trades_executed: 0, errors: 0, error_details: serializeRunDetails([], skips), status: 'skipped' });
    return;
  }
  try {
    await runTradingCycle(env, trigger);
  } finally {
    await db.releaseCycleLease(owner, leaseKey);
  }
}

async function runTradingCycle(env: Env, trigger: string): Promise<void> {
  const startTime = Date.now();
  const db = new Database(env.DB);
  const errors: string[] = [];
  const skips = new SkipReasonCollector();
  let ledgerDegraded = false;
  let decisionsMade = 0;
  let tradesExecuted = 0;
  let analyzedCandidates = 0;
  let filteredCandidates = 0;
  const findPendingDayExit = async (symbol: string, scope: string, context: Record<string, unknown> = {}) => {
    const pending = await db.findNonTerminalExitBySymbol('daytrading', symbol);
    if (!pending) return undefined;
    skips.add('PENDING_EXIT_EXISTS', scope, 'Stock exit skipped because a non-terminal sell order already exists', {
      strategy: 'daytrading',
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
    // 1. Initialize clients
    const alpaca = new AlpacaClient({
      apiKey: env.ALPACA_API_KEY,
      apiSecret: env.ALPACA_API_SECRET,
      baseUrl: env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });

    // Reconcile broker order lifecycle before any strategy reads state. This
    // is read-only against Alpaca: no submit, cancel, retry, or replace.
    try {
      const reconciliation = await reconcileBrokerOrders(db, alpaca);
      console.log(JSON.stringify({ event: 'order_reconciliation', trigger, ...reconciliation }));
    } catch (error) {
      errors.push(`Order reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 2. Load config
    const dbConfig = await db.getConfig();
    const config = resolveDaytradingConfig(dbConfig);

    // 3. Check market status
    const clock = await alpaca.getClock();
    if (!clock.is_open) {
      skips.add('MARKET_CLOSED', 'cycle', 'Market is closed; no daytrading actions were evaluated', { nextOpen: clock.next_open });
      console.log('Market closed, skipping cycle');
      await db.logRun({
        trigger,
        market_open: 0,
        duration_ms: Date.now() - startTime,
        decisions_made: 0,
        trades_executed: 0,
        errors: 0,
        error_details: serializeRunDetails([], skips),
        status: runStatus(errors, skips, ledgerDegraded, tradesExecuted),
      });
      return;
    }

    try {
      // D1 write-budget optimization: syncBrokerLedger runs in the 10-min
      // maintenance cycle only. Running it here too doubled the daily upsert
      // load (up to ~126k writes/day) against the D1 free-tier 100k limit.
      // Maintenance already converges with a 3-day overlap window.
      console.log(JSON.stringify({ event: 'broker_ledger_sync_skipped', trigger, reason: 'deferred_to_maintenance' }));
    } catch (error) {
      errors.push(`Broker ledger sync failed: ${error instanceof Error ? error.message : String(error)}`);
    }

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

    // Restore the durable rolling equity window before appending this cycle's
    // snapshot. RiskManager instances are recreated on every Worker run.
    const recentEquityHistory = await db.getRecentEquityHistory();
    const equityDirection = resolveEquityDirection(account);
    const accountForRisk = accountWithEquityDirection(account);
    if (equityDirection.fallbackUsed) {
      skips.add('EQUITY_DIRECTION_FALLBACK', 'account', 'Broker daily change was zero or unavailable; equity delta is exposed for observability without weakening risk controls', {
        source: equityDirection.source,
        change_today_pct: account.change_today_pct,
        equity: account.equity,
        last_equity: account.last_equity,
        fallback_change_today_pct: equityDirection.changeTodayPct,
        reason: equityDirection.reason,
      });
    }

    // Log performance snapshot
    await db.logSnapshot({
      account_id: account.id,
      equity: account.equity,
      cash: account.cash,
      buying_power: account.buying_power,
      portfolio_value: account.portfolio_value,
      long_market_value: account.long_market_value,
      short_market_value: account.short_market_value,
      // This is an account-wide snapshot. Risk filtering above remains
      // strategy-specific, but the snapshot count must include every
      // broker-authoritative position.
      positions_count: allBrokerPositions.length,
      daily_pl: accountForRisk.change_today,
      daily_plpc: accountForRisk.change_today_pct,
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
      observedFeeBps: 0,
      maxCapitalUsd: config.maxCapitalUsd || 0,
    };
    const riskManager = new RiskManager(riskConfig, recentEquityHistory);

    // Update kill switch with the current broker equity after loading durable history.
    riskManager.updateEquitySnapshot(accountForRisk.equity);

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
        // Keep the safety halt for this cycle, but persist the broker quantity
        // so a stale D1 quantity does not reproduce the same halt forever.
        try {
          const reconciled = await reconcileBrokerQuantityMismatches(db, positions, dbPositions);
          if (reconciled > 0) {
            errors.push(`Broker-authoritative quantity persisted for ${reconciled} mismatched position(s)`);
          }
        } catch (error) {
          errors.push(`Broker quantity reconciliation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        skips.add('POSITION_QTY_MISMATCH', 'cycle', 'New daytrading BUY entries blocked by broker/internal quantity mismatch; risk-reducing exits remain eligible', {
          strategy: 'daytrading',
          mismatchCount: divergence.details.filter(detail => detail.includes('qty mismatch')).length,
          details: divergence.details,
        });
        errors.push(`Broker/internal quantity mismatch detected; new entries blocked for this cycle: ${details}`);
        riskManager.haltTrading(`New entries blocked by broker/internal quantity mismatch: ${details}`);
        console.error(`DIVERGENCE (new entries blocked): ${details}`);
      } else {
        // Auto-reconcile: upsert all broker positions into DB. This is a
        // successful broker-authoritative repair, not an execution error.
        console.warn(`DIVERGENCE (auto-reconciling): ${details}`);
        skips.add('BROKER_ONLY_RECONCILED', 'reconciliation', 'Broker-authoritative position divergence reconciled into D1', {
          details: divergence.details,
        });
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
            await db.closePosition(dbPos.ticker, null, 'auto_reconcile_not_in_broker');
          }
        }
      }
    }

    // 6. Check existing positions for stop loss / take profit (ATR-based).
    // Keep a local closed-symbol set so later EOD/signal phases cannot submit
    // duplicate close orders against the stale broker snapshot from this cycle.
    const closedSymbols = new Set<string>();
    const positionActions = riskManager.checkPositions(positions, dbPositions);
    for (const action of positionActions) {
      if (action.priority === 'critical' || action.priority === 'high') {
        try {
          const pendingExit = await findPendingDayExit(action.symbol, 'position', { exitType: 'protective' });
          if (pendingExit) continue;
          console.log(`Closing ${action.symbol}: ${action.reason}`);
          const order = await alpaca.closePosition(action.symbol);
          const pos = positions.find(p => p.symbol === action.symbol);
          await db.logOrderTrade(order, {
            strategy: dbPositions.find(p => p.ticker === action.symbol)?.strategy ?? 'daytrading',
            estimatedValue: pos ? daytradingExitEstimatedValue(order, pos) : undefined,
          });
          if (pos && alpaca.isOrderFullyFilled(order)) {
            await db.closePosition(action.symbol, null, action.reason);
            closedSymbols.add(action.symbol);
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
          if (closedSymbols.has(pos.symbol)) continue;
          const pendingExit = await findPendingDayExit(pos.symbol, 'cycle', { exitType: 'eod_flatten' });
          if (pendingExit) continue;
          const order = await alpaca.closePosition(pos.symbol);
          closeOrders.push(order);
          await db.logOrderTrade(order, {
            strategy: 'daytrading',
            estimatedValue: daytradingExitEstimatedValue(order, pos),
          });
          if (alpaca.isOrderFullyFilled(order)) {
            await db.closePosition(pos.symbol, null, 'eod_flatten');
            closedSymbols.add(pos.symbol);
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
        const assessment = assessIntradayBars(bars, DAYTRADING_BAR_INTERVAL_SECONDS, new Date(), DAYTRADING_MAX_BAR_STALE_INTERVALS);
        if (assessment.quality !== 'ok') {
          const code = assessment.quality === 'future' ? 'DAYTRADING_BARS_FUTURE' : assessment.quality === 'stale' ? 'DAYTRADING_BARS_STALE' : 'DAYTRADING_BARS_UNAVAILABLE';
          skips.add(code, 'data', 'Daytrading signal skipped because the latest bar timestamp failed freshness validation', { strategy: 'daytrading', symbol: pos.symbol, quality: assessment.quality, latestBarAt: assessment.latestBarAt, futureBarAt: assessment.futureBarAt, ageSeconds: assessment.ageSeconds, maxStaleSeconds: assessment.maxStaleSeconds, received: assessment.received, valid: assessment.valid });
          return null;
        }
        if (assessment.bars.length < 30) {
          skips.add('DAYTRADING_BARS_SHORT', 'data', 'Daytrading signal skipped because the validated bar history is too short', { strategy: 'daytrading', symbol: pos.symbol, bars: assessment.bars.length, required: 30, latestBarAt: assessment.latestBarAt });
          return null;
        }
        const indicators = analyze(assessment.bars, pos.symbol, taConfig);
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
        const assessment = assessIntradayBars(bars, DAYTRADING_BAR_INTERVAL_SECONDS, new Date(), DAYTRADING_MAX_BAR_STALE_INTERVALS);
        if (assessment.quality !== 'ok') {
          const code = assessment.quality === 'future' ? 'DAYTRADING_BARS_FUTURE' : assessment.quality === 'stale' ? 'DAYTRADING_BARS_STALE' : 'DAYTRADING_BARS_UNAVAILABLE';
          skips.add(code, 'data', 'Daytrading signal skipped because the latest bar timestamp failed freshness validation', { strategy: 'daytrading', symbol, quality: assessment.quality, latestBarAt: assessment.latestBarAt, futureBarAt: assessment.futureBarAt, ageSeconds: assessment.ageSeconds, maxStaleSeconds: assessment.maxStaleSeconds, received: assessment.received, valid: assessment.valid });
          return null;
        }
        if (assessment.bars.length < 30) {
          skips.add('DAYTRADING_BARS_SHORT', 'data', 'Daytrading signal skipped because the validated bar history is too short', { strategy: 'daytrading', symbol, bars: assessment.bars.length, required: 30, latestBarAt: assessment.latestBarAt });
          return null;
        }
        const indicators = analyze(assessment.bars, symbol, taConfig);
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
    analyzedCandidates = signals.length;
    const actionableSignals = signals.filter(s => s.action !== 'HOLD' || s.confidence > 0.7);
    // For held positions, also include HOLD signals (potential CLOSE)
    const heldPositionSignals = signals.filter(s => positions.some(p => p.symbol === s.indicators.symbol));
    const signalsToProcess = [...new Set([...actionableSignals, ...heldPositionSignals])];
    filteredCandidates = signalsToProcess.length;

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
    let cycleEntryNotionalUsd = 0;
    const maxTradesPerCycle = config.maxTradesPerCycle || 3;

    // 11. AI refinement
    const marketContext: AIMarketContext = {
      account: {
        equity: account.equity,
        cash: account.cash,
        positionsCount: positions.length,
        dailyPlPct: accountForRisk.change_today_pct,
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
        skips.add('DECISION_HOLD', 'decision', 'Decision was HOLD; no order was needed', { symbol: signal.indicators.symbol });
        continue;
      }

      // Anti-churn: max trades per cycle limit
      if (cycleTradeCount >= maxTradesPerCycle) {
        await db.updateDecisionStatus(decisionId, 2, `Max trades per cycle reached (${maxTradesPerCycle})`);
        skips.add('MAX_TRADES_PER_CYCLE', 'decision', 'Skipped because the per-cycle trade limit was reached', { symbol: signal.indicators.symbol, limit: maxTradesPerCycle });
        continue;
      }

      // CLOSE: close existing position
      if (decision.action === 'CLOSE') {
        const existingPos = closedSymbols.has(signal.indicators.symbol) ? undefined : positions.find(p => p.symbol === signal.indicators.symbol);
        if (existingPos) {
          const pendingExit = await findPendingDayExit(signal.indicators.symbol, 'decision', { exitType: 'close', decisionId });
          if (pendingExit) {
            await db.updateDecisionStatus(decisionId, 2, `Pending exit already exists: ${pendingExit.status}`);
            continue;
          }
          // Anti-churn: check minimum hold time (unless stop loss was hit via checkPositions already)
          if (isWithinMinHold(signal.indicators.symbol)) {
            await db.updateDecisionStatus(decisionId, 2, `Min hold time not reached (${minHoldMin}min)`);
            skips.add('MIN_HOLD_TIME', 'decision', 'Skipped because the position has not reached its minimum hold time', { symbol: signal.indicators.symbol, minutes: minHoldMin });
            console.log(`Skip CLOSE ${signal.indicators.symbol}: held < ${minHoldMin} min`);
            continue;
          }
          const exitCostCheck = riskManager.checkExitCost(existingPos, signal.indicators);
          if (!exitCostCheck.approved) {
            await db.updateDecisionStatus(decisionId, 2, exitCostCheck.reason);
            skips.add('EXIT_COST_GATE', 'decision', 'Daytrading discretionary close skipped because estimated exit costs consumed the gross edge', { symbol: signal.indicators.symbol, reason: exitCostCheck.reason });
            continue;
          }
          try {
            const order = await alpaca.closePosition(signal.indicators.symbol);
            await db.logOrderTrade(order, {
              decisionId,
              strategy: 'daytrading',
              estimatedValue: daytradingExitEstimatedValue(order, existingPos),
            });
            if (alpaca.isOrderFullyFilled(order)) {
              await db.closePosition(signal.indicators.symbol, null, 'ai_signal');
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

      // BUY: apply entry sizing and entry cost gate. SELL is an exit and must
      // never pass through BUY-oriented sizing/cost checks.
      let riskCheck: RiskCheckResult | null = null;
      if (decision.action === 'BUY') {
        riskCheck = riskManager.checkTrade(decision, accountForRisk, positions, signal.indicators, cycleEntryNotionalUsd);
        if (!riskCheck.approved) {
          await db.updateDecisionStatus(decisionId, 2, riskCheck.reason);
          const skipCode = daytradingRiskSkipCode(riskCheck.reason);
          skips.add(skipCode, 'decision', 'Daytrading entry skipped by risk controls', daytradingRiskSkipContext({
            symbol: signal.indicators.symbol,
            decisionId,
            action: decision.action,
            riskCheck,
          }));
          console.log(`Skipped ${signal.indicators.symbol}: ${riskCheck.reason}`);
          continue;
        }
      }

      // SELL: close existing long position
      if (decision.action === 'SELL') {
        const existingPos = closedSymbols.has(signal.indicators.symbol) ? undefined : positions.find(p => p.symbol === signal.indicators.symbol);
        if (existingPos) {
          const pendingExit = await findPendingDayExit(signal.indicators.symbol, 'decision', { exitType: 'sell', decisionId });
          if (pendingExit) {
            await db.updateDecisionStatus(decisionId, 2, `Pending exit already exists: ${pendingExit.status}`);
            continue;
          }
          // Anti-churn: check minimum hold time
          if (isWithinMinHold(signal.indicators.symbol)) {
            await db.updateDecisionStatus(decisionId, 2, `Min hold time not reached (${minHoldMin}min)`);
            skips.add('MIN_HOLD_TIME', 'decision', 'Skipped because the position has not reached its minimum hold time', { symbol: signal.indicators.symbol, minutes: minHoldMin });
            console.log(`Skip SELL ${signal.indicators.symbol}: held < ${minHoldMin} min`);
            continue;
          }
          const exitCostCheck = riskManager.checkExitCost(existingPos, signal.indicators);
          if (!exitCostCheck.approved) {
            await db.updateDecisionStatus(decisionId, 2, exitCostCheck.reason);
            skips.add('EXIT_COST_GATE', 'decision', 'Daytrading discretionary sell skipped because estimated exit costs consumed the gross edge', { symbol: signal.indicators.symbol, reason: exitCostCheck.reason });
            continue;
          }
          try {
            const order = await alpaca.closePosition(signal.indicators.symbol);
            await db.logOrderTrade(order, {
              decisionId,
              strategy: 'daytrading',
              estimatedValue: daytradingExitEstimatedValue(order, existingPos),
            });
            if (alpaca.isOrderFullyFilled(order)) {
              await db.closePosition(signal.indicators.symbol, null, 'ai_signal');
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
      if (decision.action === 'BUY' && riskCheck?.adjustedQty) {
        if (noNewEntries) {
          await db.updateDecisionStatus(decisionId, 2, 'No new BUY entries during EOD flatten window');
          skips.add('EOD_NO_ENTRY', 'decision', 'New entries are disabled during the end-of-day flatten window', { symbol: signal.indicators.symbol });
          console.log(`Skip BUY ${signal.indicators.symbol}: EOD no-entry cutoff active`);
          continue;
        }
        // Anti-churn: re-entry cooldown check
        if (recentlySold.has(signal.indicators.symbol)) {
          await db.updateDecisionStatus(decisionId, 2, `Re-entry cooldown active (${cooldownMin}min)`);
          skips.add('REENTRY_COOLDOWN', 'decision', 'Skipped because the symbol was recently sold', { symbol: signal.indicators.symbol, minutes: cooldownMin });
          console.log(`Skip BUY ${signal.indicators.symbol}: sold within last ${cooldownMin} min`);
          continue;
        }

        const qty = riskCheck.adjustedQty;
        const clientOrderId = `bot_${decisionId}_${signal.indicators.symbol}`;
        // Deterministic client order ID lets a retry of the same decision be
        // identified and skipped before it reaches the broker. A non-terminal
        // existing trade means this order is already open/accepted/filled.
        const existingTrade = await db.findNonTerminalTradeByClientOrderId(clientOrderId);
        if (existingTrade) {
          await db.updateDecisionStatus(decisionId, 2, `Duplicate daytrading BUY skipped: order already open (status ${existingTrade.status})`);
          skips.add('DUPLICATE_ORDER_PREVENTED', 'decision', 'Daytrading BUY skipped because a non-terminal order with the same client order ID already exists', { symbol: signal.indicators.symbol, decisionId, tradeId: existingTrade.tradeId, status: existingTrade.status });
          console.log(`Skip BUY ${signal.indicators.symbol}: duplicate client_order_id ${clientOrderId}`);
          continue;
        }

        // Final read-only guard immediately before broker submission. This does
        // not resize the strategy order and does not apply to any exit path.
        const minimumNotionalCheck = checkDaytradingBuyMinimumNotional(qty, signal.indicators.price);
        if (!minimumNotionalCheck.approved) {
          const skipContext = {
            strategy: 'daytrading',
            symbol: signal.indicators.symbol,
            decision_id: decisionId,
            action: 'BUY',
            qty,
            reference_price: signal.indicators.price,
            estimated_notional_usd: minimumNotionalCheck.estimatedNotionalUsd,
            minimum_notional_usd: minimumNotionalCheck.minimumNotionalUsd,
            reason: minimumNotionalCheck.reason,
          };
          await db.updateDecisionStatus(decisionId, 2, serializeDecisionSkip(minimumNotionalCheck.reason, skipContext));
          skips.add('MIN_ORDER_SIZE', 'decision', 'Daytrading BUY skipped because estimated order notional is below the broker minimum', skipContext);
          console.log(`Skip BUY ${signal.indicators.symbol}: ${minimumNotionalCheck.reason}`);
          continue;
        }

        try {
          // Submit market order
          const order = await alpaca.submitOrder({
            symbol: signal.indicators.symbol,
            qty: qty,
            side: 'buy',
            type: 'market',
            time_in_force: 'day',
            client_order_id: clientOrderId,
          });

          const entryNotionalUsd = qty * signal.indicators.price;
          cycleEntryNotionalUsd += entryNotionalUsd;
          await db.logOrderTrade(order, {
            decisionId,
            estimatedValue: entryNotionalUsd,
            strategy: 'daytrading',
          });

          // Position is deliberately not upserted here. The broker-confirmed sync
          // below is the only source allowed to create/update current positions.
          const terminalRejected = ['rejected', 'canceled', 'cancelled', 'expired', 'done_for_day', 'stopped'].includes(order.status);
          const fullyFilled = alpaca.isOrderFullyFilled(order);
          await db.updateDecisionStatus(decisionId, fullyFilled ? 1 : terminalRejected ? 2 : 0, fullyFilled
            ? `Broker confirmed fill: ${order.filled_qty}/${order.qty} @ ${order.filled_avg_price ?? 'unknown'}`
            : terminalRejected
              ? `Broker order terminal status: ${order.status}`
              : `Broker order status: ${order.status}; filled ${order.filled_qty}/${order.qty}`);
          if (fullyFilled) tradesExecuted++;
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
        strategy: 'daytrading',
      });
    }

    // A complete successful broker snapshot is authoritative. Do not retain a
    // D1-only current position unless a known order is still live and could fill.
    const pendingDaySymbols = new Set((await db.getTradesNeedingSync(200))
      .filter(trade => trade.strategy === 'daytrading')
      .map(trade => String(trade.ticker)));
    const finalBrokerSymbols = new Set(finalPositions.map(pos => pos.symbol));
    for (const dbPos of dbPositions) {
      if (!finalBrokerSymbols.has(dbPos.ticker) && !pendingDaySymbols.has(dbPos.ticker)) {
        await db.closePosition(dbPos.ticker, null, 'broker_authoritative_sync_absent');
      }
    }

    // 13. Log run
    await db.logRun({
      trigger,
      market_open: 1,
      duration_ms: Date.now() - startTime,
      decisions_made: decisionsMade,
      trades_executed: tradesExecuted,
      errors: errors.length,
      error_details: serializeRunDetails(errors, skips),
      status: runStatus(errors, skips, ledgerDegraded, tradesExecuted),
      analyzed_candidates: analyzedCandidates,
      filtered_candidates: filteredCandidates,
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
      error_details: serializeRunDetails(errors, skips),
      status: 'error',
      analyzed_candidates: analyzedCandidates,
      filtered_candidates: filteredCandidates,
    });
  }
}

// Dashboard API
// HTTP endpoints for the dashboard to query bot status, decisions, trades, performance

import type { Env } from './index';
import { Database } from './database';
import { AlpacaClient } from './alpaca';
import { runSwingCycle } from './swing-strategy';
import { runCryptoCycle } from './crypto-strategy';
import { getCryptoSentiment } from './crypto-sentiment';
import { analyze } from './technical-analysis';

export class DashboardAPI {
    private env: Env;

    constructor(env: Env) {
      this.env = env;
    }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Routes
      if (path === '/' || path === '/health') {
        return this.json({ status: 'ok', service: 'alpaca-trading-bot', version: '1.0.0' }, corsHeaders);
      }

      if (path === '/api/dashboard') {
        return await this.getDashboard(corsHeaders);
      }

      if (path === '/api/account') {
        return await this.getAccount(corsHeaders);
      }

      if (path === '/api/positions') {
        return await this.getPositions(corsHeaders);
      }

      if (path === '/api/decisions') {
        return await this.getDecisions(url, corsHeaders);
      }

      if (path === '/api/trades') {
        return await this.getTrades(url, corsHeaders);
      }

      if (path === '/api/performance') {
        return await this.getPerformance(url, corsHeaders);
      }

      if (path === '/api/runs') {
        return await this.getRuns(corsHeaders);
      }

      if (path === '/api/stats') {
        return await this.getStats(corsHeaders);
      }

      if (path === '/api/strategy-comparison') {
        return await this.getStrategyComparison(corsHeaders);
      }

      if (path === '/api/config') {
        return await this.getConfig(corsHeaders);
      }

      if (path === '/api/trigger' && method === 'POST') {
        return await this.triggerCycle(corsHeaders);
      }

      if (path === '/api/trigger-swing' && method === 'POST') {
        return await this.triggerSwingCycle(corsHeaders);
      }

      if (path === '/api/trigger-crypto' && method === 'POST') {
        return await this.triggerCryptoCycle(corsHeaders);
      }

      if (path === '/api/positions/close' && method === 'POST') {
        return await this.closePosition(url, corsHeaders);
      }

      if (path === '/api/positions/close-all' && method === 'POST') {
        return await this.closeAllPositions(corsHeaders);
      }

      if (path === '/api/debug-crypto' && method === 'GET') {
        try {
          const alpaca = new AlpacaClient({
            apiKey: (this.env as any).ALPACA_API_KEY,
            apiSecret: (this.env as any).ALPACA_API_SECRET,
            baseUrl: (this.env as any).ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
          });
          const bars = await alpaca.getCryptoBars('BTCUSD', '15Min', 200);
          const sentiment = await getCryptoSentiment();
          let analyzeResult: any = null;
          let analyzeError: string | null = null;
          try {
            analyzeResult = analyze(bars, 'BTCUSD', {
              rsiPeriod: 14, rsiOversold: 30, rsiOverbought: 70,
              emaFast: 9, emaSlow: 21,
              macdFast: 12, macdSlow: 26, macdSignal: 9,
              atrPeriod: 14, volumeAvgPeriod: 20,
            });
          } catch (e) {
            analyzeError = e instanceof Error ? `${e.message} | ${e.stack}` : String(e);
          }
          return this.json({
            bars_count: bars.length,
            first_bar: bars[0] || null,
            last_bar: bars[bars.length - 1] || null,
            sentiment: sentiment,
            analyze_ok: !!analyzeResult,
            analyze_error: analyzeError,
            analyze_symbol: analyzeResult?.symbol || null,
            analyze_rsi: analyzeResult?.rsi || null,
          }, corsHeaders);
        } catch (e) {
          return this.json({ error: e instanceof Error ? e.message : 'unknown', stack: e instanceof Error ? e.stack : '' }, corsHeaders, 500);
        }
      }

      if (path === '/api/debug' && method === 'GET') {
        const hasLLM = !!(this.env as any).LLM_API_KEY;
        const hasAlpacaKey = !!(this.env as any).ALPACA_API_KEY;
        const hasAlpacaSecret = !!(this.env as any).ALPACA_API_SECRET;
        return this.json({
          llm_key_present: hasLLM,
          llm_key_length: hasLLM ? (this.env as any).LLM_API_KEY.length : 0,
          alpaca_key_present: hasAlpacaKey,
          alpaca_secret_present: hasAlpacaSecret,
        }, corsHeaders);
      }

      return this.json({ error: 'Not found', path }, corsHeaders, 404);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'unknown';
      return this.json({ error: errMsg }, corsHeaders, 500);
    }
  }

  private json(data: any, corsHeaders: Record<string, string>, status: number = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
        ...corsHeaders,
      },
    });
  }

  private async reconcileTrades(db: Database, alpaca: AlpacaClient): Promise<void> {
    // Import broker sells as well as refreshing locally-known orders. The import is
    // keyed by Alpaca order ID and is safe to call on every live/dashboard request.
    const orders = await alpaca.getRecentOrders(100);
    await db.reconcileOrders(orders);

    const pending = await db.getTradesNeedingSync(200);
    const byId = new Map(orders.map(order => [order.id, order]));
    for (const trade of pending) {
      const order = byId.get(trade.alpaca_order_id);
      if (!order) continue;
      await db.updateTradeStatus(
        order.id,
        order.status,
        order.filled_avg_price,
        order.filled_avg_price,
      );
    }
  }

  private async getDashboard(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    try {
      await this.reconcileTrades(db, this.getAlpacaClient());
    } catch (e) {
      console.error('Trade reconciliation failed:', e);
    }
    const [stats, recentDecisions, recentTrades, runs, snapshots, positions, strategyComparison, strategyHistory] = await Promise.all([
      db.getStats(),
      db.getRecentDecisions(20),
      db.getRecentTrades(20),
      db.getRecentRuns(10),
      db.getRecentSnapshots(500),
      db.getOpenPositions(),
      db.getStrategyComparison(),
      Promise.all((['daytrading', 'swing', 'crypto'] as const).map(async strategy => ({
        strategy,
        decisions: await db.getRecentDecisionsByStrategy(strategy, 100),
        trades: await db.getRecentTradesByStrategy(strategy, 100),
        runs: await db.getRecentRunsByStrategy(strategy, 100),
      }))),
    ]);

    const latestSnapshot = snapshots[0] || null;
    const account = await this.tryGetAccount();

    return this.json({
      stats,
      account,
      latestSnapshot,
      positions,
      recentDecisions,
      recentTrades,
      recentRuns: runs,
      performanceHistory: snapshots.reverse(), // chronological for charting
      strategyComparison,
      strategyHistory: Object.fromEntries(strategyHistory.map(item => [item.strategy, item])),
    }, cors);
  }

  private async getAccount(cors: Record<string, string>): Promise<Response> {
    const account = await this.tryGetAccount();
    return this.json({ account }, cors);
  }

  private async getPositions(cors: Record<string, string>): Promise<Response> {
      const db = new Database(this.env.DB);
      try { await this.reconcileTrades(db, this.getAlpacaClient()); } catch (e) { console.error('Trade reconciliation failed:', e); }
      const dbPositions = await db.getOpenPositions();

    // Also get live positions from Alpaca
    const alpaca = this.getAlpacaClient();
    let livePositions = [];
    try {
      livePositions = await alpaca.getPositions();
    } catch (e) {
      // Fallback to DB only
    }

    return this.json({ dbPositions, livePositions }, cors);
  }

  private async getDecisions(url: URL, cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const decisions = await db.getRecentDecisions(limit);
    return this.json({ decisions }, cors);
  }

  private async getTrades(url: URL, cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    try { await this.reconcileTrades(db, this.getAlpacaClient()); } catch (e) { console.error('Trade reconciliation failed:', e); }
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const trades = await db.getRecentTrades(limit);
    return this.json({ trades }, cors);
  }

  private async getPerformance(url: URL, cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const snapshots = await db.getRecentSnapshots(limit);
    return this.json({ performance: snapshots.reverse() }, cors);
  }

  private async getRuns(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    const runs = await db.getRecentRuns(30);
    return this.json({ runs }, cors);
  }

  private async getStats(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    try { await this.reconcileTrades(db, this.getAlpacaClient()); } catch (e) { console.error('Trade reconciliation failed:', e); }
    const stats = await db.getStats();
    return this.json({ stats }, cors);
  }

  private async getStrategyComparison(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    try { await this.reconcileTrades(db, this.getAlpacaClient()); } catch (e) { console.error('Trade reconciliation failed:', e); }
    const comparison = await db.getStrategyComparison();
    return this.json(comparison, cors);
  }

  private async getConfig(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    const config = await db.getConfig();
    return this.json({ config }, cors);
  }

  private async triggerCycle(cors: Record<string, string>): Promise<Response> {
    try {
      // Daytrading cycle runs every 5 min via cron, can't import here due to circular dep
      return this.json({ 
        message: 'Daytrading trigger received. Next cron tick runs within 5 minutes during market hours (13-21 UTC weekdays).',
        next_cron: 'within 5 minutes during market hours'
      }, cors);
    } catch (e) {
      return this.json({ error: e instanceof Error ? e.message : 'unknown' }, cors, 500);
    }
  }

  private async triggerSwingCycle(cors: Record<string, string>): Promise<Response> {
    try {
      await runSwingCycle(this.env, 'manual_swing');
      return this.json({
        message: 'Swing cycle completed.',
        status: 'completed'
      }, cors);
    } catch (e) {
      return this.json({ error: e instanceof Error ? e.message : 'unknown' }, cors, 500);
    }
  }

  private async triggerCryptoCycle(cors: Record<string, string>): Promise<Response> {
    try {
      await runCryptoCycle(this.env, 'manual_crypto');
      return this.json({
        message: 'Crypto cycle completed.',
        status: 'completed'
      }, cors);
    } catch (e) {
      return this.json({ error: e instanceof Error ? e.message : 'unknown' }, cors, 500);
    }
  }

  private async closePosition(url: URL, cors: Record<string, string>): Promise<Response> {
    const symbol = url.searchParams.get('symbol');
    if (!symbol) return this.json({ error: 'Missing symbol parameter' }, cors, 400);

    const alpaca = this.getAlpacaClient();
    const db = new Database(this.env.DB);
    try {
      // Get position info before closing
      const pos = await alpaca.getPosition(symbol.toUpperCase());
      const dbPos = (await db.getOpenPositions()).find(p => p.ticker === symbol.toUpperCase());
      const order = await alpaca.closePosition(symbol.toUpperCase());
      await db.logOrderTrade(order, { strategy: dbPos?.strategy ?? null });
      // Mark position closed only after a confirmed full broker fill.
      if (pos && alpaca.isOrderFullyFilled(order)) {
        await db.closePosition(symbol.toUpperCase(), pos.unrealized_pl, 'manual_close');
      }
      return this.json({ success: true, order, filled: alpaca.isOrderFullyFilled(order), message: `Close order submitted for ${symbol}` }, cors);
    } catch (e) {
      return this.json({ error: e instanceof Error ? e.message : 'unknown' }, cors, 500);
    }
  }

  private async closeAllPositions(cors: Record<string, string>): Promise<Response> {
    const alpaca = this.getAlpacaClient();
    const db = new Database(this.env.DB);
    try {
      const positions = await alpaca.getPositions();
      const dbPositions = await db.getOpenPositions();
      const orders = await alpaca.closeAllPositions();
      for (const order of orders) {
        const dbPos = dbPositions.find(p => p.ticker === order.symbol);
        await db.logOrderTrade(order, { strategy: dbPos?.strategy ?? null });
        const pos = positions.find(p => p.symbol === order.symbol);
        if (pos && alpaca.isOrderFullyFilled(order)) {
          await db.closePosition(pos.symbol, pos.unrealized_pl, 'manual_close_all');
        }
      }
      return this.json({ success: true, orders, message: 'All positions closed' }, cors);
    } catch (e) {
      return this.json({ error: e instanceof Error ? e.message : 'unknown' }, cors, 500);
    }
  }

  private getAlpacaClient(): AlpacaClient {
    return new AlpacaClient({
      apiKey: this.env.ALPACA_API_KEY,
      apiSecret: this.env.ALPACA_API_SECRET,
      baseUrl: this.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
    });
  }

  private async tryGetAccount(): Promise<any> {
    try {
      const alpaca = this.getAlpacaClient();
      return await alpaca.getAccount();
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to get account' };
    }
  }
}

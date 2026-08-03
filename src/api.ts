// Dashboard API
// HTTP endpoints for the dashboard to query bot status, decisions, trades, performance

import type { Env } from './index';
import { Database } from './database';
import { AlpacaClient } from './alpaca';

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

      if (path === '/api/config') {
        return await this.getConfig(corsHeaders);
      }

      if (path === '/api/trigger' && method === 'POST') {
        return await this.triggerCycle(corsHeaders);
      }

      if (path === '/api/positions/close' && method === 'POST') {
        return await this.closePosition(url, corsHeaders);
      }

      if (path === '/api/positions/close-all' && method === 'POST') {
        return await this.closeAllPositions(corsHeaders);
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
        ...corsHeaders,
      },
    });
  }

  private async getDashboard(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    const [stats, recentDecisions, recentTrades, runs, snapshots, positions] = await Promise.all([
      db.getStats(),
      db.getRecentDecisions(20),
      db.getRecentTrades(20),
      db.getRecentRuns(10),
      db.getRecentSnapshots(50),
      db.getOpenPositions(),
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
    }, cors);
  }

  private async getAccount(cors: Record<string, string>): Promise<Response> {
    const account = await this.tryGetAccount();
    return this.json({ account }, cors);
  }

  private async getPositions(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
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
    const stats = await db.getStats();
    return this.json({ stats }, cors);
  }

  private async getConfig(cors: Record<string, string>): Promise<Response> {
    const db = new Database(this.env.DB);
    const config = await db.getConfig();
    return this.json({ config }, cors);
  }

  private async triggerCycle(cors: Record<string, string>): Promise<Response> {
    try {
      // Run the trading cycle immediately in the background
      const env = this.env as any;
      // We need to call runTradingCycle but it's not exported via this module
      // Instead, we dispatch via the cron mechanism by calling the scheduled handler
      // The simplest approach: return immediately and let the next cron pick up
      // But we can also trigger via the Cloudflare API
      return this.json({ 
        message: 'Manual trigger received. The trading cycle will run on the next cron tick (within 5 minutes). To run immediately, trigger the cron via Cloudflare dashboard or API.',
        next_cron: 'within 5 minutes during market hours'
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
      const order = await alpaca.closePosition(symbol.toUpperCase());
      // Mark position as closed in DB
      if (pos) {
        await db.closePosition(symbol.toUpperCase(), pos.unrealized_pl, 'manual_close');
      }
      return this.json({ success: true, order, message: `Closed position for ${symbol}` }, cors);
    } catch (e) {
      return this.json({ error: e instanceof Error ? e.message : 'unknown' }, cors, 500);
    }
  }

  private async closeAllPositions(cors: Record<string, string>): Promise<Response> {
    const alpaca = this.getAlpacaClient();
    try {
      await alpaca.closeAllPositions();
      return this.json({ success: true, message: 'All positions closed' }, cors);
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

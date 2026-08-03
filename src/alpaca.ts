// Alpaca API Client
// Handles all interactions with Alpaca trading API
// Supports both paper and live trading via base URL configuration

export interface AlpacaConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string; // https://paper-api.alpaca.markets or https://api.alpaca.markets
}

export interface AccountInfo {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: number;
  portfolio_value: number;
  equity: number;
  buying_power: number;
  long_market_value: number;
  short_market_value: number;
  market_value: number;
  last_equity: number;
  change_today: number;
  change_today_pct: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
}

export interface Position {
  asset_id: string;
  symbol: string;
  qty: number;
  side: 'long' | 'short';
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  unrealized_intraday_pl: number;
  unrealized_intraday_plpc: number;
  current_price: number;
  avg_entry_price: number;
  change_today: number;
  change_today_pct: number;
}

export interface Order {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: number;
  filled_qty: number;
  filled_avg_price: number | null;
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  side: 'buy' | 'sell';
  status: 'new' | 'partially_filled' | 'filled' | 'done_for_day' | 'canceled' | 'expired' | 'replaced' | 'pending_cancel' | 'pending_replace' | 'accepted' | 'pending_new' | 'accepted_for_bidding' | 'stopped' | 'rejected' | 'calculated';
  time_in_force: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  limit_price: number | null;
  stop_price: number | null;
  trail_price: number | null;
  trail_percent: number | null;
}

export interface Bar {
  t: number;   // timestamp (unix seconds)
  o: number;   // open
  h: number;   // high
  l: number;   // low
  c: number;   // close
  v: number;   // volume
}

export interface Quote {
  symbol: string;
  bid_price: number;
  bid_size: number;
  ask_price: number;
  ask_size: number;
  last_price: number;
  timestamp: string;
}

export class AlpacaClient {
  private config: AlpacaConfig;

  constructor(config: AlpacaConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    return {
      'APCA-API-KEY-ID': this.config.apiKey,
      'APCA-API-SECRET-KEY': this.config.apiSecret,
      'Content-Type': 'application/json',
    };
  }

  private getBaseUrl(): string {
    // Ensure no trailing slash
    return this.config.baseUrl.replace(/\/$/, '');
  }

  private getDataBaseUrl(): string {
    // Market data lives on a different subdomain
    return this.getBaseUrl().replace('paper-api', 'data').replace('api.alpaca.markets', 'data.alpaca.markets');
  }

  private async request(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.getBaseUrl()}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });
    return response;
  }

  // ============================================================
  // Account
  // ============================================================

  async getAccount(): Promise<AccountInfo> {
    const resp = await this.request('/v2/account');
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Alpaca getAccount failed: ${resp.status} ${text}`);
    }
    const data = await resp.json() as any;
    return {
      id: data.id,
      account_number: data.account_number,
      status: data.status,
      currency: data.currency,
      cash: parseFloat(data.cash),
      portfolio_value: parseFloat(data.portfolio_value),
      equity: parseFloat(data.equity),
      buying_power: parseFloat(data.buying_power),
      long_market_value: parseFloat(data.long_market_value || '0'),
      short_market_value: parseFloat(data.short_market_value || '0'),
      market_value: parseFloat(data.market_value || '0'),
      last_equity: parseFloat(data.last_equity || '0'),
      change_today: parseFloat(data.change_today || '0'),
      change_today_pct: parseFloat(data.change_today_pct || '0'),
      pattern_day_trader: data.pattern_day_trader || false,
      trading_blocked: data.trading_blocked || false,
      transfers_blocked: data.transfers_blocked || false,
      account_blocked: data.account_blocked || false,
    };
  }

  // ============================================================
  // Clock / Market Status
  // ============================================================

  async getClock(): Promise<{ is_open: boolean; next_open: string; next_close: string; timestamp: string }> {
    const resp = await this.request('/v2/clock');
    if (!resp.ok) throw new Error(`Alpaca getClock failed: ${resp.status}`);
    return await resp.json() as any;
  }

  async isMarketOpen(): Promise<boolean> {
    const clock = await this.getClock();
    return clock.is_open;
  }

  // ============================================================
  // Positions
  // ============================================================

  async getPositions(): Promise<Position[]> {
    const resp = await this.request('/v2/positions');
    if (!resp.ok) throw new Error(`Alpaca getPositions failed: ${resp.status}`);
    const data = await resp.json() as any[];
    return data.map(p => ({
      asset_id: p.asset_id,
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      side: p.side,
      market_value: parseFloat(p.market_value),
      cost_basis: parseFloat(p.cost_basis),
      unrealized_pl: parseFloat(p.unrealized_pl),
      unrealized_plpc: parseFloat(p.unrealized_plpc),
      unrealized_intraday_pl: parseFloat(p.unrealized_intraday_pl || '0'),
      unrealized_intraday_plpc: parseFloat(p.unrealized_intraday_plpc || '0'),
      current_price: parseFloat(p.current_price),
      avg_entry_price: parseFloat(p.avg_entry_price),
      change_today: parseFloat(p.change_today || '0'),
      change_today_pct: parseFloat(p.change_today_pct || '0'),
    }));
  }

  async getPosition(symbol: string): Promise<Position | null> {
    const resp = await this.request(`/v2/positions/${symbol}`);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Alpaca getPosition failed: ${resp.status}`);
    const p = await resp.json() as any;
    return {
      asset_id: p.asset_id,
      symbol: p.symbol,
      qty: parseFloat(p.qty),
      side: p.side,
      market_value: parseFloat(p.market_value),
      cost_basis: parseFloat(p.cost_basis),
      unrealized_pl: parseFloat(p.unrealized_pl),
      unrealized_plpc: parseFloat(p.unrealized_plpc),
      unrealized_intraday_pl: parseFloat(p.unrealized_intraday_pl || '0'),
      unrealized_intraday_plpc: parseFloat(p.unrealized_intraday_plpc || '0'),
      current_price: parseFloat(p.current_price),
      avg_entry_price: parseFloat(p.avg_entry_price),
      change_today: parseFloat(p.change_today || '0'),
      change_today_pct: parseFloat(p.change_today_pct || '0'),
    };
  }

  async closePosition(symbol: string): Promise<Order> {
    const resp = await this.request(`/v2/positions/${symbol}`, { method: 'DELETE' });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Alpaca closePosition failed: ${resp.status} ${text}`);
    }
    return await resp.json() as any;
  }

  async closeAllPositions(): Promise<void> {
    const resp = await this.request('/v2/positions', { method: 'DELETE' });
    if (!resp.ok && resp.status !== 207) {
      const text = await resp.text();
      throw new Error(`Alpaca closeAllPositions failed: ${resp.status} ${text}`);
    }
  }

  // ============================================================
  // Orders
  // ============================================================

  async submitOrder(params: {
    symbol: string;
    qty: number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
    time_in_force?: 'day' | 'gtc' | 'ioc' | 'fok';
    limit_price?: number;
    stop_price?: number;
    trail_percent?: number;
    trail_price?: number;
    client_order_id?: string;
  }): Promise<Order> {
    const body: Record<string, any> = {
      symbol: params.symbol,
      qty: params.qty.toString(),
      side: params.side,
      type: params.type,
      time_in_force: params.time_in_force || 'day',
    };

    if (params.limit_price) body.limit_price = params.limit_price.toString();
    if (params.stop_price) body.stop_price = params.stop_price.toString();
    if (params.trail_percent) body.trail_percent = params.trail_percent.toString();
    if (params.trail_price) body.trail_price = params.trail_price.toString();
    if (params.client_order_id) body.client_order_id = params.client_order_id;

    const resp = await this.request('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Alpaca submitOrder failed: ${resp.status} ${text}`);
    }

    return await resp.json() as any;
  }

  async getOrder(orderId: string): Promise<Order> {
    const resp = await this.request(`/v2/orders/${orderId}`);
    if (!resp.ok) throw new Error(`Alpaca getOrder failed: ${resp.status}`);
    const data = await resp.json() as any;
    return {
      id: data.id,
      client_order_id: data.client_order_id,
      symbol: data.symbol,
      qty: parseFloat(data.qty),
      filled_qty: parseFloat(data.filled_qty),
      filled_avg_price: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
      type: data.type,
      side: data.side,
      status: data.status,
      time_in_force: data.time_in_force,
      created_at: data.created_at,
      updated_at: data.updated_at,
      submitted_at: data.submitted_at,
      limit_price: data.limit_price ? parseFloat(data.limit_price) : null,
      stop_price: data.stop_price ? parseFloat(data.stop_price) : null,
      trail_price: data.trail_price ? parseFloat(data.trail_price) : null,
      trail_percent: data.trail_percent ? parseFloat(data.trail_percent) : null,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    const resp = await this.request(`/v2/orders/${orderId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Alpaca cancelOrder failed: ${resp.status}`);
  }

  async getRecentOrders(limit: number = 50): Promise<Order[]> {
    const resp = await this.request(`/v2/orders?limit=${limit}&status=all`);
    if (!resp.ok) throw new Error(`Alpaca getRecentOrders failed: ${resp.status}`);
    const data = await resp.json() as any[];
    return data.map(o => ({
      id: o.id,
      client_order_id: o.client_order_id,
      symbol: o.symbol,
      qty: parseFloat(o.qty),
      filled_qty: parseFloat(o.filled_qty),
      filled_avg_price: o.filled_avg_price ? parseFloat(o.filled_avg_price) : null,
      type: o.type,
      side: o.side,
      status: o.status,
      time_in_force: o.time_in_force,
      created_at: o.created_at,
      updated_at: o.updated_at,
      submitted_at: o.submitted_at,
      limit_price: o.limit_price ? parseFloat(o.limit_price) : null,
      stop_price: o.stop_price ? parseFloat(o.stop_price) : null,
      trail_price: o.trail_price ? parseFloat(o.trail_price) : null,
      trail_percent: o.trail_percent ? parseFloat(o.trail_percent) : null,
    }));
  }

  // ============================================================
  // Market Data (via data.alpaca.markets)
  // ============================================================

  async getBars(symbol: string, timeframe: string = '5Min', limit: number = 200): Promise<Bar[]> {
    const dataUrl = this.getDataBaseUrl();
    const url = `${dataUrl}/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}`;

    const resp = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Alpaca getBars failed for ${symbol}: ${resp.status} ${text}`);
    }

    const data = await resp.json() as any;
    const bars = data.bars || [];
    return bars.map((b: any) => ({
      t: b.t,
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
    }));
  }

  async getLatestQuote(symbol: string): Promise<Quote | null> {
    const dataUrl = this.getDataBaseUrl();
    const url = `${dataUrl}/v2/stocks/${symbol}/quotes/latest`;

    const resp = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Alpaca getLatestQuote failed for ${symbol}: ${resp.status}`);

    const data = await resp.json() as any;
    const q = data.quote || data;
    return {
      symbol: symbol,
      bid_price: parseFloat(q.bp || q.bid_price || '0'),
      bid_size: parseFloat(q.bs || q.bid_size || '0'),
      ask_price: parseFloat(q.ap || q.ask_price || '0'),
      ask_size: parseFloat(q.as || q.ask_size || '0'),
      last_price: parseFloat(q.ap || q.ask_price || '0'), // use ask as approx last
      timestamp: q.t || q.timestamp || new Date().toISOString(),
    };
  }

  async getLatestPrice(symbol: string): Promise<number | null> {
    const dataUrl = this.getDataBaseUrl();
    const url = `${dataUrl}/v2/stocks/${symbol}/trades/latest`;

    const resp = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (resp.status === 404) return null;
    if (!resp.ok) {
      // Fallback to quote
      const quote = await this.getLatestQuote(symbol);
      if (quote) return quote.last_price;
      return null;
    }

    const data = await resp.json() as any;
    const trade = data.trade || data;
    return parseFloat(trade.p || trade.price || '0');
  }

  // ============================================================
  // Assets / Universe
  // ============================================================

  async getActiveAssets(): Promise<{ symbol: string; name: string; exchange: string }[]> {
    const resp = await this.request('/v2/assets?status=active&class=us_equity');
    if (!resp.ok) throw new Error(`Alpaca getActiveAssets failed: ${resp.status}`);
    const data = await resp.json() as any[];
    return data
      .filter(a => a.tradable && a.fractionable)
      .map(a => ({ symbol: a.symbol, name: a.name, exchange: a.exchange }));
  }

  async getTopMovers(): Promise<{ gainers: string[]; losers: string[] }> {
    // Alpaca provides a snapshot endpoint for top movers
    const dataUrl = this.getDataBaseUrl();
    const url = `${dataUrl}/v2/screener/markets/stocks/movers`;

    const resp = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!resp.ok) {
      // Fallback: return empty, the scanner will use a default universe
      return { gainers: [], losers: [] };
    }

    const data = await resp.json() as any;
    return {
      gainers: (data.gainers || []).map((g: any) => g.symbol),
      losers: (data.losers || []).map((l: any) => l.symbol),
    };
  }

  // ============================================================
  // Snapshots (batch market data)
  // ============================================================

  async getSnapshots(symbols: string[]): Promise<Record<string, {
    latest_price: number;
    daily_change_pct: number;
    volume: number;
  }>> {
    if (symbols.length === 0) return {};

    const dataUrl = this.getDataBaseUrl();
    const symbolsStr = symbols.join(',');
    const url = `${dataUrl}/v2/stocks/snapshots?symbols=${symbolsStr}`;

    const resp = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!resp.ok) throw new Error(`Alpaca getSnapshots failed: ${resp.status}`);

    const data = await resp.json() as any;
    const result: Record<string, { latest_price: number; daily_change_pct: number; volume: number }> = {};

    for (const [symbol, snap] of Object.entries(data)) {
      const s = snap as any;
      const latestPrice = s.latestTrade ? parseFloat(s.latestTrade.p) : s.latestQuote ? parseFloat(s.latestQuote.ap) : 0;
      const prevClose = s.prevDailyBar ? parseFloat(s.prevDailyBar.c) : 0;
      const dailyChangePct = prevClose > 0 ? ((latestPrice - prevClose) / prevClose) * 100 : 0;
      const volume = s.dailyBar ? parseFloat(s.dailyBar.v) : 0;
      result[symbol] = { latest_price: latestPrice, daily_change_pct: dailyChangePct, volume };
    }

    return result;
  }

  // ============================================================
  // Crypto Market Data (via data.alpaca.markets/v1beta3/crypto)
  // ============================================================

  async getCryptoBars(symbol: string, timeframe: string = '15Min', limit: number = 200): Promise<Bar[]> {
    const dataUrl = this.getDataBaseUrl();
    // Crypto API requires BTC/USD format, but our universe uses BTCUSD
    const apiSymbol = symbol.includes('/') ? symbol : symbol.replace(/USD$/, '/USD');
    const url = `${dataUrl}/v1beta3/crypto/us/bars?symbols=${apiSymbol}&timeframe=${timeframe}&limit=${limit}`;

    const resp = await fetch(url, { headers: this.getHeaders() });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Alpaca getCryptoBars failed for ${symbol}: ${resp.status} ${text}`);
    }

    const data = await resp.json() as any;
    // Response format: { "bars": { "BTC/USD": [{ t, o, h, l, c, v }, ...] } }
    const rawBars = data.bars?.[apiSymbol] || [];
    return rawBars.map((b: any) => ({
      t: new Date(b.t || b.T).getTime() / 1000,
      o: parseFloat(b.o || b.O),
      h: parseFloat(b.h || b.H),
      l: parseFloat(b.l || b.L),
      c: parseFloat(b.c || b.C),
      v: parseFloat(b.v || b.V),
    }));
  }

  async getCryptoSnapshots(symbols: string[]): Promise<Record<string, {
    latest_price: number;
    daily_change_pct: number;
    volume: number;
  }>> {
    if (symbols.length === 0) return {};

    const dataUrl = this.getDataBaseUrl();
    // Convert BTCUSD -> BTC/USD for API
    const apiSymbols = symbols.map(s => s.includes('/') ? s : s.replace(/USD$/, '/USD'));
    const url = `${dataUrl}/v1beta3/crypto/us/snapshots?symbols=${apiSymbols.join(',')}`;

    const resp = await fetch(url, { headers: this.getHeaders() });
    if (!resp.ok) {
      console.error(`Crypto snapshots failed: ${resp.status}`);
      return {};
    }

    const data = await resp.json() as any;
    const result: Record<string, { latest_price: number; daily_change_pct: number; volume: number }> = {};

    for (const [apiSymbol, snap] of Object.entries(data.snapshots || data)) {
      const s = snap as any;
      // Convert back BTC/USD -> BTCUSD for internal use
      const internalSymbol = apiSymbol.replace('/', '');
      const latestPrice = s.latestTrade ? parseFloat(s.latestTrade.p) : s.latestQuote ? parseFloat(s.latestQuote.ap) : 0;
      const prevClose = s.dailyBar ? parseFloat(s.dailyBar.pc || s.dailyBar.c) : 0;
      const dailyChangePct = prevClose > 0 ? ((latestPrice - prevClose) / prevClose) * 100 : 0;
      const volume = s.dailyBar ? parseFloat(s.dailyBar.v) : 0;
      result[internalSymbol] = { latest_price: latestPrice, daily_change_pct: dailyChangePct, volume };
    }

    return result;
  }

  async getCryptoLatestPrice(symbol: string): Promise<number | null> {
    const snaps = await this.getCryptoSnapshots([symbol]);
    return snaps[symbol]?.latest_price || null;
  }
}

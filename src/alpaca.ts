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

export interface AccountActivity {
  id: string;
  activity_type: string;
  activity_sub_type?: string | null;
  date?: string | null;
  created_at?: string | null;
  transaction_time?: string | null;
  type?: string | null;
  order_id?: string | null;
  symbol?: string | null;
  side?: string | null;
  qty?: number | null;
  price?: number | null;
  cum_qty?: number | null;
  leaves_qty?: number | null;
  net_amount?: number | null;
  currency?: string | null;
  description?: string | null;
  status?: string | null;
}

export interface AccountActivitiesResult {
  activities: AccountActivity[];
  pages: number;
  pageBudget: number;
  truncated: boolean;
  degraded: boolean;
}

/** Shared read-only budget for the scheduled broker activity import. */
export const ACCOUNT_ACTIVITY_PAGE_BUDGET = 5;

export type AlpacaOrderStatus =
  | 'new' | 'partially_filled' | 'filled' | 'done_for_day'
  | 'canceled' | 'cancelled' | 'expired' | 'replaced'
  | 'pending_cancel' | 'pending_replace' | 'accepted' | 'pending_new'
  | 'accepted_for_bidding' | 'stopped' | 'rejected' | 'calculated' | string;

/** Broker terminal states: reconciliation never retries or mutates the broker order. */
export const TERMINAL_ORDER_STATUSES = new Set([
  'filled', 'canceled', 'cancelled', 'rejected', 'expired', 'replaced', 'done_for_day', 'stopped',
]);

export interface Order {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: number;
  filled_qty: number;
  leaves_qty: number | null;
  filled_avg_price: number | null;
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop' | string;
  side: 'buy' | 'sell';
  status: AlpacaOrderStatus;
  time_in_force: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  filled_at: string | null;
  canceled_at: string | null;
  expired_at: string | null;
  failed_at: string | null;
  replaced_at: string | null;
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

export interface BatchBarsResult {
  barsBySymbol: Map<string, Bar[]>;
  pages: number;
  symbolsRequested: number;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('alpaca_request_timeout'), 12_000);
    const upstreamSignal = options.signal;
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort(upstreamSignal.reason);
      else upstreamSignal.addEventListener('abort', () => controller.abort(upstreamSignal.reason), { once: true });
    }
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });
    } finally {
      clearTimeout(timeout);
    }
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
      // Alpaca account payloads may omit market_value while still exposing
      // authoritative long/short market values. Never surface a false zero
      // when those broker aggregates are present.
      market_value: (() => {
        const longMarketValue = parseFloat(data.long_market_value || '0');
        const shortMarketValue = parseFloat(data.short_market_value || '0');
        const aggregate = longMarketValue + shortMarketValue;
        const reported = data.market_value == null ? NaN : parseFloat(data.market_value);
        return Number.isFinite(reported) && (reported !== 0 || aggregate === 0) ? reported : aggregate;
      })(),
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

  private parseOrder(data: any): Order {
    return {
      id: data.id,
      client_order_id: data.client_order_id,
      symbol: data.symbol,
      qty: parseFloat(data.qty),
      filled_qty: parseFloat(data.filled_qty || '0'),
      leaves_qty: data.leaves_qty == null ? null : parseFloat(data.leaves_qty),
      filled_avg_price: data.filled_avg_price ? parseFloat(data.filled_avg_price) : null,
      type: data.type,
      side: data.side,
      status: data.status,
      time_in_force: data.time_in_force,
      created_at: data.created_at,
      updated_at: data.updated_at,
      submitted_at: data.submitted_at ?? null,
      filled_at: data.filled_at ?? null,
      canceled_at: data.canceled_at ?? null,
      expired_at: data.expired_at ?? null,
      failed_at: data.failed_at ?? null,
      replaced_at: data.replaced_at ?? null,
      limit_price: data.limit_price ? parseFloat(data.limit_price) : null,
      stop_price: data.stop_price ? parseFloat(data.stop_price) : null,
      trail_price: data.trail_price ? parseFloat(data.trail_price) : null,
      trail_percent: data.trail_percent ? parseFloat(data.trail_percent) : null,
    };
  }

  isOrderFullyFilled(order: Order): boolean {
    return order.status === 'filled' && order.filled_qty > 0 && order.filled_qty >= order.qty * 0.999;
  }

  private isTerminalOrder(status: string): boolean {
    return TERMINAL_ORDER_STATUSES.has(status);
  }

  async waitForOrder(orderId: string, timeoutMs: number = 5000): Promise<Order> {
    const started = Date.now();
    let order = await this.getOrder(orderId);
    while (!this.isTerminalOrder(order.status) && Date.now() - started < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 250));
      order = await this.getOrder(orderId);
    }
    return order;
  }

  async closePosition(symbol: string): Promise<Order> {
    const resp = await this.request(`/v2/positions/${symbol}`, { method: 'DELETE' });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Alpaca closePosition failed: ${resp.status} ${text}`);
    }
    const order = this.parseOrder(await resp.json());
    return order.id ? await this.waitForOrder(order.id) : order;
  }

  async closeAllPositions(): Promise<Order[]> {
    const resp = await this.request('/v2/positions', { method: 'DELETE' });
    if (!resp.ok && resp.status !== 207) {
      const text = await resp.text();
      throw new Error(`Alpaca closeAllPositions failed: ${resp.status} ${text}`);
    }
    const data: any = await resp.json().catch(() => [] as any);
    const rawOrders = Array.isArray(data) ? data : (data?.orders || data?.results || []);
    const orders = rawOrders.filter((order: any) => order?.id).map((order: any) => this.parseOrder(order));
    return await Promise.all(orders.map((order: Order) => this.waitForOrder(order.id)));
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

    // Normalize the submit response so broker lifecycle timestamps are
    // preserved before the order reaches D1 persistence.
    return this.parseOrder(await resp.json());
  }

  async getOrder(orderId: string): Promise<Order> {
    const resp = await this.request(`/v2/orders/${orderId}`);
    if (!resp.ok) throw new Error(`Alpaca getOrder failed: ${resp.status}`);
    return this.parseOrder(await resp.json());
  }

  async cancelOrder(orderId: string): Promise<void> {
    const resp = await this.request(`/v2/orders/${orderId}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Alpaca cancelOrder failed: ${resp.status}`);
  }

  /**
   * Backward-compatible activity read. Scheduled ledger callers should use the
   * structured bounded result below so truncation cannot be mistaken for a
   * complete broker sync.
   */
  async getAccountActivities(
    activityTypes: string[],
    after?: string,
    until?: string,
  ): Promise<AccountActivity[]> {
    return (await this.getAccountActivitiesBounded(activityTypes, after, until)).activities;
  }

  async getAccountActivitiesBounded(
    activityTypes: string[],
    after?: string,
    until?: string,
    requestedPageBudget = ACCOUNT_ACTIVITY_PAGE_BUDGET,
  ): Promise<AccountActivitiesResult> {
    const activities: AccountActivity[] = [];
    const pageBudget = Math.max(1, Math.floor(requestedPageBudget));
    let pageToken: string | undefined;
    let pages = 0;
    for (let page = 0; page < pageBudget; page++) {
      const params = new URLSearchParams({
        activity_types: activityTypes.join(','),
        direction: 'asc',
        page_size: '100',
      });
      if (after) params.set('after', after);
      if (until) params.set('until', until);
      if (pageToken) params.set('page_token', pageToken);
      const resp = await this.request(`/v2/account/activities?${params.toString()}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Alpaca getAccountActivities failed: ${resp.status} ${text}`);
      }
      const data = await resp.json() as any[];
      pages++;
      if (!Array.isArray(data) || data.length === 0) {
        pageToken = undefined;
        break;
      }
      for (const a of data) {
        activities.push({
          id: String(a.id),
          activity_type: String(a.activity_type || ''),
          activity_sub_type: a.activity_sub_type ?? null,
          date: a.date ?? null,
          created_at: a.created_at ?? null,
          transaction_time: a.transaction_time ?? null,
          type: a.type ?? null,
          order_id: a.order_id ?? null,
          symbol: a.symbol ?? null,
          side: a.side ?? null,
          qty: a.qty == null ? null : Number(a.qty),
          price: a.price == null ? null : Number(a.price),
          cum_qty: a.cum_qty == null ? null : Number(a.cum_qty),
          leaves_qty: a.leaves_qty == null ? null : Number(a.leaves_qty),
          net_amount: a.net_amount == null ? null : Number(a.net_amount),
          currency: a.currency ?? null,
          description: a.description ?? null,
          status: a.status ?? null,
        });
      }
      const next = data[data.length - 1]?.id;
      if (!next || data.length < 100 || next === pageToken) {
        pageToken = undefined;
        break;
      }
      pageToken = String(next);
    }
    const truncated = Boolean(pageToken);
    return { activities, pages, pageBudget, truncated, degraded: truncated };
  }

  async getRecentOrders(limit: number = 50, options: { after?: string; until?: string; direction?: 'asc' | 'desc' } = {}): Promise<Order[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      status: 'all',
      direction: options.direction || 'desc',
    });
    if (options.after) params.set('after', options.after);
    if (options.until) params.set('until', options.until);
    const resp = await this.request(`/v2/orders?${params.toString()}`);
    if (!resp.ok) throw new Error(`Alpaca getRecentOrders failed: ${resp.status}`);
    const data = await resp.json() as any[];
    return data.map(o => this.parseOrder(o));
  }

  // ============================================================
  // Market Data (via data.alpaca.markets)
  // ============================================================

  async getBars(
    symbol: string,
    timeframe: string = '5Min',
    limit: number = 200,
    options: { start?: string; end?: string } = {},
  ): Promise<Bar[]> {
    const dataUrl = this.getDataBaseUrl();
    const bars: any[] = [];
    let pageToken: string | undefined;
    // Alpaca may return fewer rows than requested and expose the remainder via
    // next_page_token. Follow it so a short first page cannot masquerade as a
    // short history window.
    for (let page = 0; page < 20; page++) {
      const params = new URLSearchParams({
        timeframe,
        limit: String(limit),
        sort: 'asc',
      });
      if (options.start) params.set('start', options.start);
      if (options.end) params.set('end', options.end);
      if (pageToken) params.set('page_token', pageToken);
      const url = `${dataUrl}/v2/stocks/${symbol}/bars?${params.toString()}`;

      const resp = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Alpaca getBars failed for ${symbol}: ${resp.status} ${text}`);
      }

      const data = await resp.json() as any;
      bars.push(...(Array.isArray(data.bars) ? data.bars : []));
      pageToken = typeof data.next_page_token === 'string' && data.next_page_token.length > 0
        ? data.next_page_token
        : undefined;
      if (!pageToken) break;
    }

    return bars.map((b: any) => ({
      // Alpaca returns RFC-3339 timestamps for stock bars. Normalize them to
      // unix seconds so all indicator timestamp arithmetic is deterministic.
      t: typeof b.t === 'string' ? Date.parse(b.t) / 1000 : Number(b.t),
      o: Number(b.o),
      h: Number(b.h),
      l: Number(b.l),
      c: Number(b.c),
      v: Number(b.v),
    }));
  }

  async getBarsBatch(
    symbols: string[],
    timeframe: string = '5Min',
    limit: number = 200,
    options: { start?: string; end?: string } = {},
  ): Promise<BatchBarsResult> {
    const result = new Map<string, Bar[]>();
    const requestedSymbols = Array.from(new Set(symbols.filter(Boolean)));
    requestedSymbols.forEach(symbol => result.set(symbol, []));
    if (requestedSymbols.length === 0) return { barsBySymbol: result, pages: 0, symbolsRequested: 0 };

    const dataUrl = this.getDataBaseUrl();
    let pageToken: string | undefined;
    const seenPageTokens = new Set<string>();
    let pages = 0;
    const maxPages = 8; // 150 symbols × 400 daily bars needs at most 6 pages at 10,000/page.
    // Alpaca's multi-symbol limit applies to the total number of bars in a
    // response page, not per symbol. Request the documented maximum so a full
    // swing universe needs only a handful of pages, then follow pagination so
    // every requested symbol gets the same historical window.
    const pageLimit = Math.min(Math.max(limit, 1) * requestedSymbols.length, 10000);
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        symbols: requestedSymbols.join(','),
        timeframe,
        limit: String(pageLimit),
        sort: 'asc',
      });
      if (options.start) params.set('start', options.start);
      if (options.end) params.set('end', options.end);
      if (pageToken) params.set('page_token', pageToken);
      const url = `${dataUrl}/v2/stocks/bars?${params.toString()}`;

      const resp = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Alpaca getBarsBatch failed: ${resp.status} ${text}`);
      }
      pages++;

      const data = await resp.json() as any;
      const barsBySymbol = data.bars && typeof data.bars === 'object' ? data.bars : {};
      for (const [symbol, rawBars] of Object.entries(barsBySymbol)) {
        const normalized = Array.isArray(rawBars) ? rawBars.map((b: any) => ({
          t: typeof b.t === 'string' ? Date.parse(b.t) / 1000 : Number(b.t),
          o: Number(b.o),
          h: Number(b.h),
          l: Number(b.l),
          c: Number(b.c),
          v: Number(b.v),
        })) : [];
        const existing = result.get(symbol) || [];
        result.set(symbol, existing.concat(normalized));
      }

      const nextPageToken = typeof data.next_page_token === 'string' && data.next_page_token.length > 0
        ? data.next_page_token
        : undefined;
      if (!nextPageToken) {
        pageToken = undefined;
        break;
      }
      if (seenPageTokens.has(nextPageToken)) {
        throw new Error(`Alpaca getBarsBatch repeated next_page_token after ${pages} pages`);
      }
      seenPageTokens.add(nextPageToken);
      pageToken = nextPageToken;
    }

    if (pageToken) {
      throw new Error(`Alpaca getBarsBatch exceeded ${maxPages}-page budget`);
    }
    return { barsBySymbol: result, pages, symbolsRequested: requestedSymbols.length };
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
    // Alpaca otherwise defaults to bars from the current UTC day only.
    // Use a rolling historical window so early 00/04/08/12 UTC cycles
    // still have enough bars for the TA indicators.
    const end = new Date();
    const start = new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000);
    const url = `${dataUrl}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(apiSymbol)}&timeframe=${encodeURIComponent(timeframe)}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}&limit=${limit}`;

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
      v: parseFloat(b.v || b.V) || 0,
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

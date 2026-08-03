// Universe Scanner
// Selects the best candidate stocks to analyze each cycle
// Combines market movers with a curated default universe

import type { AlpacaClient } from './alpaca';

export interface UniverseCandidate {
  symbol: string;
  name: string;
  score: number;       // higher = more interesting
  reason: string;
}

// Curated universe of high-liquidity US stocks across sectors
const DEFAULT_UNIVERSE = [
  // Tech mega caps
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'AMD', 'INTC',
  // Financials
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'V', 'MA', 'AXP',
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'MRK', 'ABBV', 'LLY', 'BMY', 'AMGN',
  // Consumer
  'WMT', 'PG', 'COST', 'HD', 'NKE', 'MCD', 'SBUX', 'DIS', 'KO', 'PEP',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'PSX',
  // Industrial
  'BA', 'CAT', 'GE', 'HON', 'UPS', 'RTX', 'LMT',
  // Comm services
  'NFLX', 'CMCSA', 'T', 'VZ', 'TMUS',
  // Materials
  'LIN', 'APD', 'SHW', 'FCX',
  // Utilities
  'NEE', 'DUK', 'SO', 'AEP',
  // Real estate
  'PLD', 'AMT', 'SPG',
  // Crypto-adjacent
  'COIN', 'MSTR',
  // Semiconductors
  'QCOM', 'TXN', 'MU', 'NXPI', 'ASML', 'TSM',
  // Software
  'CRM', 'ORCL', 'ADBE', 'NOW', 'INTU', 'SNOW', 'PLTR', 'DDOG',
  // E-commerce / fintech
  'SHOP', 'SQ', 'PYPL', 'AFRM', 'HOOD',
  // EV / clean energy
  'RIVN', 'LCID', 'NIO', 'ENPH', 'SEDG', 'RUN',
  // Other high-volume
  'F', 'GM', 'CCL', 'NCLH', 'UAL', 'DAL', 'AAL', 'LUV',
  'BBD', 'SOFI', 'WBD', 'SIRI', 'FCEL', 'PLUG',
];

export class UniverseScanner {
  private client: AlpacaClient;
  private universeSize: number;

  constructor(client: AlpacaClient, universeSize: number = 100) {
    this.client = client;
    this.universeSize = universeSize;
  }

  async scan(): Promise<string[]> {
    const candidates = new Set<string>();

    // 1. Add top movers from Alpaca
    try {
      const movers = await this.client.getTopMovers();
      movers.gainers.forEach(s => candidates.add(s));
      movers.losers.forEach(s => candidates.add(s));
    } catch (e) {
      console.error('Failed to get movers:', e);
    }

    // 2. Add default universe
    DEFAULT_UNIVERSE.forEach(s => candidates.add(s));

    // 3. Get snapshots to filter by liquidity and activity
    const symbols = Array.from(candidates).slice(0, 150); // Max to scan

    try {
      const snapshots = await this.client.getSnapshots(symbols);

      // Filter: must have meaningful volume and price
      const filtered = symbols.filter(s => {
        const snap = snapshots[s];
        if (!snap) return false;
        if (snap.latest_price <= 0) return false;
        if (snap.volume < 100000) return false; // Min daily volume
        return true;
      });

      // Sort by absolute daily change (most movement = most opportunity)
      const scored = filtered.map(s => {
        const snap = snapshots[s];
        return {
          symbol: s,
          score: Math.abs(snap.daily_change_pct) + Math.log10(Math.max(snap.volume, 1)) * 2,
          change: snap.daily_change_pct,
          volume: snap.volume,
        };
      }).sort((a, b) => b.score - a.score);

      return scored.slice(0, this.universeSize).map(s => s.symbol);
    } catch (e) {
      console.error('Snapshot filtering failed, using raw universe:', e);
      // Fallback: just return the default universe truncated
      return DEFAULT_UNIVERSE.slice(0, this.universeSize);
    }
  }
}

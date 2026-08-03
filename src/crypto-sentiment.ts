// Crypto Market Sentiment
// Fetches Fear & Greed Index + CoinGecko trending data
// Injected into LLM prompt for better crypto decisions

export interface CryptoSentiment {
  fearGreedValue: number;        // 0-100 (0=Extreme Fear, 100=Extreme Greed)
  fearGreedLabel: string;        // "Fear", "Greed", "Extreme Fear", etc.
  fearGreedYesterday: number;    // previous day for trend
  trendingCoins: string[];       // top trending coin symbols
  bitcoinDominance: number | null; // BTC.D if available
  fetchedAt: number;
}

const FNG_API = 'https://api.alternative.me/fng/?limit=2';
const COINGECKO_TRENDING = 'https://api.coingecko.com/api/v3/search/trending';

export async function getCryptoSentiment(): Promise<CryptoSentiment | null> {
  try {
    // Fetch both APIs in parallel
    const [fngResp, trendingResp] = await Promise.all([
      fetch(FNG_API, { headers: { 'Accept': 'application/json' } }),
      fetch(COINGECKO_TRENDING, { headers: { 'Accept': 'application/json' } }),
    ]);

    // Parse Fear & Greed
    let fearGreedValue = 50;
    let fearGreedLabel = 'Neutral';
    let fearGreedYesterday = 50;

    if (fngResp.ok) {
      const fngData = await fngResp.json() as any;
      const today = fngData?.data?.[0];
      const yesterday = fngData?.data?.[1];
      if (today) {
        fearGreedValue = parseInt(today.value) || 50;
        fearGreedLabel = today.value_classification || 'Neutral';
      }
      if (yesterday) {
        fearGreedYesterday = parseInt(yesterday.value) || 50;
      }
    }

    // Parse CoinGecko trending
    let trendingCoins: string[] = [];
    if (trendingResp.ok) {
      const trendingData = await trendingResp.json() as any;
      const coins = trendingData?.coins || [];
      trendingCoins = coins
        .slice(0, 5)
        .map((c: any) => c?.item?.symbol?.toUpperCase() || '')
        .filter((s: string) => s.length > 0);
    }

    return {
      fearGreedValue,
      fearGreedLabel,
      fearGreedYesterday,
      trendingCoins,
      bitcoinDominance: null, // CoinGecko free API doesn't include BTC.D directly
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error('Crypto sentiment fetch failed:', error);
    return null;
  }
}

// Build sentiment text for LLM prompt injection
export function formatSentimentForPrompt(sentiment: CryptoSentiment | null): string {
  if (!sentiment) return 'Sentiment data unavailable';

  const trend = sentiment.fearGreedValue > sentiment.fearGreedYesterday
    ? 'rising (improving sentiment)'
    : sentiment.fearGreedValue < sentiment.fearGreedYesterday
    ? 'falling (deteriorating sentiment)'
    : 'stable';

  const trending = sentiment.trendingCoins.length > 0
    ? sentiment.trendingCoins.join(', ')
    : 'none available';

  return `- Fear & Greed Index: ${sentiment.fearGreedValue} (${sentiment.fearGreedLabel}) — ${trend} from yesterday (${sentiment.fearGreedYesterday})
- Trending coins: ${trending}
- Market psychology: ${sentiment.fearGreedValue < 25 ? 'Extreme fear — capitulation zone, potential contrarian buy opportunity' : sentiment.fearGreedValue < 45 ? 'Fear — cautious, sellers in control' : sentiment.fearGreedValue < 55 ? 'Neutral — balanced market' : sentiment.fearGreedValue < 75 ? 'Greed — buyers confident, momentum strong' : 'Extreme greed — euphoria zone, potential contrarian sell signal'}`;
}

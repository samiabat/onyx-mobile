const BASE_URL = 'https://api.coinlore.net/api';

export interface CoinLoreAsset {
  id: string;
  symbol: string;
  name: string;
  price_usd: string;
  percent_change_24h: string;
  percent_change_7d: string;
  market_cap_usd: string;
  rank: number;
}

let coinListCache: CoinLoreAsset[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchCoinList(): Promise<CoinLoreAsset[]> {
  const now = Date.now();
  if (coinListCache.length > 0 && now - cacheTimestamp < CACHE_TTL) {
    return coinListCache;
  }
  try {
    const results: CoinLoreAsset[] = [];
    // Fetch top 200 coins (2 pages of 100)
    for (let start = 0; start <= 100; start += 100) {
      const res = await fetch(`${BASE_URL}/tickers/?start=${start}&limit=100`);
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.data) results.push(...json.data);
    }
    if (results.length > 0) {
      coinListCache = results;
      cacheTimestamp = now;
    }
    return results;
  } catch (e) {
    console.error('CoinLore list fetch error:', e);
    return coinListCache; // return stale cache on error
  }
}

export async function searchCoins(query: string): Promise<CoinLoreAsset[]> {
  if (!query.trim()) return [];
  const coins = await fetchCoinList();
  const q = query.toLowerCase().trim();
  return coins.filter(
    c => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  ).slice(0, 20);
}

export async function fetchPriceById(id: string): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/ticker/?id=${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      return parseFloat(json[0].price_usd);
    }
    return null;
  } catch (e) {
    console.error('CoinLore price fetch error:', e);
    return null;
  }
}

export async function fetchPricesByIds(ids: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (ids.length === 0) return prices;
  try {
    const idStr = ids.join(',');
    const res = await fetch(`${BASE_URL}/ticker/?id=${idStr}`);
    if (!res.ok) return prices;
    const json = await res.json();
    if (Array.isArray(json)) {
      for (const coin of json) {
        prices.set(String(coin.id), parseFloat(coin.price_usd));
      }
    }
    return prices;
  } catch (e) {
    console.error('CoinLore batch price fetch error:', e);
    return prices;
  }
}

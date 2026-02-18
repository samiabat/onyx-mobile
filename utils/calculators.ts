export interface Trade {
  id: number;
  strategyId: string;
  direction: string;
  dateStr: string;
  timeStr: string;
  risk: number;
  realizedProfit: number;
  percentClosed: number;
  status: string;
  journal: JournalEntry[];
  isBreakeven: boolean;
  tags: string[];
  closedAt?: number;
}

export interface JournalEntry {
  timestamp: number;
  type: string;
  percentClosed: number;
  profitBanked: number;
  imageUris?: string[];
  imageUri?: string;
  note?: string;
}

export interface Analytics {
  netProfit: number;
  winRate: number;
  avgRR: string;
  profitFactor: string;
  totalTrades: number;
  dailyStats: Trade[];
  tagStats: TagStat[];
}

export interface TagStat {
  tag: string;
  count: number;
  winRate: number;
  roi: number;
}

export interface SimResult {
  final: number;
  growth: number;
  dd: number;
  expected: number;
}

export function computeAnalytics(
  periodTrades: Trade[],
  allStrategyHistory: Trade[],
  tags: string[]
): Analytics {
  const wins = periodTrades.filter(t => t.realizedProfit > 0);
  const losses = periodTrades.filter(t => t.realizedProfit < 0);
  const total = periodTrades.length;

  const netProfit = periodTrades.reduce((a, t) => a + t.realizedProfit, 0);
  const winRate = total > 0 ? (wins.length / total * 100) : 0;

  const avgWin = wins.length ? wins.reduce((a, t) => a + t.realizedProfit, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + t.realizedProfit, 0) / losses.length) : 0;
  const avgRR = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : (avgWin > 0 ? "∞" : "0.00");
  const profitFactor = Math.abs(losses.reduce((a, t) => a + t.realizedProfit, 0)) > 0
    ? (wins.reduce((a, t) => a + t.realizedProfit, 0) / Math.abs(losses.reduce((a, t) => a + t.realizedProfit, 0))).toFixed(2)
    : "∞";

  const dailyStats = [...allStrategyHistory].sort((a, b) => b.id - a.id);

  const tagStats = tags.map(tag => {
    const taggedTrades = allStrategyHistory.filter(t => t.tags && t.tags.includes(tag));
    const count = taggedTrades.length;
    const tagWins = taggedTrades.filter(t => t.realizedProfit > 0).length;
    const rate = count > 0 ? (tagWins / count * 100) : 0;
    const net = taggedTrades.reduce((acc, t) => acc + t.realizedProfit, 0);
    const totalRisk = taggedTrades.reduce((acc, t) => acc + t.risk, 0);
    const roi = totalRisk > 0 ? (net / totalRisk) * 100 : 0;
    return { tag, count, winRate: rate, roi };
  }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

  return { netProfit, winRate, avgRR, profitFactor, totalTrades: total, dailyStats, tagStats };
}

export function filterTradesByPeriod(trades: Trade[], period: string): Trade[] {
  const now = new Date();
  return trades.filter(t => {
    const d = new Date(t.id);
    if (period === 'ALL') return true;
    if (period === '1D') return d.toDateString() === now.toDateString();
    if (period === '1W') { const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7); return d >= weekAgo; }
    if (period === '1M') { const monthAgo = new Date(); monthAgo.setMonth(now.getMonth() - 1); return d >= monthAgo; }
    if (period === '1Y') { const yearAgo = new Date(); yearAgo.setFullYear(now.getFullYear() - 1); return d >= yearAgo; }
    return true;
  });
}

export function runSimulation(params: {
  balance: string;
  winRate: string;
  rr: string;
  trades: string;
}): SimResult {
  const startBalance = parseFloat(params.balance);
  const winRate = parseFloat(params.winRate) / 100;
  const rr = parseFloat(params.rr);
  const numTrades = parseInt(params.trades);
  const riskPerTrade = startBalance * 0.01;

  const evPerTrade = (riskPerTrade * rr * winRate) - (riskPerTrade * (1 - winRate));
  const projectedProfit = evPerTrade * numTrades;
  const expectedBalance = startBalance + projectedProfit;

  let balance = startBalance;
  let peak = startBalance;
  let maxDrawdown = 0;
  for (let i = 0; i < numTrades; i++) {
    const isWin = Math.random() < winRate;
    const pnl = isWin ? (riskPerTrade * rr) : -riskPerTrade;
    balance += pnl;
    if (balance > peak) peak = balance;
    const dd = (peak - balance) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return { final: balance, growth: ((balance - startBalance) / startBalance) * 100, dd: maxDrawdown, expected: expectedBalance };
}

export function computeModelStats(
  strategyHistory: Trade[],
  selectedModelTags: string[]
): { count: number; winRate: number; netProfit: number } | null {
  if (selectedModelTags.length === 0) return null;
  const matchingTrades = strategyHistory.filter(t => t.tags && selectedModelTags.every(tag => t.tags.includes(tag)));
  const count = matchingTrades.length;
  const wins = matchingTrades.filter(t => t.realizedProfit > 0).length;
  const winRate = count > 0 ? (wins / count * 100) : 0;
  const netProfit = matchingTrades.reduce((acc, t) => acc + t.realizedProfit, 0);
  return { count, winRate, netProfit };
}

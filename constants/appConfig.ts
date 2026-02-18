import * as FileSystem from 'expo-file-system/legacy';

export const APP_NAME = "ONYX";
export const ROOT_DIR = FileSystem.documentDirectory || FileSystem.cacheDirectory;
export const CHART_DIR = ROOT_DIR + 'charts/';
export const TRADES_PER_PAGE = 5;

export const THEMES: Record<string, Record<string, string>> = {
  dark: {
    bg: '#09090B',
    card: '#18181B',
    border: '#27272A',
    text: '#FAFAFA',
    subText: '#A1A1AA',
    tint: '#3B82F6',
    btnText: '#FFFFFF',
    danger: '#EF4444',
    success: '#32D74B',
    input: '#000000',
    overlay: 'rgba(0,0,0,0.9)'
  },
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    subText: '#64748B',
    tint: '#2563EB',
    btnText: '#FFFFFF',
    danger: '#DC2626',
    success: '#16A34A',
    input: '#F1F5F9',
    overlay: 'rgba(255,255,255,0.95)'
  }
};

export const DEFAULT_RULES = [
  { id: '1', text: "Identify Key Level (S/R)" },
  { id: '2', text: "Wait for Rejection Candle" },
  { id: '3', text: "Confirm Trend Direction" },
  { id: '4', text: "Risk/Reward > 1:2" }
];

export const DEFAULT_STRATEGY = {
  id: 'default_pa',
  name: 'Price Action Basics',
  risk: 100,
  rules: DEFAULT_RULES
};

export const DEFAULT_TAGS = ['A+ Setup', 'Trend', 'Reversal', 'Impulse', 'Chop'];

export const PREDEFINED_ASSETS: { name: string; ticker: string; category: 'Crypto' | 'Stock' | 'Index'; coinloreId?: string }[] = [
  // Crypto (with CoinLore IDs for live pricing)
  { name: 'Bitcoin', ticker: 'BTC', category: 'Crypto', coinloreId: '90' },
  { name: 'Ethereum', ticker: 'ETH', category: 'Crypto', coinloreId: '80' },
  { name: 'Solana', ticker: 'SOL', category: 'Crypto', coinloreId: '48543' },
  { name: 'Ripple', ticker: 'XRP', category: 'Crypto', coinloreId: '58' },
  { name: 'Cardano', ticker: 'ADA', category: 'Crypto', coinloreId: '257' },
  { name: 'Polygon', ticker: 'MATIC', category: 'Crypto', coinloreId: '3890' },
  { name: 'Dogecoin', ticker: 'DOGE', category: 'Crypto', coinloreId: '2' },
  { name: 'Avalanche', ticker: 'AVAX', category: 'Crypto', coinloreId: '44883' },
  { name: 'Chainlink', ticker: 'LINK', category: 'Crypto', coinloreId: '1975' },
  { name: 'Polkadot', ticker: 'DOT', category: 'Crypto', coinloreId: '54032' },
  // Stocks (manual price tracking)
  { name: 'Apple', ticker: 'AAPL', category: 'Stock' },
  { name: 'Tesla', ticker: 'TSLA', category: 'Stock' },
  { name: 'Microsoft', ticker: 'MSFT', category: 'Stock' },
  { name: 'Amazon', ticker: 'AMZN', category: 'Stock' },
  { name: 'Google', ticker: 'GOOGL', category: 'Stock' },
  { name: 'NVIDIA', ticker: 'NVDA', category: 'Stock' },
  { name: 'Meta', ticker: 'META', category: 'Stock' },
  { name: 'Netflix', ticker: 'NFLX', category: 'Stock' },
  { name: 'AMD', ticker: 'AMD', category: 'Stock' },
  { name: 'Palantir', ticker: 'PLTR', category: 'Stock' },
  // Indices (manual price tracking)
  { name: 'S&P 500', ticker: 'SPX', category: 'Index' },
  { name: 'Nasdaq 100', ticker: 'NDX', category: 'Index' },
  { name: 'Dow Jones', ticker: 'DJI', category: 'Index' },
  { name: 'Russell 2000', ticker: 'RUT', category: 'Index' },
  { name: 'VIX', ticker: 'VIX', category: 'Index' },
];

export const DEFAULT_PROFILE = {
  name: 'Trader',
  goal: 'Consistent Profitability',
  mantra: 'Plan the trade, trade the plan.',
  biometricsEnabled: false,
  rank: 'Novice',
  experience: '',
  tradingStyle: [] as string[],
};

export const RANK_OPTIONS = ['Novice', 'Apprentice', 'Intermediate', 'Advanced', 'Funded Trader', 'Whale'];

export const TRADING_STYLE_OPTIONS = ['Scalper', 'Day Trader', 'Swing', 'Position', 'Investor'];

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  check: (stats: { history: any[]; investments: any[] }) => boolean;
}

export const BACKUP_VERSION = "4.2";

export const BADGES: Badge[] = [
  { id: 'first_blood', name: 'First Blood', emoji: '🥇', description: 'Log your first trade.', check: ({ history }) => history.length >= 1 },
  { id: 'sniper', name: 'Sniper', emoji: '🎯', description: 'Achieve a win with >1:5 RR.', check: ({ history }) => history.some(t => t.realizedProfit > 0 && t.risk > 0 && (t.realizedProfit / t.risk) > 5) },
  { id: 'on_fire', name: 'On Fire', emoji: '🔥', description: '3 wins in a row.', check: ({ history }) => {
    const sorted = [...history].sort((a, b) => (Number(a.closedAt ?? a.id) || 0) - (Number(b.closedAt ?? b.id) || 0));
    let streak = 0;
    for (const t of sorted) { if (t.realizedProfit > 0) { streak++; if (streak >= 3) return true; } else { streak = 0; } }
    return false;
  }},
  { id: 'diamond_hands', name: 'Diamond Hands', emoji: '💎', description: 'Hold an investment for >30 days.', check: ({ investments }) => investments.some(inv => {
    const entryDate = new Date(inv.entryDate);
    const daysDiff = (Date.now() - entryDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 30;
  })},
  { id: 'disciplined', name: 'Disciplined', emoji: '🛡️', description: 'Close 10 trades where you followed all rules.', check: ({ history }) => {
    const taggedTrades = history.filter(t => t.tags && t.tags.length > 0);
    return taggedTrades.length >= 10;
  }},
  // --- ELITE / GOD-TIER BADGES ---
  { id: 'the_oracle', name: 'The Oracle', emoji: '🔮', description: '100% Win Rate over 50 trades.', check: ({ history }) => {
    if (history.length < 50) return false;
    const sorted = [...history].sort((a, b) => (Number(a.closedAt ?? a.id) || 0) - (Number(b.closedAt ?? b.id) || 0));
    const last50 = sorted.slice(-50);
    return last50.every(t => t.realizedProfit > 0);
  }},
  { id: 'market_maker', name: 'Market Maker', emoji: '💰', description: 'Reach a total net profit of $1,000,000.', check: ({ history }) => {
    const totalProfit = history.reduce((sum, t) => sum + (t.realizedProfit || 0), 0);
    return totalProfit >= 1000000;
  }},
  { id: 'iron_mind', name: 'Iron Mind', emoji: '🧠', description: 'Journal trades for 365 consecutive days.', check: ({ history }) => {
    if (history.length === 0) return false;
    const days = new Set(history.map(t => {
      const d = new Date(t.closedAt ?? t.id);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }));
    const sortedDays = [...days].sort();
    let maxStreak = 1, streak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1] + 'T00:00:00');
      const curr = new Date(sortedDays[i] + 'T00:00:00');
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) { streak++; maxStreak = Math.max(maxStreak, streak); } else { streak = 1; }
    }
    return maxStreak >= 365;
  }},
  { id: 'liquidity_hunter', name: 'Liquidity Hunter', emoji: '🦈', description: 'Close a single trade with a Risk:Reward of 1:20+.', check: ({ history }) => {
    return history.some(t => t.realizedProfit > 0 && t.risk > 0 && (t.realizedProfit / t.risk) >= 20);
  }},
  { id: 'century_club', name: 'Century Club', emoji: '💯', description: 'Log 1,000 trades total.', check: ({ history }) => history.length >= 1000 },
  { id: 'the_stoic', name: 'The Stoic', emoji: '🧘', description: 'No more than 2 trades per day for 90 consecutive days.', check: ({ history }) => {
    if (history.length === 0) return false;
    const dayCounts: Record<string, number> = {};
    history.forEach(t => {
      const d = new Date(t.closedAt ?? t.id);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayCounts[key] = (dayCounts[key] || 0) + 1;
    });
    const sortedDays = Object.keys(dayCounts).sort();
    let streak = 0;
    for (let i = 0; i < sortedDays.length; i++) {
      if (dayCounts[sortedDays[i]] > 2) { streak = 0; continue; }
      if (i === 0 || streak === 0) { streak = 1; } else {
        const prev = new Date(sortedDays[i - 1] + 'T00:00:00');
        const curr = new Date(sortedDays[i] + 'T00:00:00');
        const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        streak = diff === 1 ? streak + 1 : 1;
      }
      if (streak >= 90) return true;
    }
    return false;
  }},
];

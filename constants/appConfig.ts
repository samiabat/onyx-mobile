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
  biometricsEnabled: false
};

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
    tint: '#10B981',
    btnText: '#000000',
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
    tint: '#059669',
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

export const DEFAULT_PROFILE = {
  name: 'Trader',
  goal: 'Consistent Profitability',
  mantra: 'Plan the trade, trade the plan.',
  biometricsEnabled: false
};

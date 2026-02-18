import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { type Investment, computePortfolioAnalytics } from '@/utils/calculators';
import { fetchPricesByIds } from '@/services/coinloreService';

const STORAGE_KEY = 'onyx_portfolio';
const HISTORY_KEY = 'onyx_portfolio_history';

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
}

export function usePortfolioData() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioSnapshot[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPortfolio = useCallback(async () => {
    try {
      const [stored, histStored] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
      ]);
      if (stored) setInvestments(JSON.parse(stored));
      if (histStored) setPortfolioHistory(JSON.parse(histStored));
    } catch (e) {
      console.error("Portfolio Load Error", e);
    }
  }, []);

  const savePortfolio = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(investments));
    } catch (e) {
      console.error("Portfolio Save Error", e);
    }
  }, [investments]);

  const saveHistory = useCallback(async (history: PortfolioSnapshot[]) => {
    try {
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error("Portfolio History Save Error", e);
    }
  }, []);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);
  useEffect(() => { savePortfolio(); }, [savePortfolio]);

  const portfolioAnalytics = useMemo(
    () => computePortfolioAnalytics(investments),
    [investments]
  );

  const recordSnapshot = useCallback((invs: Investment[]) => {
    const analytics = computePortfolioAnalytics(invs);
    if (analytics.currentValue > 0) {
      const snapshot: PortfolioSnapshot = {
        timestamp: Date.now(),
        totalValue: analytics.currentValue,
      };
      setPortfolioHistory(prev => {
        // Keep max 100 data points, throttle to 1 per 5 min
        const last = prev[prev.length - 1];
        if (last && Date.now() - last.timestamp < 5 * 60 * 1000) {
          const updated = [...prev.slice(0, -1), snapshot];
          saveHistory(updated);
          return updated;
        }
        const updated = [...prev.slice(-99), snapshot];
        saveHistory(updated);
        return updated;
      });
    }
  }, [saveHistory]);

  const refreshCryptoPrices = useCallback(async () => {
    const cryptoInvestments = investments.filter(inv => inv.coinloreId);
    if (cryptoInvestments.length === 0) return;

    setIsRefreshing(true);
    try {
      const ids = cryptoInvestments.map(inv => inv.coinloreId!);
      const prices = await fetchPricesByIds(ids);

      if (prices.size > 0) {
        setInvestments(prev => {
          const updated = prev.map(inv => {
            if (inv.coinloreId && prices.has(inv.coinloreId)) {
              return { ...inv, currentPrice: prices.get(inv.coinloreId)! };
            }
            return inv;
          });
          recordSnapshot(updated);
          return updated;
        });
      }
    } catch (e) {
      console.error("Price refresh error:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [investments, recordSnapshot]);

  const addInvestment = (investment: Omit<Investment, 'id' | 'currentPrice'>) => {
    const newInvestment: Investment = {
      ...investment,
      id: Date.now(),
      currentPrice: investment.entryPrice,
    };
    setInvestments(prev => [newInvestment, ...prev]);
    return newInvestment;
  };

  const updateCurrentPrice = (id: number, price: number) => {
    setInvestments(prev => {
      const updated = prev.map(inv =>
        inv.id === id ? { ...inv, currentPrice: price } : inv
      );
      recordSnapshot(updated);
      return updated;
    });
  };

  const updateInvestmentImages = (id: number, imageUris: string[]) => {
    setInvestments(prev => prev.map(inv =>
      inv.id === id ? { ...inv, imageUris: [...inv.imageUris, ...imageUris] } : inv
    ));
  };

  const deleteInvestment = (id: number) => {
    Alert.alert("Delete Investment?", "This action cannot be undone.", [
      { text: "Cancel" },
      { text: "Delete", style: 'destructive', onPress: () => {
        setInvestments(prev => prev.filter(inv => inv.id !== id));
      }},
    ]);
  };

  return {
    investments,
    portfolioAnalytics,
    portfolioHistory,
    isRefreshing,
    addInvestment,
    updateCurrentPrice,
    updateInvestmentImages,
    deleteInvestment,
    loadPortfolio,
    refreshCryptoPrices,
  };
}

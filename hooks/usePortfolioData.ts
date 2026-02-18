import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { type Investment, computePortfolioAnalytics } from '@/utils/calculators';

const STORAGE_KEY = 'onyx_portfolio';

export function usePortfolioData() {
  const [investments, setInvestments] = useState<Investment[]>([]);

  const loadPortfolio = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setInvestments(JSON.parse(stored));
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

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);
  useEffect(() => { savePortfolio(); }, [savePortfolio]);

  const portfolioAnalytics = useMemo(
    () => computePortfolioAnalytics(investments),
    [investments]
  );

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
    setInvestments(prev => prev.map(inv =>
      inv.id === id ? { ...inv, currentPrice: price } : inv
    ));
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
    addInvestment,
    updateCurrentPrice,
    updateInvestmentImages,
    deleteInvestment,
    loadPortfolio,
  };
}

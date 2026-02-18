import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { DEFAULT_STRATEGY, DEFAULT_TAGS, DEFAULT_PROFILE, DEFAULT_RULES } from '@/constants/appConfig';
import type { Trade } from '@/utils/calculators';

export function useTradeData() {
  const [strategies, setStrategies] = useState([DEFAULT_STRATEGY]);
  const [currentStrategyId, setCurrentStrategyId] = useState(DEFAULT_STRATEGY.id);
  const [history, setHistory] = useState<Trade[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [themeMode, setThemeMode] = useState('dark');

  const activeStrategy = strategies.find(s => s.id === currentStrategyId) || strategies[0];
  const strategyHistory = useMemo(() => history.filter(t => t.strategyId === currentStrategyId), [history, currentStrategyId]);
  const strategyActive = useMemo(() => activeTrades.filter(t => t.strategyId === currentStrategyId), [activeTrades, currentStrategyId]);

  const loadData = useCallback(async () => {
    try {
      const sHistory = await AsyncStorage.getItem('onyx_history');
      const sActive = await AsyncStorage.getItem('onyx_active');
      const sStrategies = await AsyncStorage.getItem('onyx_strategies');
      const sCurrentId = await AsyncStorage.getItem('onyx_current_strat');
      const sTheme = await AsyncStorage.getItem('onyx_theme');
      const sTags = await AsyncStorage.getItem('onyx_tags');
      const sProfile = await AsyncStorage.getItem('onyx_profile');

      if (sHistory) setHistory(JSON.parse(sHistory));
      if (sActive) setActiveTrades(JSON.parse(sActive));
      if (sStrategies) setStrategies(JSON.parse(sStrategies));
      if (sCurrentId) setCurrentStrategyId(sCurrentId);
      if (sTheme) setThemeMode(sTheme);
      if (sTags) setTags(JSON.parse(sTags));
      if (sProfile) setProfile(JSON.parse(sProfile));
    } catch (e) { console.error("Load Error", e); }
  }, []);

  const saveData = useCallback(async () => {
    try {
      await AsyncStorage.setItem('onyx_history', JSON.stringify(history));
      await AsyncStorage.setItem('onyx_active', JSON.stringify(activeTrades));
      await AsyncStorage.setItem('onyx_strategies', JSON.stringify(strategies));
      await AsyncStorage.setItem('onyx_current_strat', currentStrategyId);
      await AsyncStorage.setItem('onyx_theme', themeMode);
      await AsyncStorage.setItem('onyx_tags', JSON.stringify(tags));
      await AsyncStorage.setItem('onyx_profile', JSON.stringify(profile));
    } catch (e) { console.error("Save Error", e); }
  }, [history, activeTrades, strategies, currentStrategyId, themeMode, tags, profile]);

  const handleExecute = (direction: string | null, customRisk?: number) => {
    const riskAmount = customRisk !== undefined && customRisk > 0 ? customRisk : activeStrategy.risk;
    const newTrade: Trade = {
      id: Date.now(), strategyId: currentStrategyId,
      direction: direction ? direction.toUpperCase() : '',
      dateStr: new Date().toLocaleDateString(),
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      risk: riskAmount,
      realizedProfit: 0, percentClosed: 0, status: 'RUNNING', journal: [],
      isBreakeven: false, tags: []
    };
    setActiveTrades([newTrade, ...activeTrades]);
    return newTrade;
  };

  const submitExecution = (
    execModal: { tradeId: number | null; percent: number; imageUris: string[]; type: string; note: string },
    manualProfit: string
  ): { closedFull: boolean; isWin: boolean } => {
    const { tradeId, percent, imageUris, type, note } = execModal;
    const currentTrade = activeTrades.find(t => t.id === tradeId);
    if (!currentTrade) return { closedFull: false, isWin: false };

    let profit = 0;
    let newPercent = currentTrade.percentClosed;
    let logType = '';

    if (type === 'SL') {
      const remainingPercent = 100 - currentTrade.percentClosed;
      profit = currentTrade.isBreakeven ? 0 : -1 * (currentTrade.risk * (remainingPercent / 100));
      newPercent = 100;
      logType = currentTrade.isBreakeven ? 'STOP_BE' : 'STOP_LOSS';
    } else {
      profit = parseFloat(manualProfit) || 0;
      newPercent = Math.min(100, currentTrade.percentClosed + percent);
      logType = newPercent >= 100 ? 'CLOSE' : 'PARTIAL';
    }

    const journalEntry = { timestamp: Date.now(), type: logType, percentClosed: type === 'SL' ? (100 - currentTrade.percentClosed) : percent, profitBanked: profit, imageUris, note };
    const updatedTrade = { ...currentTrade, realizedProfit: currentTrade.realizedProfit + profit, percentClosed: newPercent, journal: [journalEntry, ...currentTrade.journal] };

    if (newPercent >= 100) {
      const isWin = updatedTrade.realizedProfit > 0;
      updatedTrade.status = isWin ? 'WIN' : (Math.abs(updatedTrade.realizedProfit) < 0.01 ? 'BE' : 'LOSS');
      updatedTrade.closedAt = Date.now();
      setHistory([updatedTrade, ...history]);
      setActiveTrades(prev => prev.filter(t => t.id !== tradeId));

      if (isWin) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return { closedFull: true, isWin };
    } else {
      setActiveTrades(prev => prev.map(t => (t.id === tradeId ? updatedTrade : t)));
      return { closedFull: false, isWin: false };
    }
  };

  const saveEditedNote = (tradeId: number | null, entryIndex: number | null, text: string, detailTrade: Trade | null): Trade | null => {
    if (tradeId === null || entryIndex === null) return null;
    const updateList = (list: Trade[]) => list.map(t => {
      if (t.id !== tradeId) return t;
      const newJournal = [...t.journal];
      if (newJournal[entryIndex]) {
        newJournal[entryIndex] = { ...newJournal[entryIndex], note: text };
      }
      return { ...t, journal: newJournal };
    });

    if (activeTrades.find(t => t.id === tradeId)) setActiveTrades(prev => updateList(prev));
    else if (history.find(t => t.id === tradeId)) setHistory(prev => updateList(prev));

    if (detailTrade && detailTrade.id === tradeId) {
      return updateList([detailTrade])[0];
    }
    return null;
  };

  const toggleTag = (tradeId: number, tag: string) => {
    const updateList = (list: Trade[]) => list.map(t => {
      if (t.id !== tradeId) return t;
      const currentTags = t.tags || [];
      const newTags = currentTags.includes(tag) ? currentTags.filter(x => x !== tag) : [...currentTags, tag];
      return { ...t, tags: newTags };
    });
    if (activeTrades.find(t => t.id === tradeId)) setActiveTrades(prev => updateList(prev));
    else if (history.find(t => t.id === tradeId)) setHistory(prev => updateList(prev));
  };

  const createNewTag = (newTagInput: string) => {
    if (!newTagInput.trim()) return;
    if (!tags.includes(newTagInput.trim())) setTags([...tags, newTagInput.trim()]);
  };

  const toggleBreakeven = (tradeId: number) => {
    setActiveTrades(prev => prev.map(t => t.id === tradeId ? { ...t, isBreakeven: !t.isBreakeven } : t));
  };

  const stopLossHit = (tradeId: number) => {
    const trade = activeTrades.find(t => t.id === tradeId);
    if (!trade) return;
    const remainingPercent = 100 - trade.percentClosed;
    const lossAmount = trade.isBreakeven ? 0 : -1 * (trade.risk * (remainingPercent / 100));
    const finalRealized = trade.realizedProfit + lossAmount;
    let status = finalRealized > 0 ? 'WIN' : (Math.abs(finalRealized) < 0.01 ? 'BE' : 'LOSS');
    const finalized = { ...trade, status, realizedProfit: finalRealized, closedAt: Date.now(), percentClosed: 100, journal: [{ timestamp: Date.now(), type: trade.isBreakeven ? 'STOP_BE' : 'STOP_LOSS', profitBanked: lossAmount, percentClosed: remainingPercent }, ...trade.journal] };
    setHistory([finalized, ...history]);
    setActiveTrades(prev => prev.filter(t => t.id !== tradeId));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const addNewStrategy = () => {
    const newStrat = { id: Date.now().toString(), name: "New Strategy", risk: 100, rules: [...DEFAULT_RULES] };
    setStrategies([...strategies, newStrat]);
    setCurrentStrategyId(newStrat.id);
    return newStrat;
  };

  const saveStrategyEdit = (editedStrategy: any) => {
    setStrategies(prev => prev.map(s => s.id === editedStrategy.id ? editedStrategy : s));
  };

  const deleteStrategy = (id: string) => {
    if (strategies.length <= 1) { Alert.alert("Cannot Delete", "Keep one."); return; }
    Alert.alert("Delete?", "Confirm", [{ text: "Cancel" }, { text: "Delete", style: 'destructive', onPress: () => {
      const newStrats = strategies.filter(s => s.id !== id);
      setStrategies(newStrats);
      if (currentStrategyId === id) setCurrentStrategyId(newStrats[0].id);
    }}]);
  };

  const createStrategyFromModel = (selectedModelTags: string[]) => {
    if (selectedModelTags.length === 0) return;
    const newStratName = `Model: ${selectedModelTags.join(' + ')}`;
    const newRules = selectedModelTags.map((tag, index) => ({ id: Date.now().toString() + index, text: tag }));
    const newStrat = { id: Date.now().toString(), name: newStratName, risk: activeStrategy.risk, rules: newRules };
    setStrategies([...strategies, newStrat]);
    setCurrentStrategyId(newStrat.id);
    Alert.alert("Success", "Strategy created from model tags!");
  };

  const applyImportedData = (data: {
    history?: Trade[];
    activeTrades?: Trade[];
    strategies?: any[];
    tags?: string[];
    profile?: any;
  }) => {
    if (data.strategies) setStrategies(data.strategies);
    if (data.tags) setTags(data.tags);
    if (data.profile) setProfile(data.profile);
    if (data.history) setHistory(data.history);
    if (data.activeTrades) setActiveTrades(data.activeTrades);
  };

  return {
    // State
    strategies, currentStrategyId, history, activeTrades, tags, profile, themeMode,
    activeStrategy, strategyHistory, strategyActive,
    // Setters
    setCurrentStrategyId, setProfile, setThemeMode,
    // Actions
    loadData, saveData, handleExecute, submitExecution, saveEditedNote,
    toggleTag, createNewTag, toggleBreakeven, stopLossHit,
    addNewStrategy, saveStrategyEdit, deleteStrategy, createStrategyFromModel,
    applyImportedData,
  };
}

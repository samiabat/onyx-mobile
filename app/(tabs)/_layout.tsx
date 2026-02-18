import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal, Platform, SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';

import { APP_NAME, THEMES, TRADES_PER_PAGE, PREDEFINED_ASSETS } from '@/constants/appConfig';
import { runSimulation, computeDailyPnL, type Rule, type Strategy, type Investment, type DailyPnL } from '@/utils/calculators';
import { generatePlaybookPDF, generateDetailedPDF } from '@/services/pdfService';
import { searchCoins, type CoinLoreAsset } from '@/services/coinloreService';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useTradeData } from '@/hooks/useTradeData';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { StatCard } from '@/components/StatCard';
import { TradeListItem } from '@/components/TradeListItem';
import { TagChip } from '@/components/TagChip';

const { width, height } = Dimensions.get('window');

export default function OnyxApp() {
  const [view, setView] = useState('dashboard');
  const [direction, setDirection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- HOOKS ---
  const { isLocked, authenticate, checkBiometrics } = useBiometrics();
  const { initFileSystem, pickImages, exportData, importData } = useFileSystem();
  const tradeData = useTradeData();
  const {
    strategies, currentStrategyId, history, activeTrades, tags, profile, themeMode,
    activeStrategy, strategyHistory, strategyActive,
    setCurrentStrategyId, setProfile, setThemeMode,
    loadData, saveData, handleExecute, submitExecution, saveEditedNote,
    toggleTag, createNewTag, toggleBreakeven, stopLossHit,
    addNewStrategy, saveStrategyEdit, deleteStrategy, createStrategyFromModel,
    applyImportedData,
  } = tradeData;

  const theme = THEMES[themeMode];

  // --- PORTFOLIO HOOK ---
  const {
    investments, portfolioAnalytics, portfolioHistory, isRefreshing,
    addInvestment, updateCurrentPrice, updateInvestmentImages, deleteInvestment,
    refreshCryptoPrices,
  } = usePortfolioData();

  // --- UI STATE ---
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [execModal, setExecModal] = useState({ show: false, type: 'PARTIAL', tradeId: null as number | null, percent: 0, imageUris: [] as string[], note: '' });
  const [manualProfit, setManualProfit] = useState('');
  const [customRisk, setCustomRisk] = useState(activeStrategy.risk.toString());
  const [partialInputs, setPartialInputs] = useState<Record<number, string>>({});

  const [detailModal, setDetailModal] = useState<{ show: boolean; trade: any }>({ show: false, trade: null });
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [strategyModal, setStrategyModal] = useState(false);
  const [editStrategyModal, setEditStrategyModal] = useState<{ show: boolean; strategy: any }>({ show: false, strategy: null });
  const [tagModal, setTagModal] = useState<{ show: boolean; tradeId: number | null }>({ show: false, tradeId: null });
  const [newTagInput, setNewTagInput] = useState('');
  const [modelModal, setModelModal] = useState(false);
  const [selectedModelTags, setSelectedModelTags] = useState<string[]>([]);
  const [simModal, setSimModal] = useState(false);
  const [simParams, setSimParams] = useState({ balance: '10000', winRate: '50', rr: '2', trades: '20' });
  const [simResult, setSimResult] = useState<any>(null);

  // Social Share
  const viewShotRef = useRef<any>(null);
  const [shareModal, setShareModal] = useState<{ show: boolean; trade: any }>({ show: false, trade: null });

  // Note Editing
  const [editNoteModal, setEditNoteModal] = useState({ show: false, tradeId: null as number | null, entryIndex: null as number | null, text: '' });

  // Pagination & Performance
  const [historyPage, setHistoryPage] = useState(1);
  const [perfPeriod, setPerfPeriod] = useState('ALL');

  // --- PORTFOLIO UI STATE ---
  const [addInvestmentModal, setAddInvestmentModal] = useState(false);
  const [newInvestment, setNewInvestment] = useState({ assetName: '', ticker: '', category: '' as Investment['category'], coinloreId: '', entryPrice: '', quantity: '', entryDate: '', thesisNotes: '', imageUris: [] as string[] });
  const [updatePriceModal, setUpdatePriceModal] = useState<{ show: boolean; investmentId: number | null }>({ show: false, investmentId: null });
  const [newPrice, setNewPrice] = useState('');
  const [investmentDetailModal, setInvestmentDetailModal] = useState<{ show: boolean; investment: Investment | null }>({ show: false, investment: null });

  // --- ASSET SEARCH STATE ---
  const [assetSearch, setAssetSearch] = useState('');
  const [coinloreResults, setCoinloreResults] = useState<CoinLoreAsset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const filteredAssets = assetSearch.trim().length > 0
    ? PREDEFINED_ASSETS.filter(a =>
        a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.ticker.toLowerCase().includes(assetSearch.toLowerCase())
      )
    : [];
  const assetSearchHasExactMatch = filteredAssets.some(
    a => a.ticker.toLowerCase() === assetSearch.trim().toLowerCase() || a.name.toLowerCase() === assetSearch.trim().toLowerCase()
  );

  // CoinLore search effect
  useEffect(() => {
    const q = assetSearch.trim();
    if (q.length < 2) { setCoinloreResults([]); return; }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchCoins(q);
        // Filter out coins already in predefined list
        const predefinedTickers = new Set(PREDEFINED_ASSETS.filter(a => a.category === 'Crypto').map(a => a.ticker.toUpperCase()));
        setCoinloreResults(results.filter(r => !predefinedTickers.has(r.symbol.toUpperCase())));
      } catch { setCoinloreResults([]); }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [assetSearch]);

  // Auto-refresh crypto prices when switching to portfolio view
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit refreshCryptoPrices to avoid re-triggering on every investment change
  useEffect(() => {
    if (view === 'portfolio') { refreshCryptoPrices(); }
  }, [view]);

  // --- P&L CALENDAR STATE ---
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarDayModal, setCalendarDayModal] = useState<{ show: boolean; day: DailyPnL | null }>({ show: false, day: null });

  // --- ANALYTICS ---
  const { analytics, periodTrades, modelStats } = useAnalytics(strategyHistory, tags, perfPeriod, selectedModelTags);
  const dailyPnLMap = computeDailyPnL(strategyHistory);

  useEffect(() => { initFileSystem(); loadData(); checkBiometrics(); }, []);
  useEffect(() => { saveData(); }, [history, activeTrades, strategies, currentStrategyId, themeMode, tags, profile]);
  useEffect(() => { setCustomRisk(activeStrategy.risk.toString()); }, [activeStrategy.risk]);

  // --- SOCIAL SHARE ---
  const handleSocialShare = async () => {
    try {
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.9 });
      await Sharing.shareAsync(uri);
      setShareModal({ show: false, trade: null });
    } catch(e) { console.log(e); }
  };

  // --- ACTIONS ---
  const onExecute = () => {
    const riskValue = parseFloat(customRisk);
    handleExecute(direction, isNaN(riskValue) ? undefined : riskValue);
    setCheckedRules({});
    setCustomRisk(activeStrategy.risk.toString());
    setView('active');
  };

  const onSubmitExecution = () => {
    const { closedFull } = submitExecution(execModal, manualProfit);
    if (closedFull) setView('dashboard');
    setExecModal({ show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: '' });
  };

  const onSaveEditedNote = () => {
    const updatedTrade = saveEditedNote(editNoteModal.tradeId, editNoteModal.entryIndex, editNoteModal.text, detailModal.trade);
    if (updatedTrade) {
      setDetailModal(prev => ({ ...prev, trade: updatedTrade }));
    }
    setEditNoteModal({ show: false, tradeId: null, entryIndex: null, text: '' });
  };

  const onPickImages = async () => {
    const newUris = await pickImages();
    if (newUris.length > 0) {
      setExecModal(prev => ({ ...prev, imageUris: [...prev.imageUris, ...newUris] }));
    }
  };

  const onGeneratePlaybookPDF = async () => {
    setLoading(true);
    try { await generatePlaybookPDF(strategyHistory, profile.name); }
    catch (e) { Alert.alert("Error", "Could not generate Playbook."); }
    finally { setLoading(false); }
  };

  const onGenerateDetailedPDF = async () => {
    setLoading(true);
    try { await generateDetailedPDF(periodTrades, profile.name, perfPeriod, activeStrategy.name, analytics); }
    catch (e) { Alert.alert("Error", "Could not generate PDF."); }
    finally { setLoading(false); }
  };

  const onExportData = async () => {
    setLoading(true);
    try { await exportData(history, activeTrades, strategies, tags, profile); }
    catch (e: any) { Alert.alert("Export Failed", e.message); }
    finally { setLoading(false); }
  };

  const onImportData = async () => {
    try {
      setLoading(true);
      const data = await importData();
      if (data) {
        applyImportedData(data);
        Alert.alert("Success", "Restored.");
        setTimeout(() => saveData(), 1000);
      }
    } catch (e: any) { Alert.alert("Import Failed", e.message); }
    finally { setLoading(false); }
  };

  const onRunSimulation = () => {
    setSimResult(runSimulation(simParams));
  };

  const toggleModelTag = (tag: string) => {
    setSelectedModelTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const onCreateStrategyFromModel = () => {
    createStrategyFromModel(selectedModelTags);
    setModelModal(false);
  };

  const onAddNewStrategy = () => {
    const newStrat = addNewStrategy();
    setStrategyModal(false);
    setEditStrategyModal({ show: true, strategy: newStrat });
  };

  const onSaveStrategyEdit = (editedStrat: any) => {
    saveStrategyEdit(editedStrat);
    setEditStrategyModal({ show: false, strategy: null });
  };

  const onDeleteStrategy = (id: string) => {
    if (strategies.length <= 1) { Alert.alert("Cannot Delete", "Keep one."); return; }
    Alert.alert("Delete?", "Confirm", [{ text: "Cancel" }, { text: "Delete", style: 'destructive', onPress: () => {
      deleteStrategy(id);
      setEditStrategyModal({ show: false, strategy: null });
    }}]);
  };

  const openExecModal = (type: string, tradeId: number, percent: number) => {
    setExecModal({ show: true, type, tradeId, percent, imageUris: [], note: '' });
    setManualProfit('');
  };

  const onCreateNewTag = () => {
    createNewTag(newTagInput);
    setNewTagInput('');
  };

  // --- PORTFOLIO HANDLERS ---
  const onAddInvestment = () => {
    const entryPrice = parseFloat(newInvestment.entryPrice);
    const quantity = parseFloat(newInvestment.quantity);
    if (!newInvestment.assetName.trim() || isNaN(entryPrice) || isNaN(quantity) || entryPrice <= 0 || quantity <= 0) {
      Alert.alert("Invalid Input", "Please fill in asset name, entry price, and quantity.");
      return;
    }
    addInvestment({
      assetName: newInvestment.assetName.trim(),
      ticker: newInvestment.ticker || newInvestment.assetName.trim(),
      category: newInvestment.category || 'Custom',
      coinloreId: newInvestment.coinloreId || undefined,
      entryPrice,
      entryDate: newInvestment.entryDate.trim() || new Date().toLocaleDateString(),
      quantity,
      thesisNotes: newInvestment.thesisNotes,
      imageUris: newInvestment.imageUris,
    });
    setNewInvestment({ assetName: '', ticker: '', category: '' as Investment['category'], coinloreId: '', entryPrice: '', quantity: '', entryDate: '', thesisNotes: '', imageUris: [] });
    setAssetSearch('');
    setAddInvestmentModal(false);
  };

  const onPickInvestmentImages = async () => {
    const newUris = await pickImages();
    if (newUris.length > 0) {
      setNewInvestment(prev => ({ ...prev, imageUris: [...prev.imageUris, ...newUris] }));
    }
  };

  const onPickDetailImages = async (investmentId: number) => {
    const newUris = await pickImages();
    if (newUris.length > 0) {
      updateInvestmentImages(investmentId, newUris);
      setInvestmentDetailModal(prev => {
        if (!prev.investment) return prev;
        return { ...prev, investment: { ...prev.investment, imageUris: [...prev.investment.imageUris, ...newUris] } };
      });
    }
  };

  const onUpdatePrice = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0 || !updatePriceModal.investmentId) {
      Alert.alert("Invalid Price", "Enter a valid price.");
      return;
    }
    updateCurrentPrice(updatePriceModal.investmentId, price);
    setInvestmentDetailModal(prev => {
      if (prev.investment && prev.investment.id === updatePriceModal.investmentId) {
        return { ...prev, investment: { ...prev.investment, currentPrice: price } };
      }
      return prev;
    });
    setUpdatePriceModal({ show: false, investmentId: null });
    setNewPrice('');
  };

  const s = styles(theme);
  const allRulesMet = activeStrategy.rules.every((r: Rule) => checkedRules[r.id]);
  const visibleHistory = analytics.dailyStats.slice(0, historyPage * TRADES_PER_PAGE);

  if (isLocked) {
    return (
      <View style={[s.container, {justifyContent: 'center', alignItems: 'center'}]}>
        <Feather name="lock" size={64} color={theme.text} />
        <Text style={{color: theme.text, marginTop: 20, fontWeight: 'bold'}}>ONYX LOCKED</Text>
        <TouchableOpacity onPress={authenticate} style={[s.actionBtn, {marginTop: 40, width: 200}]}>
          <Text style={s.actionBtnText}>UNLOCK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={themeMode === 'dark' ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      
      {/* HEADER */}
      <View style={s.navHeader}>
        <TouchableOpacity onPress={() => setStrategyModal(true)} style={s.strategyBadge}><Feather name="layers" size={14} color={theme.btnText} /><Text style={s.strategyText}>{activeStrategy.name}</Text><Feather name="chevron-down" size={12} color={theme.btnText} /></TouchableOpacity>
        <View style={{flexDirection: 'row', gap: 16}}>
          <TouchableOpacity onPress={() => setView('profile')}><Feather name="user" size={20} color={view === 'profile' ? theme.tint : theme.subText} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}><Feather name={themeMode === 'dark' ? 'sun' : 'moon'} size={20} color={theme.subText} /></TouchableOpacity>
        </View>
      </View>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.statsRow}>
            <StatCard label="NET PROFIT" value={`$${analytics.netProfit.toFixed(2)}`} valueColor={analytics.netProfit >= 0 ? theme.success : theme.danger} theme={theme} />
            <StatCard label="AVG RR" value={analytics.avgRR} valueColor={theme.text} theme={theme} />
          </View>
          <View style={[s.statsRow, {marginTop: -12}]}>
            <StatCard label="WIN RATE" value={`${analytics.winRate.toFixed(1)}%`} valueColor={theme.text} theme={theme} valueSize={16} />
            <StatCard label="TOTAL" value={`${analytics.totalTrades}`} valueColor={theme.text} theme={theme} valueSize={16} />
          </View>

          {/* TAG ANALYTICS */}
          {tags.length > 0 && (
            <View style={{marginBottom: 24}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                <Text style={s.sectionTitle}>TAG INSIGHTS</Text>
                <TouchableOpacity onPress={() => setModelModal(true)}><Text style={{color: theme.tint, fontSize: 10, fontWeight: 'bold'}}>BUILD MODEL &rarr;</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexDirection: 'row'}}>
                {analytics.tagStats.map((stat, i) => (
                  <View key={i} style={s.tagStatCard}>
                    <Text style={{color: theme.subText, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}}>{stat.tag}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 4}}>
                      <Text style={{color: stat.roi >= 0 ? theme.success : theme.danger, fontSize: 16, fontWeight: '700'}}>{stat.roi.toFixed(0)}% ROI</Text>
                    </View>
                    <Text style={{color: theme.text, fontSize: 10}}>{stat.winRate.toFixed(0)}% WR • {stat.count}x</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{flexDirection: 'row', gap: 12, marginBottom: 24}}>
            <TouchableOpacity onPress={() => setView('checklist')} style={s.mainActionBtn}><Feather name="plus" size={20} color={theme.btnText} /><Text style={{color: theme.btnText, fontWeight: 'bold', fontSize: 13}}>ENTER TRADE</Text></TouchableOpacity>
          </View>

          <Text style={s.sectionTitle}>JOURNAL</Text>
          <View style={s.tableCard}>
            {visibleHistory.map(trade => (
              <TradeListItem key={trade.id} trade={trade} theme={theme} onPress={() => setDetailModal({show: true, trade})} />
            ))}
            {analytics.dailyStats.length === 0 && <Text style={s.emptyText}>No data available.</Text>}
            {analytics.dailyStats.length > visibleHistory.length && (
              <TouchableOpacity onPress={() => setHistoryPage(p => p + 1)} style={s.paginationBtn}><Text style={s.paginationText}>SHOW MORE</Text><Feather name="chevron-down" size={16} color={theme.subText} /></TouchableOpacity>
            )}
          </View>

          {/* DATA MANAGEMENT */}
          <View style={{marginTop: 40}}>
            <Text style={s.sectionTitle}>DATA MANAGEMENT</Text>
            <View style={{flexDirection: 'row', gap: 12, marginTop: 10}}>
              <TouchableOpacity onPress={onExportData} style={s.backupBtn}><Feather name="download" size={16} color={theme.tint} /><Text style={s.backupText}>BACKUP ALL</Text></TouchableOpacity>
              <TouchableOpacity onPress={onImportData} style={s.backupBtn}><Feather name="upload" size={16} color={theme.tint} /><Text style={s.backupText}>RESTORE</Text></TouchableOpacity>
            </View>
            <Text style={{color: theme.subText, fontSize: 10, textAlign: 'center', marginTop: 8}}>Save backup to "Files" to survive uninstall.</Text>
          </View>
        </ScrollView>
      )}

      {/* VIEW: PERFORMANCE */}
      {view === 'performance' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Text style={s.screenTitle}>PERFORMANCE</Text>

          {/* P&L CALENDAR HEATMAP - FIRST */}
          <View style={s.perfSection}>
            <Text style={s.sectionTitle}>P&L CALENDAR</Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <TouchableOpacity onPress={() => setCalendarMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() - 1); return d; })}><Feather name="chevron-left" size={20} color={theme.text} /></TouchableOpacity>
              <Text style={{color: theme.text, fontWeight: '700', fontSize: 14}}>{calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity onPress={() => setCalendarMonth(prev => { const d = new Date(prev); d.setMonth(d.getMonth() + 1); return d; })}><Feather name="chevron-right" size={20} color={theme.text} /></TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', marginBottom: 4}}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <View key={d} style={{flex: 1, alignItems: 'center'}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>{d}</Text></View>
              ))}
            </View>
            {(() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const daysInMonth = lastDay.getDate();
              let startDow = firstDay.getDay() - 1;
              if (startDow < 0) startDow = 6;
              const cells: (number | null)[] = [];
              for (let i = 0; i < startDow; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);
              while (cells.length % 7 !== 0) cells.push(null);
              const weeks: (number | null)[][] = [];
              for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
              return weeks.map((week, wi) => (
                <View key={wi} style={{flexDirection: 'row', marginBottom: 4}}>
                  {week.map((day, di) => {
                    if (day === null) return <View key={di} style={{flex: 1, height: 44, margin: 1}} />;
                    const dateObj = new Date(year, month, day);
                    const dateKey = dateObj.toLocaleDateString();
                    const dayData = dailyPnLMap[dateKey];
                    const pnl = dayData ? dayData.pnl : 0;
                    const hasTrades = !!dayData;
                    const bgColor = !hasTrades ? theme.card : pnl > 0 ? theme.success + '33' : pnl < 0 ? theme.danger + '33' : theme.border;
                    const borderCol = !hasTrades ? theme.border : pnl > 0 ? theme.success : pnl < 0 ? theme.danger : theme.border;
                    return (
                      <TouchableOpacity
                        key={di}
                        onPress={() => { if (hasTrades) setCalendarDayModal({ show: true, day: dayData }); }}
                        style={{flex: 1, height: 44, margin: 1, backgroundColor: bgColor, borderRadius: 6, borderWidth: 1, borderColor: borderCol, alignItems: 'center', justifyContent: 'center'}}
                      >
                        <Text style={{color: theme.subText, fontSize: 9}}>{day}</Text>
                        {hasTrades && <Text style={{color: pnl > 0 ? theme.success : pnl < 0 ? theme.danger : theme.subText, fontSize: 8, fontWeight: '700'}}>{pnl >= 0 ? '+' : ''}{pnl < 1000 && pnl > -1000 ? `$${pnl.toFixed(0)}` : `$${(pnl/1000).toFixed(1)}k`}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ));
            })()}
          </View>

          {/* EQUITY LINE GRAPH */}
          <View style={s.perfSection}>
            <Text style={s.sectionTitle}>EQUITY CURVE</Text>
            <View style={{backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16}}>
              {(() => {
                const sortedDates = Object.keys(dailyPnLMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                if (sortedDates.length < 2) return <Text style={{color: theme.subText, textAlign: 'center', fontStyle: 'italic', paddingVertical: 20}}>Need at least 2 trading days for graph.</Text>;
                const equityPoints: number[] = [];
                let cumPnL = 0;
                sortedDates.forEach(date => { cumPnL += dailyPnLMap[date].pnl; equityPoints.push(cumPnL); });
                const graphW = width - 80;
                const graphH = 160;
                const minVal = Math.min(0, ...equityPoints);
                const maxVal = Math.max(0, ...equityPoints);
                const range = maxVal - minVal || 1;
                const getX = (i: number) => (i / (equityPoints.length - 1)) * graphW;
                const getY = (v: number) => graphH - ((v - minVal) / range) * graphH;
                const zeroY = getY(0);
                const lastVal = equityPoints[equityPoints.length - 1];
                const lineColor = lastVal >= 0 ? theme.success : theme.danger;
                return (
                  <View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                      <Text style={{color: theme.subText, fontSize: 10}}>Cumulative P&L</Text>
                      <Text style={{color: lineColor, fontSize: 12, fontWeight: '700'}}>{lastVal >= 0 ? '+' : ''}${lastVal.toFixed(2)}</Text>
                    </View>
                    <View style={{height: graphH, overflow: 'hidden'}}>
                      {/* Zero line */}
                      {minVal < 0 && <View style={{position: 'absolute', top: zeroY, left: 0, right: 0, height: 1, backgroundColor: theme.border, opacity: 0.5}} />}
                      {/* Equity dots and lines */}
                      {equityPoints.map((val, i) => (
                        <View key={i} style={{position: 'absolute', left: getX(i) - 3, top: getY(val) - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: lineColor}} />
                      ))}
                      {equityPoints.map((val, i) => {
                        if (i === 0) return null;
                        const x1 = getX(i-1); const y1 = getY(equityPoints[i-1]);
                        const x2 = getX(i); const y2 = getY(val);
                        const dx = x2 - x1; const dy = y2 - y1;
                        const len = Math.sqrt(dx*dx + dy*dy);
                        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                        return <View key={`l${i}`} style={{position: 'absolute', left: x1, top: y1, width: len, height: 2, backgroundColor: lineColor, opacity: 0.7, transformOrigin: 'left center', transform: [{rotate: `${angle}deg`}]}} />;
                      })}
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 4}}>
                      <Text style={{color: theme.subText, fontSize: 9}}>{sortedDates[0]}</Text>
                      <Text style={{color: theme.subText, fontSize: 9}}>{sortedDates[sortedDates.length - 1]}</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>

          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, backgroundColor: theme.card, padding: 4, borderRadius: 12}}>
            {['1D', '1W', '1M', '1Y', 'ALL'].map(p => (
              <TouchableOpacity key={p} onPress={() => setPerfPeriod(p)} style={[s.periodBtn, perfPeriod === p && {backgroundColor: theme.tint}]}>
                <Text style={[s.periodText, perfPeriod === p ? {color: theme.btnText} : {color: theme.subText}]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.perfSection}>
            <Text style={s.sectionTitle}>PROFITABILITY</Text>
            <View style={s.perfList}>
              <View style={s.perfRow}><Text style={s.perfLabel}>Net Profit</Text><Text style={[s.perfValue, {color: analytics.netProfit >= 0 ? theme.success : theme.danger}]}>${analytics.netProfit.toFixed(2)}</Text></View>
              <View style={[s.perfRow, {borderBottomWidth: 0}]}><Text style={s.perfLabel}>Profit Factor</Text><Text style={s.perfValue}>{analytics.profitFactor}</Text></View>
            </View>
          </View>

          <View style={s.perfSection}>
            <Text style={s.sectionTitle}>EFFICIENCY</Text>
            <View style={s.perfList}>
              <View style={s.perfRow}><Text style={s.perfLabel}>Win Rate</Text><Text style={s.perfValue}>{analytics.winRate.toFixed(1)}%</Text></View>
              <View style={[s.perfRow, {borderBottomWidth: 0}]}><Text style={s.perfLabel}>Avg RR</Text><Text style={s.perfValue}>{analytics.avgRR}</Text></View>
            </View>
          </View>

          <View style={s.perfSection}>
            <Text style={s.sectionTitle}>ACTIVITY</Text>
            <View style={s.perfList}>
              <View style={[s.perfRow, {borderBottomWidth: 0}]}><Text style={s.perfLabel}>Total Trades</Text><Text style={s.perfValue}>{analytics.totalTrades}</Text></View>
            </View>
          </View>

          {/* REPORT BUTTONS & SIMULATOR - AT BOTTOM */}
          <View style={{flexDirection: 'row', gap: 12, marginBottom: 12}}>
            <TouchableOpacity onPress={onGenerateDetailedPDF} style={[s.actionBtn, {flex: 1, gap: 8}]}><Feather name="file-text" size={18} color={theme.btnText} /><Text style={s.actionBtnText}>EXPORT PDF REPORT</Text></TouchableOpacity>
            <TouchableOpacity onPress={onGeneratePlaybookPDF} style={[s.actionBtn, {flex: 1, gap: 8, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border}]}><Feather name="book-open" size={18} color={theme.text} /><Text style={{color: theme.text, fontWeight: '700', fontSize: 13}}>PLAYBOOK</Text></TouchableOpacity>
          </View>

          <View style={{gap: 12}}>
            <TouchableOpacity onPress={() => setSimModal(true)} style={s.actionBtn}><Feather name="trending-up" size={18} color={theme.btnText} /><Text style={s.actionBtnText}>SIMULATOR</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* VIEW: PROFILE */}
      {view === 'profile' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Text style={s.screenTitle}>PROFILE</Text>
          <View style={[s.activeCard, {marginBottom: 20}]}>
            <Text style={s.label}>IDENTITY</Text>
            <TextInput style={[s.inputField, {marginBottom: 20}]} value={profile.name} onChangeText={t => setProfile((p: any) => ({...p, name: t}))} />
            <Text style={s.label}>NORTH STAR</Text>
            <TextInput style={[s.inputField, {marginBottom: 20}]} value={profile.goal} onChangeText={t => setProfile((p: any) => ({...p, goal: t}))} />
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 10}}>
              <Text style={{color: theme.text, fontWeight: 'bold'}}>LOCK APP (BIOMETRICS)</Text>
              <Switch value={profile.biometricsEnabled} onValueChange={v => setProfile((p: any) => ({...p, biometricsEnabled: v}))} trackColor={{false: theme.border, true: theme.tint}} />
            </View>
          </View>
          <TouchableOpacity onPress={() => setView('dashboard')} style={s.actionBtn}><Text style={s.actionBtnText}>SAVE SETTINGS</Text></TouchableOpacity>
        </ScrollView>
      )}

      {/* VIEW: PORTFOLIO */}
      {view === 'portfolio' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          {/* HEADER ROW */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
            <Text style={s.screenTitle}>PORTFOLIO</Text>
            <TouchableOpacity onPress={refreshCryptoPrices} style={{flexDirection: 'row', alignItems: 'center', gap: 4, opacity: isRefreshing ? 0.5 : 1}}>
              <Feather name="refresh-cw" size={14} color={theme.tint} />
              <Text style={{color: theme.tint, fontSize: 11, fontWeight: '600'}}>{isRefreshing ? 'UPDATING...' : 'REFRESH'}</Text>
            </TouchableOpacity>
          </View>

          {/* PORTFOLIO SUMMARY - Compact */}
          <View style={{backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 12}}>
            <Text style={{color: theme.subText, fontSize: 10, fontWeight: '600', letterSpacing: 0.5}}>TOTAL VALUE</Text>
            <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 2}}>${portfolioAnalytics.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
              <Text style={{color: portfolioAnalytics.totalPnL >= 0 ? theme.success : theme.danger, fontSize: 13, fontWeight: '700'}}>
                {portfolioAnalytics.totalPnL >= 0 ? '+' : ''}${portfolioAnalytics.totalPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
              <View style={{backgroundColor: (portfolioAnalytics.totalPnL >= 0 ? theme.success : theme.danger) + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                <Text style={{color: portfolioAnalytics.totalPnL >= 0 ? theme.success : theme.danger, fontSize: 11, fontWeight: '700'}}>
                  {portfolioAnalytics.totalPnLPercent >= 0 ? '+' : ''}{portfolioAnalytics.totalPnLPercent.toFixed(2)}%
                </Text>
              </View>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.border}}>
              <View><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>INVESTED</Text><Text style={{color: theme.text, fontSize: 13, fontWeight: '700'}}>${portfolioAnalytics.totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text></View>
              <View style={{alignItems: 'flex-end'}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>ASSETS</Text><Text style={{color: theme.text, fontSize: 13, fontWeight: '700'}}>{investments.length}</Text></View>
            </View>
          </View>

          {/* PORTFOLIO VALUE CHART */}
          {portfolioHistory.length > 1 && (
            <View style={{backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 12}}>
              <Text style={{color: theme.subText, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8}}>PORTFOLIO VALUE OVER TIME</Text>
              {(() => {
                const data = portfolioHistory;
                const graphW = width - 72;
                const graphH = 80;
                const values = data.map(d => d.totalValue);
                const minV = Math.min(...values) * 0.98;
                const maxV = Math.max(...values) * 1.02;
                const range = maxV - minV || 1;
                const getX = (i: number) => data.length === 1 ? graphW / 2 : (i / (data.length - 1)) * graphW;
                const getY = (v: number) => graphH - ((v - minV) / range) * graphH;
                const trend = values[values.length - 1] >= values[0];
                const lineColor = trend ? theme.success : theme.danger;
                return (
                  <View style={{height: graphH, overflow: 'hidden'}}>
                    {data.map((d, i) => (
                      <View key={i} style={{position: 'absolute', left: getX(i) - 2, top: getY(d.totalValue) - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: lineColor}} />
                    ))}
                    {data.map((d, i) => {
                      if (i === 0) return null;
                      const x1 = getX(i-1); const y1 = getY(data[i-1].totalValue);
                      const x2 = getX(i); const y2 = getY(d.totalValue);
                      const dx = x2 - x1; const dy = y2 - y1;
                      const len = Math.sqrt(dx*dx + dy*dy);
                      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                      return <View key={`l${i}`} style={{position: 'absolute', left: x1, top: y1, width: len, height: 1.5, backgroundColor: lineColor, opacity: 0.6, transformOrigin: 'left center', transform: [{rotate: `${angle}deg`}]}} />;
                    })}
                  </View>
                );
              })()}
            </View>
          )}

          {/* P&L BY ASSET CHART */}
          {investments.length > 0 && (
            <View style={{backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, padding: 12, marginBottom: 12}}>
              <Text style={{color: theme.subText, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8}}>P&L BY ASSET</Text>
              {(() => {
                const pnlValues = investments.map(inv => {
                  const label = inv.ticker || inv.assetName;
                  return {
                    name: label.length > 6 ? label.substring(0, 6) : label,
                    value: (inv.currentPrice - inv.entryPrice) * inv.quantity,
                  };
                });
                const graphW = width - 72;
                const graphH = 60;
                const minVal = Math.min(0, ...pnlValues.map(p => p.value));
                const maxVal = Math.max(0, ...pnlValues.map(p => p.value));
                const range = maxVal - minVal || 1;
                const barW = Math.min(24, (graphW - pnlValues.length * 4) / pnlValues.length);
                const zeroY = graphH - ((0 - minVal) / range) * graphH;
                return (
                  <View>
                    <View style={{height: graphH, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4}}>
                      {pnlValues.map((p, i) => {
                        const barH = Math.abs(p.value / range) * graphH;
                        const isPositive = p.value >= 0;
                        return (
                          <View key={i} style={{alignItems: 'center', width: barW}}>
                            <View style={{
                              width: barW,
                              height: Math.max(2, barH),
                              backgroundColor: isPositive ? theme.success : theme.danger,
                              borderRadius: 2,
                              opacity: 0.8,
                              marginBottom: isPositive ? 0 : undefined,
                            }} />
                          </View>
                        );
                      })}
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 4}}>
                      {pnlValues.map((p, i) => (
                        <Text key={i} style={{color: theme.subText, fontSize: 7, textAlign: 'center', width: barW}}>{p.name}</Text>
                      ))}
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {/* ADD BUTTON */}
          <TouchableOpacity onPress={() => setAddInvestmentModal(true)} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.tint, paddingVertical: 10, borderRadius: 8, marginBottom: 16}}>
            <Feather name="plus" size={16} color={theme.btnText} />
            <Text style={{color: theme.btnText, fontWeight: '700', fontSize: 13}}>ADD INVESTMENT</Text>
          </TouchableOpacity>

          {/* HOLDINGS - Compact List View */}
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
            <Text style={{color: theme.subText, fontSize: 10, fontWeight: '600', letterSpacing: 0.5}}>HOLDINGS</Text>
            <Text style={{color: theme.subText, fontSize: 10}}>{investments.length} assets</Text>
          </View>
          <View style={{backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, overflow: 'hidden'}}>
            {investments.map((inv, idx) => {
              const pnl = (inv.currentPrice - inv.entryPrice) * inv.quantity;
              const pnlPercent = inv.entryPrice > 0 ? ((inv.currentPrice - inv.entryPrice) / inv.entryPrice) * 100 : 0;
              const currentVal = inv.currentPrice * inv.quantity;
              const isCrypto = !!inv.coinloreId;
              return (
                <TouchableOpacity key={inv.id} onPress={() => setInvestmentDetailModal({show: true, investment: inv})} style={{paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: idx < investments.length - 1 ? 1 : 0, borderColor: theme.border}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View style={{flex: 1, marginRight: 8}}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                        <Text style={{color: theme.text, fontWeight: '700', fontSize: 13}}>{inv.ticker || inv.assetName}</Text>
                        {isCrypto && <View style={{backgroundColor: theme.tint + '20', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3}}><Text style={{color: theme.tint, fontSize: 8, fontWeight: '600'}}>LIVE</Text></View>}
                        {!isCrypto && inv.category !== 'Custom' && <View style={{backgroundColor: theme.border, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3}}><Text style={{color: theme.subText, fontSize: 8, fontWeight: '600'}}>{inv.category?.toUpperCase()}</Text></View>}
                      </View>
                      <Text style={{color: theme.subText, fontSize: 10, marginTop: 1}}>{inv.quantity} × ${inv.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={{color: theme.text, fontSize: 13, fontWeight: '600'}}>${currentVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                      <Text style={{color: pnl >= 0 ? theme.success : theme.danger, fontSize: 11, fontWeight: '600'}}>{pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {investments.length === 0 && <Text style={[s.emptyText, {padding: 20}]}>No investments logged yet.</Text>}
          </View>
        </ScrollView>
      )}

      {/* --- SOCIAL SHARE MODAL --- */}
      {shareModal.show && shareModal.trade && (
        <Modal visible={true} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }} style={{backgroundColor: theme.bg, padding: 20, borderRadius: 12}}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 20}}>
                  <View style={{width: 40, height: 40, borderRadius: 8, backgroundColor: theme.tint, alignItems: 'center', justifyContent: 'center'}}><Feather name="shield" size={24} color={theme.btnText} /></View>
                  <Text style={{color: theme.text, fontSize: 24, fontWeight: '900', marginLeft: 10}}>{APP_NAME}</Text>
                </View>
                <Text style={{color: theme.subText, fontSize: 12, marginBottom: 4}}>{shareModal.trade.dateStr}</Text>
                <Text style={{color: shareModal.trade.realizedProfit >= 0 ? theme.success : theme.danger, fontSize: 48, fontWeight: '900'}}>
                  {shareModal.trade.realizedProfit >= 0 ? '+' : ''}${shareModal.trade.realizedProfit.toFixed(2)}
                </Text>
                <Text style={{color: theme.text, fontSize: 18, marginTop: 10}}>{shareModal.trade.direction} • {activeStrategy.name}</Text>
                {shareModal.trade.journal?.[0]?.imageUris?.[0] && (
                  <Image source={{uri: shareModal.trade.journal[0].imageUris[0]}} style={{width: 250, height: 250, marginTop: 20, borderRadius: 8}} resizeMode="cover" />
                )}
              </ViewShot>
              <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}>
                <TouchableOpacity onPress={() => setShareModal({show: false, trade: null})} style={s.modalCancel}><Text style={s.modalCancelText}>CLOSE</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSocialShare} style={s.modalConfirm}><Text style={s.modalConfirmText}>SHARE NOW</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* --- SIMULATOR MODAL --- */}
      <Modal visible={simModal} animationType="slide" onRequestClose={() => setSimModal(false)}>
        <SafeAreaView style={s.container}>
          <View style={s.navHeader}><Text style={s.screenTitle}>EQUITY SIMULATOR</Text><TouchableOpacity onPress={() => setSimModal(false)}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={s.scrollContent}>
            <Text style={s.label}>STARTING BALANCE</Text><TextInput keyboardType="numeric" style={s.inputField} value={simParams.balance} onChangeText={t => setSimParams(p => ({...p, balance: t}))} />
            <View style={{flexDirection: 'row', gap: 12, marginTop: 16}}>
              <View style={{flex:1}}><Text style={s.label}>WIN RATE %</Text><TextInput keyboardType="numeric" style={s.inputField} value={simParams.winRate} onChangeText={t => setSimParams(p => ({...p, winRate: t}))} /></View>
              <View style={{flex:1}}><Text style={s.label}>AVG R:R</Text><TextInput keyboardType="numeric" style={s.inputField} value={simParams.rr} onChangeText={t => setSimParams(p => ({...p, rr: t}))} /></View>
            </View>
            <Text style={[s.label, {marginTop: 16}]}>NUMBER OF TRADES</Text><TextInput keyboardType="numeric" style={s.inputField} value={simParams.trades} onChangeText={t => setSimParams(p => ({...p, trades: t}))} />
            
            <TouchableOpacity onPress={onRunSimulation} style={s.actionBtn}><Text style={s.actionBtnText}>RUN SIMULATION</Text></TouchableOpacity>

            {simResult && (
              <View style={[s.activeCard, {marginTop: 32}]}>
                <Text style={s.label}>PROJECTED BALANCE</Text>
                <Text style={[s.riskValue, {fontSize: 32}]}>${simResult.final.toFixed(2)}</Text>
                <Text style={{color: theme.subText, fontSize: 12, marginTop: 4, fontStyle:'italic'}}>Expected (Math): ${simResult.expected.toFixed(2)}</Text>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 16}}>
                  <Text style={{color: theme.success, fontWeight: 'bold'}}>+{simResult.growth.toFixed(1)}% Growth</Text>
                  <Text style={{color: theme.danger, fontWeight: 'bold'}}>{simResult.dd.toFixed(1)}% Max DD</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* --- UNIFIED EXECUTION MODAL --- */}
      <Modal visible={execModal.show} transparent animationType="fade" onRequestClose={() => setExecModal({show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: ''})}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <TouchableWithoutFeedback onPress={() => setExecModal({show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: ''})}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.modalContent}>
                <Text style={[s.modalTitle, execModal.type === 'SL' && {color: theme.danger}]}>
                  {execModal.type === 'SL' ? 'CONFIRM STOP LOSS' : `CLOSE ${execModal.percent}%`}
                </Text>
                
                {execModal.type !== 'SL' && (
                  <View style={{marginBottom: 16}}>
                    <Text style={s.label}>PROFIT ($)</Text>
                    <TextInput autoFocus keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.subText} value={manualProfit} onChangeText={setManualProfit} style={s.modalInput} />
                  </View>
                )}

                <Text style={s.label}>TRADE NOTE</Text>
                <TextInput 
                  multiline 
                  placeholder={execModal.type === 'SL' ? "Why did it fail?" : "Execution notes..."} 
                  placeholderTextColor={theme.subText} 
                  value={execModal.note} 
                  onChangeText={t => setExecModal(p => ({...p, note: t}))} 
                  style={[s.inputField, {height: 60, textAlignVertical: 'top', marginBottom: 16}]} 
                />

                <TouchableOpacity onPress={onPickImages} style={[s.imageBtn, execModal.imageUris.length > 0 ? s.imageBtnActive : null]}>
                  <Feather name="camera" size={20} color={execModal.imageUris.length > 0 ? theme.btnText : theme.text} />
                  <Text style={[s.imageBtnText, execModal.imageUris.length > 0 ? {color: theme.btnText} : null]}>{execModal.imageUris.length > 0 ? `${execModal.imageUris.length} IMAGES` : "ATTACH CHARTS"}</Text>
                </TouchableOpacity>

                <View style={s.modalBtns}>
                  <TouchableOpacity onPress={() => setExecModal({show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: ''})} style={s.modalCancel}><Text style={s.modalCancelText}>CANCEL</Text></TouchableOpacity>
                  <TouchableOpacity onPress={onSubmitExecution} style={[s.modalConfirm, execModal.type === 'SL' && {backgroundColor: theme.danger}]}><Text style={s.modalConfirmText}>{execModal.type === 'SL' ? 'LIQUIDATE' : 'CONFIRM'}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal visible={detailModal.show} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailModal({show: false, trade: null})}>
        <View style={s.detailContainer}>
           <View style={s.detailHeader}>
             <Text style={s.detailTitle}>RECORD</Text>
             <View style={{flexDirection: 'row', gap: 16}}>
               <TouchableOpacity onPress={() => setShareModal({show: true, trade: detailModal.trade})}><Feather name="share" size={20} color={theme.text} /></TouchableOpacity>
               <TouchableOpacity onPress={() => setDetailModal({show: false, trade: null})}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity>
             </View>
           </View>
           {detailModal.trade && (
             <ScrollView contentContainerStyle={{padding: 24}}>
               <View style={s.detailStats}><View><Text style={s.label}>DATE</Text><Text style={s.detailValue}>{detailModal.trade.dateStr}</Text></View><View style={{alignItems: 'flex-end'}}><Text style={s.label}>NET</Text><Text style={[s.detailValue, {color: detailModal.trade.realizedProfit >= 0 ? theme.success : theme.danger}]}>${detailModal.trade.realizedProfit.toFixed(2)}</Text></View></View>
               <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12}}>
                 {(detailModal.trade.tags || []).map((t: string) => <View key={t} style={[s.tagChip, {backgroundColor: theme.card}]}><Text style={{color: theme.subText, fontSize: 10}}>{t}</Text></View>)}
               </View>
               <Text style={[s.label, {marginTop: 32, marginBottom: 16}]}>TIMELINE</Text>
               {detailModal.trade.journal && detailModal.trade.journal.map((entry: any, index: number) => (
                 <View key={index} style={s.timelineItem}>
                   <View style={s.timelineLeft}><View style={s.timelineDot} /><View style={s.timelineLine} /></View>
                   <View style={s.timelineContent}>
                     <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><Text style={s.timelineType}>{entry.type}</Text><Text style={{color: theme.text, fontWeight: '700'}}>${entry.profitBanked}</Text></View>
                     <Text style={s.timelineSub}>Closed {entry.percentClosed}%</Text>
                     <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                       <Text style={{color: theme.text, fontStyle: 'italic', flex: 1}}>"{entry.note || 'No note'}"</Text>
                       <TouchableOpacity onPress={() => setEditNoteModal({show: true, tradeId: detailModal.trade.id, entryIndex: index, text: entry.note || ''})}><Feather name="edit-2" size={14} color={theme.subText} /></TouchableOpacity>
                     </View>
                     <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8}}>{(entry.imageUris || []).map((uri: string, i: number) => (<TouchableOpacity key={i} onPress={() => setZoomImage(uri)}><Image source={{ uri }} style={s.timelineImage} resizeMode="cover" /></TouchableOpacity>))}</View>
                   </View>
                 </View>
               ))}
             </ScrollView>
           )}
        </View>
      </Modal>

      {/* --- EDIT NOTE MODAL --- */}
      <Modal visible={editNoteModal.show} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>EDIT NOTE</Text>
            <TextInput multiline style={[s.inputField, {height: 80}]} value={editNoteModal.text} onChangeText={t => setEditNoteModal(p => ({...p, text: t}))} />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setEditNoteModal(p => ({...p, show: false}))} style={s.modalCancel}><Text style={s.modalCancelText}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity onPress={onSaveEditedNote} style={s.modalConfirm}><Text style={s.modalConfirmText}>SAVE</Text></TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* STANDARD VIEWS */}
      {view === 'checklist' && (<View style={s.centerContent}><TouchableOpacity onPress={() => setView('dashboard')} style={s.backBtn}><Feather name="arrow-left" size={24} color={theme.text} /></TouchableOpacity><Text style={s.screenTitle}>CONFIRMATION</Text><View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 16}}><TouchableOpacity onPress={() => setDirection('long')} style={[s.dirToggleBtn, direction === 'long' && {backgroundColor: theme.tint, borderColor: theme.tint}]}><Feather name="trending-up" size={16} color={direction === 'long' ? theme.btnText : theme.subText} /><Text style={{color: direction === 'long' ? theme.btnText : theme.subText, fontWeight: '700', fontSize: 13}}>LONG</Text></TouchableOpacity><TouchableOpacity onPress={() => setDirection('short')} style={[s.dirToggleBtn, direction === 'short' && {backgroundColor: theme.danger, borderColor: theme.danger}]}><Feather name="trending-down" size={16} color={direction === 'short' ? '#FFF' : theme.subText} /><Text style={{color: direction === 'short' ? '#FFF' : theme.subText, fontWeight: '700', fontSize: 13}}>SHORT</Text></TouchableOpacity></View><View style={{marginBottom: 16, paddingHorizontal: 4}}><Text style={s.label}>RISK AMOUNT ($)</Text><TextInput keyboardType="numeric" placeholder={activeStrategy.risk.toString()} placeholderTextColor={theme.subText} value={customRisk} onChangeText={setCustomRisk} style={s.inputField} /></View><ScrollView style={s.checklistCard}>{activeStrategy.rules.map((rule: Rule) => (<TouchableOpacity key={rule.id} onPress={() => setCheckedRules(p => ({...p, [rule.id]: !p[rule.id]}))} style={[s.checkItem, checkedRules[rule.id] ? s.checkItemActive : null]}><Text style={s.checkText}>{rule.text}</Text><View style={[s.checkCircle, checkedRules[rule.id] ? s.checkCircleActive : null]}>{checkedRules[rule.id] && <Feather name="check" size={14} color="#000" />}</View></TouchableOpacity>))}</ScrollView><TouchableOpacity onPress={onExecute} disabled={!direction} style={[s.executeBtn, allRulesMet && direction ? s.executeBtnReady : s.executeBtnLocked]}><Feather name={allRulesMet && direction ? "shield" : "alert-triangle"} size={20} color={allRulesMet && direction ? theme.btnText : theme.subText} /><Text style={[s.executeBtnText, !(allRulesMet && direction) && {color: theme.subText}]}>{allRulesMet && direction ? `EXECUTE ($${customRisk || activeStrategy.risk})` : !direction ? "SELECT DIRECTION" : "FORCE EXECUTE"}</Text></TouchableOpacity></View>)}
      {view === 'active' && (<ScrollView contentContainerStyle={s.scrollContent}><Text style={s.screenTitle}>LIVE TRADES</Text>{strategyActive.map(trade => { const remaining = 100 - trade.percentClosed; const tradePartialInput = partialInputs[trade.id] || ''; const parsedPartial = parseInt(tradePartialInput); const partialError = tradePartialInput.trim() !== '' && (isNaN(parsedPartial) || parsedPartial < 1 || parsedPartial > remaining); return (<TouchableOpacity key={trade.id} onPress={() => setDetailModal({show: true, trade})} style={s.activeCard}><View style={s.activeHeader}><Text style={s.riskValue}>${trade.risk} RISK</Text><View style={[s.tag, trade.direction === 'LONG' ? s.tagGreen : s.tagRed]}><Text style={[s.tagText, {color: trade.direction === 'LONG' ? '#000' : '#FFF'}]}>{trade.direction}</Text></View></View><View style={s.progressBox}><View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}><Text style={s.label}>REALIZED: <Text style={s.profitValue}>+${trade.realizedProfit.toFixed(2)}</Text></Text><Text style={[s.label, {color: theme.text}]}>{trade.percentClosed}% CLOSED</Text></View><View style={s.progressBarBg}><View style={[s.progressBarFill, { width: `${trade.percentClosed}%` }]} /></View></View><View style={{marginTop: 12}}><Text style={[s.label, {marginBottom: 4}]}>PARTIAL CLOSE (%) — Available: {remaining}%</Text><View style={{flexDirection: 'row', gap: 8, alignItems: 'center'}}><TextInput keyboardType="numeric" placeholder={`1-${remaining}`} placeholderTextColor={theme.subText} value={tradePartialInput} onChangeText={t => setPartialInputs(prev => ({...prev, [trade.id]: t}))} style={[s.inputField, {flex: 1}, partialError ? {borderColor: theme.danger, borderWidth: 1} : null]} /><TouchableOpacity disabled={partialError || tradePartialInput.trim() === '' || remaining === 0} onPress={() => { openExecModal('PARTIAL', trade.id, parsedPartial); setPartialInputs(prev => ({...prev, [trade.id]: ''})); }} style={[s.actionBtn, {paddingHorizontal: 16}, (partialError || tradePartialInput.trim() === '' || remaining === 0) && {opacity: 0.4}]}><Text style={s.actionBtnText}>CLOSE</Text></TouchableOpacity></View>{partialError && <Text style={{color: theme.danger, fontSize: 11, marginTop: 4}}>Enter a value between 1 and {remaining}%</Text>}</View><View style={{flexDirection: 'row', gap: 10, marginTop: 16}}><TouchableOpacity onPress={() => toggleBreakeven(trade.id)} style={[s.actionBtn, {flex: 1, backgroundColor: trade.isBreakeven ? theme.tint : theme.card, borderWidth: 1, borderColor: trade.isBreakeven ? theme.tint : theme.border}]}><Text style={{color: trade.isBreakeven ? theme.btnText : theme.text, fontWeight: '700'}}>MOVE SL TO BE</Text></TouchableOpacity><TouchableOpacity onPress={() => openExecModal('FULL', trade.id, 100 - trade.percentClosed)} style={[s.actionBtn, {flex: 1}]}><Text style={s.actionBtnText}>CLOSE FULL</Text></TouchableOpacity></View><View style={{flexDirection: 'row', gap: 10, marginTop: 8}}><TouchableOpacity onPress={() => setTagModal({show: true, tradeId: trade.id})} style={[s.actionBtn, {flex:1, borderColor: theme.border, borderWidth: 1, backgroundColor: 'transparent'}]}><Text style={{color: theme.text, fontWeight: '700'}}>TAGS</Text></TouchableOpacity><TouchableOpacity onPress={() => openExecModal('SL', trade.id, 0)} style={[s.actionBtn, {flex:1, borderColor: theme.danger, borderWidth: 2, backgroundColor: 'transparent'}]}><Text style={s.actionBtnTextRed}>{trade.isBreakeven ? "STOPPED AT BE" : "STOP LOSS"}</Text></TouchableOpacity></View></TouchableOpacity>); })}{strategyActive.length === 0 && <View style={s.emptyState}><Feather name="crosshair" size={48} color={theme.subText} /><Text style={s.emptyText}>No live positions.</Text><TouchableOpacity onPress={() => setView('checklist')} style={s.scanBtn}><Text style={s.scanBtnText}>ENTER TRADE</Text></TouchableOpacity></View>}</ScrollView>)}

      {/* Strategy Switcher */}
      <Modal visible={strategyModal} transparent animationType="fade" onRequestClose={() => setStrategyModal(false)}>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setStrategyModal(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>STRATEGIES</Text>
            {strategies.map((strat: Strategy) => (
              <View key={strat.id} style={{flexDirection: 'row', gap: 8, marginBottom: 8}}>
                <TouchableOpacity onPress={() => { setCurrentStrategyId(strat.id); setStrategyModal(false); }} style={[s.stratItem, strat.id === currentStrategyId ? {borderColor: theme.tint, borderWidth: 1} : null]}><Text style={{color: theme.text, fontWeight: '700'}}>{strat.name}</Text><Text style={{color: theme.subText, fontSize: 10}}>${strat.risk} Risk • {strat.rules.length} Rules</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setStrategyModal(false); setEditStrategyModal({show: true, strategy: strat}); }} style={s.editBtn}><Feather name="settings" size={18} color={theme.text} /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={onAddNewStrategy} style={[s.actionBtn, {backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginTop: 12}]}><Text style={{color: theme.text, fontWeight: '700'}}>+ CREATE NEW STRATEGY</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Strategy */}
      <Modal visible={editStrategyModal.show} animationType="slide">
        <SafeAreaView style={s.container}>
          <View style={s.navHeader}><Text style={s.screenTitle}>EDIT STRATEGY</Text><TouchableOpacity onPress={() => setEditStrategyModal({show: false, strategy: null})}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity></View>
          {editStrategyModal.strategy && (
            <ScrollView contentContainerStyle={s.scrollContent}>
              <Text style={s.label}>STRATEGY NAME</Text><TextInput style={s.inputField} value={editStrategyModal.strategy.name} onChangeText={t => setEditStrategyModal(p => ({...p, strategy: {...p.strategy, name: t}}))} />
              <Text style={[s.label, {marginTop: 20}]}>FIXED RISK AMOUNT ($)</Text><TextInput style={s.inputField} keyboardType="numeric" value={String(editStrategyModal.strategy.risk)} onChangeText={t => setEditStrategyModal(p => ({...p, strategy: {...p.strategy, risk: Number(t)}}))} />
              <Text style={[s.label, {marginTop: 20, marginBottom: 10}]}>EXECUTION RULES</Text>
              {editStrategyModal.strategy.rules.map((rule: Rule, idx: number) => (
                <View key={rule.id} style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                  <TextInput style={[s.inputField, {flex: 1}]} value={rule.text} onChangeText={t => { const newRules = [...editStrategyModal.strategy.rules]; newRules[idx].text = t; setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: newRules}})); }} />
                  <TouchableOpacity onPress={() => { const newRules = editStrategyModal.strategy.rules.filter((r: Rule) => r.id !== rule.id); setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: newRules}})); }} style={[s.editBtn, {backgroundColor: theme.danger + '22'}]}><Feather name="trash" size={18} color={theme.danger} /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => { const newRule = { id: Date.now().toString(), text: "New Rule" }; setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: [...p.strategy.rules, newRule]}})); }} style={[s.actionBtn, {backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border}]}><Text style={{color: theme.text}}>+ ADD RULE</Text></TouchableOpacity>
              <View style={{marginTop: 40, gap: 10}}>
                <TouchableOpacity onPress={() => onSaveStrategyEdit(editStrategyModal.strategy)} style={[s.actionBtn]}><Text style={s.actionBtnText}>SAVE CHANGES</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onDeleteStrategy(editStrategyModal.strategy.id)} style={[s.actionBtn, {backgroundColor: theme.danger}]}><Text style={{color: 'white', fontWeight: '700'}}>DELETE STRATEGY</Text></TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Tag Modal */}
      <Modal visible={tagModal.show} transparent animationType="fade" onRequestClose={() => setTagModal({show: false, tradeId: null})}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>MANAGE TAGS</Text>
            <View style={{flexDirection: 'row', gap: 8, marginBottom: 16}}>
              <TextInput style={[s.inputField, {flex: 1}]} placeholder="New Tag..." placeholderTextColor={theme.subText} value={newTagInput} onChangeText={setNewTagInput} />
              <TouchableOpacity onPress={onCreateNewTag} style={[s.editBtn, {backgroundColor: theme.tint}]}><Feather name="plus" size={20} color={theme.btnText} /></TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {tags.map(tag => {
                const trade = activeTrades.find(t => t.id === tagModal.tradeId) || history.find(t => t.id === tagModal.tradeId);
                const isSelected = trade?.tags?.includes(tag);
                return <TagChip key={tag} tag={tag} isSelected={!!isSelected} theme={theme} onPress={() => toggleTag(tagModal.tradeId!, tag)} />;
              })}
            </View>
            <TouchableOpacity onPress={() => setTagModal({show: false, tradeId: null})} style={[s.actionBtn, {marginTop: 20}]}><Text style={{color: theme.btnText, fontWeight: '700'}}>DONE</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Model Modal */}
      <Modal visible={modelModal} animationType="slide" onRequestClose={() => setModelModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
              <Text style={s.modalTitle}>MODEL BUILDER</Text>
              <TouchableOpacity onPress={() => setModelModal(false)}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity>
            </View>
            <Text style={{color: theme.subText, fontSize: 12, marginBottom: 16}}>Select multiple tags to analyze combined performance.</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 30}}>
              {tags.map(tag => {
                const isSelected = selectedModelTags.includes(tag);
                return <TagChip key={tag} tag={tag} isSelected={isSelected} theme={theme} onPress={() => toggleModelTag(tag)} />;
              })}
            </View>
            {modelStats ? (
              <View style={{padding: 20, backgroundColor: theme.bg, borderRadius: 16, borderWidth: 1, borderColor: theme.border}}>
                <Text style={{color: theme.subText, fontSize: 10, fontWeight: '700', letterSpacing: 1}}>COMBINED PERFORMANCE</Text>
                <View style={{flexDirection: 'row', gap: 20, marginTop: 10}}>
                  <View><Text style={{color: modelStats.winRate >= 50 ? theme.success : theme.danger, fontSize: 32, fontWeight: '700'}}>{modelStats.winRate.toFixed(0)}%</Text><Text style={{color: theme.subText, fontSize: 10}}>WIN RATE</Text></View>
                  <View><Text style={{color: theme.text, fontSize: 32, fontWeight: '700'}}>{modelStats.count}</Text><Text style={{color: theme.subText, fontSize: 10}}>TRADES</Text></View>
                </View>
                <View style={{marginTop: 10}}><Text style={{color: modelStats.netProfit >= 0 ? theme.success : theme.danger, fontSize: 24, fontWeight: '700'}}>${modelStats.netProfit.toFixed(2)}</Text><Text style={{color: theme.subText, fontSize: 10}}>NET PROFIT</Text></View>
                
                <TouchableOpacity onPress={onCreateStrategyFromModel} style={[s.actionBtn, {marginTop: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.tint}]}>
                  <Text style={{color: theme.tint, fontWeight: '700'}}>CONVERT TO STRATEGY</Text>
                </TouchableOpacity>
              </View>
            ) : (<Text style={{color: theme.subText, textAlign: 'center', fontStyle: 'italic'}}>Select tags to see stats.</Text>)}
          </View>
        </View>
      </Modal>

      <Modal visible={!!zoomImage} transparent onRequestClose={() => setZoomImage(null)}>
        <View style={{flex: 1, backgroundColor: 'black'}}><TouchableOpacity style={{position: 'absolute', top: 40, right: 20, zIndex: 99}} onPress={() => setZoomImage(null)}><Feather name="x-circle" size={32} color="white" /></TouchableOpacity>{zoomImage && <Image source={{ uri: zoomImage }} style={{width, height}} resizeMode="contain" />}</View>
      </Modal>

      {/* --- P&L CALENDAR DAY DETAIL MODAL --- */}
      <Modal visible={calendarDayModal.show} transparent animationType="fade" onRequestClose={() => setCalendarDayModal({ show: false, day: null })}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={s.modalTitle}>{calendarDayModal.day?.date || ''}</Text>
              <TouchableOpacity onPress={() => setCalendarDayModal({ show: false, day: null })}><Feather name="x" size={22} color={theme.text} /></TouchableOpacity>
            </View>
            {calendarDayModal.day && (
              <>
                <View style={{backgroundColor: theme.bg, padding: 12, borderRadius: 12, marginBottom: 16, alignItems: 'center'}}>
                  <Text style={{color: theme.subText, fontSize: 10, fontWeight: '600'}}>NET P&L</Text>
                  <Text style={{color: calendarDayModal.day.pnl >= 0 ? theme.success : theme.danger, fontSize: 28, fontWeight: '900'}}>{calendarDayModal.day.pnl >= 0 ? '+' : ''}${calendarDayModal.day.pnl.toFixed(2)}</Text>
                  <Text style={{color: theme.subText, fontSize: 10}}>{calendarDayModal.day.trades.length} trade{calendarDayModal.day.trades.length !== 1 ? 's' : ''}</Text>
                </View>
                <ScrollView style={{maxHeight: 250}}>
                  {calendarDayModal.day.trades.map(trade => (
                    <TouchableOpacity key={trade.id} onPress={() => { setCalendarDayModal({ show: false, day: null }); setDetailModal({ show: true, trade }); }} style={{padding: 12, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <View>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                          <View style={[s.tag, trade.direction === 'LONG' ? s.tagGreen : s.tagRed]}><Text style={[s.tagText, {color: trade.direction === 'LONG' ? '#000' : '#FFF'}]}>{trade.direction}</Text></View>
                          <Text style={{color: theme.subText, fontSize: 10}}>{trade.timeStr}</Text>
                        </View>
                        <Text style={{color: theme.subText, fontSize: 10, marginTop: 2}}>${trade.risk} Risk</Text>
                      </View>
                      <Text style={{color: trade.realizedProfit >= 0 ? theme.success : theme.danger, fontWeight: '700', fontSize: 16}}>{trade.realizedProfit >= 0 ? '+' : ''}${trade.realizedProfit.toFixed(2)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            <TouchableOpacity onPress={() => setCalendarDayModal({ show: false, day: null })} style={[s.actionBtn, {marginTop: 16}]}><Text style={s.actionBtnText}>CLOSE</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- ADD INVESTMENT MODAL --- */}
      <Modal visible={addInvestmentModal} animationType="slide" onRequestClose={() => setAddInvestmentModal(false)}>
        <SafeAreaView style={s.container}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <View style={s.navHeader}><Text style={s.screenTitle}>ADD INVESTMENT</Text><TouchableOpacity onPress={() => { setAddInvestmentModal(false); setAssetSearch(''); }}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={[s.label, {fontSize: 10}]}>SEARCH ASSET</Text>
            <TextInput style={s.inputField} placeholder="Search e.g. BTC, Bitcoin, TSLA..." placeholderTextColor={theme.subText} value={assetSearch} onChangeText={setAssetSearch} />

            {assetSearch.trim().length > 0 && (
              <View style={{backgroundColor: theme.card, borderRadius: 10, borderWidth: 1, borderColor: theme.border, marginTop: 8, maxHeight: 280}}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {/* Predefined assets */}
                  {filteredAssets.map((asset, i) => (
                    <TouchableOpacity key={`pre-${i}`} onPress={() => {
                      setNewInvestment(p => ({...p, assetName: asset.name, ticker: asset.ticker, category: asset.category, coinloreId: asset.coinloreId || ''}));
                      setAssetSearch('');
                    }} style={{paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        <Text style={{color: theme.text, fontWeight: '700', fontSize: 13}}>{asset.ticker}</Text>
                        <Text style={{color: theme.subText, fontSize: 11}}>{asset.name}</Text>
                      </View>
                      <View style={{flexDirection: 'row', gap: 4, alignItems: 'center'}}>
                        {asset.coinloreId && <View style={{backgroundColor: theme.tint + '20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4}}><Text style={{color: theme.tint, fontSize: 8, fontWeight: '600'}}>LIVE</Text></View>}
                        <View style={{backgroundColor: theme.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>{asset.category}</Text></View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {/* CoinLore API results (crypto not in predefined list) */}
                  {coinloreResults.map((coin, i) => (
                    <TouchableOpacity key={`cl-${coin.id}`} onPress={() => {
                      setNewInvestment(p => ({...p, assetName: coin.name, ticker: coin.symbol, category: 'Crypto', coinloreId: coin.id}));
                      setAssetSearch('');
                    }} style={{paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        <Text style={{color: theme.text, fontWeight: '700', fontSize: 13}}>{coin.symbol}</Text>
                        <Text style={{color: theme.subText, fontSize: 11}}>{coin.name}</Text>
                      </View>
                      <View style={{flexDirection: 'row', gap: 4, alignItems: 'center'}}>
                        <Text style={{color: theme.success, fontSize: 10}}>${parseFloat(coin.price_usd).toLocaleString()}</Text>
                        <View style={{backgroundColor: theme.tint + '20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4}}><Text style={{color: theme.tint, fontSize: 8, fontWeight: '600'}}>LIVE</Text></View>
                        <View style={{backgroundColor: theme.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>Crypto</Text></View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {isSearching && <Text style={{color: theme.subText, fontSize: 10, padding: 10, textAlign: 'center'}}>Searching CoinLore...</Text>}
                  {/* Custom asset fallback */}
                  {!assetSearchHasExactMatch && (
                    <TouchableOpacity onPress={() => { setNewInvestment(p => ({...p, assetName: assetSearch.trim(), ticker: assetSearch.trim(), category: 'Custom', coinloreId: ''})); setAssetSearch(''); }} style={{paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <Feather name="plus-circle" size={14} color={theme.tint} />
                      <Text style={{color: theme.tint, fontWeight: '700', fontSize: 12}}>Add Custom: "{assetSearch.trim()}"</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            {newInvestment.assetName ? (
              <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: theme.tint + '18', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, gap: 6}}>
                <Feather name="check-circle" size={14} color={theme.tint} />
                <Text style={{color: theme.tint, fontWeight: '700', fontSize: 12, flex: 1}}>{newInvestment.ticker} — {newInvestment.assetName}</Text>
                {newInvestment.coinloreId ? <View style={{backgroundColor: theme.tint + '20', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4}}><Text style={{color: theme.tint, fontSize: 8, fontWeight: '600'}}>LIVE</Text></View> : null}
                <TouchableOpacity onPress={() => setNewInvestment(p => ({...p, assetName: '', ticker: '', category: '' as Investment['category'], coinloreId: ''}))}><Feather name="x" size={14} color={theme.subText} /></TouchableOpacity>
              </View>
            ) : null}

            <View style={{flexDirection: 'row', gap: 12, marginTop: 14}}>
              <View style={{flex: 1}}><Text style={[s.label, {fontSize: 10}]}>ENTRY PRICE ($)</Text><TextInput keyboardType="numeric" style={s.inputField} placeholder="0.00" placeholderTextColor={theme.subText} value={newInvestment.entryPrice} onChangeText={t => setNewInvestment(p => ({...p, entryPrice: t}))} /></View>
              <View style={{flex: 1}}><Text style={[s.label, {fontSize: 10}]}>QUANTITY</Text><TextInput keyboardType="numeric" style={s.inputField} placeholder="0" placeholderTextColor={theme.subText} value={newInvestment.quantity} onChangeText={t => setNewInvestment(p => ({...p, quantity: t}))} /></View>
            </View>

            <Text style={[s.label, {marginTop: 14, fontSize: 10}]}>ENTRY DATE</Text>
            <TextInput style={s.inputField} placeholder="e.g. 2/18/2026 (leave blank for today)" placeholderTextColor={theme.subText} value={newInvestment.entryDate} onChangeText={t => setNewInvestment(p => ({...p, entryDate: t}))} />

            <Text style={[s.label, {marginTop: 14, fontSize: 10}]}>THESIS NOTES</Text>
            <TextInput multiline placeholder="Why did I buy this?" placeholderTextColor={theme.subText} value={newInvestment.thesisNotes} onChangeText={t => setNewInvestment(p => ({...p, thesisNotes: t}))} style={[s.inputField, {height: 70, textAlignVertical: 'top'}]} />

            <TouchableOpacity onPress={onPickInvestmentImages} style={[s.imageBtn, {marginTop: 14}, newInvestment.imageUris.length > 0 ? s.imageBtnActive : null]}>
              <Feather name="camera" size={18} color={newInvestment.imageUris.length > 0 ? theme.btnText : theme.text} />
              <Text style={[s.imageBtnText, newInvestment.imageUris.length > 0 ? {color: theme.btnText} : null]}>{newInvestment.imageUris.length > 0 ? `${newInvestment.imageUris.length} IMAGES` : "ATTACH CHARTS / DATA"}</Text>
            </TouchableOpacity>
            {newInvestment.imageUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                {newInvestment.imageUris.map((uri, i) => (
                  <Image key={i} source={{uri}} style={{width: 60, height: 60, borderRadius: 6, marginRight: 6, backgroundColor: '#000'}} resizeMode="cover" />
                ))}
              </ScrollView>
            )}

            <TouchableOpacity onPress={onAddInvestment} style={[s.actionBtn, {marginTop: 20}]}><Text style={s.actionBtnText}>ADD TO PORTFOLIO</Text></TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* --- UPDATE PRICE MODAL --- */}
      <Modal visible={updatePriceModal.show} transparent animationType="fade" onRequestClose={() => setUpdatePriceModal({show: false, investmentId: null})}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>UPDATE PRICE</Text>
            <TextInput autoFocus keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.subText} value={newPrice} onChangeText={setNewPrice} style={s.modalInput} />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => { setUpdatePriceModal({show: false, investmentId: null}); setNewPrice(''); }} style={s.modalCancel}><Text style={s.modalCancelText}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity onPress={onUpdatePrice} style={s.modalConfirm}><Text style={s.modalConfirmText}>UPDATE</Text></TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- INVESTMENT DETAIL MODAL --- */}
      <Modal visible={investmentDetailModal.show} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInvestmentDetailModal({show: false, investment: null})}>
        <View style={s.detailContainer}>
          <View style={s.detailHeader}>
            <Text style={s.detailTitle}>INVESTMENT DETAIL</Text>
            <TouchableOpacity onPress={() => setInvestmentDetailModal({show: false, investment: null})}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity>
          </View>
          {investmentDetailModal.investment && (() => {
            const inv = investmentDetailModal.investment;
            const pnl = (inv.currentPrice - inv.entryPrice) * inv.quantity;
            const pnlPercent = inv.entryPrice > 0 ? ((inv.currentPrice - inv.entryPrice) / inv.entryPrice) * 100 : 0;
            const currentVal = inv.currentPrice * inv.quantity;
            const isCrypto = !!inv.coinloreId;
            return (
              <ScrollView contentContainerStyle={{padding: 20}}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <Text style={{color: theme.text, fontSize: 22, fontWeight: '900'}}>{inv.ticker || inv.assetName}</Text>
                  {isCrypto && <View style={{backgroundColor: theme.tint + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}><Text style={{color: theme.tint, fontSize: 9, fontWeight: '600'}}>LIVE PRICE</Text></View>}
                  {!isCrypto && <View style={{backgroundColor: theme.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>MANUAL</Text></View>}
                </View>
                <Text style={{color: theme.subText, fontSize: 11, marginTop: 2}}>{inv.assetName} • Added {inv.entryDate}</Text>

                {/* Price Card */}
                <View style={[s.activeCard, {marginTop: 16}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <View><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>ENTRY PRICE</Text><Text style={{color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 2}}>${inv.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text></View>
                    <View style={{alignItems: 'flex-end'}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>CURRENT PRICE</Text><Text style={{color: theme.text, fontSize: 16, fontWeight: '700', marginTop: 2}}>${inv.currentPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text></View>
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: theme.border}}>
                    <View><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>QUANTITY</Text><Text style={{color: theme.text, fontSize: 14, fontWeight: '700', marginTop: 2}}>{inv.quantity}</Text></View>
                    <View style={{alignItems: 'center'}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>CURRENT VALUE</Text><Text style={{color: theme.text, fontSize: 14, fontWeight: '700', marginTop: 2}}>${currentVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text></View>
                    <View style={{alignItems: 'flex-end'}}><Text style={{color: theme.subText, fontSize: 9, fontWeight: '600'}}>P&L</Text><Text style={{color: pnl >= 0 ? theme.success : theme.danger, fontSize: 14, fontWeight: '700', marginTop: 2}}>{pnl >= 0 ? '+' : ''}${pnl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</Text></View>
                  </View>
                </View>

                {/* Manual Update Price Button - Prominent for non-live assets */}
                {!isCrypto && (
                  <TouchableOpacity onPress={() => { setUpdatePriceModal({show: true, investmentId: inv.id}); setNewPrice(String(inv.currentPrice)); }} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.tint + '15', borderWidth: 1, borderColor: theme.tint + '40', paddingVertical: 10, borderRadius: 8, marginTop: 12}}>
                    <Feather name="edit-3" size={14} color={theme.tint} />
                    <Text style={{color: theme.tint, fontWeight: '700', fontSize: 12}}>UPDATE CURRENT PRICE</Text>
                  </TouchableOpacity>
                )}

                {inv.thesisNotes ? (
                  <View style={{marginTop: 16}}>
                    <Text style={{color: theme.subText, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6}}>THESIS</Text>
                    <View style={[s.activeCard, {marginTop: 0}]}>
                      <Text style={{color: theme.text, fontStyle: 'italic', lineHeight: 18, fontSize: 13}}>"{inv.thesisNotes}"</Text>
                    </View>
                  </View>
                ) : null}

                {inv.imageUris && inv.imageUris.length > 0 && (
                  <View style={{marginTop: 16}}>
                    <Text style={{color: theme.subText, fontSize: 9, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6}}>VISUAL THESIS</Text>
                    {inv.imageUris.map((uri, i) => (
                      <TouchableOpacity key={i} onPress={() => setZoomImage(uri)}>
                        <Image source={{uri}} style={{width: '100%', height: 180, borderRadius: 10, marginTop: 6, backgroundColor: '#000'}} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity onPress={() => onPickDetailImages(inv.id)} style={[s.imageBtn, {marginTop: 16}]}>
                  <Feather name="camera" size={16} color={theme.text} />
                  <Text style={[s.imageBtnText, {fontSize: 11}]}>ADD CHARTS</Text>
                </TouchableOpacity>

                <View style={{flexDirection: 'row', gap: 10, marginTop: 16}}>
                  {isCrypto && (
                    <TouchableOpacity onPress={() => { setUpdatePriceModal({show: true, investmentId: inv.id}); setNewPrice(String(inv.currentPrice)); }} style={[s.actionBtn, {flex: 1, gap: 6}]}><Feather name="edit-3" size={16} color={theme.btnText} /><Text style={[s.actionBtnText, {fontSize: 12}]}>MANUAL OVERRIDE</Text></TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => { deleteInvestment(inv.id); setInvestmentDetailModal({show: false, investment: null}); }} style={[s.actionBtn, {flex: 1, backgroundColor: theme.danger}]}><Feather name="trash-2" size={16} color="white" /><Text style={{color: 'white', fontWeight: '700', fontSize: 12}}>DELETE</Text></TouchableOpacity>
                </View>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      <View style={s.navBar}>
        <TouchableOpacity onPress={() => setView('dashboard')} style={s.navItem}><Feather name="grid" size={24} color={view === 'dashboard' ? theme.tint : theme.subText} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('active')} style={s.navItem}><View><Feather name="activity" size={24} color={view === 'active' ? theme.tint : theme.subText} />{activeTrades.length > 0 && <View style={s.activeDot} />}</View></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('portfolio')} style={s.navItem}><Feather name="briefcase" size={24} color={view === 'portfolio' ? theme.tint : theme.subText} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('performance')} style={s.navItem}><Feather name="bar-chart-2" size={24} color={view === 'performance' ? theme.tint : theme.subText} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, paddingTop: StatusBar.currentHeight },
  scrollContent: { padding: 16, paddingBottom: 130 },
  centerContent: { flex: 1, padding: 16, justifyContent: 'center', paddingBottom: 130 },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  
  strategyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.tint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  strategyText: { color: t.btnText, fontWeight: '600', fontSize: 12 },
  
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  
  mainActionBtn: { flex: 2, backgroundColor: t.tint, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secActionBtn: { flex: 1, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  
  tableCard: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, overflow: 'hidden', marginTop: 12 },
  emptyText: { color: t.subText, textAlign: 'center', padding: 32, fontStyle: 'italic' },
  
  backupBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
  backupText: { color: t.text, fontWeight: '600', fontSize: 10 },
  
  stratItem: { flex: 1, backgroundColor: t.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border },
  editBtn: { width: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: t.border, borderRadius: 12 },
  inputField: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, color: t.text, padding: 12, borderRadius: 8, fontSize: 14 },
  
  activeCard: { backgroundColor: t.card, padding: 24, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: t.border },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  riskValue: { color: t.text, fontSize: 20, fontWeight: '700' },
  progressBox: { backgroundColor: t.bg, padding: 16, borderRadius: 16, marginBottom: 16 },
  progressBarBg: { height: 8, backgroundColor: t.border, borderRadius: 4 },
  progressBarFill: { height: '100%', backgroundColor: t.tint, borderRadius: 4 },
  profitValue: { color: t.tint, fontWeight: '900' },
  
  bigBtn: { height: 160, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16, backgroundColor: t.card, borderWidth: 1 },
  bigBtnText: { fontSize: 28, fontWeight: '600', marginTop: 12, letterSpacing: 2 },
  borderGreen: { borderColor: t.tint + '44', backgroundColor: t.tint + '11' },
  borderRed: { borderColor: t.danger + '44', backgroundColor: t.danger + '11' },
  backBtn: { position: 'absolute', top: 16, left: 16, zIndex: 10, padding: 8 },
  screenTitle: { color: t.text, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 32, letterSpacing: 2 },
  
  checklistCard: { backgroundColor: t.card, borderRadius: 24, padding: 12, flex: 1, marginBottom: 20 },
  checkItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 4 },
  checkItemActive: { backgroundColor: t.border + '33' },
  checkText: { color: t.subText, flex: 1, fontWeight: '600', fontSize: 12 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  checkCircleActive: { borderColor: t.tint, backgroundColor: t.tint },
  
  executeBox: { padding: 24, borderRadius: 24, borderWidth: 1, borderColor: t.border },
  executeBoxReady: { backgroundColor: t.tint, borderColor: t.tint },
  executeBoxLocked: { backgroundColor: t.card },
  executeTitle: { fontSize: 18, fontWeight: '700', color: t.btnText },
  executeBtnText: { color: t.btnText, fontWeight: '700', fontSize: 14 },
  executeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, marginTop: 8 },
  executeBtnReady: { backgroundColor: t.tint },
  executeBtnLocked: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
  dirToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
  lockedText: { color: t.subText, fontWeight: '600', marginTop: 8 },
  
  grid3: { flexDirection: 'row', gap: 8 },
  partialBtn: { flex: 1, backgroundColor: t.border, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  partialBtnText: { color: t.text, fontWeight: '600' },
  
  actionBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: t.tint },
  actionBtnText: { color: t.btnText, fontWeight: '700', fontSize: 13 },
  actionBtnTextBlack: { color: t.btnText, fontWeight: '700', fontSize: 13 },
  actionBtnTextRed: { color: t.danger, fontWeight: '700', fontSize: 13 },
  
  modalOverlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: t.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: t.border },
  modalTitle: { color: t.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  modalInput: { backgroundColor: t.input, color: t.tint, fontSize: 32, fontWeight: '700', textAlign: 'center', padding: 16, borderRadius: 16, marginBottom: 16 },
  imageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: t.tint, marginBottom: 16 },
  imageBtnActive: { backgroundColor: t.tint },
  imageBtnText: { color: t.tint, fontWeight: '600', fontSize: 12 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, backgroundColor: t.border, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalCancelText: { color: t.text, fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: t.tint, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalConfirmText: { color: t.btnText, fontWeight: '600' },
  
  detailContainer: { flex: 1, backgroundColor: t.bg },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1, borderColor: t.border },
  detailTitle: { color: t.text, fontSize: 16, fontWeight: '700' },
  detailStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  detailValue: { color: t.text, fontSize: 24, fontWeight: '700' },
  
  timelineItem: { flexDirection: 'row', marginBottom: 24 },
  timelineLeft: { alignItems: 'center', width: 20, marginRight: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.tint },
  timelineLine: { width: 2, flex: 1, backgroundColor: t.border, marginTop: 4 },
  timelineContent: { flex: 1, backgroundColor: t.card, padding: 16, borderRadius: 16 },
  timelineType: { color: t.tint, fontWeight: '700', fontSize: 10, marginBottom: 4 },
  timelineSub: { color: t.subText, fontSize: 12, marginTop: 4 },
  timelineImage: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#000' },
  
  sectionTitle: { color: t.text, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '600' },
  tagGreen: { backgroundColor: t.tint },
  tagRed: { backgroundColor: t.danger },
  label: { color: t.subText, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  emptyState: { alignItems: 'center', marginTop: 64 },
  scanBtn: { marginTop: 16, padding: 12, backgroundColor: t.card, borderRadius: 8 },
  scanBtnText: { color: t.tint, fontWeight: '700', fontSize: 10 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: t.overlay, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  
  navBar: { position: 'absolute', bottom: 32, alignSelf: 'center', width: '90%', height: 72, backgroundColor: t.card + 'EE', borderRadius: 36, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: t.border },
  navItem: { padding: 16 },
  activeDot: { position: 'absolute', top: 14, right: 14, width: 6, height: 6, borderRadius: 3, backgroundColor: t.tint },
  
  paginationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderTopWidth: 1, borderColor: t.border, gap: 6 },
  paginationText: { color: t.subText, fontSize: 10, fontWeight: '600' },
  periodBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  periodText: { fontSize: 12, fontWeight: '600' },
  
  perfSection: { marginBottom: 24, padding: 4 },
  perfList: { marginTop: 8, backgroundColor: t.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: t.border },
  perfRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: t.border },
  perfLabel: { color: t.subText, fontSize: 14, fontWeight: '500' },
  perfValue: { color: t.text, fontSize: 14, fontWeight: '700' },
  
  tagStatCard: { backgroundColor: t.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border, marginRight: 12, minWidth: 100 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: t.border, marginRight: 8, marginBottom: 8 },
});

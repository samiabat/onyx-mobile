import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal, SafeAreaView,
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

// --- CONSTANTS ---
const APP_NAME = "ONYX";
const ROOT_DIR = FileSystem.documentDirectory || FileSystem.cacheDirectory;
const CHART_DIR = ROOT_DIR + 'charts/';
const { width, height } = Dimensions.get('window');

// --- THEME ENGINE (VIBRANT PROFESSIONAL) ---
const THEMES = {
  dark: { 
    bg: '#09090B', 
    card: '#18181B', 
    border: '#27272A', 
    text: '#FAFAFA', 
    subText: '#A1A1AA', 
    tint: '#10B981', // PRIMARY COLOR (Emerald)
    btnText: '#000000', // Text on primary buttons
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
    tint: '#059669', // PRIMARY COLOR (Dark Emerald)
    btnText: '#FFFFFF', 
    danger: '#DC2626', 
    success: '#16A34A', 
    input: '#F1F5F9', 
    overlay: 'rgba(255,255,255,0.95)' 
  }
};

// --- DEFAULT DATA ---
const DEFAULT_RULES = [
  { id: '1', text: "Identify Key Level (S/R)" },
  { id: '2', text: "Wait for Rejection Candle" },
  { id: '3', text: "Confirm Trend Direction" },
  { id: '4', text: "Risk/Reward > 1:2" }
];

const DEFAULT_STRATEGY = {
  id: 'default_pa',
  name: 'Price Action Basics',
  risk: 100,
  rules: DEFAULT_RULES
};

const DEFAULT_TAGS = ['A+ Setup', 'Trend', 'Reversal', 'Impulse', 'Chop'];

const DEFAULT_PROFILE = {
  name: 'Trader',
  goal: 'Consistent Profitability',
  mantra: 'Plan the trade, trade the plan.',
  biometricsEnabled: false
};

export default function OnyxApp() {
  const [view, setView] = useState('dashboard');
  const [direction, setDirection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeMode] = useState('dark');
  const theme = THEMES[themeMode];
  
  // --- AUTH STATE ---
  const [isLocked, setIsLocked] = useState(false);
  
  // --- DATA STATE ---
  const [strategies, setStrategies] = useState([DEFAULT_STRATEGY]);
  const [currentStrategyId, setCurrentStrategyId] = useState(DEFAULT_STRATEGY.id);
  const [history, setHistory] = useState([]); 
  const [activeTrades, setActiveTrades] = useState([]); 
  const [tags, setTags] = useState(DEFAULT_TAGS); 
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  const activeStrategy = strategies.find(s => s.id === currentStrategyId) || strategies[0];
  const strategyHistory = useMemo(() => history.filter(t => t.strategyId === currentStrategyId), [history, currentStrategyId]);
  const strategyActive = useMemo(() => activeTrades.filter(t => t.strategyId === currentStrategyId), [activeTrades, currentStrategyId]);

  const [status, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  // --- UI STATE ---
  const [checkedRules, setCheckedRules] = useState({}); 
  const [execModal, setExecModal] = useState({ show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: '' });
  const [manualProfit, setManualProfit] = useState('');
  
  const [detailModal, setDetailModal] = useState({ show: false, trade: null });
  const [zoomImage, setZoomImage] = useState(null);
  const [strategyModal, setStrategyModal] = useState(false); 
  const [editStrategyModal, setEditStrategyModal] = useState({ show: false, strategy: null });
  const [tagModal, setTagModal] = useState({ show: false, tradeId: null });
  const [newTagInput, setNewTagInput] = useState('');
  const [modelModal, setModelModal] = useState(false); 
  const [selectedModelTags, setSelectedModelTags] = useState([]); 
  const [simModal, setSimModal] = useState(false);
  const [simParams, setSimParams] = useState({ balance: '10000', winRate: '50', rr: '2', trades: '20' });
  const [simResult, setSimResult] = useState(null);
  
  // Social Share
  const viewShotRef = useRef();
  const [shareModal, setShareModal] = useState({ show: false, trade: null });

  // Note Editing
  const [editNoteModal, setEditNoteModal] = useState({ show: false, tradeId: null, entryIndex: null, text: '' });

  // Pagination & Performance
  const [historyPage, setHistoryPage] = useState(1);
  const TRADES_PER_PAGE = 5;
  const [perfPeriod, setPerfPeriod] = useState('ALL'); 

  useEffect(() => { initFileSystem(); loadData(); checkBiometrics(); }, []);
  useEffect(() => { saveData(); }, [history, activeTrades, strategies, currentStrategyId, themeMode, tags, profile]);

  const initFileSystem = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CHART_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(CHART_DIR, { intermediates: true });
    } catch (e) { console.error("Init Error:", e); }
  };

  const loadData = async () => {
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
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('onyx_history', JSON.stringify(history));
      await AsyncStorage.setItem('onyx_active', JSON.stringify(activeTrades));
      await AsyncStorage.setItem('onyx_strategies', JSON.stringify(strategies));
      await AsyncStorage.setItem('onyx_current_strat', currentStrategyId);
      await AsyncStorage.setItem('onyx_theme', themeMode);
      await AsyncStorage.setItem('onyx_tags', JSON.stringify(tags));
      await AsyncStorage.setItem('onyx_profile', JSON.stringify(profile));
    } catch (e) { console.error("Save Error", e); }
  };

  // --- BIOMETRICS ---
  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const savedProfile = await AsyncStorage.getItem('onyx_profile');
    const parsedProfile = savedProfile ? JSON.parse(savedProfile) : DEFAULT_PROFILE;

    if (hasHardware && isEnrolled && parsedProfile.biometricsEnabled) {
      setIsLocked(true);
      authenticate();
    }
  };

  const authenticate = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ONYX' });
    if (result.success) setIsLocked(false);
    else Alert.alert("Locked", "Authentication failed. Try again.", [{ text: "Retry", onPress: authenticate }]);
  };

  // --- ANALYTICS ---
  const getPeriodTrades = () => {
    const now = new Date();
    return strategyHistory.filter(t => {
      const d = new Date(t.id);
      if (perfPeriod === 'ALL') return true;
      if (perfPeriod === '1D') return d.toDateString() === now.toDateString();
      if (perfPeriod === '1W') { const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7); return d >= weekAgo; }
      if (perfPeriod === '1M') { const monthAgo = new Date(); monthAgo.setMonth(now.getMonth() - 1); return d >= monthAgo; }
      if (perfPeriod === '1Y') { const yearAgo = new Date(); yearAgo.setFullYear(now.getFullYear() - 1); return d >= yearAgo; }
      return true;
    });
  };

  const analytics = useMemo(() => {
    const trades = getPeriodTrades();
    const wins = trades.filter(t => t.realizedProfit > 0);
    const losses = trades.filter(t => t.realizedProfit < 0);
    const total = trades.length;
    
    const netProfit = trades.reduce((a, t) => a + t.realizedProfit, 0);
    const winRate = total > 0 ? (wins.length / total * 100) : 0;
    
    const avgWin = wins.length ? wins.reduce((a, t) => a + t.realizedProfit, 0) / wins.length : 0;
    const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + t.realizedProfit, 0) / losses.length) : 0;
    const avgRR = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : (avgWin > 0 ? "∞" : "0.00");
    const profitFactor = Math.abs(losses.reduce((a, t) => a + t.realizedProfit, 0)) > 0 
      ? (wins.reduce((a, t) => a + t.realizedProfit, 0) / Math.abs(losses.reduce((a, t) => a + t.realizedProfit, 0))).toFixed(2) 
      : "∞";

    const dailyStats = [...strategyHistory].sort((a, b) => b.id - a.id);

    const tagStats = tags.map(tag => {
      const taggedTrades = strategyHistory.filter(t => t.tags && t.tags.includes(tag));
      const count = taggedTrades.length;
      const tagWins = taggedTrades.filter(t => t.realizedProfit > 0).length;
      const rate = count > 0 ? (tagWins / count * 100) : 0;
      const net = taggedTrades.reduce((acc, t) => acc + t.realizedProfit, 0);
      const totalRisk = taggedTrades.reduce((acc, t) => acc + t.risk, 0);
      const roi = totalRisk > 0 ? (net / totalRisk) * 100 : 0;
      return { tag, count, winRate: rate, roi };
    }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

    return { netProfit, winRate, avgRR, profitFactor, totalTrades: total, dailyStats, tagStats };
  }, [strategyHistory, tags, perfPeriod]);

  // --- SOCIAL SHARE ---
  const handleSocialShare = async () => {
    try {
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.9 });
      await Sharing.shareAsync(uri);
      setShareModal({ show: false, trade: null });
    } catch(e) { console.log(e); }
  };

  // --- TRADING & EDITING ---
  const saveEditedNote = () => {
    const { tradeId, entryIndex, text } = editNoteModal;
    const updateList = (list) => list.map(t => {
      if (t.id !== tradeId) return t;
      const newJournal = [...t.journal];
      if (newJournal[entryIndex]) {
        newJournal[entryIndex].note = text;
      }
      return { ...t, journal: newJournal };
    });

    if (activeTrades.find(t => t.id === tradeId)) setActiveTrades(prev => updateList(prev));
    else if (history.find(t => t.id === tradeId)) setHistory(prev => updateList(prev));
    
    // Also update current detail view if open
    if (detailModal.trade && detailModal.trade.id === tradeId) {
      const updatedTrade = updateList([detailModal.trade])[0];
      setDetailModal(prev => ({ ...prev, trade: updatedTrade }));
    }
    
    setEditNoteModal({ show: false, tradeId: null, entryIndex: null, text: '' });
  };

  const handleExecute = () => {
    const newTrade = {
      id: Date.now(), strategyId: currentStrategyId, 
      direction: direction.toUpperCase(), dateStr: new Date().toLocaleDateString(),
      timeStr: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      risk: activeStrategy.risk,
      realizedProfit: 0, percentClosed: 0, status: 'RUNNING', journal: [],
      isBreakeven: false, tags: [] 
    };
    setActiveTrades([newTrade, ...activeTrades]);
    setCheckedRules({});
    setView('active');
  };

  const submitExecution = () => {
    const { tradeId, percent, imageUris, type, note } = execModal;
    const currentTrade = activeTrades.find(t => t.id === tradeId);
    if (!currentTrade) return;

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
      setView('dashboard');
      
      // HAPTIC FEEDBACK
      if (isWin) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setActiveTrades(prev => prev.map(t => (t.id === tradeId ? updatedTrade : t)));
    }
    setExecModal({ show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: '' });
  };

  // --- REUSABLE HELPERS (Sim, PDF, Images, etc.) ---
  const pickImages = async () => {
    let perm = status;
    if (!perm?.granted) perm = await requestPermission();
    if (!perm.granted) { Alert.alert("Permission Denied", "Enable photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
    if (!result.canceled) {
      const newUris = [];
      const dirInfo = await FileSystem.getInfoAsync(CHART_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(CHART_DIR, { intermediates: true });
      for (const asset of result.assets) {
        const fileName = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
        await FileSystem.copyAsync({ from: asset.uri, to: CHART_DIR + fileName });
        newUris.push(CHART_DIR + fileName);
      }
      setExecModal(prev => ({ ...prev, imageUris: [...prev.imageUris, ...newUris] }));
    }
  };

  const generatePlaybookPDF = async () => {
    setLoading(true);
    try {
      const winners = strategyHistory.filter(t => t.realizedProfit > 0);
      const processTradeImages = async (trade) => {
        let htmlImages = '';
        if (trade.journal) {
          for (const entry of trade.journal) {
            if (entry.imageUris && entry.imageUris.length > 0) {
              for (const uri of entry.imageUris) {
                try {
                  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                  htmlImages += `<div class="img-container"><img src="data:image/jpeg;base64,${base64}" /></div>`;
                } catch (e) {}
              }
            }
            if (entry.note) htmlImages += `<p class="note">"${entry.note}"</p>`;
          }
        }
        return htmlImages;
      };
      let content = '';
      for (const t of winners) {
        const images = await processTradeImages(t);
        content += `<div class="page"><div class="trade-header"><h2>${t.direction} on ${t.dateStr}</h2><div class="stats">Risk: $${t.risk} | Profit: $${t.realizedProfit.toFixed(2)}</div></div><div class="tags">${(t.tags || []).map(tg => `<span class="tag">${tg}</span>`).join(' ')}</div><div class="content">${images}</div></div>`;
      }
      const html = `<html><head><style>body { font-family: 'Helvetica Neue', Helvetica, sans-serif; padding: 40px; color: #111; } .page { page-break-after: always; margin-bottom: 50px; } .trade-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline; } h1 { font-size: 36px; margin-bottom: 50px; text-align: center; } h2 { margin: 0; font-size: 24px; } .stats { font-weight: bold; color: #10B981; } .tag { background: #000; color: #fff; padding: 4px 8px; font-size: 10px; border-radius: 4px; display: inline-block; margin-right: 5px; text-transform: uppercase; letter-spacing: 1px; } img { max-width: 100%; border: 1px solid #ddd; margin-bottom: 10px; } .note { background: #f4f4f5; padding: 15px; font-style: italic; border-left: 4px solid #333; margin: 10px 0; }</style></head><body><h1>${profile.name}'s PLAYBOOK</h1>${content || '<p style="text-align:center">No winning trades documented yet.</p>'}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) { Alert.alert("Error", "Could not generate Playbook."); } finally { setLoading(false); }
  };

  const generateDetailedPDF = async () => {
    setLoading(true);
    try {
      const trades = getPeriodTrades();
      const processTradeImages = async (trade) => {
        let htmlImages = '';
        if (trade.journal) {
          for (const entry of trade.journal) {
            if (entry.imageUris && entry.imageUris.length > 0) {
              for (const uri of entry.imageUris) {
                try {
                  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                  htmlImages += `<div class="img-container"><img src="data:image/jpeg;base64,${base64}" /></div>`;
                } catch (e) {}
              }
            }
            if (entry.note) htmlImages += `<p class="note"><strong>${entry.type}:</strong> ${entry.note}</p>`;
          }
        }
        return htmlImages;
      };
      let tradesHtml = '';
      for (const t of trades) {
        const imagesHtml = await processTradeImages(t);
        tradesHtml += `<div class="trade-block"><div class="trade-header"><span>${t.dateStr} - ${t.direction}</span><span class="${t.realizedProfit >= 0 ? 'win' : 'loss'}">${t.realizedProfit >= 0 ? '+' : ''}$${t.realizedProfit.toFixed(2)}</span></div><div class="trade-meta">Strategy: ${activeStrategy.name} | Risk: $${t.risk} | Status: ${t.status}</div><div class="tags">${(t.tags || []).map(tg => `<span class="tag">${tg}</span>`).join('')}</div><div class="journal-entries">${imagesHtml}</div></div>`;
      }
      const html = `<html><head><style>body { font-family: Helvetica, sans-serif; padding: 40px; color: #333; } .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; } h1 { margin: 0; font-size: 32px; letter-spacing: 2px; } .sub-header { color: #666; font-size: 14px; margin-top: 10px; } .stats-grid { display: flex; gap: 20px; margin-bottom: 40px; justify-content: center; } .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; width: 22%; text-align: center; } .label { font-size: 10px; color: #666; text-transform: uppercase; } .value { font-size: 20px; font-weight: bold; margin-top: 5px; } .trade-block { border: 1px solid #eee; margin-bottom: 20px; page-break-inside: avoid; border-radius: 8px; overflow: hidden; } .trade-header { background: #f9f9f9; padding: 10px 15px; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-bottom: 1px solid #eee; } .trade-meta { padding: 10px 15px; font-size: 12px; color: #666; } .tags { padding: 0 15px; margin-bottom: 10px; } .tag { background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 4px; } .journal-entries { padding: 15px; } .img-container { text-align: center; margin-bottom: 10px; } img { max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid #ddd; } .note { font-size: 13px; font-style: italic; background: #fffbe6; padding: 10px; border-radius: 4px; border-left: 3px solid #ffe58f; margin: 10px 0; } .win { color: #10B981; } .loss { color: #F43F5E; }</style></head><body><div class="header"><h1>ONYX PERFORMANCE</h1><p class="sub-header">Trader: ${profile.name} | Period: ${perfPeriod}</p></div><div class="stats-grid"><div class="card"><p class="label">Net Profit</p><p class="value" style="color: ${analytics.netProfit >= 0 ? '#10B981' : '#F43F5E'}">$${analytics.netProfit.toFixed(2)}</p></div><div class="card"><p class="label">Win Rate</p><p class="value">${analytics.winRate.toFixed(1)}%</p></div><div class="card"><p class="label">Profit Factor</p><p class="value">${analytics.profitFactor}</p></div><div class="card"><p class="label">Total Trades</p><p class="value">${analytics.totalTrades}</p></div></div><h2>Detailed Execution Log</h2>${tradesHtml}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (e) { Alert.alert("Error", "Could not generate PDF."); } finally { setLoading(false); }
  };

  const exportData = async () => {
    setLoading(true); try {
      const allImagePaths = new Set();
      const collectImages = (list) => { list.forEach(t => t.journal?.forEach(j => { if (Array.isArray(j.imageUris)) j.imageUris.forEach(uri => allImagePaths.add(uri)); else if (j.imageUri) allImagePaths.add(j.imageUri); })); };
      collectImages(history); collectImages(activeTrades);
      const imageBundle = {};
      for (const uri of allImagePaths) { if (!uri) continue; try { const filename = uri.split('/').pop(); const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }); imageBundle[filename] = base64; } catch (err) { console.log("Skip:", uri); } }
      const backupData = { history, activeTrades, strategies, tags, profile, imageBundle, timestamp: new Date().toISOString(), version: "4.1" };
      const fileUri = ROOT_DIR + `ONYX_Backup_${Date.now()}.json`; await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData));
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri);
    } catch (e) { Alert.alert("Export Failed", e.message); } finally { setLoading(false); }
  };
  const importData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled) return; setLoading(true); const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri); const data = JSON.parse(fileContent);
      if (data.imageBundle) { await FileSystem.makeDirectoryAsync(CHART_DIR, { intermediates: true }); for (const [filename, base64] of Object.entries(data.imageBundle)) { await FileSystem.writeAsStringAsync(CHART_DIR + filename, base64, { encoding: FileSystem.EncodingType.Base64 }); } }
      const fixPaths = (list) => list.map(t => ({ ...t, journal: t.journal?.map(j => ({ ...j, imageUris: j.imageUris ? j.imageUris.map(u => CHART_DIR + u.split('/').pop()) : [] })) }));
      if (data.strategies) setStrategies(data.strategies); if (data.tags) setTags(data.tags); if (data.profile) setProfile(data.profile);
      if (data.history) setHistory(fixPaths(data.history)); if (data.activeTrades) setActiveTrades(fixPaths(data.activeTrades));
      Alert.alert("Success", "Restored."); setTimeout(() => saveData(), 1000); 
    } catch (e) { Alert.alert("Import Failed", e.message); } finally { setLoading(false); }
  };
  
  // --- SIMULATION (Validated) ---
  const runSimulation = () => {
    const startBalance = parseFloat(simParams.balance); const winRate = parseFloat(simParams.winRate) / 100; const rr = parseFloat(simParams.rr); const numTrades = parseInt(simParams.trades); const riskPerTrade = startBalance * 0.01;
    
    // Theoretical Calculation
    const evPerTrade = (riskPerTrade * rr * winRate) - (riskPerTrade * (1 - winRate));
    const projectedProfit = evPerTrade * numTrades;
    const expectedBalance = startBalance + projectedProfit;

    // Monte Carlo
    let balance = startBalance; let peak = startBalance; let maxDrawdown = 0;
    for (let i = 0; i < numTrades; i++) { const isWin = Math.random() < winRate; const pnl = isWin ? (riskPerTrade * rr) : -riskPerTrade; balance += pnl; if (balance > peak) peak = balance; const dd = (peak - balance) / peak * 100; if (dd > maxDrawdown) maxDrawdown = dd; }
    
    setSimResult({ final: balance, growth: ((balance - startBalance) / startBalance) * 100, dd: maxDrawdown, expected: expectedBalance });
  };
  
  const toggleTag = (tradeId, tag) => {
    const updateList = (list) => list.map(t => { if (t.id !== tradeId) return t; const currentTags = t.tags || []; const newTags = currentTags.includes(tag) ? currentTags.filter(x => x !== tag) : [...currentTags, tag]; return { ...t, tags: newTags }; });
    if (activeTrades.find(t => t.id === tradeId)) setActiveTrades(prev => updateList(prev)); else if (history.find(t => t.id === tradeId)) setHistory(prev => updateList(prev));
  };
  const createNewTag = () => { if (!newTagInput.trim()) return; if (!tags.includes(newTagInput.trim())) setTags([...tags, newTagInput.trim()]); setNewTagInput(''); };
  const toggleBreakeven = (tradeId) => { setActiveTrades(prev => prev.map(t => t.id === tradeId ? { ...t, isBreakeven: !t.isBreakeven } : t)); };
  const stopLossHit = (tradeId) => {
    const trade = activeTrades.find(t => t.id === tradeId); if (!trade) return;
    const remainingPercent = 100 - trade.percentClosed; const lossAmount = trade.isBreakeven ? 0 : -1 * (trade.risk * (remainingPercent / 100));
    const finalRealized = trade.realizedProfit + lossAmount; let status = finalRealized > 0 ? 'WIN' : (Math.abs(finalRealized) < 0.01 ? 'BE' : 'LOSS');
    const finalized = { ...trade, status, realizedProfit: finalRealized, closedAt: Date.now(), percentClosed: 100, journal: [{ timestamp: Date.now(), type: trade.isBreakeven ? 'STOP_BE' : 'STOP_LOSS', profitBanked: lossAmount, percentClosed: remainingPercent }, ...trade.journal] };
    setHistory([finalized, ...history]); setActiveTrades(prev => prev.filter(t => t.id !== tradeId)); setView('dashboard');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };
  const openExecModal = (type, tradeId, percent) => { setExecModal({ show: true, type, tradeId, percent, imageUris: [], note: '' }); setManualProfit(''); };
  const addNewStrategy = () => { const newStrat = { id: Date.now().toString(), name: "New Strategy", risk: 100, rules: [...DEFAULT_RULES] }; setStrategies([...strategies, newStrat]); setCurrentStrategyId(newStrat.id); setStrategyModal(false); setEditStrategyModal({ show: true, strategy: newStrat }); };
  const saveStrategyEdit = (editedStrat) => { setStrategies(prev => prev.map(s => s.id === editedStrat.id ? editedStrat : s)); setEditStrategyModal({ show: false, strategy: null }); };
  const deleteStrategy = (id) => { if (strategies.length <= 1) return Alert.alert("Cannot Delete", "Keep one."); Alert.alert("Delete?", "Confirm", [{ text: "Cancel" }, { text: "Delete", style: 'destructive', onPress: () => { const newStrats = strategies.filter(s => s.id !== id); setStrategies(newStrats); if (currentStrategyId === id) setCurrentStrategyId(newStrats[0].id); setEditStrategyModal({ show: false, strategy: null }); }}]); };
  
  // --- MODEL TESTER ---
  const toggleModelTag = (tag) => { setSelectedModelTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]); };
  const modelStats = useMemo(() => {
    if (selectedModelTags.length === 0) return null;
    const matchingTrades = strategyHistory.filter(t => t.tags && selectedModelTags.every(tag => t.tags.includes(tag)));
    const count = matchingTrades.length; const wins = matchingTrades.filter(t => t.realizedProfit > 0).length;
    const winRate = count > 0 ? (wins / count * 100) : 0; const netProfit = matchingTrades.reduce((acc, t) => acc + t.realizedProfit, 0);
    return { count, winRate, netProfit };
  }, [strategyHistory, selectedModelTags]);

  const createStrategyFromModel = () => {
    if (selectedModelTags.length === 0) return;
    const newStratName = `Model: ${selectedModelTags.join(' + ')}`;
    const newRules = selectedModelTags.map((tag, index) => ({ id: Date.now().toString() + index, text: tag }));
    const newStrat = { id: Date.now().toString(), name: newStratName, risk: activeStrategy.risk, rules: newRules };
    setStrategies([...strategies, newStrat]); setCurrentStrategyId(newStrat.id); setModelModal(false); Alert.alert("Success", "Strategy created from model tags!");
  };

  const s = styles(theme);
  const allRulesMet = activeStrategy.rules.every(r => checkedRules[r.id]);
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
          <TouchableOpacity onPress={() => setThemeMode(p => p === 'dark' ? 'light' : 'dark')}><Feather name={themeMode === 'dark' ? 'sun' : 'moon'} size={20} color={theme.subText} /></TouchableOpacity>
        </View>
      </View>

      {/* DASHBOARD */}
      {view === 'dashboard' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.statsRow}>
            <View style={s.statCard}><Text style={s.statLabel}>NET PROFIT</Text><Text style={[s.statValue, { color: analytics.netProfit >= 0 ? theme.success : theme.danger }]}>${analytics.netProfit.toFixed(2)}</Text></View>
            <View style={s.statCard}><Text style={s.statLabel}>AVG RR</Text><Text style={[s.statValue, { color: theme.text }]}>{analytics.avgRR}</Text></View>
          </View>
          <View style={[s.statsRow, {marginTop: -12}]}>
             <View style={s.statCard}><Text style={s.statLabel}>WIN RATE</Text><Text style={[s.statValue, { color: theme.text, fontSize: 20 }]}>{analytics.winRate.toFixed(1)}%</Text></View>
             <View style={s.statCard}><Text style={s.statLabel}>TOTAL</Text><Text style={[s.statValue, { color: theme.text, fontSize: 20 }]}>{analytics.totalTrades}</Text></View>
          </View>

          {/* TAG ANALYTICS (Restored) */}
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
            <TouchableOpacity onPress={() => setView('direction')} style={s.mainActionBtn}><Feather name="plus" size={20} color={theme.btnText} /><Text style={{color: theme.btnText, fontWeight: 'bold'}}>NEW ENTRY</Text></TouchableOpacity>
          </View>

          <Text style={s.sectionTitle}>JOURNAL</Text>
          <View style={s.tableCard}>
            {visibleHistory.map(trade => (
              <TouchableOpacity key={trade.id} onPress={() => setDetailModal({show: true, trade})} style={s.tableRow}>
                <View><Text style={s.tdDate}>{trade.dateStr}</Text><Text style={s.tdTime}>{trade.timeStr}</Text></View>
                <View style={[s.tag, {backgroundColor: theme.border}]}><Text style={[s.tagText, {color: theme.text}]}>{trade.direction[0]}</Text></View>
                <Text style={[s.tdNet, {color: trade.realizedProfit >= 0 ? theme.success : theme.danger}]}>{trade.realizedProfit >= 0 ? '+' : ''}${trade.realizedProfit.toFixed(2)}</Text>
              </TouchableOpacity>
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
              <TouchableOpacity onPress={exportData} style={s.backupBtn}><Feather name="download" size={16} color={theme.tint} /><Text style={s.backupText}>BACKUP ALL</Text></TouchableOpacity>
              <TouchableOpacity onPress={importData} style={s.backupBtn}><Feather name="upload" size={16} color={theme.tint} /><Text style={s.backupText}>RESTORE</Text></TouchableOpacity>
            </View>
            <Text style={{color: theme.subText, fontSize: 10, textAlign: 'center', marginTop: 8}}>Save backup to "Files" to survive uninstall.</Text>
          </View>
        </ScrollView>
      )}

      {/* VIEW: PERFORMANCE (Redesigned) */}
      {view === 'performance' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Text style={s.screenTitle}>PERFORMANCE</Text>
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

          <View style={{gap: 12, marginTop: 24}}>
            <TouchableOpacity onPress={() => setSimModal(true)} style={s.actionBtn}><Feather name="trending-up" size={18} color={theme.btnText} /><Text style={s.actionBtnText}>SIMULATOR</Text></TouchableOpacity>
            <TouchableOpacity onPress={generatePlaybookPDF} style={s.actionBtn}><Feather name="book-open" size={18} color={theme.btnText} /><Text style={s.actionBtnText}>PLAYBOOK (PDF)</Text></TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* VIEW: PROFILE */}
      {view === 'profile' && (
        <ScrollView contentContainerStyle={s.scrollContent}>
          <Text style={s.screenTitle}>PROFILE</Text>
          <View style={[s.activeCard, {marginBottom: 20}]}>
            <Text style={s.label}>IDENTITY</Text>
            <TextInput style={[s.inputField, {marginBottom: 20}]} value={profile.name} onChangeText={t => setProfile(p => ({...p, name: t}))} />
            <Text style={s.label}>NORTH STAR</Text>
            <TextInput style={[s.inputField, {marginBottom: 20}]} value={profile.goal} onChangeText={t => setProfile(p => ({...p, goal: t}))} />
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 10}}>
              <Text style={{color: theme.text, fontWeight: 'bold'}}>LOCK APP (BIOMETRICS)</Text>
              <Switch value={profile.biometricsEnabled} onValueChange={v => setProfile(p => ({...p, biometricsEnabled: v}))} trackColor={{false: theme.border, true: theme.tint}} />
            </View>
          </View>
          <TouchableOpacity onPress={() => setView('dashboard')} style={s.actionBtn}><Text style={s.actionBtnText}>SAVE SETTINGS</Text></TouchableOpacity>
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

      {/* --- SIMULATOR MODAL (Fixed Logic) --- */}
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
            
            <TouchableOpacity onPress={runSimulation} style={s.actionBtn}><Text style={s.actionBtnText}>RUN SIMULATION</Text></TouchableOpacity>

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

                <TouchableOpacity onPress={pickImages} style={[s.imageBtn, execModal.imageUris.length > 0 ? s.imageBtnActive : null]}>
                  <Feather name="camera" size={20} color={execModal.imageUris.length > 0 ? theme.btnText : theme.text} />
                  <Text style={[s.imageBtnText, execModal.imageUris.length > 0 ? {color: theme.btnText} : null]}>{execModal.imageUris.length > 0 ? `${execModal.imageUris.length} IMAGES` : "ATTACH CHARTS"}</Text>
                </TouchableOpacity>

                <View style={s.modalBtns}>
                  <TouchableOpacity onPress={() => setExecModal({show: false, type: 'PARTIAL', tradeId: null, percent: 0, imageUris: [], note: ''})} style={s.modalCancel}><Text style={s.modalCancelText}>CANCEL</Text></TouchableOpacity>
                  <TouchableOpacity onPress={submitExecution} style={[s.modalConfirm, execModal.type === 'SL' && {backgroundColor: theme.danger}]}><Text style={s.modalConfirmText}>{execModal.type === 'SL' ? 'LIQUIDATE' : 'CONFIRM'}</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* DETAIL, STRATEGY, TAG, MODEL MODALS (Reused with new styles) */}
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
                 {(detailModal.trade.tags || []).map(t => <View key={t} style={[s.tagChip, {backgroundColor: theme.card}]}><Text style={{color: theme.subText, fontSize: 10}}>{t}</Text></View>)}
               </View>
               <Text style={[s.label, {marginTop: 32, marginBottom: 16}]}>TIMELINE</Text>
               {detailModal.trade.journal && detailModal.trade.journal.map((entry, index) => (
                 <View key={index} style={s.timelineItem}>
                   <View style={s.timelineLeft}><View style={s.timelineDot} /><View style={s.timelineLine} /></View>
                   <View style={s.timelineContent}>
                     <View style={{flexDirection: 'row', justifyContent: 'space-between'}}><Text style={s.timelineType}>{entry.type}</Text><Text style={{color: theme.text, fontWeight: '700'}}>${entry.profitBanked}</Text></View>
                     <Text style={s.timelineSub}>Closed {entry.percentClosed}%</Text>
                     <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 8}}>
                       <Text style={{color: theme.text, fontStyle: 'italic', flex: 1}}>"{entry.note || 'No note'}"</Text>
                       <TouchableOpacity onPress={() => setEditNoteModal({show: true, tradeId: detailModal.trade.id, entryIndex: index, text: entry.note || ''})}><Feather name="edit-2" size={14} color={theme.subText} /></TouchableOpacity>
                     </View>
                     <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8}}>{(entry.imageUris || []).map((uri, i) => (<TouchableOpacity key={i} onPress={() => setZoomImage(uri)}><Image source={{ uri }} style={s.timelineImage} resizeMode="cover" /></TouchableOpacity>))}</View>
                   </View>
                 </View>
               ))}
             </ScrollView>
           )}
        </View>
      </Modal>

      {/* --- EDIT NOTE MODAL --- */}
      <Modal visible={editNoteModal.show} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>EDIT NOTE</Text>
            <TextInput multiline style={[s.inputField, {height: 80}]} value={editNoteModal.text} onChangeText={t => setEditNoteModal(p => ({...p, text: t}))} />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setEditNoteModal(p => ({...p, show: false}))} style={s.modalCancel}><Text style={s.modalCancelText}>CANCEL</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveEditedNote} style={s.modalConfirm}><Text style={s.modalConfirmText}>SAVE</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* STANDARD VIEWS */}
      {view === 'direction' && (<View style={s.centerContent}><TouchableOpacity onPress={() => setView('dashboard')} style={s.backBtn}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity><Text style={s.screenTitle}>MARKET BIAS</Text><TouchableOpacity onPress={() => {setDirection('long'); setView('checklist');}} style={[s.bigBtn, s.borderGreen]}><Feather name="trending-up" size={48} color={theme.tint} /><Text style={[s.bigBtnText, {color: theme.tint}]}>LONG</Text></TouchableOpacity><TouchableOpacity onPress={() => {setDirection('short'); setView('checklist');}} style={[s.bigBtn, s.borderRed]}><Feather name="trending-down" size={48} color={theme.danger} /><Text style={[s.bigBtnText, {color: theme.danger}]}>SHORT</Text></TouchableOpacity></View>)}
      {view === 'checklist' && (<View style={s.centerContent}><TouchableOpacity onPress={() => setView('direction')} style={s.backBtn}><Feather name="arrow-left" size={24} color={theme.text} /></TouchableOpacity><Text style={s.screenTitle}>CONFIRMATION</Text><ScrollView style={s.checklistCard}>{activeStrategy.rules.map(rule => (<TouchableOpacity key={rule.id} onPress={() => setCheckedRules(p => ({...p, [rule.id]: !p[rule.id]}))} style={[s.checkItem, checkedRules[rule.id] ? s.checkItemActive : null]}><Text style={s.checkText}>{rule.text}</Text><View style={[s.checkCircle, checkedRules[rule.id] ? s.checkCircleActive : null]}>{checkedRules[rule.id] && <Feather name="check" size={14} color="#000" />}</View></TouchableOpacity>))}</ScrollView><View style={[s.executeBox, allRulesMet ? s.executeBoxReady : s.executeBoxLocked]}><TouchableOpacity onPress={handleExecute} style={{alignItems: 'center', width: '100%'}}><Feather name={allRulesMet ? "shield" : "alert-triangle"} size={32} color={theme.btnText} style={{marginBottom: 8}} /><Text style={[s.executeTitle, !allRulesMet && {color: theme.subText}]}>{allRulesMet ? `EXECUTE ($${activeStrategy.risk})` : "FORCE EXECUTE"}</Text></TouchableOpacity></View></View>)}
      {view === 'active' && (<ScrollView contentContainerStyle={s.scrollContent}><Text style={s.screenTitle}>LIVE TRADES</Text>{strategyActive.map(trade => (<TouchableOpacity key={trade.id} onPress={() => setDetailModal({show: true, trade})} style={s.activeCard}><View style={s.activeHeader}><Text style={s.riskValue}>${trade.risk} RISK</Text><View style={[s.tag, trade.direction === 'LONG' ? s.tagGreen : s.tagRed]}><Text style={[s.tagText, {color: trade.direction === 'LONG' ? '#000' : '#FFF'}]}>{trade.direction}</Text></View></View><View style={s.progressBox}><View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}><Text style={s.label}>REALIZED: <Text style={s.profitValue}>+${trade.realizedProfit.toFixed(2)}</Text></Text><Text style={[s.label, {color: theme.text}]}>{trade.percentClosed}% CLOSED</Text></View><View style={s.progressBarBg}><View style={[s.progressBarFill, { width: `${trade.percentClosed}%` }]} /></View></View><View style={s.grid3}>{[25, 50, 75].map(p => (<TouchableOpacity key={p} onPress={() => openExecModal('PARTIAL', trade.id, p)} style={s.partialBtn}><Text style={s.partialBtnText}>+{p}%</Text></TouchableOpacity>))}</View><View style={{flexDirection: 'row', gap: 10, marginTop: 16}}><TouchableOpacity onPress={() => toggleBreakeven(trade.id)} style={[s.actionBtn, {flex: 1, backgroundColor: trade.isBreakeven ? theme.tint : theme.card, borderWidth: 1, borderColor: trade.isBreakeven ? theme.tint : theme.border}]}><Text style={{color: trade.isBreakeven ? theme.btnText : theme.text, fontWeight: '700'}}>MOVE SL TO BE</Text></TouchableOpacity><TouchableOpacity onPress={() => openExecModal('FULL', trade.id, 100 - trade.percentClosed)} style={[s.actionBtn, {flex: 1}]}><Text style={s.actionBtnText}>CLOSE FULL</Text></TouchableOpacity></View><View style={{flexDirection: 'row', gap: 10, marginTop: 8}}><TouchableOpacity onPress={() => setTagModal({show: true, tradeId: trade.id})} style={[s.actionBtn, {flex:1, borderColor: theme.border, borderWidth: 1, backgroundColor: 'transparent'}]}><Text style={{color: theme.text, fontWeight: '700'}}>TAGS</Text></TouchableOpacity><TouchableOpacity onPress={() => openExecModal('SL', trade.id, 0)} style={[s.actionBtn, {flex:1, borderColor: theme.danger, borderWidth: 2, backgroundColor: 'transparent'}]}><Text style={s.actionBtnTextRed}>{trade.isBreakeven ? "STOPPED AT BE" : "STOP LOSS"}</Text></TouchableOpacity></View></TouchableOpacity>))}{strategyActive.length === 0 && <View style={s.emptyState}><Feather name="crosshair" size={48} color={theme.subText} /><Text style={s.emptyText}>No live positions.</Text><TouchableOpacity onPress={() => setView('direction')} style={s.scanBtn}><Text style={s.scanBtnText}>SCAN MARKET</Text></TouchableOpacity></View>}</ScrollView>)}

      {/* Strategy Switcher */}
      <Modal visible={strategyModal} transparent animationType="fade" onRequestClose={() => setStrategyModal(false)}>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setStrategyModal(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>STRATEGIES</Text>
            {strategies.map(strat => (
              <View key={strat.id} style={{flexDirection: 'row', gap: 8, marginBottom: 8}}>
                <TouchableOpacity onPress={() => { setCurrentStrategyId(strat.id); setStrategyModal(false); }} style={[s.stratItem, strat.id === currentStrategyId ? {borderColor: theme.tint, borderWidth: 1} : null]}><Text style={{color: theme.text, fontWeight: '700'}}>{strat.name}</Text><Text style={{color: theme.subText, fontSize: 10}}>${strat.risk} Risk • {strat.rules.length} Rules</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setStrategyModal(false); setEditStrategyModal({show: true, strategy: strat}); }} style={s.editBtn}><Feather name="settings" size={18} color={theme.text} /></TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={addNewStrategy} style={[s.actionBtn, {backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginTop: 12}]}><Text style={{color: theme.text, fontWeight: '700'}}>+ CREATE NEW STRATEGY</Text></TouchableOpacity>
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
              {editStrategyModal.strategy.rules.map((rule, idx) => (
                <View key={rule.id} style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                  <TextInput style={[s.inputField, {flex: 1}]} value={rule.text} onChangeText={t => { const newRules = [...editStrategyModal.strategy.rules]; newRules[idx].text = t; setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: newRules}})); }} />
                  <TouchableOpacity onPress={() => { const newRules = editStrategyModal.strategy.rules.filter(r => r.id !== rule.id); setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: newRules}})); }} style={[s.editBtn, {backgroundColor: theme.danger + '22'}]}><Feather name="trash" size={18} color={theme.danger} /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => { const newRule = { id: Date.now().toString(), text: "New Rule" }; setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: [...p.strategy.rules, newRule]}})); }} style={[s.actionBtn, {backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border}]}><Text style={{color: theme.text}}>+ ADD RULE</Text></TouchableOpacity>
              <View style={{marginTop: 40, gap: 10}}>
                <TouchableOpacity onPress={() => saveStrategyEdit(editStrategyModal.strategy)} style={[s.actionBtn]}><Text style={s.actionBtnText}>SAVE CHANGES</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteStrategy(editStrategyModal.strategy.id)} style={[s.actionBtn, {backgroundColor: theme.danger}]}><Text style={{color: 'white', fontWeight: '700'}}>DELETE STRATEGY</Text></TouchableOpacity>
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
              <TouchableOpacity onPress={createNewTag} style={[s.editBtn, {backgroundColor: theme.tint}]}><Feather name="plus" size={20} color={theme.btnText} /></TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {tags.map(tag => {
                const trade = activeTrades.find(t => t.id === tagModal.tradeId) || history.find(t => t.id === tagModal.tradeId);
                const isSelected = trade?.tags?.includes(tag);
                return (<TouchableOpacity key={tag} onPress={() => toggleTag(tagModal.tradeId, tag)} style={[s.tagChip, isSelected ? {backgroundColor: theme.tint, borderColor: theme.tint} : {borderColor: theme.border}]}><Text style={{color: isSelected ? theme.btnText : theme.text, fontSize: 12, fontWeight: '700'}}>{tag}</Text></TouchableOpacity>);
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
                return (<TouchableOpacity key={tag} onPress={() => toggleModelTag(tag)} style={[s.tagChip, isSelected ? {backgroundColor: theme.tint, borderColor: theme.tint} : {borderColor: theme.border}]}><Text style={{color: isSelected ? theme.btnText : theme.text, fontSize: 12, fontWeight: '700'}}>{tag}</Text></TouchableOpacity>);
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
                
                {/* NEW: Convert to Strategy Button */}
                <TouchableOpacity onPress={createStrategyFromModel} style={[s.actionBtn, {marginTop: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.tint}]}>
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

      <View style={s.navBar}>
        <TouchableOpacity onPress={() => setView('dashboard')} style={s.navItem}><Feather name="grid" size={24} color={view === 'dashboard' ? theme.tint : theme.subText} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('active')} style={s.navItem}><View><Feather name="activity" size={24} color={view === 'active' ? theme.tint : theme.subText} />{activeTrades.length > 0 && <View style={s.activeDot} />}</View></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('performance')} style={s.navItem}><Feather name="bar-chart-2" size={24} color={view === 'performance' ? theme.tint : theme.subText} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = (t) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, paddingTop: StatusBar.currentHeight },
  scrollContent: { padding: 16, paddingBottom: 100 },
  centerContent: { flex: 1, padding: 16, justifyContent: 'center', paddingBottom: 100 },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  
  strategyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.tint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  strategyText: { color: t.btnText, fontWeight: '600', fontSize: 12 },
  
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: t.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: t.border },
  statLabel: { color: t.subText, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  statValue: { fontSize: 24, fontWeight: '600', marginTop: 4 },
  
  mainActionBtn: { flex: 2, backgroundColor: t.tint, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secActionBtn: { flex: 1, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 },
  
  tableCard: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, overflow: 'hidden', marginTop: 12 },
  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'space-between' },
  tdDate: { color: t.text, fontSize: 11, fontWeight: '600' },
  tdTime: { color: t.subText, fontSize: 9, fontWeight: '600' },
  tdNet: { fontSize: 13, fontWeight: '700' },
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
  lockedText: { color: t.subText, fontWeight: '600', marginTop: 8 },
  
  grid3: { flexDirection: 'row', gap: 8 },
  partialBtn: { flex: 1, backgroundColor: t.border, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  partialBtnText: { color: t.text, fontWeight: '600' },
  
  actionBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: t.tint },
  actionBtnText: { color: t.btnText, fontWeight: '700' },
  actionBtnTextBlack: { color: t.btnText, fontWeight: '700' },
  actionBtnTextRed: { color: t.danger, fontWeight: '700' },
  
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
  stratItem: { flex: 1, backgroundColor: t.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: t.border },
  editBtn: { width: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: t.border, borderRadius: 12 },
  inputField: { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, color: t.text, padding: 12, borderRadius: 8, fontSize: 14 }
});
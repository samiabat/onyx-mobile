import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
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

import { APP_NAME, THEMES, TRADES_PER_PAGE } from '@/constants/appConfig';
import { runSimulation } from '@/utils/calculators';
import { generatePlaybookPDF, generateDetailedPDF } from '@/services/pdfService';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useTradeData } from '@/hooks/useTradeData';
import { useAnalytics } from '@/hooks/useAnalytics';
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

  // --- UI STATE ---
  const [checkedRules, setCheckedRules] = useState<Record<string, boolean>>({});
  const [execModal, setExecModal] = useState({ show: false, type: 'PARTIAL', tradeId: null as number | null, percent: 0, imageUris: [] as string[], note: '' });
  const [manualProfit, setManualProfit] = useState('');

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
  const viewShotRef = useRef<any>();
  const [shareModal, setShareModal] = useState<{ show: boolean; trade: any }>({ show: false, trade: null });

  // Note Editing
  const [editNoteModal, setEditNoteModal] = useState({ show: false, tradeId: null as number | null, entryIndex: null as number | null, text: '' });

  // Pagination & Performance
  const [historyPage, setHistoryPage] = useState(1);
  const [perfPeriod, setPerfPeriod] = useState('ALL');

  // --- ANALYTICS ---
  const { analytics, periodTrades, modelStats } = useAnalytics(strategyHistory, tags, perfPeriod, selectedModelTags);

  useEffect(() => { initFileSystem(); loadData(); checkBiometrics(); }, []);
  useEffect(() => { saveData(); }, [history, activeTrades, strategies, currentStrategyId, themeMode, tags, profile]);

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
    handleExecute(direction);
    setCheckedRules({});
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

  const s = styles(theme);
  const allRulesMet = activeStrategy.rules.every((r: any) => checkedRules[r.id]);
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
            <StatCard label="WIN RATE" value={`${analytics.winRate.toFixed(1)}%`} valueColor={theme.text} theme={theme} valueSize={20} />
            <StatCard label="TOTAL" value={`${analytics.totalTrades}`} valueColor={theme.text} theme={theme} valueSize={20} />
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
            <TouchableOpacity onPress={() => setView('direction')} style={s.mainActionBtn}><Feather name="plus" size={20} color={theme.btnText} /><Text style={{color: theme.btnText, fontWeight: 'bold'}}>NEW ENTRY</Text></TouchableOpacity>
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
            <TouchableOpacity onPress={onGeneratePlaybookPDF} style={s.actionBtn}><Feather name="book-open" size={18} color={theme.btnText} /><Text style={s.actionBtnText}>PLAYBOOK (PDF)</Text></TouchableOpacity>
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
      </Modal>

      {/* STANDARD VIEWS */}
      {view === 'direction' && (<View style={s.centerContent}><TouchableOpacity onPress={() => setView('dashboard')} style={s.backBtn}><Feather name="x" size={24} color={theme.text} /></TouchableOpacity><Text style={s.screenTitle}>MARKET BIAS</Text><TouchableOpacity onPress={() => {setDirection('long'); setView('checklist');}} style={[s.bigBtn, s.borderGreen]}><Feather name="trending-up" size={48} color={theme.tint} /><Text style={[s.bigBtnText, {color: theme.tint}]}>LONG</Text></TouchableOpacity><TouchableOpacity onPress={() => {setDirection('short'); setView('checklist');}} style={[s.bigBtn, s.borderRed]}><Feather name="trending-down" size={48} color={theme.danger} /><Text style={[s.bigBtnText, {color: theme.danger}]}>SHORT</Text></TouchableOpacity></View>)}
      {view === 'checklist' && (<View style={s.centerContent}><TouchableOpacity onPress={() => setView('direction')} style={s.backBtn}><Feather name="arrow-left" size={24} color={theme.text} /></TouchableOpacity><Text style={s.screenTitle}>CONFIRMATION</Text><ScrollView style={s.checklistCard}>{activeStrategy.rules.map((rule: any) => (<TouchableOpacity key={rule.id} onPress={() => setCheckedRules(p => ({...p, [rule.id]: !p[rule.id]}))} style={[s.checkItem, checkedRules[rule.id] ? s.checkItemActive : null]}><Text style={s.checkText}>{rule.text}</Text><View style={[s.checkCircle, checkedRules[rule.id] ? s.checkCircleActive : null]}>{checkedRules[rule.id] && <Feather name="check" size={14} color="#000" />}</View></TouchableOpacity>))}</ScrollView><View style={[s.executeBox, allRulesMet ? s.executeBoxReady : s.executeBoxLocked]}><TouchableOpacity onPress={onExecute} style={{alignItems: 'center', width: '100%'}}><Feather name={allRulesMet ? "shield" : "alert-triangle"} size={32} color={theme.btnText} style={{marginBottom: 8}} /><Text style={[s.executeTitle, !allRulesMet && {color: theme.subText}]}>{allRulesMet ? `EXECUTE ($${activeStrategy.risk})` : "FORCE EXECUTE"}</Text></TouchableOpacity></View></View>)}
      {view === 'active' && (<ScrollView contentContainerStyle={s.scrollContent}><Text style={s.screenTitle}>LIVE TRADES</Text>{strategyActive.map(trade => (<TouchableOpacity key={trade.id} onPress={() => setDetailModal({show: true, trade})} style={s.activeCard}><View style={s.activeHeader}><Text style={s.riskValue}>${trade.risk} RISK</Text><View style={[s.tag, trade.direction === 'LONG' ? s.tagGreen : s.tagRed]}><Text style={[s.tagText, {color: trade.direction === 'LONG' ? '#000' : '#FFF'}]}>{trade.direction}</Text></View></View><View style={s.progressBox}><View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}><Text style={s.label}>REALIZED: <Text style={s.profitValue}>+${trade.realizedProfit.toFixed(2)}</Text></Text><Text style={[s.label, {color: theme.text}]}>{trade.percentClosed}% CLOSED</Text></View><View style={s.progressBarBg}><View style={[s.progressBarFill, { width: `${trade.percentClosed}%` }]} /></View></View><View style={s.grid3}>{[25, 50, 75].map(p => (<TouchableOpacity key={p} onPress={() => openExecModal('PARTIAL', trade.id, p)} style={s.partialBtn}><Text style={s.partialBtnText}>+{p}%</Text></TouchableOpacity>))}</View><View style={{flexDirection: 'row', gap: 10, marginTop: 16}}><TouchableOpacity onPress={() => toggleBreakeven(trade.id)} style={[s.actionBtn, {flex: 1, backgroundColor: trade.isBreakeven ? theme.tint : theme.card, borderWidth: 1, borderColor: trade.isBreakeven ? theme.tint : theme.border}]}><Text style={{color: trade.isBreakeven ? theme.btnText : theme.text, fontWeight: '700'}}>MOVE SL TO BE</Text></TouchableOpacity><TouchableOpacity onPress={() => openExecModal('FULL', trade.id, 100 - trade.percentClosed)} style={[s.actionBtn, {flex: 1}]}><Text style={s.actionBtnText}>CLOSE FULL</Text></TouchableOpacity></View><View style={{flexDirection: 'row', gap: 10, marginTop: 8}}><TouchableOpacity onPress={() => setTagModal({show: true, tradeId: trade.id})} style={[s.actionBtn, {flex:1, borderColor: theme.border, borderWidth: 1, backgroundColor: 'transparent'}]}><Text style={{color: theme.text, fontWeight: '700'}}>TAGS</Text></TouchableOpacity><TouchableOpacity onPress={() => openExecModal('SL', trade.id, 0)} style={[s.actionBtn, {flex:1, borderColor: theme.danger, borderWidth: 2, backgroundColor: 'transparent'}]}><Text style={s.actionBtnTextRed}>{trade.isBreakeven ? "STOPPED AT BE" : "STOP LOSS"}</Text></TouchableOpacity></View></TouchableOpacity>))}{strategyActive.length === 0 && <View style={s.emptyState}><Feather name="crosshair" size={48} color={theme.subText} /><Text style={s.emptyText}>No live positions.</Text><TouchableOpacity onPress={() => setView('direction')} style={s.scanBtn}><Text style={s.scanBtnText}>SCAN MARKET</Text></TouchableOpacity></View>}</ScrollView>)}

      {/* Strategy Switcher */}
      <Modal visible={strategyModal} transparent animationType="fade" onRequestClose={() => setStrategyModal(false)}>
        <TouchableOpacity style={s.modalOverlay} onPress={() => setStrategyModal(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>STRATEGIES</Text>
            {strategies.map((strat: any) => (
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
              {editStrategyModal.strategy.rules.map((rule: any, idx: number) => (
                <View key={rule.id} style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                  <TextInput style={[s.inputField, {flex: 1}]} value={rule.text} onChangeText={t => { const newRules = [...editStrategyModal.strategy.rules]; newRules[idx].text = t; setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: newRules}})); }} />
                  <TouchableOpacity onPress={() => { const newRules = editStrategyModal.strategy.rules.filter((r: any) => r.id !== rule.id); setEditStrategyModal(p => ({...p, strategy: {...p.strategy, rules: newRules}})); }} style={[s.editBtn, {backgroundColor: theme.danger + '22'}]}><Feather name="trash" size={18} color={theme.danger} /></TouchableOpacity>
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

      <View style={s.navBar}>
        <TouchableOpacity onPress={() => setView('dashboard')} style={s.navItem}><Feather name="grid" size={24} color={view === 'dashboard' ? theme.tint : theme.subText} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('active')} style={s.navItem}><View><Feather name="activity" size={24} color={view === 'active' ? theme.tint : theme.subText} />{activeTrades.length > 0 && <View style={s.activeDot} />}</View></TouchableOpacity>
        <TouchableOpacity onPress={() => setView('performance')} style={s.navItem}><Feather name="bar-chart-2" size={24} color={view === 'performance' ? theme.tint : theme.subText} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg, paddingTop: StatusBar.currentHeight },
  scrollContent: { padding: 16, paddingBottom: 100 },
  centerContent: { flex: 1, padding: 16, justifyContent: 'center', paddingBottom: 100 },
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

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

interface TradeListItemProps {
  trade: { id: number; dateStr: string; timeStr: string; direction: string; realizedProfit: number };
  theme: Record<string, string>;
  onPress: () => void;
}

export function TradeListItem({ trade, theme, onPress }: TradeListItemProps) {
  const s = styles(theme);
  return (
    <TouchableOpacity onPress={onPress} style={s.tableRow}>
      <View>
        <Text style={s.tdDate}>{trade.dateStr}</Text>
        <Text style={s.tdTime}>{trade.timeStr}</Text>
      </View>
      <View style={[s.tag, { backgroundColor: theme.border }]}>
        <Text style={[s.tagText, { color: theme.text }]}>{trade.direction[0]}</Text>
      </View>
      <Text style={[s.tdNet, { color: trade.realizedProfit >= 0 ? theme.success : theme.danger }]}>
        {trade.realizedProfit >= 0 ? '+' : ''}${trade.realizedProfit.toFixed(2)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  tableRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'space-between' },
  tdDate: { color: t.text, fontSize: 11, fontWeight: '600' },
  tdTime: { color: t.subText, fontSize: 9, fontWeight: '600' },
  tdNet: { fontSize: 13, fontWeight: '700' },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '600' },
});

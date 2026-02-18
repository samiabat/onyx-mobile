import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  label: string;
  value: string;
  valueColor: string;
  theme: Record<string, string>;
  valueSize?: number;
}

export function StatCard({ label, value, valueColor, theme, valueSize = 24 }: StatCardProps) {
  const s = styles(theme);
  return (
    <View style={s.statCard}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: valueColor, fontSize: valueSize }]}>{value}</Text>
    </View>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  statCard: { flex: 1, backgroundColor: t.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: t.border },
  statLabel: { color: t.subText, fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  statValue: { fontSize: 24, fontWeight: '600', marginTop: 4 },
});

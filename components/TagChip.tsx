import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface TagChipProps {
  tag: string;
  isSelected: boolean;
  theme: Record<string, string>;
  onPress: () => void;
}

export function TagChip({ tag, isSelected, theme, onPress }: TagChipProps) {
  const s = styles(theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.tagChip, isSelected ? { backgroundColor: theme.tint, borderColor: theme.tint } : { borderColor: theme.border }]}
    >
      <Text style={{ color: isSelected ? theme.btnText : theme.text, fontSize: 12, fontWeight: '700' }}>{tag}</Text>
    </TouchableOpacity>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  tagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: t.border, marginRight: 8, marginBottom: 8 },
});

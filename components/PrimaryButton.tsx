import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface PrimaryButtonProps {
  onPress: () => void;
  title: string;
  theme: Record<string, string>;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

export function PrimaryButton({ onPress, title, theme, style, textStyle, children }: PrimaryButtonProps) {
  const s = styles(theme);
  return (
    <TouchableOpacity onPress={onPress} style={[s.actionBtn, style]}>
      {children}
      <Text style={[s.actionBtnText, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  actionBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: t.tint, gap: 8 },
  actionBtnText: { color: t.btnText, fontWeight: '700' },
});

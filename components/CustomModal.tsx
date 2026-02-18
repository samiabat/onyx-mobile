import React from 'react';
import { Modal as RNModal, View, TouchableOpacity, TouchableWithoutFeedback, Text, StyleSheet } from 'react-native';

interface CustomModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  theme: Record<string, string>;
  children: React.ReactNode;
  animationType?: 'fade' | 'slide' | 'none';
  dismissOnOverlay?: boolean;
}

export function CustomModal({ visible, onClose, title, theme, children, animationType = 'fade', dismissOnOverlay = true }: CustomModalProps) {
  const s = styles(theme);
  return (
    <RNModal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      {dismissOnOverlay ? (
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={s.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.modalContent}>
                {title && <Text style={s.modalTitle}>{title}</Text>}
                {children}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      ) : (
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {title && <Text style={s.modalTitle}>{title}</Text>}
            {children}
          </View>
        </View>
      )}
    </RNModal>
  );
}

const styles = (t: Record<string, string>) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: t.overlay, justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: t.card, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: t.border },
  modalTitle: { color: t.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
});

import type { ContentReportReason } from '@vibeshub/contracts';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const reasons: { label: string; value: ContentReportReason }[] = [
  { label: 'Inappropriate content', value: 'inappropriate' },
  { label: 'Misleading recommendation', value: 'misleading' },
  { label: 'Spam', value: 'spam' },
  { label: 'Unsafe product or advice', value: 'unsafe' },
  { label: 'Intellectual property concern', value: 'intellectual_property' },
  { label: 'Something else', value: 'other' },
];

export function ContentReportModal({
  busy,
  onClose,
  onSubmit,
  visible,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: ContentReportReason, details?: string) => void;
  visible: boolean;
}) {
  const [reason, setReason] = useState<ContentReportReason | null>(null);
  const [details, setDetails] = useState('');

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Report content</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onClose}>
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
        </View>
        <Text style={styles.copy}>
          Tell us what is wrong. Reports are reviewed privately and are not shown to the
          creator.
        </Text>
        <View style={styles.reasons}>
          {reasons.map((item) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: reason === item.value }}
              key={item.value}
              onPress={() => setReason(item.value)}
              style={[styles.reason, reason === item.value && styles.reasonSelected]}
            >
              <Text style={styles.reasonText}>{item.label}</Text>
              <Text style={styles.radio}>{reason === item.value ? '●' : '○'}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Additional report details"
          maxLength={500}
          multiline
          onChangeText={setDetails}
          placeholder="Optional details"
          style={styles.details}
          textAlignVertical="top"
          value={details}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!reason || busy}
          onPress={() => reason && onSubmit(reason, details.trim() || undefined)}
          style={[styles.submit, (!reason || busy) && styles.submitDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Send report</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#fbf6ec', flex: 1, padding: 24, paddingTop: 32 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: { color: '#30251f', fontFamily: 'Georgia', fontSize: 30 },
  close: { color: '#7a6b62', fontSize: 16, padding: 8 },
  copy: { color: '#6f625a', fontSize: 15, lineHeight: 22, marginTop: 12 },
  reasons: { gap: 8, marginTop: 20 },
  reason: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2d8cd',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  reasonSelected: { borderColor: '#b77856', borderWidth: 2 },
  reasonText: { color: '#30251f', flex: 1, fontSize: 15 },
  radio: { color: '#b77856', fontSize: 19, marginLeft: 12 },
  details: {
    backgroundColor: '#ffffff',
    borderColor: '#e2d8cd',
    borderRadius: 14,
    borderWidth: 1,
    color: '#30251f',
    fontSize: 15,
    height: 92,
    marginTop: 16,
    padding: 14,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: '#b77856',
    borderRadius: 14,
    marginTop: 18,
    minHeight: 52,
    justifyContent: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

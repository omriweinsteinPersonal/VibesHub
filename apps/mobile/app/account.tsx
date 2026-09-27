import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deleteCurrentAccount } from '../lib/api';
import { getSupabaseClient } from '../lib/supabase';

export default function AccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/login');
        return;
      }
      setEmail(data.session.user.email ?? 'Creator account');
    });
  }, [router]);

  async function signOut() {
    await getSupabaseClient().auth.signOut({ scope: 'local' });
    router.replace('/');
  }

  function confirmDeletion() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your creator profile, storefront, recommendations, videos, discount codes and account access. This cannot be undone.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void performDeletion(),
          style: 'destructive',
          text: 'Delete account',
        },
      ],
    );
  }

  async function performDeletion() {
    setDeleting(true);
    setError('');
    try {
      await deleteCurrentAccount();
      await getSupabaseClient().auth.signOut({ scope: 'local' });
      Alert.alert('Account deleted', 'Your Swavii account and storefront were deleted.', [
        { onPress: () => router.replace('/'), text: 'Done' },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account deletion failed.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>CREATOR ACCOUNT</Text>
        <Text style={styles.title}>Your account</Text>
        <Text style={styles.email}>{email || 'Loading your account…'}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerCopy}>
            Permanently remove your creator account, public storefront and all content
            associated with it.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={deleting}
            onPress={confirmDeletion}
            style={({ pressed }) => [
              styles.deleteButton,
              (deleting || pressed) && styles.deleteButtonDisabled,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color="#9b2c24" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete account</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flexGrow: 1, padding: spacing.lg },
  back: { color: colors.muted, marginBottom: spacing.xl },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2 },
  title: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 44,
    marginTop: spacing.sm,
  },
  email: { color: colors.muted, fontSize: 16, marginTop: spacing.sm },
  signOut: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: 15,
  },
  signOutText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  dangerZone: {
    borderColor: '#dfb4ae',
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  dangerTitle: { color: '#8a3028', fontSize: 20, fontWeight: '700' },
  dangerCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.sm,
  },
  error: {
    backgroundColor: '#fff0ed',
    color: '#8a3028',
    marginTop: spacing.md,
    padding: 12,
  },
  deleteButton: {
    alignItems: 'center',
    borderColor: '#b43a31',
    borderRadius: radii.control,
    borderWidth: 1,
    marginTop: spacing.lg,
    minHeight: 50,
    justifyContent: 'center',
    padding: 14,
  },
  deleteButtonDisabled: { opacity: 0.55 },
  deleteButtonText: { color: '#9b2c24', fontSize: 16, fontWeight: '700' },
});

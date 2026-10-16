import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteCurrentAccount } from '../lib/api';
import { getAppleAccountDeletionAuthorizationCode } from '../lib/auth';
import { isNativeBillingConfigured, restoreNativePurchases } from '../lib/billing';
import {
  clearCreatorStudioBundleCache,
  getCreatorStudioBundle,
} from '../lib/creator-api';
import { getAccountSummary } from '../lib/creator-onboarding';
import { openExternalWebPage } from '../lib/external-browser';
import { getSupabaseClient } from '../lib/supabase';

const webLinks = {
  privacy: 'https://swavii.com/privacy',
  support: 'https://swavii.com/support',
  terms: 'https://swavii.com/terms',
};

export default function AccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [hasCreatorProfile, setHasCreatorProfile] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/login');
        return;
      }
      setEmail(data.session.user.email ?? 'Creator account');
      try {
        const account = await getAccountSummary();
        const isCreator = Boolean(account.creator);
        setHasCreatorProfile(isCreator);
        if (isCreator) void getCreatorStudioBundle().catch(() => undefined);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Account details could not be loaded.',
        );
      }
    });
  }, [router]);

  async function signOut() {
    await getSupabaseClient().auth.signOut({ scope: 'local' });
    clearCreatorStudioBundleCache();
    router.replace('/');
  }

  async function openExternalUrl(url: string) {
    try {
      await openExternalWebPage(url);
    } catch {
      setError('This link could not be opened. Please try again.');
    }
  }

  async function restorePurchases() {
    setRestoring(true);
    setError('');
    try {
      const restored = await restoreNativePurchases();
      Alert.alert(
        restored ? 'Purchases restored' : 'No purchases found',
        restored
          ? 'Your Swavii access has been restored.'
          : 'We could not find an active purchase for this store account.',
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Purchases could not be restored.',
      );
    } finally {
      setRestoring(false);
    }
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
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const providers = session?.user.app_metadata.providers;
      const signedInWithApple = Array.isArray(providers)
        ? providers.includes('apple')
        : session?.user.app_metadata.provider === 'apple';
      const appleAuthorizationCode = signedInWithApple
        ? await getAppleAccountDeletionAuthorizationCode()
        : undefined;
      await deleteCurrentAccount(
        appleAuthorizationCode ? { appleAuthorizationCode } : {},
      );
      await supabase.auth.signOut({ scope: 'local' });
      clearCreatorStudioBundleCache();
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

        {hasCreatorProfile === null ? (
          <View style={styles.section}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : hasCreatorProfile ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Creator tools</Text>
            <Text style={styles.sectionCopy}>
              Manage your storefront, recommendations, links and analytics in the Swavii
              creator studio.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/studio')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Open creator studio</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Finish creator setup</Text>
            <Text style={styles.sectionCopy}>
              Choose your public address and add the details for your storefront.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/creator-apply')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Continue creator setup</Text>
            </Pressable>
          </View>
        )}

        {isNativeBillingConfigured() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Purchases</Text>
            <Text style={styles.sectionCopy}>
              Already subscribed with this Apple ID or Google Play account? Restore your
              access here.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={restoring}
              onPress={() => void restorePurchases()}
              style={styles.secondaryButton}
            >
              {restoring ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.secondaryButtonText}>Restore purchases</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & legal</Text>
          {(
            [
              ['Privacy policy', webLinks.privacy],
              ['Terms of service', webLinks.terms],
              ['Support', webLinks.support],
            ] as const
          ).map(([label, url]) => (
            <Pressable
              accessibilityRole="link"
              key={url}
              onPress={() => void openExternalUrl(url)}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>{label}</Text>
              <Text style={styles.linkArrow}>↗</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <View style={styles.accountManagement}>
          <Text style={styles.accountManagementTitle}>Account management</Text>
          <Pressable
            accessibilityHint="Permanently removes your account and associated data after confirmation"
            accessibilityLabel="Delete account"
            accessibilityRole="button"
            disabled={deleting}
            onPress={confirmDeletion}
            style={({ pressed }) => [
              styles.deleteRow,
              (deleting || pressed) && styles.deleteButtonDisabled,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color="#9b2c24" />
            ) : (
              <>
                <View style={styles.deleteCopy}>
                  <Text style={styles.deleteButtonText}>Delete account</Text>
                  <Text style={styles.deleteHint}>
                    Permanently remove your account and storefront
                  </Text>
                </View>
                <Text accessibilityElementsHidden style={styles.deleteArrow}>
                  ›
                </Text>
              </>
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
  section: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  sectionCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    marginTop: spacing.lg,
    padding: 15,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    marginTop: spacing.lg,
    minHeight: 50,
    justifyContent: 'center',
    padding: 14,
  },
  secondaryButtonText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  linkRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  linkText: { color: colors.ink, fontSize: 16 },
  linkArrow: { color: colors.muted, fontSize: 18 },
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
  accountManagement: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.sm,
  },
  accountManagementTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  error: {
    backgroundColor: '#fff0ed',
    color: '#8a3028',
    marginTop: spacing.md,
    padding: 12,
  },
  deleteRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    minHeight: 54,
    paddingVertical: spacing.sm,
  },
  deleteButtonDisabled: { opacity: 0.55 },
  deleteCopy: { flex: 1 },
  deleteButtonText: { color: '#7e4f49', fontSize: 15, fontWeight: '600' },
  deleteHint: { color: colors.muted, fontSize: 13, marginTop: 3 },
  deleteArrow: { color: colors.muted, fontSize: 22, marginLeft: spacing.md },
});

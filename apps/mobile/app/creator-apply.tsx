import type { CategoryCard, CreatorApplicationInput } from '@vibeshub/contracts';
import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearCreatorStudioBundleCache } from '../lib/creator-api';
import {
  checkCreatorHandle,
  getAccountSummary,
  getCreatorApplication,
  getCreatorCategories,
  isCreatorHandle,
  normalizeCreatorHandle,
  saveAndSubmitCreatorApplication,
  suggestCreatorHandle,
  type CreatorApplication,
} from '../lib/creator-onboarding';
import { getSupabaseClient } from '../lib/supabase';

export default function CreatorApplicationScreen() {
  const router = useRouter();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [bio, setBio] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [followers, setFollowers] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const account = await getAccountSummary();
      if (account.creator) {
        router.replace('/studio');
        return;
      }
      const [loadedCategories, current] = await Promise.all([
        getCreatorCategories(),
        getCreatorApplication(),
      ]);
      setCategories(loadedCategories);
      setApplication(current);
      if (current) {
        setDisplayName(current.displayName ?? '');
        setHandle(current.requestedHandle ?? '');
        setHandleEdited(Boolean(current.requestedHandle));
        setCategoryId(current.primaryCategoryId ?? '');
        setBio(current.bioText ?? '');
        const instagram = current.socialLinks.find(
          (link) => link.platform === 'instagram',
        );
        setInstagramUrl(instagram?.url ?? '');
        setFollowers(instagram?.followerCount?.toString() ?? '');
      }
    } catch (cause) {
      setError(messageFor(cause, 'Could not load creator setup.'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  async function submit() {
    const normalizedHandle = normalizeCreatorHandle(handle);
    const normalizedInstagram = normalizeHttpsUrl(instagramUrl);
    const followerCount = followers.trim() ? Number(followers) : null;
    if (!displayName.trim()) return setError('Add your creator display name.');
    if (!isCreatorHandle(normalizedHandle)) {
      return setError('Use 2–30 lowercase letters, numbers, hyphens or underscores.');
    }
    if (!categoryId) return setError('Choose your main category.');
    if (!bio.trim()) return setError('Add a short bio for your storefront.');
    if (!normalizedInstagram) {
      return setError('Add a valid HTTPS Instagram profile URL.');
    }
    if (followerCount !== null && (!Number.isInteger(followerCount) || followerCount < 0)) {
      return setError('Follower count must be a positive whole number.');
    }

    setSubmitting(true);
    setError('');
    try {
      const available = await checkCreatorHandle(normalizedHandle);
      if (!available && normalizedHandle !== application?.requestedHandle) {
        setError('That storefront address is already taken. Try another one.');
        return;
      }
      const input: CreatorApplicationInput = {
        bioText: bio.trim(),
        displayName: displayName.trim(),
        primaryCategoryId: categoryId,
        requestedHandle: normalizedHandle,
        socialLinks: [
          {
            followerCount,
            platform: 'instagram',
            url: normalizedInstagram,
          },
        ],
      };
      await saveAndSubmitCreatorApplication(input, application);
      clearCreatorStudioBundleCache();
      router.replace('/studio');
    } catch (cause) {
      setError(messageFor(cause, 'Could not create your storefront.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    await getSupabaseClient().auth.signOut({ scope: 'local' });
    router.replace('/login');
  }

  const editable =
    !application || ['draft', 'changes_requested'].includes(application.status);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Preparing your creator setup…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Text style={styles.wordmark}>swavii</Text>
            <Pressable accessibilityRole="button" onPress={() => void signOut()}>
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </View>
          <Text style={styles.eyebrow}>CREATOR SETUP</Text>
          <Text style={styles.title}>Open your storefront</Text>
          <Text style={styles.lede}>
            Tell us about your work. Your public Swavii page will be ready right away.
          </Text>

          {!editable && application ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>Setup is being completed</Text>
              <Text style={styles.statusCopy}>
                Current status: {application.status.replaceAll('_', ' ')}
              </Text>
              <Pressable onPress={() => void load()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Check again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.formCard}>
              <FieldLabel text="Creator display name" />
              <TextInput
                accessibilityLabel="Creator display name"
                autoCapitalize="words"
                editable={!submitting}
                maxLength={100}
                onChangeText={(value) => {
                  setDisplayName(value);
                  if (!handleEdited) setHandle(suggestCreatorHandle(value));
                }}
                placeholder="Your public name"
                style={styles.input}
                value={displayName}
              />

              <FieldLabel text="Storefront address" />
              <View style={styles.handleRow}>
                <Text style={styles.handlePrefix}>swavii.com/</Text>
                <TextInput
                  accessibilityLabel="Storefront handle"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!submitting}
                  maxLength={30}
                  onChangeText={(value) => {
                    setHandleEdited(true);
                    setHandle(normalizeCreatorHandle(value));
                  }}
                  placeholder="your-name"
                  style={styles.handleInput}
                  value={handle}
                />
              </View>
              <Text style={styles.hint}>
                Use letters, numbers, hyphens or underscores. You can change this later.
              </Text>

              <FieldLabel text="Main category" />
              <View style={styles.chipGrid}>
                {categories.map((category) => {
                  const selected = categoryId === category.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={submitting}
                      key={category.id}
                      onPress={() => setCategoryId(category.id)}
                      style={[styles.chip, selected && styles.selectedChip]}
                    >
                      <Text style={[styles.chipText, selected && styles.selectedChipText]}>
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <FieldLabel text="Short bio" />
              <TextInput
                accessibilityLabel="Creator bio"
                editable={!submitting}
                maxLength={1000}
                multiline
                onChangeText={setBio}
                placeholder="What do you create and recommend?"
                style={[styles.input, styles.textArea]}
                textAlignVertical="top"
                value={bio}
              />

              <FieldLabel text="Instagram profile URL" />
              <TextInput
                accessibilityLabel="Instagram profile URL"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
                keyboardType="url"
                onChangeText={setInstagramUrl}
                placeholder="https://instagram.com/yourname"
                style={styles.input}
                value={instagramUrl}
              />

              <FieldLabel optional text="Approximate followers" />
              <TextInput
                accessibilityLabel="Approximate followers"
                editable={!submitting}
                keyboardType="number-pad"
                onChangeText={(value) => setFollowers(value.replace(/\D/g, ''))}
                placeholder="0"
                style={styles.input}
                value={followers}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.buttonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create my storefront</Text>
                )}
              </Pressable>
            </View>
          )}
          {!editable && error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ optional, text }: { optional?: boolean; text: string }) {
  return (
    <Text style={styles.label}>
      {text}
      {optional ? <Text style={styles.optional}> · Optional</Text> : null}
    </Text>
  );
}

function normalizeHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function messageFor(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  loadingText: { color: colors.muted, marginTop: spacing.md },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  wordmark: { color: colors.ink, fontFamily: 'Georgia', fontSize: 28 },
  signOut: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2 },
  title: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 42,
    lineHeight: 47,
    marginTop: spacing.sm,
  },
  lede: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  formCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  optional: { color: colors.muted, fontWeight: '400' },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: { minHeight: 116 },
  handleRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  handlePrefix: { color: colors.muted, fontSize: 16 },
  handleInput: { color: colors.ink, flex: 1, fontSize: 16, paddingVertical: 12 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedChip: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 14 },
  selectedChipText: { color: colors.white, fontWeight: '700' },
  error: {
    backgroundColor: '#fff0ed',
    borderRadius: 12,
    color: '#8a3028',
    lineHeight: 20,
    marginTop: spacing.lg,
    padding: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 54,
    padding: 15,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.65 },
  statusCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  statusTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  statusCopy: { color: colors.muted, marginTop: spacing.sm },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: 14,
  },
  secondaryButtonText: { color: colors.ink, fontWeight: '700' },
});

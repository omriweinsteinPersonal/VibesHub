import type { CategoryCard, CreatorApplicationInput } from '@vibeshub/contracts';
import { colors, radii, spacing } from '@vibeshub/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

type SocialLink = { followerCount?: number | null; platform: string; url: string };
type ImageLayout = 'full-bleed' | 'standard';
const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'website', label: 'Website' },
];
const TOUR_SLIDES = [
  ['Your storefront', 'A home for your profile, links and recommendations.'],
  ['Recommendations', 'Share products, places and ideas your audience will love.'],
  [
    'Your style',
    'Build a page that feels like you and keeps your best content together.',
  ],
  ['You are in control', 'Edit your page whenever you want from your creator studio.'],
] as const;

export default function CreatorApplicationScreen() {
  const router = useRouter();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([
    { platform: 'instagram', url: '' },
  ]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [imageLayout, setImageLayout] = useState<ImageLayout>('full-bleed');
  const [tourSlide, setTourSlide] = useState(0);
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
        setSocialLinks(
          current.socialLinks.length
            ? current.socialLinks.map((link) => ({
                followerCount: link.followerCount,
                platform: link.platform,
                url: link.url,
              }))
            : [{ platform: 'instagram', url: '' }],
        );
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

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to add your profile image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  }
  function updateSocial(index: number, patch: Partial<SocialLink>) {
    setSocialLinks((current) =>
      current.map((link, linkIndex) =>
        linkIndex === index ? { ...link, ...patch } : link,
      ),
    );
  }
  function addSocial() {
    const next = SOCIAL_PLATFORMS.find(
      (platform) => !socialLinks.some((link) => link.platform === platform.id),
    );
    if (next) setSocialLinks((current) => [...current, { platform: next.id, url: '' }]);
  }
  function validateStep() {
    if (step === 0) {
      if (!displayName.trim()) return 'Add your creator display name.';
      if (!isCreatorHandle(normalizeCreatorHandle(handle)))
        return 'Use 2–30 lowercase letters, numbers, hyphens or underscores.';
      if (!categoryId) return 'Choose your main category.';
      if (!bio.trim() || !/[\u0590-\u05ff]/u.test(bio))
        return 'Add a short bio in Hebrew for your storefront.';
    }
    if (step === 2) {
      const instagram = socialLinks.find((link) => link.platform === 'instagram');
      if (!instagram || !normalizeHttpsUrl(instagram.url))
        return 'Add a valid HTTPS Instagram profile URL.';
      if (socialLinks.some((link) => link.url.trim() && !normalizeHttpsUrl(link.url)))
        return 'Check that each social link is a valid HTTPS URL.';
    }
    return '';
  }
  function next() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, 4));
  }
  function back() {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      setStep(step === 2 ? 2 : 0);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const normalizedHandle = normalizeCreatorHandle(handle);
      const available = await checkCreatorHandle(normalizedHandle);
      if (!available && normalizedHandle !== application?.requestedHandle) {
        setError('That storefront address is already taken. Try another one.');
        setStep(0);
        return;
      }
      const input: CreatorApplicationInput = {
        bioText: bio.trim(),
        displayName: displayName.trim(),
        primaryCategoryId: categoryId,
        requestedHandle: normalizedHandle,
        socialLinks: socialLinks
          .filter((link) => link.url.trim())
          .map((link) => ({
            followerCount: link.followerCount ?? null,
            platform: link.platform,
            url: normalizeHttpsUrl(link.url) ?? link.url.trim(),
          })),
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
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  )?.name;
  if (loading)
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>Preparing your creator setup…</Text>
      </SafeAreaView>
    );

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
            <>
              <Text style={styles.eyebrow}>CREATOR SETUP</Text>
              <Text style={styles.title}>
                {step === 4 ? 'Here is your page' : 'Build your Swavii page'}
              </Text>
              <Text style={styles.lede}>
                {step === 4
                  ? 'This is how your storefront will look to your audience.'
                  : 'A short journey to make your creator page feel like you.'}
              </Text>
              <Progress step={step} />
              <View style={styles.formCard}>
                {step === 0 ? (
                  <ProfileStep
                    bio={bio}
                    categories={categories}
                    categoryId={categoryId}
                    displayName={displayName}
                    handle={handle}
                    onBioChange={setBio}
                    onCategoryChange={setCategoryId}
                    onDisplayNameChange={(value) => {
                      setDisplayName(value);
                      if (!handleEdited) setHandle(suggestCreatorHandle(value));
                    }}
                    onHandleChange={(value) => {
                      setHandleEdited(true);
                      setHandle(normalizeCreatorHandle(value));
                    }}
                    submitting={submitting}
                  />
                ) : null}
                {step === 1 ? (
                  <ImageStep
                    avatarUri={avatarUri}
                    imageLayout={imageLayout}
                    onChoose={chooseAvatar}
                    onLayoutChange={setImageLayout}
                  />
                ) : null}
                {step === 2 ? (
                  <SocialStep
                    links={socialLinks}
                    onAdd={addSocial}
                    onChange={updateSocial}
                    submitting={submitting}
                  />
                ) : null}
                {step === 3 ? (
                  <TourStep
                    slide={tourSlide}
                    onNext={() =>
                      setTourSlide((current) =>
                        Math.min(current + 1, TOUR_SLIDES.length - 1),
                      )
                    }
                    onPrevious={() => setTourSlide((current) => Math.max(current - 1, 0))}
                  />
                ) : null}
                {step === 4 ? (
                  <PreviewStep
                    avatar={avatarUri ? { uri: avatarUri } : null}
                    bio={bio}
                    category={selectedCategory}
                    displayName={displayName}
                    imageLayout={imageLayout}
                    links={socialLinks}
                  />
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.actions}>
                  {step > 0 ? (
                    <Pressable
                      disabled={submitting}
                      onPress={back}
                      style={styles.backButton}
                    >
                      <Text style={styles.backButtonText}>Back</Text>
                    </Pressable>
                  ) : null}
                  {step < 4 ? (
                    <Pressable
                      disabled={submitting}
                      onPress={next}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={submitting}
                      onPress={() => void submit()}
                      style={styles.primaryButton}
                    >
                      {submitting ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.primaryButtonText}>Create my storefront</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            </>
          )}
          {!editable && error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <View accessibilityLabel={`Step ${step + 1} of 5`} style={styles.progressRow}>
      {[0, 1, 2, 3, 4].map((item) => (
        <View
          key={item}
          style={[styles.progressDot, item <= step && styles.progressDotActive]}
        />
      ))}
    </View>
  );
}
function ProfileStep({
  bio,
  categories,
  categoryId,
  displayName,
  handle,
  onBioChange,
  onCategoryChange,
  onDisplayNameChange,
  onHandleChange,
  submitting,
}: {
  bio: string;
  categories: CategoryCard[];
  categoryId: string;
  displayName: string;
  handle: string;
  onBioChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onHandleChange: (value: string) => void;
  submitting: boolean;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Tell us about yourself</Text>
      <Text style={styles.sectionCopy}>
        These details will appear on your public storefront.
      </Text>
      <FieldLabel text="Creator display name" />
      <TextInput
        autoCapitalize="words"
        editable={!submitting}
        onChangeText={onDisplayNameChange}
        placeholder="Your public name"
        style={styles.input}
        value={displayName}
      />
      <FieldLabel text="Storefront address" />
      <View style={styles.handleRow}>
        <Text style={styles.handlePrefix}>swavii.com/</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          onChangeText={onHandleChange}
          placeholder="your-name"
          style={styles.handleInput}
          value={handle}
        />
      </View>
      <FieldLabel text="Main category" />
      <View style={styles.chipGrid}>
        {categories.map((category) => {
          const selected = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => onCategoryChange(category.id)}
              style={[styles.chip, selected && styles.selectedChip]}
            >
              <Text style={[styles.chipText, selected && styles.selectedChipText]}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldLabel text="Short bio in Hebrew" />
      <TextInput
        editable={!submitting}
        maxLength={1000}
        multiline
        onChangeText={onBioChange}
        placeholder="מה אתם יוצרים ועל מה אתם ממליצים?"
        style={[styles.input, styles.textArea]}
        textAlignVertical="top"
        value={bio}
      />
    </>
  );
}
function ImageStep({
  avatarUri,
  imageLayout,
  onChoose,
  onLayoutChange,
}: {
  avatarUri: string | null;
  imageLayout: ImageLayout;
  onChoose: () => void;
  onLayoutChange: (value: ImageLayout) => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Add your profile image</Text>
      <Text style={styles.sectionCopy}>
        Choose a photo and how it should sit at the top of your storefront.
      </Text>
      <Pressable onPress={onChoose} style={styles.imagePicker}>
        {avatarUri ? (
          <Image
            contentFit="cover"
            source={{ uri: avatarUri }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.imagePickerPlus}>+</Text>
        )}
        <Text style={styles.imagePickerText}>
          {avatarUri ? 'Change photo' : 'Upload photo'}
        </Text>
      </Pressable>
      <Text style={styles.label}>Image style</Text>
      <View style={styles.layoutRow}>
        {(['full-bleed', 'standard'] as const).map((layout) => (
          <Pressable
            key={layout}
            onPress={() => onLayoutChange(layout)}
            style={[
              styles.layoutCard,
              imageLayout === layout && styles.layoutCardSelected,
            ]}
          >
            <View
              style={[
                styles.layoutMock,
                layout === 'full-bleed' && styles.layoutMockBleed,
              ]}
            />
            <Text style={styles.layoutTitle}>
              {layout === 'full-bleed' ? 'Full bleed' : 'Standard'}
            </Text>
            <Text style={styles.layoutCopy}>
              {layout === 'full-bleed'
                ? 'Image fills the card'
                : 'Image with soft margins'}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
function SocialStep({
  links,
  onAdd,
  onChange,
  submitting,
}: {
  links: SocialLink[];
  onAdd: () => void;
  onChange: (index: number, patch: Partial<SocialLink>) => void;
  submitting: boolean;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Connect your socials</Text>
      <Text style={styles.sectionCopy}>
        Add the places where your audience already follows you. Instagram is required.
      </Text>
      {links.map((link, index) => (
        <View key={`${link.platform}-${index}`} style={styles.socialRow}>
          <Text style={styles.socialLabel}>
            {SOCIAL_PLATFORMS.find((platform) => platform.id === link.platform)?.label ??
              link.platform}
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            keyboardType="url"
            onChangeText={(value) => onChange(index, { url: value })}
            placeholder="https://..."
            style={styles.input}
            value={link.url}
          />
        </View>
      ))}
      {links.length < SOCIAL_PLATFORMS.length ? (
        <Pressable onPress={onAdd} style={styles.addLinkButton}>
          <Text style={styles.addLinkText}>+ Add another link</Text>
        </Pressable>
      ) : null}
    </>
  );
}
function TourStep({
  slide,
  onNext,
  onPrevious,
}: {
  slide: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const [title, copy] = TOUR_SLIDES[slide];
  return (
    <View style={styles.tourWrap}>
      <View style={styles.tourIllustration}>
        <Text style={styles.tourIllustrationText}>{slide + 1}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{copy}</Text>
      <View style={styles.tourControls}>
        <Pressable disabled={slide === 0} onPress={onPrevious} style={styles.tourArrow}>
          <Text style={styles.tourArrowText}>‹</Text>
        </Pressable>
        <Text style={styles.tourCount}>
          {slide + 1} / {TOUR_SLIDES.length}
        </Text>
        <Pressable
          disabled={slide === TOUR_SLIDES.length - 1}
          onPress={onNext}
          style={styles.tourArrow}
        >
          <Text style={styles.tourArrowText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}
function PreviewStep({
  avatar,
  bio,
  category,
  displayName,
  imageLayout,
  links,
}: {
  avatar: { uri: string } | null;
  bio: string;
  category?: string;
  displayName: string;
  imageLayout: ImageLayout;
  links: SocialLink[];
}) {
  const visibleLinks = useMemo(() => links.filter((link) => link.url.trim()), [links]);
  return (
    <View style={styles.previewCard}>
      <View
        style={[
          styles.previewImage,
          imageLayout === 'full-bleed' && styles.previewImageBleed,
        ]}
      >
        {avatar ? (
          <Image contentFit="cover" source={avatar} style={styles.previewImageAsset} />
        ) : (
          <Text style={styles.previewImageFallback}>Your image</Text>
        )}
      </View>
      <View style={styles.previewContent}>
        <Text style={styles.previewName}>{displayName || 'Your name'}</Text>
        <Text style={styles.previewCategory}>{category || 'Your category'}</Text>
        <Text style={styles.previewBio}>{bio || 'Your short bio will appear here.'}</Text>
        <View style={styles.previewLinks}>
          {visibleLinks.map((link) => (
            <View key={link.platform} style={styles.previewLink}>
              <Text style={styles.previewLinkText}>{link.platform}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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
    fontSize: 40,
    lineHeight: 46,
    marginTop: spacing.sm,
  },
  lede: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  progressRow: { flexDirection: 'row', gap: 6, marginTop: spacing.lg },
  progressDot: { backgroundColor: colors.border, borderRadius: 4, flex: 1, height: 5 },
  progressDotActive: { backgroundColor: colors.accent },
  formCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  sectionCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
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
  imagePicker: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  avatarImage: { borderRadius: 60, height: 120, width: 120 },
  imagePickerPlus: {
    color: colors.accent,
    fontSize: 44,
    fontWeight: '300',
    lineHeight: 54,
  },
  imagePickerText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  layoutRow: { flexDirection: 'row', gap: spacing.sm },
  layoutCard: {
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  layoutCardSelected: { borderColor: colors.accent, borderWidth: 2 },
  layoutMock: {
    backgroundColor: '#ead6c5',
    borderRadius: 8,
    height: 70,
    marginBottom: spacing.sm,
    marginHorizontal: 8,
  },
  layoutMockBleed: { marginHorizontal: 0 },
  layoutTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  layoutCopy: { color: colors.muted, fontSize: 11, marginTop: 3 },
  socialRow: { marginTop: spacing.md },
  socialLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  addLinkButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: 13,
  },
  addLinkText: { color: colors.ink, fontWeight: '700' },
  tourWrap: { alignItems: 'center', paddingVertical: spacing.md },
  tourIllustration: {
    alignItems: 'center',
    backgroundColor: '#f5e4d7',
    borderRadius: 80,
    height: 150,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    width: 150,
  },
  tourIllustrationText: { color: colors.accent, fontFamily: 'Georgia', fontSize: 64 },
  tourControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    width: '100%',
  },
  tourArrow: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  tourArrowText: { color: colors.white, fontSize: 32, lineHeight: 36 },
  tourCount: { color: colors.muted, fontSize: 13 },
  previewCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImage: {
    alignItems: 'center',
    backgroundColor: '#ead6c5',
    borderRadius: 12,
    height: 180,
    justifyContent: 'center',
    margin: spacing.sm,
  },
  previewImageBleed: { borderRadius: 0, margin: 0 },
  previewImageAsset: { height: '100%', width: '100%' },
  previewImageFallback: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  previewContent: { padding: spacing.md },
  previewName: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  previewCategory: { color: colors.muted, marginTop: 4 },
  previewBio: { color: colors.ink, lineHeight: 20, marginTop: spacing.md },
  previewLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  previewLink: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  previewLinkText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  error: {
    backgroundColor: '#fff0ed',
    borderRadius: 12,
    color: '#8a3028',
    lineHeight: 20,
    marginTop: spacing.lg,
    padding: 12,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    padding: 15,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  backButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
  },
  backButtonText: { color: colors.ink, fontSize: 16, fontWeight: '700' },
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

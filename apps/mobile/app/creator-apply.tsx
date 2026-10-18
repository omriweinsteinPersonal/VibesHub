import type { CreatorApplicationInput } from '@vibeshub/contracts';
import { colors, radii, spacing } from '@vibeshub/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus } from 'lucide-react-native';
import { Circle, Defs, LinearGradient, Path, Rect, Stop, Svg } from 'react-native-svg';
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
  saveAndSubmitCreatorApplication,
  suggestCreatorHandle,
  type CreatorApplication,
} from '../lib/creator-onboarding';

type ImageLayout = 'full-bleed' | 'central';
type SocialPlatform = NonNullable<
  CreatorApplicationInput['socialLinks']
>[number]['platform'];
type SocialLink = {
  followerCount?: number | null;
  platform: SocialPlatform;
  url: string;
};
const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'apple_music', label: 'Apple Music' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'website', label: 'Website' },
];
const DEFAULT_SOCIAL_LINKS: SocialLink[] = [
  { platform: 'instagram', url: '' },
  { platform: 'tiktok', url: '' },
  { platform: 'apple_music', url: '' },
];
const TOUR_SLIDES = [
  [
    'Add a recommendation',
    'Share a product or place with a photo, a short note and one clear link.',
  ],
  [
    'Add a brand',
    'Keep the brands you work with in one place for your audience to discover.',
  ],
  ['Add media', 'Bring your recommendations to life with photos and short videos.'],
  [
    'Add a place',
    'Turn a favourite location into a recommendation your audience can open in Maps.',
  ],
] as const;

export default function CreatorApplicationScreen() {
  const router = useRouter();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(DEFAULT_SOCIAL_LINKS);
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
      const current = await getCreatorApplication();
      setApplication(current);
      if (current) {
        setDisplayName(current.displayName ?? '');
        setHandle(current.requestedHandle ?? '');
        setHandleEdited(Boolean(current.requestedHandle));
        setBio(current.bioText ?? '');
        setSocialLinks(
          current.socialLinks.length
            ? current.socialLinks.map((link) => ({
                followerCount: link.followerCount,
                platform: link.platform as SocialPlatform,
                url: link.url,
              }))
            : DEFAULT_SOCIAL_LINKS,
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
  function removeSocial(index: number) {
    setSocialLinks((current) => current.filter((_, linkIndex) => linkIndex !== index));
  }
  function validateStep() {
    if (step === 0) {
      if (!displayName.trim()) return 'Add your creator display name.';
      if (!handle.trim()) return 'Add a storefront address.';
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
      const requestedHandle = handle.trim();
      const available = await checkCreatorHandle(requestedHandle);
      if (!available && requestedHandle !== application?.requestedHandle) {
        setError('That storefront address is already taken. Try another one.');
        setStep(0);
        return;
      }
      const input: CreatorApplicationInput = {
        bioText: bio.trim(),
        displayName: displayName.trim(),
        requestedHandle,
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
  const editable =
    !application || ['draft', 'changes_requested'].includes(application.status);
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
                    displayName={displayName}
                    handle={handle}
                    onBioChange={setBio}
                    onDisplayNameChange={(value) => {
                      setDisplayName(value);
                      if (!handleEdited) setHandle(suggestCreatorHandle(value));
                    }}
                    onHandleChange={(value) => {
                      setHandleEdited(true);
                      setHandle(value);
                    }}
                    submitting={submitting}
                  />
                ) : null}
                {step === 1 ? (
                  <ImageStep
                    avatarUri={avatarUri}
                    handle={handle}
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
                    onRemove={removeSocial}
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
  displayName,
  handle,
  onBioChange,
  onDisplayNameChange,
  onHandleChange,
  submitting,
}: {
  bio: string;
  displayName: string;
  handle: string;
  onBioChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onHandleChange: (value: string) => void;
  submitting: boolean;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Tell us about yourself</Text>
      <Text style={styles.sectionCopy}>
        These details will appear on your public link in bio.
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
  handle,
  imageLayout,
  onChoose,
  onLayoutChange,
}: {
  avatarUri: string | null;
  handle: string;
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
      <Pressable
        accessibilityLabel="Upload profile image"
        onPress={onChoose}
        style={styles.imagePicker}
      >
        {avatarUri ? (
          <Image
            contentFit="cover"
            source={{ uri: avatarUri }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <ImagePlus color={colors.accent} size={30} />
          </View>
        )}
      </Pressable>
      <Text style={styles.label}>Image style</Text>
      <View style={styles.layoutRow}>
        {(['full-bleed', 'central'] as const).map((layout) => (
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
                styles.layoutPreview,
                layout === 'full-bleed' && styles.layoutPreviewBleed,
                layout === 'central' && styles.layoutPreviewCentral,
              ]}
            >
              <View
                style={[
                  styles.layoutPreviewHero,
                  layout === 'central' && styles.layoutPreviewHeroCentral,
                ]}
              >
                {avatarUri ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: avatarUri }}
                    style={styles.layoutPreviewImage}
                  />
                ) : null}
                {layout === 'full-bleed' ? (
                  <Svg height="100%" style={StyleSheet.absoluteFill} width="100%">
                    <Defs>
                      <LinearGradient id="fullBleedFade" x1="0" x2="0" y1="0" y2="1">
                        <Stop offset="0" stopColor="#d89573" stopOpacity="0" />
                        <Stop offset="0.78" stopColor="#d89573" stopOpacity="0.32" />
                        <Stop offset="1" stopColor="#d89573" stopOpacity="1" />
                      </LinearGradient>
                    </Defs>
                    <Rect fill="url(#fullBleedFade)" height="100%" width="100%" />
                  </Svg>
                ) : null}
              </View>
              {layout === 'central' ? (
                <View style={styles.layoutPreviewAvatar}>
                  {avatarUri ? (
                    <Image
                      contentFit="cover"
                      source={{ uri: avatarUri }}
                      style={styles.layoutPreviewImage}
                    />
                  ) : null}
                </View>
              ) : null}
              <Text style={styles.layoutPreviewName}>@{handle || 'your_handle'}</Text>
              <Text style={styles.layoutPreviewBio}>Really love sharing finds</Text>
              <View style={styles.layoutPreviewSocials}>
                <SocialPlatformIcon platform="instagram" size={14} />
                <SocialPlatformIcon platform="youtube" size={14} />
                <SocialPlatformIcon platform="apple_music" size={14} />
                <SocialPlatformIcon platform="tiktok" size={14} />
              </View>
              <View style={styles.layoutPreviewTabs}>
                <Text style={styles.layoutPreviewTabActive}>All</Text>
                <Text style={styles.layoutPreviewTab}>Fashion</Text>
                <Text style={styles.layoutPreviewTab}>Sports</Text>
                <Text style={styles.layoutPreviewTab}>Random</Text>
                <Text style={styles.layoutPreviewTab}>Food</Text>
              </View>
            </View>
            <Text style={styles.layoutTitle}>
              {layout === 'full-bleed' ? 'Full bleed' : 'Central'}
            </Text>
            <Text style={styles.layoutCopy}>
              {layout === 'full-bleed'
                ? 'Your image fills the hero area'
                : 'Your image sits centered above the page'}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
function SocialPlatformIcon({
  platform,
  size = 24,
}: {
  platform: SocialPlatform;
  size?: number;
}) {
  if (platform === 'instagram') {
    return (
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Path
          fill="#b84735"
          d="M7.03.084c-1.277.06-2.148.264-2.911.563-.789.308-1.458.72-2.123 1.388-.665.668-1.075 1.337-1.38 2.127-.296.764-.496 1.636-.552 2.914-.056 1.277-.069 1.688-.063 4.947.007 3.258.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123.668.665 1.337 1.074 2.129 1.38.763.295 1.636.496 2.913.552 1.277.056 1.688.069 4.946.063 3.258-.007 3.668-.021 4.948-.081 1.28-.061 2.147-.266 2.91-.564.789-.309 1.458-.72 2.123-1.388.665-.668 1.074-1.338 1.379-2.128.296-.763.497-1.636.552-2.912.056-1.281.069-1.69.063-4.948-.006-3.258-.021-3.667-.082-4.947-.061-1.28-.264-2.149-.563-2.912-.308-.788-.72-1.456-1.388-2.122-.668-.666-1.337-1.075-2.128-1.38C19.074.321 18.202.12 16.924.065 15.647.009 15.236-.005 11.977.001 8.718.008 8.31.022 7.03.084M7.17 21.777c-1.17-.051-1.805-.245-2.229-.408-.56-.216-.96-.477-1.382-.895-.422-.418-.681-.819-.9-1.378-.164-.424-.362-1.059-.417-2.228-.06-1.265-.072-1.644-.079-4.848-.007-3.204.005-3.583.061-4.848.05-1.169.245-1.805.408-2.228.216-.561.476-.96.895-1.382.419-.422.818-.681 1.378-.9.423-.165 1.058-.362 2.227-.417 1.266-.06 1.645-.072 4.848-.079 3.204-.007 3.584.005 4.85.061 1.169.051 1.805.245 2.228.408.561.216.96.475 1.382.895.422.419.682.818.9 1.379.165.422.362 1.056.417 2.226.06 1.266.074 1.645.08 4.848.006 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.806-.408 2.229-.216.56-.476.96-.896 1.381-.419.422-.818.681-1.378.9-.422.165-1.058.362-2.226.417-1.266.06-1.645.072-4.849.079-3.204.007-3.582-.006-4.848-.061M16.953 5.586a1.44 1.44 0 1 0 1.437-1.442 1.44 1.44 0 0 0-1.437 1.442M5.839 12.012c.006 3.403 2.77 6.156 6.173 6.15 3.402-.007 6.157-2.77 6.15-6.174-.006-3.403-2.771-6.156-6.174-6.15-3.403.007-6.156 2.771-6.149 6.174M8 12.008a4 4 0 1 1 4.008 3.992A4 4 0 0 1 8 12.008"
        />
      </Svg>
    );
  }
  if (platform === 'tiktok') {
    return (
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Path
          fill="#102f2c"
          d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
        />
      </Svg>
    );
  }
  if (platform === 'apple_music') {
    return (
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Defs>
          <LinearGradient id="appleMusicGradient" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor="#fa2d55" />
            <Stop offset="1" stopColor="#8c4bff" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#appleMusicGradient)" height="24" rx="6" width="24" />
        <Path
          fill="#fff"
          d="M15.7 6.2v8.4a2.6 2.6 0 1 1-1.1-2.1V8.7l-5.1 1.1v6.2a2.6 2.6 0 1 1-1.1-2.1V8.9c0-.4.3-.8.7-.9l5.7-1.2c.5-.1.9.2.9.7Z"
        />
      </Svg>
    );
  }
  if (platform === 'youtube') {
    return (
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Path
          fill="#ff0033"
          d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
        />
      </Svg>
    );
  }
  if (platform === 'spotify') {
    return (
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Circle cx="12" cy="12" fill="#1db954" r="12" />
        <Path
          fill="#fff"
          d="M17.4 16.2a.9.9 0 0 1-1.2.3c-3.3-2-7.5-2.4-12.4-1.3a.9.9 0 1 1-.4-1.8c5.4-1.2 10-.7 13.7 1.5.4.3.5.9.3 1.3Zm1.5-3.2a1.1 1.1 0 0 1-1.5.4c-3.8-2.3-9.6-3-14.1-1.7a1.1 1.1 0 1 1-.6-2.1c5.1-1.5 11.5-.7 15.9 1.9.5.3.7 1 .3 1.5Zm.1-3.3c-4.6-2.7-12.1-3-16.5-1.7a1.3 1.3 0 0 1-.7-2.5c5.1-1.5 13.7-1.2 18.9 1.9a1.3 1.3 0 0 1-1.7 2.3Z"
        />
      </Svg>
    );
  }
  return <Text style={styles.socialFallbackIcon}>↗</Text>;
}

function SocialStep({
  links,
  onAdd,
  onChange,
  onRemove,
  submitting,
}: {
  links: SocialLink[];
  onAdd: () => void;
  onChange: (index: number, patch: Partial<SocialLink>) => void;
  onRemove: (index: number) => void;
  submitting: boolean;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Connect your socials</Text>
      <Text style={styles.sectionCopy}>
        Add the places where your audience already follows you.
      </Text>
      {links.map((link, index) => (
        <View key={`${link.platform}-${index}`} style={styles.socialCard}>
          <View style={styles.socialCardHeader}>
            <View
              style={[
                styles.socialIconBox,
                link.platform === 'instagram'
                  ? styles.socialIconInstagram
                  : link.platform === 'tiktok'
                    ? styles.socialIconTiktok
                    : link.platform === 'apple_music'
                      ? styles.socialIconAppleMusic
                      : styles.socialIconDefault,
              ]}
            >
              <SocialPlatformIcon platform={link.platform} />
            </View>
            <View style={styles.socialCardCopy}>
              <Text style={styles.socialLabel}>
                {SOCIAL_PLATFORMS.find((platform) => platform.id === link.platform)
                  ?.label ?? link.platform}
              </Text>
              <Text style={styles.socialHint}>Paste your profile link</Text>
            </View>
            <Pressable
              accessibilityLabel={`Remove ${link.platform}`}
              onPress={() => onRemove(index)}
              style={styles.socialRemove}
            >
              <Text style={styles.socialRemoveText}>×</Text>
            </Pressable>
          </View>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            keyboardType="url"
            onChangeText={(value) => onChange(index, { url: value })}
            placeholder={
              link.platform === 'apple_music'
                ? 'music.apple.com/profile/...'
                : 'https://...'
            }
            style={styles.socialInput}
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
        <View style={styles.tourScreen}>
          <View style={styles.tourScreenHeader}>
            <Text style={styles.tourScreenHeaderText}>swavii studio</Text>
            <View style={styles.tourScreenAvatar} />
          </View>
          <View style={styles.tourScreenBody}>
            <View style={styles.tourScreenTitleRow}>
              <Text style={styles.tourScreenTitle}>{TOUR_SLIDES[slide][0]}</Text>
              <Text style={styles.tourScreenPlus}>+</Text>
            </View>
            <View style={styles.tourScreenRows}>
              <View style={styles.tourScreenRow} />
              <View style={styles.tourScreenRow} />
              <View style={styles.tourScreenRow} />
            </View>
          </View>
        </View>
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
  displayName,
  imageLayout,
  links,
}: {
  avatar: { uri: string } | null;
  bio: string;
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
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  wordmark: { color: colors.ink, fontFamily: 'Georgia', fontSize: 28 },
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
    height: 142,
    marginTop: spacing.xl,
    position: 'relative',
    width: 142,
  },
  avatarImage: {
    borderColor: colors.border,
    borderRadius: 71,
    borderWidth: 1,
    height: 142,
    width: 142,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#f2e3d5',
    borderColor: colors.accent,
    borderRadius: 71,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 142,
    justifyContent: 'center',
    width: 142,
  },
  imagePickerBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.white,
    borderRadius: 19,
    borderWidth: 3,
    bottom: -2,
    height: 38,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 38,
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
  layoutPreview: {
    backgroundColor: '#d89573',
    borderColor: colors.border,
    borderRadius: 8,
    height: 112,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  layoutPreviewHero: {
    backgroundColor: '#b98d79',
    height: 72,
    overflow: 'hidden',
  },
  layoutPreviewBleed: { borderColor: colors.accent, borderWidth: 1 },
  layoutPreviewCentral: { backgroundColor: '#d89573' },
  layoutPreviewHeroCentral: { display: 'none' },
  layoutPreviewImage: { height: '100%', width: '100%' },
  layoutPreviewAvatar: {
    backgroundColor: '#d89573',
    borderColor: colors.white,
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    marginTop: 10,
    overflow: 'hidden',
    width: 44,
  },
  layoutPreviewName: {
    color: '#173d38',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 3,
  },
  layoutPreviewBio: { color: '#173d38', fontSize: 7, marginTop: 2 },
  layoutPreviewSocials: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 5,
  },
  layoutPreviewTabs: {
    alignItems: 'center',
    borderColor: 'rgba(23, 61, 56, 0.4)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginHorizontal: 7,
    marginTop: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  layoutPreviewTab: { color: '#173d38', fontSize: 6 },
  layoutPreviewTabActive: {
    backgroundColor: '#f8dfd0',
    borderRadius: 8,
    color: '#173d38',
    fontSize: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  layoutPreviewLines: {
    gap: 4,
    marginLeft: 12,
    marginTop: 12,
    width: '60%',
  },
  layoutPreviewLine: {
    backgroundColor: '#eadfd5',
    borderRadius: 2,
    height: 4,
    width: '100%',
  },
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
  socialCard: {
    backgroundColor: '#fffdf9',
    borderColor: '#eadbd0',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  socialCardHeader: { alignItems: 'center', flexDirection: 'row' },
  socialIconBox: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  socialIconInstagram: { backgroundColor: '#f3c2ae' },
  socialIconTiktok: { backgroundColor: '#dcece5' },
  socialIconAppleMusic: { backgroundColor: '#e8ddf0' },
  socialIconDefault: { backgroundColor: '#f0dfd2' },
  socialCardCopy: { flex: 1, marginLeft: spacing.sm },
  socialLabel: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  socialHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
  socialRemove: {
    alignItems: 'center',
    backgroundColor: '#f7ebe3',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  socialRemoveText: { color: '#9c6b58', fontSize: 19, lineHeight: 21 },
  socialInput: {
    backgroundColor: colors.white,
    borderColor: '#eadbd0',
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 13,
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  socialFallbackIcon: { color: colors.accent, fontSize: 20, fontWeight: '700' },
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
    borderRadius: 18,
    height: 190,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    width: '100%',
  },
  tourScreen: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 13,
    borderWidth: 4,
    overflow: 'hidden',
    width: '84%',
  },
  tourScreenHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  tourScreenHeaderText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
  tourScreenAvatar: {
    backgroundColor: '#e6c6b3',
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  tourScreenBody: { padding: 10 },
  tourScreenTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tourScreenTitle: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  tourScreenPlus: {
    backgroundColor: colors.accent,
    borderRadius: 9,
    color: colors.white,
    fontSize: 15,
    height: 18,
    lineHeight: 18,
    textAlign: 'center',
    width: 18,
  },
  tourScreenRows: { gap: 5, marginTop: 10 },
  tourScreenRow: { backgroundColor: '#f1e3d8', borderRadius: 4, height: 19 },
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

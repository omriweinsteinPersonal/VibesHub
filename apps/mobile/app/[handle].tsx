import type {
  ContentReportReason,
  CreatorStorefront,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContentReportModal } from '../components/content-report-modal';
import {
  ApiError,
  createContentReport,
  getPublicStorefront,
  getStorefrontDiscountCodes,
  getStorefrontRecommendations,
} from '../lib/api';
import {
  getContentSafetyInstallationId,
  getHiddenCreatorIds,
  hideCreator,
  showCreator,
} from '../lib/content-safety';

interface StorefrontData {
  codes: PublicDiscountCode[];
  recommendations: RecommendationCard[];
  storefront: CreatorStorefront;
}

interface ReportTarget {
  targetId: string;
  targetType: 'creator' | 'recommendation';
}

const fallbackTheme = {
  accentColor: '#b77856',
  discountBackground: '#f8f6f2',
  productBackground: '#ffffff',
  profileBackground: '#fbf6ec',
  recommendationsBackground: '#ffffff',
  textColor: '#30251f',
};

export default function PublicStorefrontScreen() {
  const params = useLocalSearchParams<{ handle?: string | string[] }>();
  const router = useRouter();
  const handle = Array.isArray(params.handle) ? params.handle[0] : params.handle;
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [creatorHidden, setCreatorHidden] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const loadStorefront = useCallback(
    async (refresh = false) => {
      if (!handle) {
        setError('This storefront link is incomplete.');
        setLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [storefront, recommendations, codes, hiddenCreatorIds] = await Promise.all([
          getPublicStorefront(handle),
          getStorefrontRecommendations(handle),
          getStorefrontDiscountCodes(handle),
          getHiddenCreatorIds(),
        ]);
        setData({ codes, recommendations, storefront });
        setCreatorHidden(hiddenCreatorIds.has(storefront.id));
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
          setError('This creator storefront could not be found.');
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : 'This storefront could not be loaded.',
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [handle],
  );

  useEffect(() => {
    if (!handle) return;
    let active = true;
    void Promise.all([
      getPublicStorefront(handle),
      getStorefrontRecommendations(handle),
      getStorefrontDiscountCodes(handle),
      getHiddenCreatorIds(),
    ])
      .then(([storefront, recommendations, codes, hiddenCreatorIds]) => {
        if (active) {
          setData({ codes, recommendations, storefront });
          setCreatorHidden(hiddenCreatorIds.has(storefront.id));
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 404) {
          setError('This creator storefront could not be found.');
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : 'This storefront could not be loaded.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handle]);

  const filteredRecommendations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return data?.recommendations ?? [];
    return (data?.recommendations ?? []).filter((recommendation) =>
      [
        recommendation.brandName,
        recommendation.productName,
        recommendation.category.name,
      ].some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [data?.recommendations, query]);

  const confirmHideCreator = useCallback(() => {
    if (!data) return;
    Alert.alert(
      `Hide ${data.storefront.displayName}?`,
      'Their storefront will be removed from creator lists on this device. You can show it again here.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            void hideCreator(data.storefront.id).then(() => setCreatorHidden(true));
          },
          style: 'destructive',
          text: 'Hide creator',
        },
      ],
    );
  }, [data]);

  const restoreCreator = useCallback(() => {
    if (!data) return;
    void showCreator(data.storefront.id).then(() => setCreatorHidden(false));
  }, [data]);

  const submitReport = useCallback(
    async (reason: ContentReportReason, details?: string) => {
      if (!reportTarget) return;
      setReportBusy(true);
      try {
        await createContentReport({
          details,
          installationId: await getContentSafetyInstallationId(),
          reason,
          targetId: reportTarget.targetId,
          targetType: reportTarget.targetType,
        });
        setReportTarget(null);
        Alert.alert('Report received', 'Thank you. We will review this privately.');
      } catch (cause) {
        Alert.alert(
          'Report not sent',
          cause instanceof Error ? cause.message : 'Please try again.',
        );
      } finally {
        setReportBusy(false);
      }
    },
    [reportTarget],
  );

  if (loading) {
    return <StorefrontLoading />;
  }

  if (!data || error) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <StatusBar style="dark" />
        <Text style={styles.logo}>swavii</Text>
        <View style={styles.errorBody}>
          <Text style={styles.errorTitle}>Storefront unavailable</Text>
          <Text style={styles.errorCopy}>{error}</Text>
          <Pressable onPress={() => void loadStorefront()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/creators')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>Browse creators</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (creatorHidden) {
    return (
      <SafeAreaView style={styles.hiddenScreen}>
        <StatusBar style="dark" />
        <Text style={styles.logo}>swavii</Text>
        <View style={styles.hiddenBody}>
          <Text style={styles.errorTitle}>Creator hidden</Text>
          <Text style={styles.errorCopy}>
            {data.storefront.displayName} will not appear in creator lists on this device.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={restoreCreator}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Show creator again</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/creators')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryText}>Browse creators</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const theme = { ...fallbackTheme, ...data.storefront.theme };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.profileBackground }]}
    >
      <StatusBar style="dark" />
      <View style={[styles.storeHeader, { borderBottomColor: theme.textColor + '1f' }]}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <Text style={[styles.back, { color: theme.textColor }]}>‹</Text>
        </Pressable>
        <Text style={[styles.logo, { color: theme.textColor }]}>swavii</Text>
        <Pressable
          accessibilityLabel="Browse creators"
          onPress={() => router.push('/creators')}
        >
          <Text style={[styles.browseLink, { color: theme.textColor }]}>Explore</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ backgroundColor: theme.recommendationsBackground }}
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadStorefront(true)}
            refreshing={refreshing}
            tintColor={theme.accentColor}
          />
        }
      >
        <View style={[styles.profile, { backgroundColor: theme.profileBackground }]}>
          <View style={styles.identityRow}>
            {data.storefront.avatarUrl ? (
              <Image
                accessibilityLabel={`${data.storefront.displayName}'s profile photo`}
                source={{ uri: data.storefront.avatarUrl }}
                style={[styles.avatar, { borderColor: '#ffffff' }]}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={[styles.avatarInitial, { color: theme.accentColor }]}>
                  {data.storefront.displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.identityCopy}>
              <Text style={[styles.creatorName, { color: theme.textColor }]}>
                {data.storefront.displayName}
              </Text>
              <Text style={[styles.creatorMeta, { color: theme.textColor }]}>
                {data.storefront.primaryCategory.name} · @{data.storefront.handle}
              </Text>
            </View>
          </View>
          {data.storefront.bio.value ? (
            <Text
              style={[
                styles.bio,
                {
                  color: theme.textColor,
                  textAlign: data.storefront.bio.direction === 'rtl' ? 'right' : 'left',
                  writingDirection: data.storefront.bio.direction,
                },
              ]}
            >
              {data.storefront.bio.value}
            </Text>
          ) : null}
          {data.storefront.socialLinks.length > 0 ? (
            <View style={styles.socialRow}>
              {data.storefront.socialLinks.map((social) => (
                <Pressable
                  accessibilityLabel={`Open ${social.platform}`}
                  key={social.platform}
                  onPress={() => void openExternalUrl(social.url)}
                  style={[styles.socialButton, { borderColor: theme.textColor + '33' }]}
                >
                  <Text style={[styles.socialText, { color: theme.textColor }]}>
                    {socialLabel(social.platform)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.safetyActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setReportTarget({
                  targetId: data.storefront.id,
                  targetType: 'creator',
                })
              }
              style={[styles.safetyButton, { borderColor: theme.textColor + '33' }]}
            >
              <Text style={[styles.safetyButtonText, { color: theme.textColor }]}>
                Report
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={confirmHideCreator}
              style={[styles.safetyButton, { borderColor: theme.textColor + '33' }]}
            >
              <Text style={[styles.safetyButtonText, { color: theme.textColor }]}>
                Hide creator
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[styles.catalog, { backgroundColor: theme.recommendationsBackground }]}
        >
          <TextInput
            accessibilityLabel="Search this storefront"
            autoCapitalize="none"
            onChangeText={setQuery}
            placeholder="Search this store…"
            placeholderTextColor={theme.textColor + '80'}
            returnKeyType="search"
            style={[
              styles.search,
              { borderColor: theme.textColor + '25', color: theme.textColor },
            ]}
            value={query}
          />

          {data.codes.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>Codes</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.codesRow}
              >
                {data.codes.map((code) => (
                  <Pressable
                    accessibilityHint="Opens the merchant website"
                    accessibilityRole="link"
                    key={code.id}
                    onPress={() => void openExternalUrl(code.merchantUrl)}
                    style={[
                      styles.codeCard,
                      { backgroundColor: theme.discountBackground },
                    ]}
                  >
                    <Text style={[styles.codeMerchant, { color: theme.textColor }]}>
                      {code.merchantName}
                    </Text>
                    <Text style={[styles.codeValue, { color: theme.accentColor }]}>
                      {code.code ?? code.label ?? 'View offer'}
                    </Text>
                    {code.discountPercent ? (
                      <Text style={[styles.codeDetail, { color: theme.textColor }]}>
                        {code.discountPercent}% off
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Recommendations
            </Text>
            <Text style={[styles.resultCount, { color: theme.textColor + '99' }]}>
              {filteredRecommendations.length}{' '}
              {filteredRecommendations.length === 1 ? 'item' : 'items'}
            </Text>
            {filteredRecommendations.length === 0 ? (
              <View style={[styles.emptyState, { borderColor: theme.textColor + '22' }]}>
                <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
                  No matches
                </Text>
                <Text style={[styles.emptyCopy, { color: theme.textColor + '99' }]}>
                  Try another product, brand or category.
                </Text>
              </View>
            ) : (
              filteredRecommendations.map((recommendation) => (
                <ProductCard
                  key={recommendation.id}
                  onReport={() =>
                    setReportTarget({
                      targetId: recommendation.id,
                      targetType: 'recommendation',
                    })
                  }
                  recommendation={recommendation}
                  theme={theme}
                />
              ))
            )}
          </View>
          <Text style={[styles.footer, { color: theme.textColor + '88' }]}>
            Powered by swavii
          </Text>
        </View>
      </ScrollView>
      {reportTarget ? (
        <ContentReportModal
          busy={reportBusy}
          onClose={() => setReportTarget(null)}
          onSubmit={(reason, details) => void submitReport(reason, details)}
          visible
        />
      ) : null}
    </SafeAreaView>
  );
}

function StorefrontLoading() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar style="dark" />
      <Text style={styles.logo}>swavii</Text>
      <View accessibilityRole="progressbar" style={styles.loadingBody}>
        <ActivityIndicator color={fallbackTheme.accentColor} size="large" />
        <Text style={styles.loadingText}>Opening storefront…</Text>
      </View>
    </SafeAreaView>
  );
}

function ProductCard({
  onReport,
  recommendation,
  theme,
}: {
  onReport: () => void;
  recommendation: RecommendationCard;
  theme: typeof fallbackTheme;
}) {
  const hasStory = recommendation.storyClips.length > 0 || recommendation.videoUrl;
  return (
    <View
      style={[
        styles.productCard,
        { backgroundColor: theme.productBackground, borderColor: theme.textColor + '20' },
      ]}
    >
      <View style={[styles.imageStage, { backgroundColor: theme.productBackground }]}>
        <Image
          blurRadius={24}
          source={{ uri: recommendation.imageUrl }}
          style={styles.imageBackdrop}
        />
        <View style={styles.imageVeil} />
        <Image
          accessibilityLabel={recommendation.productName}
          resizeMode="contain"
          source={{ uri: recommendation.imageUrl }}
          style={styles.productImage}
        />
        {hasStory ? (
          <View style={styles.storyBadge}>
            <Text style={styles.storyBadgeText}>Video</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.productBody}>
        <Text style={[styles.brand, { color: theme.accentColor }]}>
          {recommendation.brandName.toUpperCase()}
        </Text>
        <Text style={[styles.productName, { color: theme.textColor }]}>
          {recommendation.productName}
        </Text>
        <Text style={[styles.price, { color: theme.textColor }]}>
          {formatPrice(recommendation.price.amountMinor)}
        </Text>
        <Text
          style={[
            styles.review,
            {
              color: theme.textColor + 'cc',
              textAlign: recommendation.review.direction === 'rtl' ? 'right' : 'left',
              writingDirection: recommendation.review.direction,
            },
          ]}
        >
          {recommendation.review.value}
        </Text>
        {recommendation.discount ? (
          <View style={[styles.offerMeta, { backgroundColor: theme.discountBackground }]}>
            <View style={styles.offerMetaMain}>
              {recommendation.discount.code ? (
                <>
                  <Text style={[styles.inlineCodeLabel, { color: theme.textColor }]}>
                    Code
                  </Text>
                  <Text style={[styles.inlineCodeValue, { color: theme.accentColor }]}>
                    {recommendation.discount.code}
                  </Text>
                </>
              ) : null}
              {recommendation.discount.label ? (
                <Text style={[styles.offerLabel, { color: theme.textColor }]}>
                  {recommendation.discount.label}
                </Text>
              ) : null}
            </View>
            {recommendation.discount.expiresAt ? (
              <Text style={[styles.offerExpiry, { color: theme.textColor + 'cc' }]}>
                Ends {formatDiscountDate(recommendation.discount.expiresAt)}
              </Text>
            ) : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="link"
          onPress={() => void openExternalUrl(recommendation.shopUrl)}
          style={[styles.shopButton, { backgroundColor: theme.accentColor }]}
        >
          <Text style={styles.shopButtonText}>View product</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Report ${recommendation.productName}`}
          accessibilityRole="button"
          onPress={onReport}
          style={styles.reportProductButton}
        >
          <Text style={[styles.reportProductText, { color: theme.textColor }]}>
            Report recommendation
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

async function openExternalUrl(url: string) {
  await Linking.openURL(url);
}

function formatPrice(amountMinor: number): string {
  return new Intl.NumberFormat('he-IL', {
    currency: 'ILS',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(amountMinor / 100);
}

function formatDiscountDate(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function socialLabel(platform: CreatorStorefront['socialLinks'][number]['platform']) {
  const labels = {
    facebook: 'f',
    instagram: 'IG',
    linkedin: 'in',
    pinterest: 'P',
    tiktok: 'TT',
    website: '↗',
    x: 'X',
    youtube: 'YT',
  } as const;
  return labels[platform];
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingScreen: { backgroundColor: '#fbf6ec', flex: 1, paddingTop: 14 },
  loadingBody: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  loadingText: { color: '#766b64', fontSize: 15, marginTop: 14 },
  errorScreen: { backgroundColor: '#fbf9f6', flex: 1, padding: 22 },
  hiddenScreen: { backgroundColor: '#fbf9f6', flex: 1, padding: 22 },
  hiddenBody: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  errorBody: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  errorTitle: { color: '#30251f', fontFamily: 'Georgia', fontSize: 30 },
  errorCopy: {
    color: '#766b64',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#b77856',
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  retryText: { color: '#ffffff', fontWeight: '700' },
  secondaryButton: { marginTop: 16, padding: 8 },
  secondaryText: { color: '#30251f', textDecorationLine: 'underline' },
  storeHeader: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  logo: { color: '#30251f', fontFamily: 'Georgia', fontSize: 29 },
  back: { fontSize: 38, lineHeight: 40, width: 54 },
  browseLink: { fontSize: 13, fontWeight: '600', marginLeft: 'auto', padding: 10 },
  profile: { padding: 24, paddingBottom: 28 },
  identityRow: { alignItems: 'center', flexDirection: 'row' },
  avatar: { borderRadius: 42, borderWidth: 3, height: 84, width: 84 },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#f0e4da',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'Georgia', fontSize: 32 },
  identityCopy: { flex: 1, marginLeft: 18 },
  creatorName: { fontFamily: 'Georgia', fontSize: 31, letterSpacing: -1, lineHeight: 35 },
  creatorMeta: { fontSize: 14, marginTop: 7, opacity: 0.78 },
  bio: { fontSize: 15, lineHeight: 23, marginTop: 18 },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  socialButton: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  socialText: { fontSize: 12, fontWeight: '700' },
  safetyActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  safetyButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  safetyButtonText: { fontSize: 12, fontWeight: '600' },
  catalog: { minHeight: 500, padding: 18, paddingBottom: 40 },
  search: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  section: { marginTop: 26 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: 29 },
  resultCount: { fontSize: 12, marginTop: 4 },
  codesRow: { gap: 10, paddingRight: 18, paddingTop: 12 },
  codeCard: { borderRadius: 18, minWidth: 156, padding: 15 },
  codeMerchant: { fontSize: 12, opacity: 0.7 },
  codeValue: { fontSize: 20, fontWeight: '800', marginTop: 7 },
  codeDetail: { fontSize: 12, marginTop: 4 },
  emptyState: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
    padding: 26,
  },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 22 },
  emptyCopy: { fontSize: 13, marginTop: 7, textAlign: 'center' },
  productCard: { borderRadius: 24, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  imageStage: { aspectRatio: 1.12, overflow: 'hidden', position: 'relative' },
  imageBackdrop: {
    bottom: 0,
    left: 0,
    opacity: 0.28,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  imageVeil: {
    backgroundColor: 'rgba(255,255,255,0.62)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  productImage: {
    bottom: 18,
    left: 18,
    position: 'absolute',
    right: 18,
    top: 18,
  },
  storyBadge: {
    backgroundColor: 'rgba(48,37,31,0.86)',
    borderRadius: 999,
    left: 13,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: 'absolute',
    top: 13,
  },
  storyBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  productBody: { padding: 18 },
  brand: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6 },
  productName: { fontFamily: 'Georgia', fontSize: 26, marginTop: 7 },
  price: { fontSize: 17, fontWeight: '600', marginTop: 7 },
  review: { fontSize: 15, lineHeight: 24, marginTop: 13 },
  inlineCode: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 12,
  },
  inlineCodeLabel: { fontSize: 12 },
  inlineCodeValue: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  offerMeta: {
    borderRadius: 12,
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  offerMetaMain: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offerLabel: { fontSize: 13 },
  offerExpiry: { fontSize: 12 },
  shopButton: {
    alignItems: 'center',
    borderRadius: 999,
    marginTop: 16,
    paddingVertical: 14,
  },
  shopButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  reportProductButton: { alignItems: 'center', marginTop: 10, paddingVertical: 8 },
  reportProductText: { fontSize: 12, opacity: 0.65, textDecorationLine: 'underline' },
  footer: { fontSize: 12, marginTop: 34, textAlign: 'center' },
});

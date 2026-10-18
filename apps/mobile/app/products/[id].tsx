import type { PublicRecommendationDetail } from '@vibeshub/contracts';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as NativeImage,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  getPublicRecommendation,
  readCachedPublicRecommendation,
} from '../../lib/api';
import { openExternalWebPage } from '../../lib/external-browser';

const palette = {
  accent: '#b77856',
  background: '#fbf9f6',
  border: '#e5ddd4',
  ink: '#30251f',
  muted: '#766b64',
  white: '#ffffff',
};

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [initialRecommendation] = useState(() =>
    id ? readCachedPublicRecommendation(id) : null,
  );
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!initialRecommendation);
  const [recommendation, setRecommendation] = useState<PublicRecommendationDetail | null>(
    initialRecommendation,
  );

  const load = useCallback(async () => {
    if (!id) {
      setError('This product link is incomplete.');
      setLoading(false);
      return;
    }
    setError('');
    if (!initialRecommendation) setLoading(true);
    try {
      setRecommendation(await getPublicRecommendation(id));
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 404
          ? 'This recommendation is no longer available.'
          : 'This recommendation could not be loaded. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [id, initialRecommendation]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const images = useMemo(() => {
    if (!recommendation) return [];
    return recommendation.images?.length
      ? recommendation.images.map(({ url }) => url)
      : recommendation.imageUrl
        ? [recommendation.imageUrl]
        : [];
  }, [recommendation]);
  const shownImage = images[activeImage] ?? images[0];

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator color={palette.accent} size="large" />
        <Text style={styles.statusText}>Opening recommendation…</Text>
      </SafeAreaView>
    );
  }

  if (!recommendation || error) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Recommendation unavailable</Text>
        <Text style={styles.statusText}>{error}</Text>
        <Pressable onPress={() => void load()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/creators')} style={styles.textButton}>
          <Text style={styles.textButtonLabel}>Browse creators</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to creator storefront"
          onPress={() =>
            router.replace({
              pathname: '/[handle]',
              params: { handle: recommendation.creator.handle },
            })
          }
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.logo}>swavii</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mediaStage}>
          {shownImage ? (
            <>
              <NativeImage
                blurRadius={24}
                source={{ uri: shownImage }}
                style={styles.backdrop}
              />
              <View style={styles.imageVeil} />
              <Image
                accessibilityLabel={`${recommendation.productName}, photo ${activeImage + 1}`}
                cachePolicy="memory-disk"
                contentFit="contain"
                source={shownImage}
                style={styles.image}
                transition={180}
              />
            </>
          ) : (
            <Text style={styles.noImage}>No product image</Text>
          )}
        </View>
        {images.length > 1 ? (
          <ScrollView
            contentContainerStyle={styles.thumbnails}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {images.map((url, index) => (
              <Pressable
                accessibilityLabel={`View photo ${index + 1}`}
                accessibilityState={{ selected: activeImage === index }}
                key={`${url}:${index}`}
                onPress={() => setActiveImage(index)}
                style={[
                  styles.thumbnail,
                  activeImage === index && styles.thumbnailSelected,
                ]}
              >
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={url}
                  style={styles.thumbnailImage}
                  transition={120}
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.brand}>{recommendation.brandName.toUpperCase()}</Text>
        <Text
          style={[
            styles.title,
            recommendation.review.direction === 'rtl' && styles.rightAligned,
          ]}
        >
          {recommendation.productName}
        </Text>
        {recommendation.price.amountMinor > 0 ? (
          <Text style={styles.price}>
            {formatPrice(recommendation.price.amountMinor)}
          </Text>
        ) : null}

        {recommendation.discount ? (
          <View style={styles.offer}>
            <Text style={styles.offerEyebrow}>
              {recommendation.discount.code ? 'DISCOUNT CODE' : 'OFFER'}
            </Text>
            {recommendation.discount.code ? (
              <Text selectable style={styles.offerCode}>
                {recommendation.discount.code}
              </Text>
            ) : null}
            {recommendation.discount.label ? (
              <Text style={styles.offerLabel}>{recommendation.discount.label}</Text>
            ) : null}
            {recommendation.discount.expiresAt ? (
              <Text style={styles.offerExpiry}>
                Expires {formatDate(recommendation.discount.expiresAt)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityHint="Opens the merchant website in your browser"
          accessibilityRole="link"
          onPress={() => void openExternalWebPage(recommendation.shopUrl)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Shop product</Text>
        </Pressable>

        {recommendation.review.value !== 'לא צורפה ביקורת' ? (
          <View style={styles.description}>
            <Text style={styles.sectionTitle}>About this product</Text>
            <Text
              style={[
                styles.descriptionText,
                recommendation.review.direction === 'rtl' && styles.rightAligned,
              ]}
            >
              {recommendation.review.value}
            </Text>
          </View>
        ) : null}

        {recommendation.instagramStoryUrl ? (
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              void openExternalWebPage(recommendation.instagramStoryUrl as string)
            }
            style={styles.storyButton}
          >
            <Text style={styles.storyButtonLabel}>View creator story on Instagram</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatPrice(amountMinor: number): string {
  return new Intl.NumberFormat('he-IL', {
    currency: 'ILS',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    style: 'currency',
  }).format(amountMinor / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.background, flex: 1 },
  centered: {
    alignItems: 'center',
    backgroundColor: palette.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  statusText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    textAlign: 'center',
  },
  errorTitle: { color: palette.ink, fontFamily: 'Georgia', fontSize: 30 },
  header: {
    alignItems: 'center',
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  back: { color: palette.ink, fontSize: 38, lineHeight: 40 },
  logo: { color: palette.ink, fontFamily: 'Georgia', fontSize: 27 },
  headerSpacer: { width: 24 },
  content: { padding: 18, paddingBottom: 46 },
  mediaStage: {
    alignItems: 'center',
    aspectRatio: 1,
    backgroundColor: palette.white,
    borderRadius: 26,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    height: '100%',
    opacity: 0.2,
    width: '100%',
  },
  imageVeil: { ...StyleSheet.absoluteFill, backgroundColor: '#ffffffb8' },
  image: { height: '88%', width: '88%' },
  noImage: { color: palette.muted },
  thumbnails: { gap: 10, paddingVertical: 14 },
  thumbnail: {
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 64,
    overflow: 'hidden',
    width: 64,
  },
  thumbnailSelected: { borderColor: palette.accent, borderWidth: 2 },
  thumbnailImage: { height: '100%', width: '100%' },
  brand: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: 12,
  },
  title: { color: palette.ink, fontFamily: 'Georgia', fontSize: 34, marginTop: 8 },
  rightAligned: { textAlign: 'right', writingDirection: 'rtl' },
  price: { color: palette.ink, fontSize: 19, fontWeight: '700', marginTop: 10 },
  offer: {
    backgroundColor: '#f3ece5',
    borderRadius: 18,
    marginTop: 18,
    padding: 18,
  },
  offerEyebrow: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  offerCode: { color: palette.accent, fontSize: 25, fontWeight: '800', marginTop: 8 },
  offerLabel: { color: palette.ink, fontSize: 16, marginTop: 7 },
  offerExpiry: { color: palette.muted, fontSize: 13, marginTop: 7 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
  primaryButtonText: { color: palette.white, fontSize: 16, fontWeight: '700' },
  textButton: { marginTop: 16, padding: 8 },
  textButtonLabel: { color: palette.ink, textDecorationLine: 'underline' },
  description: {
    borderTopColor: palette.border,
    borderTopWidth: 1,
    marginTop: 28,
    paddingTop: 22,
  },
  sectionTitle: { color: palette.ink, fontFamily: 'Georgia', fontSize: 24 },
  descriptionText: { color: palette.ink, fontSize: 16, lineHeight: 25, marginTop: 10 },
  storyButton: {
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  storyButtonLabel: { color: palette.ink, fontSize: 15, fontWeight: '700' },
});

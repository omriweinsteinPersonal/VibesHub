import type { CreatorStorefront, RecommendationCard } from '@vibeshub/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPublicStorefront, getStorefrontRecommendations } from '../../../lib/api';

interface PageData {
  recommendations: RecommendationCard[];
  storefront: CreatorStorefront;
}

export default function StorefrontCollectionScreen() {
  const params = useLocalSearchParams<{
    handle?: string | string[];
    pageId?: string | string[];
  }>();
  const router = useRouter();
  const handle = first(params.handle);
  const pageId = first(params.pageId);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!handle || !pageId) {
      setError('This collection link is incomplete.');
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const [storefront, recommendations] = await Promise.all([
        getPublicStorefront(handle),
        getStorefrontRecommendations(handle),
      ]);
      setData({ recommendations, storefront });
    } catch {
      setError('This collection could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [handle, pageId]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const page = data?.storefront.curatedSections.find(
    (section) =>
      section.id === pageId && (section.kind === 'page' || section.kind === 'collection'),
  );
  const recommendations = useMemo(() => {
    if (!data || !page) return [];
    const byId = new Map(data.recommendations.map((item) => [item.id, item]));
    return page.recommendationIds.flatMap((id) => byId.get(id) ?? []);
  }, [data, page]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator color="#b77856" size="large" />
        <Text style={styles.statusText}>Opening collection…</Text>
      </SafeAreaView>
    );
  }

  if (!data || !page || error) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Collection unavailable</Text>
        <Text style={styles.statusText}>
          {error || 'This collection is no longer available.'}
        </Text>
        <Pressable onPress={() => void load()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
        {handle ? (
          <Pressable
            onPress={() => router.replace({ pathname: '/[handle]', params: { handle } })}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>Back to storefront</Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    );
  }

  const collection = data.storefront.curatedSections.find(
    (section) => section.id === page.parentCollectionId,
  );
  const theme = data.storefront.theme;

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: theme.recommendationsBackground }]}
    >
      <StatusBar style="dark" />
      <View style={[styles.header, { borderBottomColor: theme.textColor + '20' }]}>
        <Pressable
          accessibilityLabel="Back to storefront"
          onPress={() =>
            router.replace({
              pathname: '/[handle]',
              params: { handle: data.storefront.handle },
            })
          }
        >
          <Text style={[styles.back, { color: theme.textColor }]}>‹</Text>
        </Pressable>
        <Text style={[styles.logo, { color: theme.textColor }]}>swavii</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {collection ? (
          <Text style={[styles.eyebrow, { color: theme.accentColor }]}>
            {collection.title.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: theme.textColor }]}>{page.title}</Text>
        {page.description ? (
          <Text style={[styles.description, { color: theme.textColor + 'bb' }]}>
            {page.description}
          </Text>
        ) : null}

        {recommendations.length ? (
          recommendations.map((recommendation) => (
            <Pressable
              accessibilityRole="button"
              key={recommendation.id}
              onPress={() =>
                router.push({
                  pathname: '/products/[id]',
                  params: { id: recommendation.id },
                })
              }
              style={[
                styles.card,
                {
                  backgroundColor: theme.productBackground,
                  borderColor: theme.textColor + '20',
                },
              ]}
            >
              <View style={styles.imageStage}>
                <Image
                  accessibilityLabel={recommendation.productName}
                  resizeMode="contain"
                  source={{ uri: recommendation.imageUrl }}
                  style={styles.image}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.brand, { color: theme.accentColor }]}>
                  {recommendation.brandName.toUpperCase()}
                </Text>
                <Text style={[styles.productName, { color: theme.textColor }]}>
                  {recommendation.productName}
                </Text>
                <Text style={[styles.detailsLink, { color: theme.accentColor }]}>
                  View details
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={[styles.empty, { borderColor: theme.textColor + '20' }]}>
            <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
              No items yet
            </Text>
            <Text style={[styles.statusText, { color: theme.textColor + '99' }]}>
              This creator has not added products to this collection yet.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: {
    alignItems: 'center',
    backgroundColor: '#fbf9f6',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  statusText: {
    color: '#766b64',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  errorTitle: { color: '#30251f', fontFamily: 'Georgia', fontSize: 30 },
  primaryButton: {
    backgroundColor: '#b77856',
    borderRadius: 999,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  textButton: { marginTop: 15, padding: 8 },
  textButtonLabel: { color: '#30251f', textDecorationLine: 'underline' },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 18,
  },
  back: { fontSize: 38, lineHeight: 40 },
  logo: { fontFamily: 'Georgia', fontSize: 27 },
  headerSpacer: { width: 24 },
  content: { padding: 18, paddingBottom: 48 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontFamily: 'Georgia', fontSize: 35, marginTop: 7 },
  description: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  card: { borderRadius: 22, borderWidth: 1, marginTop: 18, overflow: 'hidden' },
  imageStage: { aspectRatio: 1.35, backgroundColor: '#ffffff', padding: 14 },
  image: { height: '100%', width: '100%' },
  cardBody: { padding: 17 },
  brand: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  productName: { fontFamily: 'Georgia', fontSize: 25, marginTop: 6 },
  detailsLink: { fontSize: 15, fontWeight: '700', marginTop: 14 },
  empty: { borderRadius: 20, borderWidth: 1, marginTop: 20, padding: 22 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 24 },
});

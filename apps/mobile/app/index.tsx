import type { CreatorCard } from '@vibeshub/contracts';
import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getSupabaseClient } from '../lib/supabase';
import { getCreators } from '../lib/api';
import { useHiddenCreatorIds } from '../hooks/use-hidden-creator-ids';

const categories = ['Fashion', 'Beauty', 'Skincare', 'Food', 'Fitness', 'Lifestyle'];

export default function HomeScreen() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [featuredCreators, setFeaturedCreators] = useState<CreatorCard[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const hiddenCreatorIds = useHiddenCreatorIds();
  const visibleFeaturedCreators = featuredCreators.filter(
    (creator) => !hiddenCreatorIds.has(creator.id),
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    void supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    void getCreators()
      .then((creators) => {
        if (active) setFeaturedCreators(creators.slice(0, 3));
      })
      .catch(() => {
        // The directory remains available through the primary action and owns its
        // detailed retry state. Keep the home page calm if this preview fails.
      })
      .finally(() => {
        if (active) setCreatorsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>swavii</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(signedIn ? '/account' : '/login')}
            style={styles.profileButton}
          >
            <Text style={styles.profileButtonText}>
              {signedIn ? 'Account' : 'For creators'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>CREATOR RECOMMENDATIONS</Text>
        <Text style={styles.title}>Discover what your favorite creators recommend</Text>
        <Text style={styles.subtitle}>
          Authentic recommendations, exclusive discounts and products loved by Israeli
          creators.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/creators')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Explore creators</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((category) => (
            <View key={category} style={styles.categoryPill}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionEyebrow}>FEATURED STOREFRONTS</Text>
        <Text style={styles.sectionTitle}>Start with a creator</Text>
        {creatorsLoading ? (
          <View accessibilityRole="progressbar" style={styles.previewLoading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.previewLoadingText}>Finding creators…</Text>
          </View>
        ) : visibleFeaturedCreators.length > 0 ? (
          <View style={styles.creatorList}>
            {visibleFeaturedCreators.map((creator) => (
              <Pressable
                accessibilityHint="Opens this creator's public storefront"
                accessibilityRole="button"
                key={creator.id}
                onPress={() =>
                  router.push({
                    pathname: '/[handle]',
                    params: { handle: creator.handle },
                  })
                }
                style={({ pressed }) => [
                  styles.creatorCard,
                  pressed && styles.creatorCardPressed,
                ]}
              >
                {creator.avatarUrl ? (
                  <Image source={{ uri: creator.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>
                      {creator.displayName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.creatorCardCopy}>
                  <Text style={styles.creatorName}>{creator.displayName}</Text>
                  <Text style={styles.creatorMeta}>
                    @{creator.handle} · {creator.recommendationCount}{' '}
                    {creator.recommendationCount === 1
                      ? 'recommendation'
                      : 'recommendations'}
                  </Text>
                </View>
                <Text accessibilityElementsHidden style={styles.chevron}>
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>
              Published creator storefronts will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  logo: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 32,
  },
  profileButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    marginLeft: 'auto',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileButtonText: { color: colors.ink, fontWeight: '600' },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  title: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 46,
    letterSpacing: -2,
    lineHeight: 49,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 27,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: 15,
  },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  categories: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  categoryPill: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  categoryText: { color: colors.muted },
  sectionEyebrow: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginHorizontal: spacing.lg,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 32,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  creatorList: {
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  creatorCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.md,
  },
  creatorCardPressed: { opacity: 0.72 },
  avatar: { borderRadius: 28, height: 56, width: 56 },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.accent, fontFamily: 'Georgia', fontSize: 24 },
  creatorCardCopy: { flex: 1, marginLeft: spacing.md },
  creatorName: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21 },
  creatorMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  chevron: { color: colors.muted, fontSize: 30, marginLeft: spacing.sm },
  previewLoading: {
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
  },
  previewLoadingText: { color: colors.muted, marginTop: spacing.sm },
  emptyPreview: {
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  emptyPreviewText: {
    color: colors.muted,
    lineHeight: 22,
    textAlign: 'center',
  },
});

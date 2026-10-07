import type { CreatorCard } from '@vibeshub/contracts';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCreators } from '../lib/api';
import { useHiddenCreatorIds } from '../hooks/use-hidden-creator-ids';

const palette = {
  accent: '#b77856',
  background: '#fbf9f6',
  border: '#e5ddd4',
  ink: '#30251f',
  muted: '#766b64',
  white: '#ffffff',
};

export default function CreatorsScreen() {
  const router = useRouter();
  const [creators, setCreators] = useState<CreatorCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hiddenCreatorIds = useHiddenCreatorIds();
  const visibleCreators = creators.filter((creator) => !hiddenCreatorIds.has(creator.id));

  const loadCreators = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setCreators(await getCreators());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Creators could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getCreators()
      .then((nextCreators) => {
        if (active) setCreators(nextCreators);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Creators could not be loaded.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.logo}>swavii</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View accessibilityRole="progressbar" style={styles.centered}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.statusText}>Finding creators…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>We couldn&apos;t load creators</Text>
          <Text style={styles.statusText}>{error}</Text>
          <Pressable onPress={() => void loadCreators()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={() => void loadCreators(true)}
              refreshing={refreshing}
              tintColor={palette.accent}
            />
          }
        >
          <Text style={styles.eyebrow}>THE COMMUNITY</Text>
          <Text style={styles.title}>Creators on swavii</Text>
          <Text style={styles.intro}>
            Open a creator&apos;s storefront to explore their recommendations and codes.
          </Text>
          {visibleCreators.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.errorTitle}>No published creators yet</Text>
              <Text style={styles.statusText}>Come back soon.</Text>
            </View>
          ) : (
            visibleCreators.map((creator) => (
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
                style={({ pressed }) => [styles.creatorCard, pressed && styles.pressed]}
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
                <View style={styles.creatorCopy}>
                  <Text style={styles.creatorName}>{creator.displayName}</Text>
                  <Text style={styles.creatorMeta}>
                    @{creator.handle} · {creator.primaryCategory.name}
                  </Text>
                  <Text numberOfLines={2} style={styles.creatorBio}>
                    {creator.bio.value ||
                      `${creator.recommendationCount} recommendations`}
                  </Text>
                </View>
                <Text accessibilityElementsHidden style={styles.chevron}>
                  ›
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.background, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: palette.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 20,
  },
  back: { color: palette.ink, fontSize: 38, lineHeight: 40, width: 42 },
  logo: { color: palette.ink, fontFamily: 'Georgia', fontSize: 28 },
  headerSpacer: { width: 42 },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  statusText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
  },
  errorTitle: { color: palette.ink, fontFamily: 'Georgia', fontSize: 25 },
  retryButton: {
    backgroundColor: palette.accent,
    borderRadius: 999,
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: { color: palette.white, fontWeight: '700' },
  content: { gap: 14, padding: 22, paddingBottom: 42 },
  eyebrow: { color: palette.accent, fontSize: 11, letterSpacing: 2, marginTop: 12 },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 40,
    letterSpacing: -1.4,
    lineHeight: 44,
  },
  intro: { color: palette.muted, fontSize: 16, lineHeight: 24, marginBottom: 10 },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 22,
    borderWidth: 1,
    padding: 28,
  },
  creatorCard: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 15,
  },
  pressed: { opacity: 0.72 },
  avatar: { borderRadius: 31, height: 62, width: 62 },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: '#f0e4da',
    justifyContent: 'center',
  },
  avatarInitial: { color: palette.accent, fontFamily: 'Georgia', fontSize: 25 },
  creatorCopy: { flex: 1, marginLeft: 14 },
  creatorName: { color: palette.ink, fontFamily: 'Georgia', fontSize: 21 },
  creatorMeta: { color: palette.accent, fontSize: 12, marginTop: 3 },
  creatorBio: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  chevron: { color: palette.muted, fontSize: 30, marginLeft: 8 },
});

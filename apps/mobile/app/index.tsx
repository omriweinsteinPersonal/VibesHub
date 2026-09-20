import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const categories = ['Fashion', 'Beauty', 'Skincare', 'Food', 'Fitness', 'Lifestyle'];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>
          <Text style={styles.logo}>Swave</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/login')}
            style={styles.profileButton}
          >
            <Text style={styles.profileButtonText}>Join</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>ISRAEL&apos;S CREATOR MARKETPLACE</Text>
        <Text style={styles.title}>Discover what your favorite creators recommend</Text>
        <Text style={styles.subtitle}>
          Authentic recommendations, exclusive discounts and products loved by Israeli
          creators.
        </Text>

        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Explore creators</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((category) => (
            <Pressable
              accessibilityRole="button"
              key={category}
              style={styles.categoryPill}
            >
              <Text style={styles.categoryText}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionEyebrow}>TRENDING NOW</Text>
        <Text style={styles.sectionTitle}>Recommendations worth saving</Text>
        <View style={styles.card}>
          <View style={styles.cardImage}>
            <View style={styles.videoPill}>
              <Text style={styles.videoText}>◉ Video</Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.brand}>RARE BEAUTY</Text>
            <Text style={styles.productName}>Soft Pinch Liquid Blush</Text>
            <Text style={styles.price}>₪120</Text>
            <Text style={styles.hebrew} numberOfLines={5}>
              המוצר האהוב עליי למראה טבעי וזוהר שנשאר לאורך כל היום
            </Text>
            <View style={styles.creatorRow}>
              <View style={styles.storyRing}>
                <Text style={styles.storyText}>NL</Text>
              </View>
              <Text style={styles.creatorText}>Recommended by Noa Levi</Text>
            </View>
          </View>
        </View>
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
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  logoMarkText: {
    color: colors.white,
    fontFamily: 'Georgia',
    fontSize: 25,
    lineHeight: 30,
  },
  logo: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 24,
    marginLeft: spacing.sm,
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
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  cardImage: {
    aspectRatio: 1,
    backgroundColor: '#ead5bd',
    padding: spacing.md,
  },
  videoPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  videoText: { color: colors.ink, fontSize: 12 },
  cardBody: { padding: spacing.lg },
  brand: { color: colors.muted, fontSize: 11, letterSpacing: 2 },
  productName: { color: colors.ink, fontFamily: 'Georgia', fontSize: 26, marginTop: 8 },
  price: { color: colors.ink, fontSize: 19, marginTop: 8 },
  hebrew: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 27,
    marginTop: spacing.md,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  creatorRow: { alignItems: 'center', flexDirection: 'row', marginTop: spacing.lg },
  storyRing: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  storyText: { color: colors.ink, fontSize: 10 },
  creatorText: { color: colors.muted, fontSize: 12, marginLeft: spacing.sm },
});

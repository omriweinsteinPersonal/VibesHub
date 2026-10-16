import type {
  CreatorBrand,
  CreatorProfileSocialLink,
  CreatorRecommendation,
  CreatorStorefrontConfiguration,
  FeaturedMedia,
  StorefrontTheme,
} from '@vibeshub/contracts';
import { defaultStorefrontTheme } from '@vibeshub/contracts';
import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChartColumn, House, LayoutDashboard, Store, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  cacheCreatorStudioBundle,
  getCreatorAnalytics,
  getCreatorHandleAvailability,
  getCreatorStudioBundle,
  getCachedCreatorStudioBundle,
  newStudioId,
  saveCreatorBrand,
  saveStorefrontConfiguration,
  saveStorefrontTheme,
  transitionCreatorRecommendation,
  updateCreatorProfile,
  type CreatorStudioBundle,
} from '../lib/creator-api';
import { isCreatorHandle, type CreatorHandleStatus } from '../lib/creator-handle';
import {
  creatorWorkspaceTabs,
  type CreatorWorkspaceView,
} from '../lib/creator-workspace';

type StudioView = CreatorWorkspaceView;

const tabIcons = {
  analytics: ChartColumn,
  overview: House,
  profile: User,
  recommendations: LayoutDashboard,
  storefront: Store,
} as const;

const storefrontTemplates: readonly {
  colors: Partial<StorefrontTheme>;
  id: NonNullable<StorefrontTheme['templateId']>;
  title: string;
}[] = [
  {
    colors: { recommendationsBackground: '#d8ef66' },
    id: 'citrus-glow',
    title: 'Citrus Glow',
  },
  {
    colors: { recommendationsBackground: '#d99a78' },
    id: 'clay-editorial',
    title: 'Clay Editorial',
  },
  {
    colors: {
      accentColor: '#d6e8d1',
      collectionBackground: '#f4efe3',
      discountBackground: '#f4efe3',
      productBackground: '#f4efe3',
      recommendationsBackground: '#123f3b',
      textColor: '#173c38',
    },
    id: 'forest-glass',
    title: 'Forest Glass',
  },
  {
    colors: { recommendationsBackground: '#281a34' },
    id: 'aurora-veil',
    title: 'Aurora Veil',
  },
  {
    colors: { recommendationsBackground: '#643a32' },
    id: 'desert-rose',
    title: 'Desert Rose',
  },
  {
    colors: { recommendationsBackground: '#102f43' },
    id: 'glacier-current',
    title: 'Glacier Current',
  },
];

export default function CreatorStudioScreen() {
  const router = useRouter();
  const cachedBundle = getCachedCreatorStudioBundle();
  const [view, setView] = useState<StudioView>('overview');
  const [bundle, setBundle] = useState<CreatorStudioBundle | null>(cachedBundle);
  const [loading, setLoading] = useState(!cachedBundle);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const contentScroll = useRef<ScrollView>(null);
  const hasBundle = useRef(Boolean(cachedBundle));

  const updateBundle = useCallback<
    React.Dispatch<React.SetStateAction<CreatorStudioBundle | null>>
  >((action) => {
    setBundle((current) => {
      const next = typeof action === 'function' ? action(current) : action;
      if (next) {
        hasBundle.current = true;
        cacheCreatorStudioBundle(next);
      }
      return next;
    });
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else if (!hasBundle.current) setLoading(true);
      setError('');
      try {
        updateBundle(
          await getCreatorStudioBundle(30, {
            forceRefresh: refresh || hasBundle.current,
          }),
        );
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/login');
          return;
        }
        if (cause instanceof ApiError && cause.status === 403) {
          router.replace('/creator-apply');
          return;
        }
        setError(messageFor(cause));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, updateBundle],
  );

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  const switchView = useCallback(
    (nextView: StudioView) => {
      if (nextView === view) {
        contentScroll.current?.scrollTo({ animated: true, y: 0 });
        return;
      }
      setError('');
      setNotice('');
      Animated.timing(contentOpacity, {
        duration: 80,
        toValue: 0.35,
        useNativeDriver: true,
      }).start(() => {
        setView(nextView);
        contentScroll.current?.scrollTo({ animated: false, y: 0 });
        Animated.timing(contentOpacity, {
          duration: 180,
          toValue: 1,
          useNativeDriver: true,
        }).start();
      });
    },
    [contentOpacity, view],
  );

  if (loading && !bundle) {
    return <StudioLoadingScreen />;
  }

  if (!bundle) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorTitle}>Studio unavailable</Text>
        <Text style={styles.errorCopy}>{error || 'Please try again.'}</Text>
        <Pressable onPress={() => void load()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/account')}>
          <Text style={styles.back}>Account</Text>
        </Pressable>
        <Text style={styles.wordmark}>swavii</Text>
        <Pressable
          accessibilityLabel="View public storefront"
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/[handle]',
              params: { handle: bundle.summary.handle },
            })
          }
        >
          <Text style={styles.viewPage}>View page</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.contentPane, { opacity: contentOpacity }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={contentScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.accent}
              onRefresh={() => void load(true)}
            />
          }
        >
          {error ? <Message kind="error" text={error} /> : null}
          {notice ? <Message kind="success" text={notice} /> : null}
          {view === 'overview' ? (
            <Overview bundle={bundle} navigate={switchView} />
          ) : view === 'recommendations' ? (
            <Recommendations
              brands={bundle.brands}
              recommendations={bundle.recommendations}
              onBundle={updateBundle}
              onError={setError}
              onNotice={setNotice}
            />
          ) : view === 'storefront' ? (
            <StorefrontEditor
              bundle={bundle}
              onBundle={updateBundle}
              onError={setError}
              onNotice={setNotice}
            />
          ) : view === 'analytics' ? (
            <Analytics bundle={bundle} />
          ) : (
            <ProfileEditor
              bundle={bundle}
              onBundle={updateBundle}
              onError={setError}
              onNotice={setNotice}
            />
          )}
        </ScrollView>
      </Animated.View>

      <View accessibilityRole="tablist" style={styles.tabBar}>
        {creatorWorkspaceTabs.map((item) => {
          const selected = view === item.key;
          const Icon = tabIcons[item.key];
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => switchView(item.key)}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              <Icon
                color={selected ? colors.accent : colors.muted}
                size={20}
                strokeWidth={selected ? 2.4 : 1.8}
              />
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function StudioLoadingScreen() {
  const [opacity] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 650,
          toValue: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 650,
          toValue: 0.45,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={[styles.skeletonLine, styles.skeletonHeaderAction]} />
        <Text style={styles.wordmark}>swavii</Text>
        <View style={[styles.skeletonLine, styles.skeletonHeaderAction]} />
      </View>
      <Animated.View style={[styles.skeletonContent, { opacity }]}>
        <View style={[styles.skeletonLine, styles.skeletonEyebrow]} />
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonLede]} />
        <View style={styles.metricGrid}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={[styles.metricCard, styles.skeletonCard]} />
          ))}
        </View>
        <View style={[styles.skeletonLine, styles.skeletonSectionTitle]} />
        {[0, 1, 2].map((item) => (
          <View key={item} style={[styles.actionCard, styles.skeletonAction]} />
        ))}
      </Animated.View>
      <View style={styles.tabBar}>
        {creatorWorkspaceTabs.map((item) => (
          <View key={item.key} style={styles.tab}>
            <View style={[styles.skeletonLine, styles.skeletonTabIcon]} />
            <View style={[styles.skeletonLine, styles.skeletonTab]} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Overview({
  bundle,
  navigate,
}: {
  bundle: CreatorStudioBundle;
  navigate: (view: StudioView) => void;
}) {
  const router = useRouter();
  const firstName = bundle.summary.displayName.trim().split(/\s+/)[0];
  const pageUrl = `https://swavii.com/${bundle.summary.handle}`;

  async function sharePage() {
    await Share.share({
      message: `Explore ${bundle.summary.displayName}'s recommendations on Swavii: ${pageUrl}`,
      title: `${bundle.summary.displayName} on Swavii`,
      url: pageUrl,
    });
  }

  return (
    <>
      <Text style={styles.eyebrow}>CREATOR STUDIO / HOME</Text>
      <Text style={styles.title}>
        Welcome back,{`\n`}
        {firstName || bundle.summary.displayName}.
      </Text>
      <Text style={styles.lede}>
        Your page is yours to shape. Pick up wherever inspiration left you.
      </Text>

      <View style={styles.pagePanel}>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>YOUR PAGE IS LIVE</Text>
        </View>
        <Text style={styles.pagePanelTitle}>Your page, ready to share.</Text>
        <Text style={styles.pagePanelCopy}>
          Every link, photo and recommendation in a space that feels like you.
        </Text>
        <Text numberOfLines={1} style={styles.pageUrl}>
          swavii.com/{bundle.summary.handle}
        </Text>
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/[handle]',
                params: { handle: bundle.summary.handle },
              })
            }
            style={styles.primarySmall}
          >
            <Text style={styles.primaryButtonText}>View your page</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Share storefront link"
            accessibilityRole="button"
            onPress={() => void sharePage()}
            style={styles.secondarySmall}
          >
            <Text style={styles.secondaryButtonText}>Share link</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>What would you like to do?</Text>
      {(
        [
          [
            'recommendations',
            'Add to your page',
            'Share a new recommendation or manage your brands and picks.',
          ],
          [
            'storefront',
            'Make it yours',
            'Arrange sections and shape the page around your point of view.',
          ],
          [
            'analytics',
            'See what connects',
            'Understand which pages and recommendations draw attention.',
          ],
        ] as [StudioView, string, string][]
      ).map(([target, title, copy]) => (
        <Pressable
          key={target}
          onPress={() => navigate(target)}
          style={styles.actionCard}
        >
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>{title}</Text>
            <Text style={styles.actionDescription}>{copy}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </>
  );
}

function Recommendations({
  brands,
  recommendations,
  onBundle,
  onError,
  onNotice,
}: {
  brands: CreatorBrand[];
  recommendations: CreatorRecommendation[];
  onBundle: React.Dispatch<React.SetStateAction<CreatorStudioBundle | null>>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [editingBrand, setEditingBrand] = useState<CreatorBrand | null | undefined>();
  const [brandName, setBrandName] = useState('');
  const [brandUrl, setBrandUrl] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  function openBrand(brand?: CreatorBrand) {
    setEditingBrand(brand ?? null);
    setBrandName(brand?.name ?? '');
    setBrandUrl(brand?.websiteUrl ?? '');
  }

  async function persistBrand() {
    if (!brandName.trim() || !brandUrl.trim()) {
      onError('Add both a brand name and website.');
      return;
    }
    setBusyId(editingBrand?.id ?? 'new-brand');
    onError('');
    try {
      const saved = await saveCreatorBrand(
        {
          logoAssetId: editingBrand?.logoAssetId ?? null,
          logoUrl: editingBrand?.logoUrl ?? null,
          name: brandName.trim(),
          websiteUrl: normalizeUrl(brandUrl),
        },
        editingBrand ?? undefined,
      );
      onBundle((current) =>
        current
          ? {
              ...current,
              brands: editingBrand
                ? current.brands.map((item) => (item.id === saved.id ? saved : item))
                : [...current.brands, saved],
            }
          : current,
      );
      setEditingBrand(undefined);
      onNotice(editingBrand ? 'Brand updated.' : 'Brand added.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function transition(item: CreatorRecommendation) {
    const command =
      item.lifecycle === 'published'
        ? 'unpublish'
        : item.lifecycle === 'archived'
          ? 'restore'
          : 'publish';
    setBusyId(item.id);
    onError('');
    try {
      const updated = await transitionCreatorRecommendation(item, command);
      onBundle((current) =>
        current
          ? {
              ...current,
              recommendations: current.recommendations.map((value) =>
                value.id === updated.id ? updated : value,
              ),
            }
          : current,
      );
      onNotice(
        command === 'publish' ? 'Recommendation is live.' : 'Recommendation updated.',
      );
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Text style={styles.eyebrow}>CREATOR STUDIO / DASHBOARD</Text>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Recommendations</Text>
          <Text style={styles.lede}>
            Keep your brands, collections and individual picks beautifully organized.
          </Text>
        </View>
        <Pressable onPress={() => openBrand()} style={styles.compactButton}>
          <Text style={styles.compactButtonText}>+ Brand</Text>
        </Pressable>
      </View>

      {editingBrand !== undefined ? (
        <View style={styles.editorCard}>
          <Text style={styles.cardTitle}>
            {editingBrand ? 'Edit brand' : 'Add brand'}
          </Text>
          <Field label="Brand name" onChangeText={setBrandName} value={brandName} />
          <Field
            autoCapitalize="none"
            keyboardType="url"
            label="Brand website"
            onChangeText={setBrandUrl}
            value={brandUrl}
          />
          <View style={styles.buttonRow}>
            <Pressable
              disabled={Boolean(busyId)}
              onPress={() => void persistBrand()}
              style={styles.primarySmall}
            >
              {busyId ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save brand</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setEditingBrand(undefined)}
              style={styles.secondarySmall}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Brands</Text>
      {brands.map((brand) => (
        <Pressable
          key={brand.id}
          onPress={() => openBrand(brand)}
          style={styles.listCard}
        >
          <View style={styles.listCopy}>
            <Text style={styles.cardTitle}>{brand.name}</Text>
            <Text style={styles.cardMeta}>
              {brand.collectionCount} collections · {brand.itemCount} items
            </Text>
          </View>
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>Items</Text>
      {recommendations.length ? (
        recommendations.map((item) => (
          <View key={item.id} style={styles.listCard}>
            <View style={styles.listCopy}>
              <Text style={styles.cardEyebrow}>{item.brandName}</Text>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.productName}
              </Text>
              <Text style={styles.cardMeta}>{lifecycleLabel(item.lifecycle)}</Text>
            </View>
            <Pressable
              disabled={busyId === item.id}
              onPress={() => void transition(item)}
              style={styles.statusButton}
            >
              {busyId === item.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text style={styles.statusButtonText}>
                  {item.lifecycle === 'published'
                    ? 'Hide'
                    : item.lifecycle === 'archived'
                      ? 'Restore'
                      : 'Publish'}
                </Text>
              )}
            </Pressable>
          </View>
        ))
      ) : (
        <Empty text="No recommendations yet." />
      )}
    </>
  );
}

function StorefrontEditor({
  bundle,
  onBundle,
  onError,
  onNotice,
}: {
  bundle: CreatorStudioBundle;
  onBundle: React.Dispatch<React.SetStateAction<CreatorStudioBundle | null>>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [configuration, setConfiguration] = useState(bundle.configuration);
  const [themeConfiguration, setThemeConfiguration] = useState(bundle.theme);
  const [labelTitle, setLabelTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function selectTemplate(template: (typeof storefrontTemplates)[number]) {
    if (saving || themeConfiguration.theme.templateId === template.id) return;
    setSaving(true);
    onError('');
    try {
      const theme: StorefrontTheme = {
        ...defaultStorefrontTheme,
        ...themeConfiguration.theme,
        ...template.colors,
        templateId: template.id,
      };
      const saved = await saveStorefrontTheme(themeConfiguration, theme);
      setThemeConfiguration(saved);
      onBundle((current) => (current ? { ...current, theme: saved } : current));
      onNotice(`${template.title} is live on your storefront.`);
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  const save = useCallback(
    async (next: CreatorStorefrontConfiguration) => {
      setSaving(true);
      onError('');
      try {
        const saved = await saveStorefrontConfiguration(next, configurationInput(next));
        setConfiguration(saved);
        onBundle((current) => (current ? { ...current, configuration: saved } : current));
        onNotice('Your storefront organization is live.');
      } catch (cause) {
        onError(messageFor(cause));
      } finally {
        setSaving(false);
      }
    },
    [onBundle, onError, onNotice],
  );

  function addLabel() {
    const title = labelTitle.trim();
    if (!title) return;
    const next = {
      ...configuration,
      labels: [
        ...configuration.labels,
        {
          brandIds: [],
          categorySlug: null,
          collectionIds: [],
          id: newStudioId(),
          layout: 'grid' as const,
          recommendationIds: [],
          title,
        },
      ],
    };
    setLabelTitle('');
    setConfiguration(next);
    void save(next);
  }

  function addMedia() {
    if (!mediaTitle.trim() || !mediaUrl.trim()) return;
    const media: FeaturedMedia = {
      displayMode: 'embed',
      id: newStudioId(),
      provider: mediaProvider(mediaUrl),
      thumbnailUrl: null,
      title: mediaTitle.trim(),
      url: normalizeUrl(mediaUrl),
      visible: true,
    };
    const next = {
      ...configuration,
      contentOrder: [
        ...configuration.contentOrder,
        { id: media.id, kind: 'media' as const },
      ],
      featuredMedia: [...configuration.featuredMedia, media],
    };
    setMediaTitle('');
    setMediaUrl('');
    setConfiguration(next);
    void save(next);
  }

  function removeLabel(id: string) {
    Alert.alert('Remove this label?', 'It will disappear from your public storefront.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          const next = {
            ...configuration,
            labels: configuration.labels.filter((item) => item.id !== id),
          };
          setConfiguration(next);
          void save(next);
        },
        style: 'destructive',
        text: 'Remove',
      },
    ]);
  }

  function removeMedia(id: string) {
    Alert.alert(
      'Remove this featured item?',
      'It will disappear from your public storefront.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            const next = {
              ...configuration,
              contentOrder: configuration.contentOrder.filter(
                (item) => !(item.kind === 'media' && item.id === id),
              ),
              featuredMedia: configuration.featuredMedia.filter((item) => item.id !== id),
            };
            setConfiguration(next);
            void save(next);
          },
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
  }

  return (
    <>
      <Text style={styles.eyebrow}>CREATOR STUDIO / STOREFRONT</Text>
      <Text style={styles.title}>Organize your page</Text>
      <Text style={styles.lede}>
        Add quick filters and feature videos, posts or music.
      </Text>

      <Text style={styles.sectionTitle}>Design template</Text>
      <Text style={styles.cardMeta}>
        These are the same storefront templates available on the web.
      </Text>
      <ScrollView
        contentContainerStyle={styles.templateRail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {storefrontTemplates.map((template) => {
          const selected = themeConfiguration.theme.templateId === template.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              disabled={saving}
              key={template.id}
              onPress={() => void selectTemplate(template)}
              style={[styles.templateCard, selected && styles.templateCardSelected]}
            >
              <View
                style={[
                  styles.templateSwatch,
                  {
                    backgroundColor:
                      template.colors.recommendationsBackground ??
                      defaultStorefrontTheme.recommendationsBackground,
                  },
                ]}
              />
              <Text style={styles.templateTitle}>{template.title}</Text>
              <Text style={styles.templateState}>{selected ? 'Selected' : 'Choose'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.editorCard}>
        <Text style={styles.cardTitle}>Add label</Text>
        <Text style={styles.cardMeta}>Create a filter such as “My favorites”.</Text>
        <Field label="Label name" onChangeText={setLabelTitle} value={labelTitle} />
        <Pressable
          disabled={saving || !labelTitle.trim()}
          onPress={addLabel}
          style={styles.primarySmall}
        >
          <Text style={styles.primaryButtonText}>Add label</Text>
        </Pressable>
      </View>
      {configuration.labels.map((label) => (
        <View key={label.id} style={styles.listCard}>
          <View style={styles.listCopy}>
            <Text style={styles.cardTitle}>{label.title}</Text>
            <Text style={styles.cardMeta}>
              {label.recommendationIds.length} items · {label.collectionIds.length}{' '}
              collections
            </Text>
          </View>
          <Pressable onPress={() => removeLabel(label.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.editorCard}>
        <Text style={styles.cardTitle}>Add media</Text>
        <Text style={styles.cardMeta}>YouTube, Instagram, Spotify or Apple Music.</Text>
        <Field
          autoCapitalize="none"
          keyboardType="url"
          label="Media link"
          onChangeText={setMediaUrl}
          value={mediaUrl}
        />
        <Field label="Title" onChangeText={setMediaTitle} value={mediaTitle} />
        <Pressable
          disabled={saving || !mediaTitle.trim() || !mediaUrl.trim()}
          onPress={addMedia}
          style={styles.primarySmall}
        >
          <Text style={styles.primaryButtonText}>Add media</Text>
        </Pressable>
      </View>
      {configuration.featuredMedia.map((item) => (
        <View key={item.id} style={styles.listCard}>
          <View style={styles.listCopy}>
            <Text style={styles.cardEyebrow}>{item.provider.replace('_', ' ')}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>
          <Pressable onPress={() => removeMedia(item.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {saving ? <ActivityIndicator color={colors.accent} style={styles.saving} /> : null}
    </>
  );
}

function Analytics({ bundle }: { bundle: CreatorStudioBundle }) {
  const initialRange = bundle.analytics.range.days === 7 ? 7 : 30;
  const [analytics, setAnalytics] = useState(bundle.analytics);
  const [range, setRange] = useState<7 | 30>(initialRange);
  const [loading, setLoading] = useState(false);
  const [rangeError, setRangeError] = useState('');
  const metrics = [
    ['Page views', analytics.summary.storefrontViews],
    ['Unique visitors', analytics.summary.uniqueVisitors],
    ['Product clicks', analytics.summary.shopClicks],
    ['Instagram taps', analytics.summary.instagramTaps],
  ] as const;
  const top = useMemo(
    () =>
      [...analytics.recommendations]
        .sort((a, b) => b.shopClicks - a.shopClicks || b.views - a.views)
        .slice(0, 5),
    [analytics.recommendations],
  );

  async function selectRange(nextRange: 7 | 30) {
    if (nextRange === range || loading) return;
    setRange(nextRange);
    setLoading(true);
    setRangeError('');
    try {
      setAnalytics(await getCreatorAnalytics(nextRange));
    } catch (cause) {
      setRangeError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Text style={styles.eyebrow}>CREATOR STUDIO / ANALYTICS</Text>
      <Text style={styles.title}>See what resonates</Text>
      <Text style={styles.lede}>A clear view of what people explore on your page.</Text>
      <View accessibilityRole="tablist" style={styles.rangeControl}>
        {([7, 30] as const).map((days) => {
          const selected = range === days;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              disabled={loading}
              key={days}
              onPress={() => void selectRange(days)}
              style={[styles.rangeButton, selected && styles.rangeButtonActive]}
            >
              <Text
                style={[styles.rangeButtonText, selected && styles.rangeButtonTextActive]}
              >
                Last {days} days
              </Text>
            </Pressable>
          );
        })}
      </View>
      {rangeError ? <Message kind="error" text={rangeError} /> : null}
      <View style={styles.metricGrid}>
        {metrics.map(([label, value]) => (
          <View key={label} style={styles.metricCard}>
            <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.accent} style={styles.saving} /> : null}
      <Text style={styles.sectionTitle}>Most explored</Text>
      {top.length ? (
        top.map((item, index) => (
          <View key={item.id} style={styles.listCard}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.listCopy}>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.productName}
              </Text>
              <Text style={styles.cardMeta}>{item.brandName}</Text>
            </View>
            <View>
              <Text style={styles.clickValue}>{item.shopClicks}</Text>
              <Text style={styles.clickLabel}>clicks</Text>
            </View>
          </View>
        ))
      ) : (
        <Empty text="Your activity will appear here as people visit your page." />
      )}
    </>
  );
}

function ProfileEditor({
  bundle,
  onBundle,
  onError,
  onNotice,
}: {
  bundle: CreatorStudioBundle;
  onBundle: React.Dispatch<React.SetStateAction<CreatorStudioBundle | null>>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(bundle.profile.displayName);
  const [handle, setHandle] = useState(bundle.profile.handle);
  const [bio, setBio] = useState(bundle.profile.bioHe);
  const [instagram, setInstagram] = useState(
    linkFor(bundle.profile.socialLinks, 'instagram'),
  );
  const [website, setWebsite] = useState(linkFor(bundle.profile.socialLinks, 'website'));
  const [saving, setSaving] = useState(false);
  const [handleResult, setHandleResult] = useState<{
    handle: string;
    status: 'available' | 'unavailable' | 'idle';
  }>({ handle: bundle.profile.handle, status: 'available' });

  const normalizedHandle = handle.trim();
  const handleStatus: CreatorHandleStatus = !normalizedHandle
    ? 'idle'
    : !isCreatorHandle(normalizedHandle)
      ? 'invalid'
      : normalizedHandle === bundle.profile.handle
        ? 'available'
        : handleResult.handle === normalizedHandle
          ? handleResult.status
          : 'checking';

  useEffect(() => {
    const normalized = handle.trim();
    if (!isCreatorHandle(normalized) || normalized === bundle.profile.handle) return;

    let active = true;
    const timer = globalThis.setTimeout(() => {
      void getCreatorHandleAvailability(normalized)
        .then((available) => {
          if (active) {
            setHandleResult({
              handle: normalized,
              status: available ? 'available' : 'unavailable',
            });
          }
        })
        .catch(() => {
          if (active) setHandleResult({ handle: normalized, status: 'idle' });
        });
    }, 350);
    return () => {
      active = false;
      globalThis.clearTimeout(timer);
    };
  }, [bundle.profile.handle, handle]);

  async function save() {
    if (!displayName.trim()) {
      onError('Add your display name.');
      return;
    }
    if (!isCreatorHandle(handle) || handleStatus !== 'available') {
      onError('Choose an available storefront address before saving.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      const otherLinks = bundle.profile.socialLinks.filter(
        ({ platform }) => platform !== 'instagram' && platform !== 'website',
      );
      const socialLinks: CreatorProfileSocialLink[] = [...otherLinks];
      if (instagram.trim()) {
        socialLinks.push({ platform: 'instagram', url: normalizeUrl(instagram) });
      }
      if (website.trim()) {
        socialLinks.push({ platform: 'website', url: normalizeUrl(website) });
      }
      const profile = await updateCreatorProfile(bundle.profile, {
        bioHe: bio,
        displayName: displayName.trim(),
        handle: handle.trim(),
        socialLinks,
      });
      onBundle((current) =>
        current
          ? {
              ...current,
              profile,
              summary: {
                ...current.summary,
                displayName: profile.displayName,
                handle: profile.handle,
              },
            }
          : current,
      );
      setHandle(profile.handle);
      onNotice('Your profile and links are live.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Text style={styles.eyebrow}>CREATOR STUDIO / ACCOUNT</Text>
      <Text style={styles.title}>Profile & links</Text>
      <Text style={styles.lede}>These details appear at the top of your storefront.</Text>
      <View style={styles.editorCard}>
        <Field label="Display name" onChangeText={setDisplayName} value={displayName} />
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label="Storefront address"
          onChangeText={setHandle}
          value={handle}
        />
        <Text style={styles.cardMeta}>{handleStatusMessage(handleStatus)}</Text>
        <Field label="Bio" multiline onChangeText={setBio} value={bio} />
        <Field
          autoCapitalize="none"
          keyboardType="url"
          label="Instagram"
          onChangeText={setInstagram}
          value={instagram}
        />
        <Field
          autoCapitalize="none"
          keyboardType="url"
          label="Website"
          onChangeText={setWebsite}
          value={website}
        />
        <Pressable
          disabled={saving || handleStatus !== 'available'}
          onPress={() => void save()}
          style={styles.primaryButton}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Save profile</Text>
          )}
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/account')}
        style={styles.accountSettingsButton}
      >
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>Account settings</Text>
          <Text style={styles.actionDescription}>
            Purchases, support, legal information, sign out and account deletion.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </>
  );
}

function handleStatusMessage(status: CreatorHandleStatus): string {
  if (status === 'checking') return 'Checking availability…';
  if (status === 'available') return 'This storefront address is available.';
  if (status === 'unavailable') return 'That storefront address is already taken.';
  if (status === 'invalid') return 'Use at least two characters without /, ?, # or %.';
  return 'Choose the address visitors will use to open your storefront.';
}

function Field({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

function Message({ kind, text }: { kind: 'error' | 'success'; text: string }) {
  return (
    <View
      style={[
        styles.message,
        kind === 'error' ? styles.errorMessage : styles.successMessage,
      ]}
    >
      <Text
        style={kind === 'error' ? styles.errorMessageText : styles.successMessageText}
      >
        {text}
      </Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function configurationInput(configuration: CreatorStorefrontConfiguration) {
  return {
    ...(configuration.brandOrder ? { brandOrder: configuration.brandOrder } : {}),
    categoryIds: configuration.sections.map(({ category }) => category.id),
    contentOrder: configuration.contentOrder,
    curatedSections: configuration.curatedSections,
    featuredMedia: configuration.featuredMedia,
    hiddenBrandIds: configuration.hiddenBrandIds,
    hiddenCollectionIds: configuration.hiddenCollectionIds,
    hiddenRecommendationIds: configuration.hiddenRecommendationIds,
    labels: configuration.labels,
    ...(configuration.titles ? { titles: configuration.titles } : {}),
  };
}

function linkFor(
  links: CreatorProfileSocialLink[],
  platform: CreatorProfileSocialLink['platform'],
) {
  return links.find((link) => link.platform === platform)?.url ?? '';
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`;
}

function mediaProvider(value: string): FeaturedMedia['provider'] {
  const hostname = (() => {
    try {
      return new URL(normalizeUrl(value)).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (hostname.includes('instagram')) return 'instagram';
  if (hostname.includes('spotify')) return 'spotify';
  if (hostname.includes('music.apple')) return 'apple_music';
  return 'youtube';
}

function lifecycleLabel(value: CreatorRecommendation['lifecycle']): string {
  return value === 'published'
    ? 'Live on your storefront'
    : value === 'archived'
      ? 'Archived'
      : 'Hidden from your storefront';
}

function messageFor(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  centered: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 32 },
  errorCopy: {
    color: colors.muted,
    lineHeight: 22,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: spacing.lg,
  },
  back: { color: colors.white, fontSize: 14, fontWeight: '600' },
  wordmark: { color: colors.white, fontSize: 27, fontWeight: '800' },
  viewPage: { color: colors.white, fontSize: 14, fontWeight: '700' },
  contentPane: { flex: 1 },
  skeletonContent: { flex: 1, padding: spacing.lg },
  skeletonLine: { backgroundColor: '#e9e2d9', borderRadius: 999 },
  skeletonHeaderAction: { height: 13, width: 58 },
  skeletonEyebrow: { height: 9, marginTop: 4, width: 94 },
  skeletonTitle: { height: 37, marginTop: spacing.md, width: '72%' },
  skeletonLede: { height: 15, marginTop: spacing.md, width: '86%' },
  skeletonCard: { backgroundColor: '#eee8e0', borderColor: '#eee8e0' },
  skeletonSectionTitle: { height: 20, marginTop: spacing.xl, width: '55%' },
  skeletonAction: {
    backgroundColor: '#eee8e0',
    borderColor: '#eee8e0',
    minHeight: 76,
    marginTop: spacing.md,
  },
  skeletonTab: { height: 9, width: 38 },
  skeletonTabIcon: { height: 18, marginBottom: 5, width: 18 },
  tabBar: {
    backgroundColor: colors.white,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 4,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    gap: 4,
    paddingHorizontal: 2,
  },
  tabPressed: { opacity: 0.55 },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  tabTextActive: { color: colors.ink, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2 },
  title: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 38,
    letterSpacing: -1,
    lineHeight: 43,
    marginTop: spacing.sm,
  },
  lede: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
  headingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  headingCopy: { flex: 1 },
  compactButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    marginTop: spacing.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactButtonText: { color: colors.white, fontWeight: '700' },
  rangeControl: {
    alignSelf: 'flex-start',
    backgroundColor: '#eee6dc',
    borderRadius: radii.control,
    flexDirection: 'row',
    marginTop: spacing.lg,
    padding: 3,
  },
  rangeButton: { borderRadius: radii.control, paddingHorizontal: 14, paddingVertical: 9 },
  rangeButtonActive: { backgroundColor: colors.white },
  rangeButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  rangeButtonTextActive: { color: colors.ink },
  templateRail: { gap: 10, paddingVertical: spacing.md },
  templateCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 10,
    width: 134,
  },
  templateCardSelected: { borderColor: colors.accent, borderWidth: 2, padding: 9 },
  templateSwatch: { borderRadius: 10, height: 72, marginBottom: 10 },
  templateTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  templateState: { color: colors.muted, fontSize: 12, marginTop: 3 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: spacing.xl },
  metricCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    minHeight: 108,
    padding: spacing.md,
    width: '48%',
  },
  metricValue: { color: colors.ink, fontFamily: 'Georgia', fontSize: 34 },
  metricLabel: { color: colors.muted, fontSize: 13, marginTop: 4 },
  pagePanel: {
    backgroundColor: '#f4eadf',
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  liveRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  liveDot: { backgroundColor: '#4c8b59', borderRadius: 99, height: 7, width: 7 },
  liveLabel: {
    color: '#4c6c52',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  pagePanelTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 27,
    marginTop: spacing.md,
  },
  pagePanelCopy: { color: colors.muted, lineHeight: 21, marginTop: 7 },
  pageUrl: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  actionCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: spacing.md,
  },
  accountSettingsButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  actionCopy: { flex: 1 },
  actionTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  actionDescription: { color: colors.muted, lineHeight: 20, marginTop: 3 },
  chevron: { color: '#2f5960', fontSize: 28, marginLeft: spacing.md },
  editorCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  listCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: 10,
    minHeight: 78,
    padding: spacing.md,
  },
  listCopy: { flex: 1 },
  cardEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  editLabel: { color: colors.accent, fontWeight: '700' },
  removeText: { color: '#9b2c24', fontSize: 13, fontWeight: '700' },
  statusButton: {
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  field: { marginTop: spacing.md },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  readOnlyRow: { marginTop: spacing.lg },
  readOnlyValue: { color: colors.muted, fontSize: 15 },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    marginTop: spacing.lg,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  primarySmall: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondarySmall: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  message: { borderRadius: radii.control, marginBottom: spacing.md, padding: 12 },
  errorMessage: { backgroundColor: '#fff0ed' },
  successMessage: { backgroundColor: '#edf7ef' },
  errorMessageText: { color: '#8a3028' },
  successMessageText: { color: '#28613a' },
  empty: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: spacing.xl,
  },
  emptyText: { color: colors.muted, lineHeight: 21, textAlign: 'center' },
  saving: { marginTop: spacing.md },
  rank: { color: colors.accent, fontFamily: 'Georgia', fontSize: 24, width: 24 },
  clickValue: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'right' },
  clickLabel: { color: colors.muted, fontSize: 11 },
});

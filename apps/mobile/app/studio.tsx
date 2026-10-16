import type {
  CategoryCard,
  CreatorBrand,
  CreatorDiscountCode,
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
import * as ImagePicker from 'expo-image-picker';
import { ChartColumn, House, LayoutDashboard, Store, User } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../lib/api';
import {
  cacheCreatorStudioBundle,
  fetchCreatorProductDetails,
  getCreatorAnalytics,
  getCreatorHandleAvailability,
  getCreatorStudioBundle,
  getCachedCreatorStudioBundle,
  newStudioId,
  saveCreatorBrand,
  saveCreatorDiscount,
  saveCreatorRecommendation,
  saveStorefrontConfiguration,
  saveStorefrontTheme,
  transitionCreatorRecommendation,
  transitionCreatorDiscount,
  updateCreatorProfile,
  type CreatorStudioBundle,
} from '../lib/creator-api';
import { isCreatorHandle, type CreatorHandleStatus } from '../lib/creator-handle';
import { uploadCreatorImage } from '../lib/creator-media';
import { featuredMediaProvider } from '../lib/featured-media';
import {
  emptyRecommendationDraft,
  recommendationDraftFromItem,
  recommendationDraftWithMetadata,
  recommendationInput,
  type RecommendationDraft,
} from '../lib/recommendation-editor';
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
        <Pressable
          accessibilityLabel="Account settings"
          accessibilityRole="button"
          onPress={() => router.push('/account')}
        >
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
              categories={bundle.categories ?? []}
              configuration={bundle.configuration}
              discounts={bundle.discounts ?? []}
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
              accessibilityLabel={`${item.label} tab`}
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
  categories,
  configuration,
  discounts,
  recommendations,
  onBundle,
  onError,
  onNotice,
}: {
  brands: CreatorBrand[];
  categories: CategoryCard[];
  configuration: CreatorStorefrontConfiguration;
  discounts: CreatorDiscountCode[];
  recommendations: CreatorRecommendation[];
  onBundle: React.Dispatch<React.SetStateAction<CreatorStudioBundle | null>>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [editingBrand, setEditingBrand] = useState<CreatorBrand | null | undefined>();
  const [editingItem, setEditingItem] = useState<
    CreatorRecommendation | null | undefined
  >();
  const [itemDraft, setItemDraft] = useState<RecommendationDraft>(
    emptyRecommendationDraft,
  );
  const [brandName, setBrandName] = useState('');
  const [brandUrl, setBrandUrl] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingCollection, setEditingCollection] = useState<
    CreatorStorefrontConfiguration['curatedSections'][number] | null | undefined
  >();
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionBrandId, setCollectionBrandId] = useState<string | null>(null);
  const [collectionItemIds, setCollectionItemIds] = useState<string[]>([]);
  const [editingDiscount, setEditingDiscount] = useState<
    CreatorDiscountCode | null | undefined
  >();
  const [discountBrandId, setDiscountBrandId] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountDetails, setDiscountDetails] = useState('');
  const [discountExpiresAt, setDiscountExpiresAt] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [discountMerchantUrl, setDiscountMerchantUrl] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');

  function openBrand(brand?: CreatorBrand) {
    setEditingItem(undefined);
    setEditingCollection(undefined);
    setEditingDiscount(undefined);
    setEditingBrand(brand ?? null);
    setBrandName(brand?.name ?? '');
    setBrandUrl(brand?.websiteUrl ?? '');
  }

  function openItem(item?: CreatorRecommendation) {
    setEditingBrand(undefined);
    setEditingCollection(undefined);
    setEditingDiscount(undefined);
    setEditingItem(item ?? null);
    setItemDraft(item ? recommendationDraftFromItem(item) : emptyRecommendationDraft);
  }

  function openCollection(
    collection?: CreatorStorefrontConfiguration['curatedSections'][number],
  ) {
    setEditingBrand(undefined);
    setEditingItem(undefined);
    setEditingDiscount(undefined);
    setEditingCollection(collection ?? null);
    setCollectionTitle(collection?.title ?? '');
    setCollectionDescription(collection?.description ?? '');
    setCollectionBrandId(collection?.brandId ?? null);
    setCollectionItemIds(collection?.recommendationIds ?? []);
  }

  function openDiscount(discount?: CreatorDiscountCode) {
    setEditingBrand(undefined);
    setEditingCollection(undefined);
    setEditingItem(undefined);
    setEditingDiscount(discount ?? null);
    setDiscountBrandId(discount?.brandId ?? null);
    setDiscountCode(discount?.code ?? '');
    setDiscountDetails(discount?.details?.value ?? '');
    setDiscountExpiresAt(discount?.expiresAt?.slice(0, 10) ?? '');
    setDiscountLabel(discount?.label ?? '');
    setDiscountMerchantUrl(discount?.merchantUrl ?? '');
    setDiscountPercent(discount?.discountPercent ? String(discount.discountPercent) : '');
  }

  async function persistDiscount() {
    const code = discountCode.trim();
    const merchantUrl = discountMerchantUrl.trim();
    const percent = Number(discountPercent);
    if (!code) {
      onError('Add the discount code.');
      return;
    }
    if (!merchantUrl) {
      onError('Add the merchant website.');
      return;
    }
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      onError('Enter a whole-number discount from 1 to 100%.');
      return;
    }
    setBusyId(editingDiscount?.id ?? 'new-discount');
    onError('');
    try {
      const brand = brands.find(({ brandId }) => brandId === discountBrandId);
      let saved = await saveCreatorDiscount(
        {
          brandId: discountBrandId,
          code,
          detailsHe: discountDetails.trim() || null,
          discountAmountMinor: null,
          discountPercent: percent,
          expiresAt: discountExpiresAt
            ? new Date(`${discountExpiresAt}T23:59:59.000Z`).toISOString()
            : null,
          label: discountLabel.trim() || `${percent}% off`,
          merchantUrl: normalizeUrl(merchantUrl),
          offerType: 'creator_code',
          priority: editingDiscount?.priority ?? 0,
          recurrenceRule: 'none',
          scopeId: discountBrandId,
          scopeKind: 'brand',
          source: 'manual',
          stackable: editingDiscount?.stackable ?? false,
          startsAt: editingDiscount?.startsAt ?? null,
          storyClips: [],
        },
        editingDiscount ?? undefined,
      );
      if (saved.lifecycle !== 'published') {
        saved = await transitionCreatorDiscount(saved, 'confirm');
      }
      onBundle((current) =>
        current
          ? {
              ...current,
              discounts: editingDiscount
                ? current.discounts.map((item) => (item.id === saved.id ? saved : item))
                : [...current.discounts, saved],
            }
          : current,
      );
      setEditingDiscount(undefined);
      onNotice(`${brand?.name ?? 'Discount'} offer is live.`);
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDiscount(discount: CreatorDiscountCode) {
    const command = discount.lifecycle === 'published' ? 'hide' : 'confirm';
    setBusyId(discount.id);
    onError('');
    try {
      const saved = await transitionCreatorDiscount(discount, command);
      onBundle((current) =>
        current
          ? {
              ...current,
              discounts: current.discounts.map((item) =>
                item.id === saved.id ? saved : item,
              ),
            }
          : current,
      );
      onNotice(command === 'confirm' ? 'Discount is live.' : 'Discount hidden.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  function toggleCollectionItem(id: string) {
    setCollectionItemIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : current.length < 20
          ? [...current, id]
          : current,
    );
  }

  async function persistCollection() {
    const title = collectionTitle.trim();
    if (!title) {
      onError('Add a collection name.');
      return;
    }
    if (!collectionItemIds.length) {
      onError('Choose at least one item for this collection.');
      return;
    }

    setBusyId(editingCollection?.id ?? 'new-collection');
    onError('');
    try {
      const id = editingCollection?.id ?? newStudioId();
      const collection = {
        brandId: collectionBrandId,
        contentItems: collectionItemIds.map((itemId) => ({
          id: itemId,
          kind: 'recommendation' as const,
        })),
        description: collectionDescription.trim(),
        displayStyle: editingCollection?.displayStyle ?? ('horizontal' as const),
        id,
        imageUrl: editingCollection?.imageUrl ?? null,
        kind: 'collection' as const,
        parentCollectionId: editingCollection?.parentCollectionId ?? null,
        recommendationIds: collectionItemIds,
        showItemsIndividually: editingCollection?.showItemsIndividually ?? false,
        title,
      };
      const next = {
        ...configuration,
        contentOrder: editingCollection
          ? configuration.contentOrder
          : [...configuration.contentOrder, { id, kind: 'collection' as const }],
        curatedSections: editingCollection
          ? configuration.curatedSections.map((item) =>
              item.id === id ? collection : item,
            )
          : [...configuration.curatedSections, collection],
      };
      const saved = await saveStorefrontConfiguration(
        configuration,
        configurationInput(next),
      );
      onBundle((current) => (current ? { ...current, configuration: saved } : current));
      setEditingCollection(undefined);
      onNotice(editingCollection ? 'Collection updated.' : 'Collection added.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  function removeCollection(
    collection: CreatorStorefrontConfiguration['curatedSections'][number],
  ) {
    Alert.alert(
      `Remove ${collection.title}?`,
      'Its items will stay in your recommendations.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void confirmRemoveCollection(collection),
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
  }

  async function confirmRemoveCollection(
    collection: CreatorStorefrontConfiguration['curatedSections'][number],
  ) {
    setBusyId(collection.id);
    onError('');
    try {
      const next = {
        ...configuration,
        contentOrder: configuration.contentOrder.filter(
          ({ id, kind }) => !(kind === 'collection' && id === collection.id),
        ),
        curatedSections: configuration.curatedSections.filter(
          ({ id }) => id !== collection.id,
        ),
        hiddenCollectionIds: configuration.hiddenCollectionIds.filter(
          (id) => id !== collection.id,
        ),
        labels: configuration.labels.map((label) => ({
          ...label,
          collectionIds: label.collectionIds.filter((id) => id !== collection.id),
        })),
      };
      const saved = await saveStorefrontConfiguration(
        configuration,
        configurationInput(next),
      );
      onBundle((current) => (current ? { ...current, configuration: saved } : current));
      onNotice('Collection removed. Its items are still available.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  function updateItem(patch: Partial<RecommendationDraft>) {
    setItemDraft((current) => ({ ...current, ...patch }));
  }

  async function fetchDetails() {
    const rawUrl = itemDraft.productUrl.trim();
    if (!rawUrl) {
      onError('Add an item link first.');
      return;
    }
    setFetchingDetails(true);
    onError('');
    try {
      const url = normalizeUrl(rawUrl);
      const metadata = await fetchCreatorProductDetails(url);
      const detectedCategory = categories.find(
        ({ slug }) => slug === metadata.categorySlug,
      );
      setItemDraft((current) =>
        recommendationDraftWithMetadata(current, metadata, detectedCategory?.id),
      );
      onNotice('Item details fetched. Review them before saving.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setFetchingDetails(false);
    }
  }

  async function chooseItemImage() {
    onError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError('Allow photo access to choose an image for this item.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setUploadingImage(true);
    try {
      const uploaded = await uploadCreatorImage({
        fileSize: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? 'image/jpeg',
        uri: asset.uri,
      });
      updateItem({ imageAssetId: uploaded.id, imageUrl: uploaded.publicUrl });
      onNotice('Image uploaded. Save the item to keep it.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setUploadingImage(false);
    }
  }

  async function persistItem() {
    let input;
    try {
      input = recommendationInput(itemDraft, newStudioId());
    } catch (cause) {
      onError(messageFor(cause));
      return;
    }

    const busyKey = editingItem?.id ?? 'new-item';
    setBusyId(busyKey);
    onError('');
    try {
      const saved = await saveCreatorRecommendation(input, editingItem ?? undefined);
      let savedConfiguration = configuration;
      if (
        !editingItem &&
        !configuration.contentOrder.some(
          ({ id, kind }) => kind === 'recommendation' && id === saved.id,
        )
      ) {
        const next = {
          ...configuration,
          contentOrder: [
            ...configuration.contentOrder,
            { id: saved.id, kind: 'recommendation' as const },
          ],
        };
        savedConfiguration = await saveStorefrontConfiguration(
          configuration,
          configurationInput(next),
        );
      }
      onBundle((current) =>
        current
          ? {
              ...current,
              configuration: savedConfiguration,
              recommendations: editingItem
                ? current.recommendations.map((item) =>
                    item.id === saved.id ? saved : item,
                  )
                : [...current.recommendations, saved],
            }
          : current,
      );
      setEditingItem(undefined);
      setItemDraft(emptyRecommendationDraft);
      onNotice(editingItem ? 'Item updated.' : 'Item added. Publish it when ready.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
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
      let savedConfiguration = configuration;
      if (
        command === 'restore' &&
        !configuration.contentOrder.some(
          ({ id, kind }) => kind === 'recommendation' && id === item.id,
        )
      ) {
        const next = {
          ...configuration,
          contentOrder: [
            ...configuration.contentOrder,
            { id: item.id, kind: 'recommendation' as const },
          ],
        };
        savedConfiguration = await saveStorefrontConfiguration(
          configuration,
          configurationInput(next),
        );
      }
      onBundle((current) =>
        current
          ? {
              ...current,
              configuration: savedConfiguration,
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

  function archiveItem(item: CreatorRecommendation) {
    Alert.alert(
      `Remove ${item.productName}?`,
      'The item will be archived and removed from your storefront. You can restore it later.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void confirmArchiveItem(item),
          style: 'destructive',
          text: 'Remove',
        },
      ],
    );
  }

  async function confirmArchiveItem(item: CreatorRecommendation) {
    setBusyId(item.id);
    onError('');
    try {
      const archived = await transitionCreatorRecommendation(item, 'archive');
      const next = {
        ...configuration,
        contentOrder: configuration.contentOrder.filter(
          ({ id, kind }) => !(kind === 'recommendation' && id === item.id),
        ),
        curatedSections: configuration.curatedSections.map((section) => ({
          ...section,
          contentItems: section.contentItems.filter(
            ({ id, kind }) => !(kind === 'recommendation' && id === item.id),
          ),
          recommendationIds: section.recommendationIds.filter((id) => id !== item.id),
        })),
        hiddenRecommendationIds: configuration.hiddenRecommendationIds.filter(
          (id) => id !== item.id,
        ),
        labels: configuration.labels.map((label) => ({
          ...label,
          recommendationIds: label.recommendationIds.filter((id) => id !== item.id),
        })),
      };
      const savedConfiguration = await saveStorefrontConfiguration(
        configuration,
        configurationInput(next),
      );
      onBundle((current) =>
        current
          ? {
              ...current,
              configuration: savedConfiguration,
              recommendations: current.recommendations.map((value) =>
                value.id === archived.id ? archived : value,
              ),
            }
          : current,
      );
      onNotice('Item archived.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setBusyId(null);
    }
  }

  async function moveDashboardContent(
    id: string,
    kind: 'collection' | 'recommendation',
    direction: -1 | 1,
  ) {
    const index = configuration.contentOrder.findIndex(
      (entry) => entry.id === id && entry.kind === kind,
    );
    const target = index + direction;
    if (index < 0 || target < 0 || target >= configuration.contentOrder.length) return;
    const contentOrder = [...configuration.contentOrder];
    [contentOrder[index], contentOrder[target]] = [
      contentOrder[target]!,
      contentOrder[index]!,
    ];
    setBusyId(`move-${kind}-${id}`);
    onError('');
    try {
      const saved = await saveStorefrontConfiguration(
        configuration,
        configurationInput({ ...configuration, contentOrder }),
      );
      onBundle((current) => (current ? { ...current, configuration: saved } : current));
      onNotice('Storefront order updated.');
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
        <View style={styles.headingActions}>
          <Pressable onPress={() => openItem()} style={styles.compactButton}>
            <Text style={styles.compactButtonText}>+ Item</Text>
          </Pressable>
          <Pressable onPress={() => openBrand()} style={styles.compactButtonSecondary}>
            <Text style={styles.compactButtonSecondaryText}>+ Brand</Text>
          </Pressable>
          <Pressable
            onPress={() => openCollection()}
            style={styles.compactButtonSecondary}
          >
            <Text style={styles.compactButtonSecondaryText}>+ Collection</Text>
          </Pressable>
          <Pressable onPress={() => openDiscount()} style={styles.compactButtonSecondary}>
            <Text style={styles.compactButtonSecondaryText}>+ Discount</Text>
          </Pressable>
        </View>
      </View>

      {editingDiscount !== undefined ? (
        <View style={styles.editorCard}>
          <Text style={styles.cardTitle}>
            {editingDiscount ? 'Edit discount' : 'Add discount'}
          </Text>
          <Text style={styles.fieldLabelStandalone}>Brand (optional)</Text>
          <ScrollView
            contentContainerStyle={styles.choiceRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <ChoicePill
              label="Any brand"
              onPress={() => setDiscountBrandId(null)}
              selected={discountBrandId === null}
            />
            {brands.map((brand) => (
              <ChoicePill
                key={brand.id}
                label={brand.name}
                onPress={() => {
                  setDiscountBrandId(brand.brandId);
                  if (!discountMerchantUrl) setDiscountMerchantUrl(brand.websiteUrl);
                }}
                selected={discountBrandId === brand.brandId}
              />
            ))}
          </ScrollView>
          <Field label="Code" onChangeText={setDiscountCode} value={discountCode} />
          <Field
            keyboardType="number-pad"
            label="Percent off"
            onChangeText={setDiscountPercent}
            value={discountPercent}
          />
          <Field
            autoCapitalize="none"
            keyboardType="url"
            label="Merchant website"
            onChangeText={setDiscountMerchantUrl}
            value={discountMerchantUrl}
          />
          <Field
            label="Public label (optional)"
            onChangeText={setDiscountLabel}
            value={discountLabel}
          />
          <Field
            autoCapitalize="none"
            label="Expires (YYYY-MM-DD, optional)"
            onChangeText={setDiscountExpiresAt}
            value={discountExpiresAt}
          />
          <Field
            label="Details (optional)"
            multiline
            onChangeText={setDiscountDetails}
            value={discountDetails}
          />
          <View style={styles.buttonRow}>
            <Pressable
              disabled={Boolean(busyId)}
              onPress={() => void persistDiscount()}
              style={styles.primarySmall}
            >
              {busyId === (editingDiscount?.id ?? 'new-discount') ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save discount</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setEditingDiscount(undefined)}
              style={styles.secondarySmall}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {editingCollection !== undefined ? (
        <View style={styles.editorCard}>
          <Text style={styles.cardTitle}>
            {editingCollection ? 'Edit collection' : 'Add collection'}
          </Text>
          <Field
            label="Collection name"
            onChangeText={setCollectionTitle}
            value={collectionTitle}
          />
          <Field
            label="Description (optional)"
            multiline
            onChangeText={setCollectionDescription}
            value={collectionDescription}
          />
          <Text style={styles.fieldLabelStandalone}>Brand (optional)</Text>
          <ScrollView
            contentContainerStyle={styles.choiceRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <ChoicePill
              label="Any brand"
              onPress={() => setCollectionBrandId(null)}
              selected={collectionBrandId === null}
            />
            {brands.map((brand) => (
              <ChoicePill
                key={brand.id}
                label={brand.name}
                onPress={() => setCollectionBrandId(brand.brandId)}
                selected={collectionBrandId === brand.brandId}
              />
            ))}
          </ScrollView>
          <Text style={styles.fieldLabelStandalone}>Items</Text>
          {recommendations.filter(({ lifecycle }) => lifecycle !== 'archived').length ? (
            recommendations
              .filter(({ lifecycle }) => lifecycle !== 'archived')
              .map((item) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: collectionItemIds.includes(item.id) }}
                  key={item.id}
                  onPress={() => toggleCollectionItem(item.id)}
                  style={styles.checkboxRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      collectionItemIds.includes(item.id) && styles.checkboxSelected,
                    ]}
                  >
                    {collectionItemIds.includes(item.id) ? (
                      <Text style={styles.checkboxMark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.cardTitle}>{item.productName}</Text>
                    <Text style={styles.cardMeta}>{item.brandName}</Text>
                  </View>
                </Pressable>
              ))
          ) : (
            <Empty text="Add an item before creating a collection." />
          )}
          <View style={styles.buttonRow}>
            <Pressable
              disabled={Boolean(busyId) || !collectionItemIds.length}
              onPress={() => void persistCollection()}
              style={styles.primarySmall}
            >
              {busyId === (editingCollection?.id ?? 'new-collection') ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save collection</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setEditingCollection(undefined)}
              style={styles.secondarySmall}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {editingItem !== undefined ? (
        <View style={styles.editorCard}>
          <Text style={styles.cardTitle}>{editingItem ? 'Edit item' : 'Add item'}</Text>
          <Text style={styles.cardMeta}>
            Paste a product link to fetch its details, or fill the fields manually.
          </Text>
          <Field
            autoCapitalize="none"
            keyboardType="url"
            label="Item link (optional)"
            onChangeText={(productUrl) => updateItem({ productUrl })}
            value={itemDraft.productUrl}
          />
          <Pressable
            disabled={fetchingDetails || !itemDraft.productUrl.trim()}
            onPress={() => void fetchDetails()}
            style={styles.fetchButton}
          >
            {fetchingDetails ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.fetchButtonText}>Fetch name, image and price</Text>
            )}
          </Pressable>
          <Field
            label="Item name"
            onChangeText={(productName) => updateItem({ productName })}
            value={itemDraft.productName}
          />
          <Text style={styles.fieldLabelStandalone}>Brand</Text>
          {brands.length ? (
            <ScrollView
              contentContainerStyle={styles.choiceRail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {brands.map((brand) => (
                <ChoicePill
                  key={brand.id}
                  label={brand.name}
                  onPress={() => updateItem({ brandName: brand.name })}
                  selected={itemDraft.brandName === brand.name}
                />
              ))}
            </ScrollView>
          ) : null}
          <Field
            label="Brand name"
            onChangeText={(nextBrandName) => updateItem({ brandName: nextBrandName })}
            value={itemDraft.brandName}
          />
          <Text style={styles.fieldLabelStandalone}>Category</Text>
          <ScrollView
            contentContainerStyle={styles.choiceRail}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((category) => (
              <ChoicePill
                key={category.id}
                label={category.name}
                onPress={() => updateItem({ categoryId: category.id })}
                selected={itemDraft.categoryId === category.id}
              />
            ))}
          </ScrollView>
          <Field
            keyboardType="decimal-pad"
            label="Price in ILS (optional)"
            onChangeText={(priceIls) => updateItem({ priceIls })}
            value={itemDraft.priceIls}
          />
          <Field
            autoCapitalize="none"
            keyboardType="url"
            label="Image link (optional)"
            onChangeText={(imageUrl) => updateItem({ imageAssetId: '', imageUrl })}
            value={itemDraft.imageUrl}
          />
          {itemDraft.imageUrl ? (
            <Image
              accessibilityLabel="Selected item image preview"
              resizeMode="contain"
              source={{ uri: itemDraft.imageUrl }}
              style={styles.itemImagePreview}
            />
          ) : null}
          <Pressable
            disabled={uploadingImage}
            onPress={() => void chooseItemImage()}
            style={styles.fetchButton}
          >
            {uploadingImage ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.fetchButtonText}>Choose image from phone</Text>
            )}
          </Pressable>
          <Field
            label="Your recommendation (optional)"
            multiline
            onChangeText={(review) => updateItem({ review })}
            value={itemDraft.review}
          />
          <View style={styles.buttonRow}>
            <Pressable
              disabled={Boolean(busyId) || !categories.length}
              onPress={() => void persistItem()}
              style={styles.primarySmall}
            >
              {busyId === (editingItem?.id ?? 'new-item') ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Save item</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setEditingItem(undefined)}
              style={styles.secondarySmall}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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

      {configuration.curatedSections.filter(({ kind }) => kind === 'collection')
        .length ? (
        <>
          <Text style={styles.sectionTitle}>Collections</Text>
          {configuration.curatedSections
            .filter(({ kind }) => kind === 'collection')
            .map((collection) => (
              <View key={collection.id} style={styles.listCard}>
                <View style={styles.listCopy}>
                  <Text style={styles.cardTitle}>{collection.title}</Text>
                  <Text style={styles.cardMeta}>
                    {collection.recommendationIds.length} items
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <MoveButtons
                    disabled={Boolean(busyId)}
                    onDown={() =>
                      void moveDashboardContent(collection.id, 'collection', 1)
                    }
                    onUp={() =>
                      void moveDashboardContent(collection.id, 'collection', -1)
                    }
                  />
                  <Pressable onPress={() => openCollection(collection)}>
                    <Text style={styles.editLabel}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => removeCollection(collection)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </>
      ) : null}
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
            <View style={styles.itemActions}>
              {configuration.contentOrder.some(
                ({ id, kind }) => kind === 'recommendation' && id === item.id,
              ) ? (
                <MoveButtons
                  disabled={Boolean(busyId)}
                  onDown={() => void moveDashboardContent(item.id, 'recommendation', 1)}
                  onUp={() => void moveDashboardContent(item.id, 'recommendation', -1)}
                />
              ) : null}
              {item.lifecycle !== 'archived' ? (
                <>
                  <Pressable onPress={() => openItem(item)} style={styles.editItemButton}>
                    <Text style={styles.editLabel}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => archiveItem(item)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </>
              ) : null}
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
          </View>
        ))
      ) : (
        <Empty text="No recommendations yet." />
      )}

      <Text style={styles.sectionTitle}>Discounts</Text>
      {discounts.filter(({ lifecycle }) => lifecycle !== 'archived').length ? (
        discounts
          .filter(({ lifecycle }) => lifecycle !== 'archived')
          .map((discount) => (
            <View key={discount.id} style={styles.listCard}>
              <View style={styles.listCopy}>
                <Text style={styles.cardEyebrow}>{discount.code}</Text>
                <Text style={styles.cardTitle}>
                  {discount.label ??
                    (discount.discountPercent
                      ? `${discount.discountPercent}% off`
                      : 'Creator offer')}
                </Text>
                <Text style={styles.cardMeta}>
                  {discount.lifecycle === 'published' ? 'Live' : 'Hidden'}
                </Text>
              </View>
              <View style={styles.itemActions}>
                <Pressable onPress={() => openDiscount(discount)}>
                  <Text style={styles.editLabel}>Edit</Text>
                </Pressable>
                <Pressable
                  disabled={busyId === discount.id}
                  onPress={() => void toggleDiscount(discount)}
                  style={styles.statusButton}
                >
                  {busyId === discount.id ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Text style={styles.statusButtonText}>
                      {discount.lifecycle === 'published' ? 'Hide' : 'Publish'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
      ) : (
        <Empty text="No discounts yet." />
      )}
    </>
  );
}

function ChoicePill({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choicePill, selected && styles.choicePillSelected]}
    >
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>
        {label}
      </Text>
    </Pressable>
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
  const [editingLabelId, setEditingLabelId] = useState<string | null | undefined>();
  const [labelBrandIds, setLabelBrandIds] = useState<string[]>([]);
  const [labelCollectionIds, setLabelCollectionIds] = useState<string[]>([]);
  const [labelRecommendationIds, setLabelRecommendationIds] = useState<string[]>([]);
  const [labelLayout, setLabelLayout] = useState<'cards' | 'grid'>('grid');
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

  async function setLabelsFrame(labelsFrame: boolean) {
    if (saving) return;
    setSaving(true);
    onError('');
    try {
      const theme: StorefrontTheme = {
        ...defaultStorefrontTheme,
        ...themeConfiguration.theme,
        labelsFrame,
      };
      const saved = await saveStorefrontTheme(themeConfiguration, theme);
      setThemeConfiguration(saved);
      onBundle((current) => (current ? { ...current, theme: saved } : current));
      onNotice(
        labelsFrame
          ? 'Storefront label frames are visible.'
          : 'Storefront label frames are hidden.',
      );
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

  function openLabel(id?: string) {
    const label = id ? configuration.labels.find((item) => item.id === id) : undefined;
    setEditingLabelId(id ?? null);
    setLabelTitle(label?.title ?? '');
    setLabelBrandIds(label?.brandIds ?? []);
    setLabelCollectionIds(label?.collectionIds ?? []);
    setLabelRecommendationIds(label?.recommendationIds ?? []);
    setLabelLayout(label?.layout ?? 'grid');
  }

  function toggleLabelValue(
    id: string,
    values: string[],
    setValues: React.Dispatch<React.SetStateAction<string[]>>,
  ) {
    setValues(
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
  }

  function saveLabel() {
    const title = labelTitle.trim();
    if (!title) return;
    const id = editingLabelId ?? newStudioId();
    const label = {
      brandIds: labelBrandIds,
      categorySlug: null,
      collectionIds: labelCollectionIds,
      id,
      layout: labelLayout,
      recommendationIds: labelRecommendationIds,
      title,
    };
    const next = {
      ...configuration,
      labels:
        editingLabelId === null
          ? [...configuration.labels, label]
          : configuration.labels.map((item) => (item.id === id ? label : item)),
    };
    setEditingLabelId(undefined);
    setLabelTitle('');
    setConfiguration(next);
    void save(next);
  }

  function toggleCategory(category: CategoryCard) {
    const selected = configuration.sections.some(
      ({ category: sectionCategory }) => sectionCategory.id === category.id,
    );
    const next = {
      ...configuration,
      sections: selected
        ? configuration.sections.filter(
            ({ category: sectionCategory }) => sectionCategory.id !== category.id,
          )
        : [
            ...configuration.sections,
            {
              category: {
                id: category.id,
                name: category.name,
                slug: category.slug,
              },
              position: configuration.sections.length,
            },
          ],
    };
    setConfiguration(next);
    void save(next);
  }

  function addMedia() {
    if (!mediaTitle.trim() || !mediaUrl.trim()) return;
    const provider = featuredMediaProvider(mediaUrl);
    const media: FeaturedMedia = {
      displayMode: provider === 'maps' ? 'link' : 'embed',
      id: newStudioId(),
      provider,
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
          if (editingLabelId === id) setEditingLabelId(undefined);
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

  async function moveContent(id: string, kind: 'media', direction: -1 | 1) {
    const index = configuration.contentOrder.findIndex(
      (entry) => entry.kind === kind && entry.id === id,
    );
    const target = index + direction;
    if (index < 0 || target < 0 || target >= configuration.contentOrder.length) return;
    const contentOrder = [...configuration.contentOrder];
    [contentOrder[index], contentOrder[target]] = [
      contentOrder[target]!,
      contentOrder[index]!,
    ];
    const next = { ...configuration, contentOrder };
    setConfiguration(next);
    await save(next);
  }

  async function toggleMediaVisibility(id: string) {
    const next = {
      ...configuration,
      featuredMedia: configuration.featuredMedia.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item,
      ),
    };
    setConfiguration(next);
    await save(next);
  }

  async function moveLabel(id: string, direction: -1 | 1) {
    const index = configuration.labels.findIndex((label) => label.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= configuration.labels.length) return;
    const labels = [...configuration.labels];
    [labels[index], labels[target]] = [labels[target]!, labels[index]!];
    const next = { ...configuration, labels };
    setConfiguration(next);
    await save(next);
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

      <View style={styles.toggleCard}>
        <View style={styles.toggleCopy}>
          <Text style={styles.cardTitle}>Show a frame around labels</Text>
          <Text style={styles.cardMeta}>
            Add or remove the outline around All, Fashion and other storefront filters.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Show a frame around storefront labels"
          disabled={saving}
          onValueChange={(value) => void setLabelsFrame(value)}
          trackColor={{ false: '#d8d0c7', true: colors.accent }}
          value={themeConfiguration.theme.labelsFrame ?? true}
        />
      </View>

      <Text style={styles.sectionTitle}>Storefront categories</Text>
      <Text style={styles.cardMeta}>
        Choose the category sections visitors can browse on your page.
      </Text>
      <View style={styles.wrappedChoices}>
        {bundle.categories.map((category) => (
          <ChoicePill
            key={category.id}
            label={category.name}
            onPress={() => toggleCategory(category)}
            selected={configuration.sections.some(
              ({ category: selected }) => selected.id === category.id,
            )}
          />
        ))}
      </View>

      <View style={styles.editorCard}>
        <View style={styles.labelHeadingRow}>
          <View style={styles.listCopy}>
            <Text style={styles.cardTitle}>Storefront labels</Text>
            <Text style={styles.cardMeta}>
              Create filters such as “My favorites” and choose exactly what they show.
            </Text>
          </View>
          {editingLabelId === undefined ? (
            <Pressable onPress={() => openLabel()} style={styles.compactButton}>
              <Text style={styles.compactButtonText}>+ Label</Text>
            </Pressable>
          ) : null}
        </View>
        {editingLabelId !== undefined ? (
          <>
            <Field label="Label name" onChangeText={setLabelTitle} value={labelTitle} />
            <Text style={styles.fieldLabelStandalone}>Layout</Text>
            <View style={styles.inlineChoices}>
              <ChoicePill
                label="Grid"
                onPress={() => setLabelLayout('grid')}
                selected={labelLayout === 'grid'}
              />
              <ChoicePill
                label="Cards"
                onPress={() => setLabelLayout('cards')}
                selected={labelLayout === 'cards'}
              />
            </View>
            {bundle.brands.length ? (
              <LabelChoices
                label="Brands"
                onToggle={(id) => toggleLabelValue(id, labelBrandIds, setLabelBrandIds)}
                options={bundle.brands.map((brand) => ({
                  id: brand.brandId,
                  label: brand.name,
                }))}
                selectedIds={labelBrandIds}
              />
            ) : null}
            {configuration.curatedSections.some(({ kind }) => kind === 'collection') ? (
              <LabelChoices
                label="Collections"
                onToggle={(id) =>
                  toggleLabelValue(id, labelCollectionIds, setLabelCollectionIds)
                }
                options={configuration.curatedSections
                  .filter(({ kind }) => kind === 'collection')
                  .map((collection) => ({
                    id: collection.id,
                    label: collection.title,
                  }))}
                selectedIds={labelCollectionIds}
              />
            ) : null}
            {bundle.recommendations.some(({ lifecycle }) => lifecycle !== 'archived') ? (
              <LabelChoices
                label="Items"
                onToggle={(id) =>
                  toggleLabelValue(id, labelRecommendationIds, setLabelRecommendationIds)
                }
                options={bundle.recommendations
                  .filter(({ lifecycle }) => lifecycle !== 'archived')
                  .map((item) => ({ id: item.id, label: item.productName }))}
                selectedIds={labelRecommendationIds}
              />
            ) : null}
            <View style={styles.buttonRow}>
              <Pressable
                disabled={saving || !labelTitle.trim()}
                onPress={saveLabel}
                style={styles.primarySmall}
              >
                <Text style={styles.primaryButtonText}>Save label</Text>
              </Pressable>
              <Pressable
                onPress={() => setEditingLabelId(undefined)}
                style={styles.secondarySmall}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </>
        ) : null}
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
          <View style={styles.itemActions}>
            <MoveButtons
              disabled={saving}
              onDown={() => void moveLabel(label.id, 1)}
              onUp={() => void moveLabel(label.id, -1)}
            />
            <Pressable onPress={() => openLabel(label.id)}>
              <Text style={styles.editLabel}>Edit</Text>
            </Pressable>
            <Pressable onPress={() => removeLabel(label.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={styles.editorCard}>
        <Text style={styles.cardTitle}>Add media</Text>
        <Text style={styles.cardMeta}>
          YouTube, Instagram, TikTok, Spotify, Apple Music or Google Maps.
        </Text>
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
          <View style={styles.itemActions}>
            <MoveButtons
              disabled={saving}
              onDown={() => void moveContent(item.id, 'media', 1)}
              onUp={() => void moveContent(item.id, 'media', -1)}
            />
            <Pressable onPress={() => void toggleMediaVisibility(item.id)}>
              <Text style={styles.editLabel}>{item.visible ? 'Hide' : 'Show'}</Text>
            </Pressable>
            <Pressable onPress={() => removeMedia(item.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {saving ? <ActivityIndicator color={colors.accent} style={styles.saving} /> : null}
    </>
  );
}

function LabelChoices({
  label,
  onToggle,
  options,
  selectedIds,
}: {
  label: string;
  onToggle: (id: string) => void;
  options: { id: string; label: string }[];
  selectedIds: string[];
}) {
  return (
    <>
      <Text style={styles.fieldLabelStandalone}>{label}</Text>
      {options.map((option) => (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selectedIds.includes(option.id) }}
          key={option.id}
          onPress={() => onToggle(option.id)}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              selectedIds.includes(option.id) && styles.checkboxSelected,
            ]}
          >
            {selectedIds.includes(option.id) ? (
              <Text style={styles.checkboxMark}>✓</Text>
            ) : null}
          </View>
          <Text style={styles.choiceListLabel}>{option.label}</Text>
        </Pressable>
      ))}
    </>
  );
}

function MoveButtons({
  disabled,
  onDown,
  onUp,
}: {
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <View accessibilityLabel="Reorder content" style={styles.moveButtons}>
      <Pressable
        accessibilityLabel="Move up"
        disabled={disabled}
        onPress={onUp}
        style={styles.moveButton}
      >
        <Text style={styles.moveButtonText}>↑</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Move down"
        disabled={disabled}
        onPress={onDown}
        style={styles.moveButton}
      >
        <Text style={styles.moveButtonText}>↓</Text>
      </Pressable>
    </View>
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
  const [avatarAssetId, setAvatarAssetId] = useState(
    bundle.profile.avatar?.assetId ?? '',
  );
  const [avatarUrl, setAvatarUrl] = useState(bundle.profile.avatar?.url ?? '');
  const [primaryCategoryId, setPrimaryCategoryId] = useState(
    bundle.profile.primaryCategory?.id ?? bundle.categories[0]?.id ?? '',
  );
  const [socialValues, setSocialValues] = useState(
    () =>
      Object.fromEntries(
        profileSocialFields.map(({ platform }) => [
          platform,
          linkFor(bundle.profile.socialLinks, platform),
        ]),
      ) as Record<CreatorProfileSocialLink['platform'], string>,
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
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
      const socialLinks: CreatorProfileSocialLink[] = profileSocialFields.flatMap(
        ({ platform }) => {
          const value = socialValues[platform].trim();
          return value ? [{ platform, url: normalizeUrl(value) }] : [];
        },
      );
      const profile = await updateCreatorProfile(bundle.profile, {
        avatarAssetId: avatarAssetId || null,
        bioHe: bio,
        displayName: displayName.trim(),
        handle: handle.trim(),
        ...(primaryCategoryId ? { primaryCategoryId } : {}),
        socialLinks,
      });
      onBundle((current) =>
        current
          ? {
              ...current,
              profile,
              summary: {
                ...current.summary,
                avatarUrl: profile.avatar?.url ?? null,
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

  async function chooseAvatar() {
    onError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      onError('Allow photo access to choose a profile image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadCreatorImage({
        fileSize: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? 'image/jpeg',
        uri: asset.uri,
      });
      setAvatarAssetId(uploaded.id);
      setAvatarUrl(uploaded.publicUrl);
      onNotice('Profile image uploaded. Save your profile to publish it.');
    } catch (cause) {
      onError(messageFor(cause));
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <>
      <Text style={styles.eyebrow}>CREATOR STUDIO / ACCOUNT</Text>
      <Text style={styles.title}>Profile & links</Text>
      <Text style={styles.lede}>These details appear at the top of your storefront.</Text>
      <View style={styles.editorCard}>
        <View style={styles.avatarEditorRow}>
          {avatarUrl ? (
            <Image
              accessibilityLabel="Profile image preview"
              source={{ uri: avatarUrl }}
              style={styles.avatarPreview}
            />
          ) : (
            <View style={[styles.avatarPreview, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {displayName.trim().slice(0, 1).toUpperCase() || 'S'}
              </Text>
            </View>
          )}
          <Pressable
            disabled={uploadingAvatar}
            onPress={() => void chooseAvatar()}
            style={styles.avatarButton}
          >
            {uploadingAvatar ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.fetchButtonText}>Choose profile image</Text>
            )}
          </Pressable>
        </View>
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
        <Text style={styles.fieldLabelStandalone}>Primary category</Text>
        <ScrollView
          contentContainerStyle={styles.choiceRail}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {bundle.categories.map((category) => (
            <ChoicePill
              key={category.id}
              label={category.name}
              onPress={() => setPrimaryCategoryId(category.id)}
              selected={primaryCategoryId === category.id}
            />
          ))}
        </ScrollView>
        <Text style={styles.sectionTitle}>Social links</Text>
        {profileSocialFields.map(({ label, platform }) => (
          <Field
            autoCapitalize="none"
            key={platform}
            keyboardType="url"
            label={label}
            onChangeText={(value) =>
              setSocialValues((current) => ({ ...current, [platform]: value }))
            }
            value={socialValues[platform]}
          />
        ))}
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
            Purchases, support, legal information, sign out and privacy controls.
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </>
  );
}

const profileSocialFields: readonly {
  label: string;
  platform: CreatorProfileSocialLink['platform'];
}[] = [
  { label: 'Instagram', platform: 'instagram' },
  { label: 'TikTok', platform: 'tiktok' },
  { label: 'YouTube', platform: 'youtube' },
  { label: 'Facebook', platform: 'facebook' },
  { label: 'LinkedIn', platform: 'linkedin' },
  { label: 'X', platform: 'x' },
  { label: 'Pinterest', platform: 'pinterest' },
  { label: 'Spotify', platform: 'spotify' },
  { label: 'Apple Music', platform: 'apple_music' },
  { label: 'Website', platform: 'website' },
];

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
  headingActions: { gap: 8, marginTop: spacing.lg },
  compactButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactButtonText: { color: colors.white, fontWeight: '700' },
  compactButtonSecondary: {
    borderColor: colors.accent,
    borderRadius: radii.control,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  compactButtonSecondaryText: { color: colors.accent, fontWeight: '700' },
  fetchButton: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  fetchButtonText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  itemImagePreview: {
    backgroundColor: '#f5f1eb',
    borderRadius: radii.control,
    height: 180,
    marginTop: spacing.sm,
    width: '100%',
  },
  avatarEditorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatarPreview: { borderRadius: 44, height: 88, width: 88 },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#efe5d9',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    color: colors.accent,
    fontFamily: 'Georgia',
    fontSize: 36,
    fontWeight: '700',
  },
  avatarButton: {
    alignItems: 'center',
    borderColor: colors.accent,
    borderRadius: radii.control,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  fieldLabelStandalone: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  choiceRail: { gap: 8, paddingVertical: spacing.sm },
  choicePill: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  choicePillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  choicePillText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  choicePillTextSelected: { color: colors.white },
  wrappedChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  inlineChoices: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
  labelHeadingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  choiceListLabel: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '600' },
  checkboxRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxMark: { color: colors.white, fontSize: 15, fontWeight: '800' },
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
  toggleCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  toggleCopy: { flex: 1 },
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
  itemActions: { alignItems: 'flex-end', gap: 7 },
  moveButtons: { flexDirection: 'row', gap: 5 },
  moveButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 32,
  },
  moveButtonText: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  editItemButton: { paddingHorizontal: 10, paddingVertical: 5 },
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

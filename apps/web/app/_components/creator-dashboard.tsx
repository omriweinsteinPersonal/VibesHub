'use client';

import type {
  CategoryCard,
  CreatorBrand,
  CreatorDiscountCode,
  CreatorProductMetadata,
  CreatorProfileSettings,
  CreatorRecommendation,
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  FeaturedMedia,
  StoryClipInput,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  Link2,
  PlayCircle,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react';

import { ApiError, apiCollectionRequest, apiRequest } from '../../lib/api';
import {
  recommendationImageAccept,
  storyVideoAccept,
  uploadRecommendationImage,
  uploadStoryVideo,
} from '../../lib/recommendation-media';
import { randomUuid } from '../../lib/random-id';
import { hasRecommendationImage } from '../../lib/recommendation-image';
import { CreatorConnectorsEditor } from './creator-connectors-editor';
import { useCreatorNavigation } from './creator-navigation-provider';
import { DelayedLoading } from './delayed-loading';
import styles from './creator-dashboard.module.css';

type Composer = null | 'choose' | 'product' | 'discount' | 'brand' | 'collection';
type CuratedSection = CreatorStorefrontConfigurationInput['curatedSections'][number];
type ContentLayer = CreatorStorefrontConfigurationInput['contentOrder'][number];
type StorefrontLabel = CreatorStorefrontConfigurationInput['labels'][number];
type FeaturedMediaDraft = Omit<FeaturedMedia, 'id' | 'visible'>;
type CollectionManageEntry = {
  kind: 'collection';
  section: CuratedSection;
  items: CreatorRecommendation[];
};

interface ProductEditor {
  additionalImages: Array<{ imageAssetId: string; url: string }>;
  brandName: string;
  brandDiscountCodeId: string;
  categoryId: string;
  categoryIds: string[];
  collectionIds: string[];
  contentKind: 'product' | 'link';
  discountCode: string;
  discountExpiresAt: string;
  discountLabel: string;
  discountType: 'amount' | 'percent';
  discountValue: string;
  imageAssetId: string;
  imageUrl: string;
  instagramStoryUrl: string;
  linkHasBackground: boolean;
  priceIls: string;
  productName: string;
  productUrl: string;
  reviewHe: string;
  storyClips: Array<{ mediaAssetId: string; url: string }>;
  storyLink: string;
}

interface DiscountEditor {
  brandId: string;
  code: string;
  detailsHe: string;
  discountType: 'percent' | 'amount';
  discountPercent: string;
  discountAmount: string;
  expiresAt: string;
  label: string;
  merchantUrl: string;
  offerType: 'brand_promotion' | 'creator_code';
  priority: string;
  recurrenceRule: 'month_end_week' | 'none';
  scopeTarget: string;
  stackable: boolean;
  startsAt: string;
  storyClips: Array<{ mediaAssetId: string; url: string }>;
}
interface BrandEditor {
  code: string;
  discountType: 'percent' | 'amount';
  detailsHe: string;
  discountPercent: string;
  discountAmount: string;
  expiresAt: string;
  name: string;
  websiteUrl: string;
  logoAssetId: string;
  logoUrl: string;
}

type DiscountOfferPayload = {
  brandId: string | null;
  code: string | null;
  detailsHe: string | null;
  discountPercent: number | null;
  discountAmountMinor: number | null;
  storyClips?: StoryClipInput[];
  expiresAt: string | null;
  label: string | null;
  merchantUrl: string;
  offerType: 'brand_promotion' | 'creator_code';
  priority: number;
  recurrenceRule: 'month_end_week' | 'none';
  scopeId: string | null;
  scopeKind: 'brand' | 'collection' | 'item';
  source: 'manual';
  stackable: boolean;
  startsAt: string | null;
};

/**
 * The web app can be released before the API deployment finishes. Retry the
 * offer request using the previous API contract so a normal code/percentage
 * offer never leaves a newly-created brand looking only half-saved.
 */
function legacyOfferPayload(input: DiscountOfferPayload) {
  const legacy: Partial<DiscountOfferPayload> = { ...input };
  delete legacy.discountAmountMinor;
  delete legacy.storyClips;
  return {
    ...legacy,
    // The earlier API only accepted Hebrew in this legacy field. Keeping it
    // null is safer than rejecting the whole offer when a creator writes in
    // another language; the current API preserves all languages.
    detailsHe:
      legacy.detailsHe && /[א-ת]/u.test(legacy.detailsHe) ? legacy.detailsHe : null,
  };
}

async function saveOffer<T>(
  path: string,
  input: DiscountOfferPayload,
  init: { headers?: HeadersInit; idempotent?: boolean; method: 'PATCH' | 'POST' },
) {
  try {
    return await apiRequest<T>(path, { ...init, body: JSON.stringify(input) });
  } catch (cause) {
    // An old, strict API reports a 400 for the newer fixed-amount/video
    // properties. Retry without only those additions so codes still save.
    if (!(cause instanceof ApiError) || cause.status !== 400) throw cause;
    return apiRequest<T>(path, {
      ...init,
      body: JSON.stringify(legacyOfferPayload(input)),
    });
  }
}

function legacyRecommendationPayload(input: Record<string, unknown>) {
  const legacy = { ...input };
  delete legacy.discountAmountMinor;
  delete legacy.storyClips;
  return legacy;
}

async function saveRecommendation<T>(
  path: string,
  input: Record<string, unknown>,
  init: { headers?: HeadersInit; idempotent?: boolean; method: 'PATCH' | 'POST' },
) {
  try {
    return await apiRequest<T>(path, { ...init, body: JSON.stringify(input) });
  } catch (cause) {
    // Older API deployments do not yet know these optional additions. Retrying
    // preserves the recommendation instead of blocking the entire dashboard.
    if (!(cause instanceof ApiError) || cause.status !== 400) throw cause;
    return apiRequest<T>(path, {
      ...init,
      body: JSON.stringify(legacyRecommendationPayload(input)),
    });
  }
}

const emptyProduct: ProductEditor = {
  additionalImages: [],
  brandName: '',
  brandDiscountCodeId: '',
  categoryId: '',
  categoryIds: [],
  collectionIds: [],
  contentKind: 'product',
  discountCode: '',
  discountExpiresAt: '',
  discountLabel: '',
  discountType: 'percent',
  discountValue: '',
  imageAssetId: '',
  imageUrl: '',
  instagramStoryUrl: '',
  linkHasBackground: false,
  priceIls: '',
  productName: '',
  productUrl: '',
  reviewHe: '',
  storyClips: [],
  storyLink: '',
};

const emptyDiscount: DiscountEditor = {
  brandId: '',
  code: '',
  detailsHe: '',
  discountType: 'percent',
  discountPercent: '',
  discountAmount: '',
  expiresAt: '',
  label: '',
  merchantUrl: '',
  offerType: 'creator_code',
  priority: '0',
  recurrenceRule: 'none',
  scopeTarget: 'brand',
  stackable: false,
  startsAt: '',
  storyClips: [],
};

export function CreatorDashboard() {
  const { creatorProfile, setCreatorProfile } = useCreatorNavigation();
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [loadedProfile, setLoadedProfile] = useState<CreatorProfileSettings | null>(null);
  const profile = loadedProfile ?? creatorProfile;
  const [recommendations, setRecommendations] = useState<CreatorRecommendation[]>([]);
  const [discounts, setDiscounts] = useState<CreatorDiscountCode[]>([]);
  const [brands, setBrands] = useState<CreatorBrand[]>([]);
  const [configuration, setConfiguration] =
    useState<CreatorStorefrontConfiguration | null>(null);
  const [composer, setComposer] = useState<Composer>(null);
  const [product, setProduct] = useState<ProductEditor>(emptyProduct);
  const [discount, setDiscount] = useState<DiscountEditor>(emptyDiscount);
  const [brand, setBrand] = useState<BrandEditor>({
    code: '',
    discountType: 'percent',
    detailsHe: '',
    discountPercent: '',
    discountAmount: '',
    expiresAt: '',
    name: '',
    websiteUrl: '',
    logoAssetId: '',
    logoUrl: '',
  });
  const [editingBrand, setEditingBrand] = useState<CreatorBrand | null>(null);
  const [editingProduct, setEditingProduct] = useState<CreatorRecommendation | null>(
    null,
  );
  const [editingDiscount, setEditingDiscount] = useState<CreatorDiscountCode | null>(
    null,
  );
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [curatedSections, setCuratedSections] = useState<CuratedSection[]>([]);
  const [contentOrder, setContentOrder] = useState<ContentLayer[]>([]);
  const [featuredMedia, setFeaturedMedia] = useState<FeaturedMedia[]>([]);
  const [mediaDraft, setMediaDraft] = useState<FeaturedMediaDraft>({
    provider: 'youtube',
    url: '',
    title: '',
    thumbnailUrl: null,
    displayMode: 'embed',
  });
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [mediaEditorOpen, setMediaEditorOpen] = useState(false);
  const [storefrontLabels, setStorefrontLabels] = useState<StorefrontLabel[]>([]);
  const [hiddenBrandIds, setHiddenBrandIds] = useState<string[]>([]);
  const [hiddenCollectionIds, setHiddenCollectionIds] = useState<string[]>([]);
  const [hiddenRecommendationIds, setHiddenRecommendationIds] = useState<string[]>([]);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<
    'recommendations' | 'labels' | 'connectors' | 'media'
  >('recommendations');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchWarnings, setFetchWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [videoStage, setVideoStage] = useState('');
  const [videoError, setVideoError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const productFetchRequest = useRef(0);
  const brandFetchRequest = useRef(0);
  const loadRequest = useRef(0);
  const silentLoadRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++loadRequest.current;
    setLoading(true);
    try {
      const [categoryResult, profileResult, recommendationResult, configResult] =
        await Promise.allSettled([
          apiCollectionRequest<CategoryCard>('/creator/categories'),
          apiRequest<CreatorProfileSettings>('/creator/profile'),
          loadCreatorRecommendations(),
          apiRequest<CreatorStorefrontConfiguration>(
            '/creator/studio/storefront-sections',
          ),
        ]);
      if (
        categoryResult.status !== 'fulfilled' ||
        profileResult.status !== 'fulfilled' ||
        recommendationResult.status !== 'fulfilled'
      ) {
        const failed = [categoryResult, profileResult, recommendationResult].find(
          (result) => result.status === 'rejected',
        );
        throw failed?.status === 'rejected'
          ? failed.reason
          : new Error('Could not load creator recommendations.');
      }
      const categoryPage = categoryResult.value;
      const loadedProfile = profileResult.value;
      const loadedRecommendations = recommendationResult.value;
      const [discountResult, brandResult] = await Promise.allSettled([
        apiCollectionRequest<CreatorDiscountCode>('/creator/discount-codes?limit=48'),
        apiRequest<CreatorBrand[]>('/creator/brands'),
      ]);
      const discountPage =
        discountResult.status === 'fulfilled'
          ? discountResult.value
          : { data: [], page: { hasMore: false, nextCursor: null } };
      const loadedBrands = brandResult.status === 'fulfilled' ? brandResult.value : [];
      setCategories(categoryPage.data);
      setLoadedProfile(loadedProfile);
      setCreatorProfile(loadedProfile);
      setRecommendations(loadedRecommendations);
      setDiscounts(discountPage.data);
      setBrands(loadedBrands);
      if (configResult.status === 'fulfilled') {
        const config = configResult.value;
        const loadedOrder = Array.isArray(config.contentOrder) ? config.contentOrder : [];
        setConfiguration({ ...config, contentOrder: loadedOrder });
        setFeaturedMedia(config.featuredMedia ?? []);
        setStorefrontLabels(config.labels ?? []);
        setHiddenBrandIds(config.hiddenBrandIds ?? []);
        setHiddenCollectionIds(config.hiddenCollectionIds ?? []);
        setHiddenRecommendationIds(config.hiddenRecommendationIds ?? []);
        setContentOrder(
          loadedOrder.filter(({ kind, id }) =>
            kind === 'collection' || kind === 'section'
              ? config.curatedSections.some(
                  (section) => section.id === id && section.kind === kind,
                )
              : kind === 'category'
                ? config.sections.some(({ category }) => category.id === id)
                : kind === 'discount'
                  ? discountPage.data.some(
                      (item) => item.id === id && item.lifecycle !== 'archived',
                    )
                  : kind === 'media'
                    ? (config.featuredMedia ?? []).some((item) => item.id === id)
                    : loadedRecommendations.some(
                        (item) => item.id === id && item.lifecycle !== 'archived',
                      ),
          ),
        );
        setSelectedSections(config.sections.map(({ category }) => category.id));
        const activeIds = new Set(
          loadedRecommendations
            .filter(({ lifecycle }) => lifecycle !== 'archived')
            .map(({ id }) => id),
        );
        setCuratedSections(
          config.curatedSections.map((section) => ({
            ...section,
            recommendationIds: section.recommendationIds.filter((id) =>
              activeIds.has(id),
            ),
          })),
        );
      } else {
        setNotice('Recommendations loaded. Storefront layout could not be refreshed.');
      }
      if (discountResult.status === 'rejected' || brandResult.status === 'rejected') {
        setNotice(
          'Some optional brand data could not be refreshed. You can continue editing.',
        );
      }
    } catch (cause) {
      // A mutation can succeed even when the follow-up dashboard refresh is
      // interrupted (especially on mobile Safari). Do not turn a successful
      // save into a misleading "Load failed" error in that case.
      if (requestId === loadRequest.current && !silentLoadRef.current) {
        setError(messageFor(cause));
      }
    } finally {
      setLoading(false);
    }
  }, [setCreatorProfile]);

  const refreshAfterSave = useCallback(async () => {
    silentLoadRef.current = true;
    try {
      await load();
    } finally {
      silentLoadRef.current = false;
    }
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      if (new URLSearchParams(window.location.search).get('add') === 'product') {
        setComposer('product');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!composer) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('creator-composer')?.scrollIntoView({ block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [composer]);

  function showComposer(next: Exclude<Composer, null>) {
    setComposer(next);
    setEditingProduct(null);
    setEditingDiscount(null);
    setEditingBrand(null);
    setError('');
    setVideoError('');
    setNotice('');
  }

  function closeComposer() {
    productFetchRequest.current += 1;
    setFetching(false);
    setError('');
    setVideoError('');
    setNotice('');
    setFetchWarnings([]);
    brandFetchRequest.current += 1;
    setComposer(null);
    setEditingProduct(null);
    setEditingDiscount(null);
    setEditingBrand(null);
    setProduct(emptyProduct);
    setDiscount(emptyDiscount);
    setBrand({
      code: '',
      discountType: 'percent',
      detailsHe: '',
      discountPercent: '',
      discountAmount: '',
      expiresAt: '',
      name: '',
      websiteUrl: '',
      logoAssetId: '',
      logoUrl: '',
    });
  }

  async function selectBrandLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const asset = await uploadRecommendationImage(file, () => undefined);
      setBrand((current) => ({
        ...current,
        logoAssetId: asset.id,
        logoUrl: asset.publicUrl,
      }));
      setNotice('Brand image uploaded. Save the brand to publish it.');
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedWebsiteUrl = brand.websiteUrl.trim();
    const brandWebsiteChanged =
      !editingBrand || normalizedWebsiteUrl !== editingBrand.websiteUrl.trim();
    const brandLogoChanged =
      !editingBrand ||
      brand.logoUrl.trim() !== (editingBrand.logoUrl ?? '').trim() ||
      (brand.logoAssetId || null) !== (editingBrand.logoAssetId ?? null);
    if (brandWebsiteChanged && !normalizedProductUrl(normalizedWebsiteUrl)) {
      setError(
        'Enter a full HTTPS brand website URL, for example https://www.example.com.',
      );
      return;
    }
    if (
      brand.discountPercent &&
      (!Number.isInteger(Number(brand.discountPercent)) ||
        Number(brand.discountPercent) < 1 ||
        Number(brand.discountPercent) > 100)
    ) {
      setError('Enter a whole-number discount from 1 to 100%.');
      return;
    }
    if (
      brand.discountAmount &&
      (!Number.isFinite(Number(brand.discountAmount)) ||
        !Number.isInteger(Number(brand.discountAmount) * 100) ||
        Number(brand.discountAmount) < 0.01)
    ) {
      setError('Enter a fixed discount of at least ₪0.01, with up to two decimals.');
      return;
    }
    if (
      (brand.detailsHe.trim() || brand.expiresAt) &&
      !brand.code.trim() &&
      !brand.discountPercent &&
      !brand.discountAmount
    ) {
      setError('Add a discount code or amount before adding offer details.');
      return;
    }
    setSaving(true);
    setError('');
    const wasEditingBrand = Boolean(editingBrand);
    let mutationSucceeded = false;
    try {
      const updateBrand = (version: number) =>
        apiRequest<CreatorBrand>(`/creator/brands/${editingBrand!.id}`, {
          body: JSON.stringify({
            name: brand.name,
            websiteUrl: normalizedWebsiteUrl,
            logoAssetId: brand.logoAssetId || null,
            logoUrl: brand.logoAssetId ? null : brand.logoUrl.trim() || null,
          }),
          headers: { 'if-match': `"${version}"` },
          method: 'PATCH',
        });
      const existingOffer = editingBrand
        ? discounts.find(
            (offer) => offer.brandId === editingBrand.id && offer.scopeKind === 'brand',
          )
        : null;
      const offerFieldsChanged = existingOffer
        ? brand.code.trim() !== (existingOffer.code ?? '') ||
          brand.detailsHe.trim() !== (existingOffer.details?.value ?? '') ||
          (brand.discountPercent ? Number(brand.discountPercent) : null) !==
            existingOffer.discountPercent ||
          (brand.discountAmount
            ? Math.round(Number(brand.discountAmount) * 100)
            : null) !== existingOffer.discountAmountMinor ||
          brand.expiresAt !== toLocalDate(existingOffer.expiresAt)
        : false;
      let savedBrand: CreatorBrand;
      if (editingBrand) {
        if (
          !brandWebsiteChanged &&
          !brandLogoChanged &&
          brand.name.trim() === editingBrand.name.trim()
        ) {
          // Editing only the offer must not re-submit the brand URL. This keeps
          // legacy records with an old/malformed URL editable while the offer
          // itself continues using its already validated merchant URL.
          savedBrand = editingBrand;
        } else {
          try {
            savedBrand = await updateBrand(editingBrand.version);
            mutationSucceeded = true;
          } catch (cause) {
            if (!(cause instanceof Error) || !cause.message.includes('Reload the brand'))
              throw cause;
            const currentBrands = await apiRequest<CreatorBrand[]>('/creator/brands');
            const current = currentBrands.find(({ id }) => id === editingBrand.id);
            if (!current) throw cause;
            savedBrand = await updateBrand(current.version);
            mutationSucceeded = true;
          }
        }
      } else {
        savedBrand = await apiRequest<CreatorBrand>('/creator/brands', {
          body: JSON.stringify({
            name: brand.name,
            websiteUrl: normalizedWebsiteUrl,
            logoAssetId: brand.logoAssetId || null,
            logoUrl: brand.logoAssetId ? null : brand.logoUrl.trim() || null,
          }),
          idempotent: true,
          method: 'POST',
        });
        mutationSucceeded = true;
      }
      // Upload completion only confirms the media object. The brand response
      // must confirm that the chosen image is attached before reporting success.
      if (
        brandLogoChanged &&
        (savedBrand.logoAssetId ?? null) !== (brand.logoAssetId || null)
      ) {
        throw new Error('The brand image was not saved. Please try again.');
      }
      if (
        brandLogoChanged &&
        brand.logoUrl.trim() &&
        savedBrand.logoUrl !== brand.logoUrl.trim()
      ) {
        throw new Error('The brand image was not saved. Please try again.');
      }
      setEditingBrand(savedBrand);
      const hasOffer = Boolean(
        brand.code.trim() || brand.discountPercent || brand.discountAmount,
      );
      const visibleBrandIds = hiddenBrandIds.filter((id) => id !== savedBrand.id);
      const wasHidden = visibleBrandIds.length !== hiddenBrandIds.length;
      if (hasOffer && (!existingOffer || offerFieldsChanged)) {
        const offerBody: DiscountOfferPayload = {
          brandId: savedBrand.id,
          code: brand.code.trim() || null,
          detailsHe: brand.detailsHe.trim() || null,
          discountPercent: brand.discountPercent ? Number(brand.discountPercent) : null,
          discountAmountMinor: brand.discountAmount
            ? Math.round(Number(brand.discountAmount) * 100)
            : null,
          expiresAt: toDateTimeIso(brand.expiresAt),
          label: brand.discountPercent
            ? `${brand.discountPercent}% off`
            : brand.discountAmount
              ? `₪${brand.discountAmount} off`
              : null,
          merchantUrl: existingOffer?.merchantUrl ?? savedBrand.websiteUrl,
          offerType: 'creator_code',
          priority: 0,
          recurrenceRule: 'none',
          scopeId: null,
          scopeKind: 'brand',
          source: 'manual',
          stackable: false,
          startsAt: null,
        };
        if (existingOffer) {
          // Read a fresh version first: the dashboard list can be older than
          // an offer just saved in another tab or by a previous composer.
          const latest = await apiRequest<CreatorDiscountCode>(
            `/creator/discount-codes/${existingOffer.id}`,
          );
          const updated = await saveOffer<CreatorDiscountCode>(
            `/creator/discount-codes/${existingOffer.id}`,
            offerBody,
            { headers: { 'if-match': `"${latest.version}"` }, method: 'PATCH' },
          );
          mutationSucceeded = true;
          if (updated.lifecycle !== 'published') {
            await apiRequest(`/creator/discount-codes/${updated.id}/confirm`, {
              headers: { 'if-match': `"${updated.version}"` },
              idempotent: true,
              method: 'POST',
            });
          }
        } else {
          const created = await saveOffer<CreatorDiscountCode>(
            '/creator/discount-codes',
            offerBody,
            { idempotent: true, method: 'POST' },
          );
          mutationSucceeded = true;
          await apiRequest(`/creator/discount-codes/${created.id}/confirm`, {
            headers: { 'if-match': `"${created.version}"` },
            idempotent: true,
            method: 'POST',
          });
          const sectionsSaved = await saveSections(
            selectedSections,
            curatedSections,
            [...contentOrder, { kind: 'discount', id: created.id }],
            storefrontLabels,
            visibleBrandIds,
          );
          if (!sectionsSaved)
            throw new Error(
              'The brand offer was saved, but its storefront position could not be updated.',
            );
        }
      } else if (!hasOffer && existingOffer && offerFieldsChanged) {
        await apiRequest(`/creator/discount-codes/${existingOffer.id}/archive`, {
          headers: { 'if-match': `"${existingOffer.version}"` },
          idempotent: true,
          method: 'POST',
        });
        mutationSucceeded = true;
      }
      if (wasHidden && !(hasOffer && !existingOffer)) {
        if (
          !(await saveSections(
            selectedSections,
            curatedSections,
            contentOrder,
            storefrontLabels,
            visibleBrandIds,
          ))
        ) {
          throw new Error(
            'The brand was saved, but it could not be made visible in the storefront.',
          );
        }
      }
      closeComposer();
      await refreshAfterSave();
      setError('');
      setNotice(
        wasEditingBrand
          ? 'Brand updated.'
          : 'Brand added. You can now add items and collections to it.',
      );
    } catch (cause) {
      if (mutationSucceeded) {
        setError(messageFor(cause));
        setNotice(
          'Some brand changes were saved, but the update is incomplete. Please retry.',
        );
        await refreshAfterSave();
        return;
      }
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  const fetchProductDetails = useCallback(
    async (rawUrl: string) => {
      const requestedUrl = normalizedProductUrl(rawUrl);
      if (!requestedUrl) return;
      const requestId = ++productFetchRequest.current;
      setFetching(true);
      setFetchWarnings([]);
      setError('');
      try {
        const metadata = await apiRequest<CreatorProductMetadata>(
          '/creator/recommendations/fetch-details',
          {
            body: JSON.stringify({ url: requestedUrl }),
            method: 'POST',
            timeoutMs: 6_000,
          },
        );
        if (productFetchRequest.current !== requestId) return;
        const warnings = [
          metadata.productName ? null : 'Product name was not found.',
          metadata.brandName ? null : 'Brand was not found.',
          metadata.imageUrl ? null : 'No product image was found.',
          metadata.priceAmountMinor === null ? 'Price was not found.' : null,
          metadata.categorySlug ? null : 'Category was not identified.',
          metadata.description ? null : 'Product description was not found.',
        ].filter((value): value is string => Boolean(value));
        setFetchWarnings(warnings);
        setProduct((current) => {
          const detectedCategoryId = categories.find(
            (category) => category.slug === metadata.categorySlug,
          )?.id;
          const detectedBrand = brands.find(
            (brand) =>
              brand.name.toLocaleLowerCase() ===
              (metadata.brandName ?? current.brandName).trim().toLocaleLowerCase(),
          );
          const detectedBrandOffer = discounts.find(
            (offer) =>
              offer.brandId === detectedBrand?.id &&
              offer.scopeKind === 'brand' &&
              offer.lifecycle === 'published' &&
              offer.code,
          );
          const categoryId = detectedCategoryId ?? current.categoryId;
          return normalizedProductUrl(current.productUrl) === requestedUrl
            ? {
                ...current,
                brandName: metadata.brandName ?? current.brandName,
                brandDiscountCodeId:
                  detectedBrandOffer?.id ?? current.brandDiscountCodeId,
                categoryId,
                categoryIds: detectedCategoryId
                  ? [detectedCategoryId]
                  : current.categoryIds,
                additionalImages: current.imageAssetId
                  ? current.additionalImages
                  : metadata.imageUrls.slice(1).map((url) => ({ imageAssetId: '', url })),
                imageAssetId:
                  metadata.imageUrl && !current.imageAssetId ? '' : current.imageAssetId,
                imageUrl:
                  metadata.imageUrl && !current.imageAssetId
                    ? metadata.imageUrl
                    : current.imageUrl,
                priceIls:
                  metadata.priceAmountMinor === null
                    ? current.priceIls
                    : String(metadata.priceAmountMinor / 100),
                productName: metadata.productName ?? current.productName,
                productUrl: metadata.productUrl,
                reviewHe: metadata.description
                  ? metadata.description.slice(0, 1000)
                  : current.reviewHe,
              }
            : current;
        });
        if (productFetchRequest.current === requestId) {
          setNotice(
            metadata.imageUrl
              ? metadata.priceAmountMinor === null
                ? 'Product details fetched. This store did not expose a price, so add it manually before saving.'
                : 'Product details fetched. Review them, then select Save recommendation.'
              : 'Product details fetched, but this store did not provide a photo. You can add one or save this as a text-only recommendation.',
          );
        }
      } catch (cause) {
        if (productFetchRequest.current === requestId) {
          setFetchWarnings([]);
          setError(messageFor(cause));
        }
      } finally {
        if (productFetchRequest.current === requestId) {
          setFetching(false);
        }
      }
    },
    [brands, categories, discounts],
  );

  const fetchBrandDetails = useCallback(async () => {
    const requestedUrl = normalizedProductUrl(brand.websiteUrl);
    if (!requestedUrl) {
      setError('Enter a full HTTPS brand website URL first.');
      return;
    }
    const requestId = ++brandFetchRequest.current;
    setFetching(true);
    setFetchWarnings([]);
    setError('');
    try {
      const metadata = await apiRequest<CreatorProductMetadata>(
        '/creator/recommendations/fetch-details',
        {
          body: JSON.stringify({ url: requestedUrl }),
          method: 'POST',
          timeoutMs: 6_000,
        },
      );
      if (brandFetchRequest.current !== requestId) return;
      setBrand((current) => ({
        ...current,
        name: current.name.trim() || metadata.brandName || brandNameFromUrl(requestedUrl),
        logoUrl: current.logoAssetId
          ? current.logoUrl
          : metadata.imageUrl || current.logoUrl || brandLogoFromUrl(requestedUrl),
      }));
      setFetchWarnings(
        [
          metadata.imageUrl
            ? null
            : 'No brand image was found. You can upload one or paste an image URL.',
        ].filter((value): value is string => Boolean(value)),
      );
      setNotice(
        metadata.imageUrl
          ? 'Brand name and image fetched. Review the preview, then save the brand.'
          : 'Brand name fetched. Add an image before saving if needed.',
      );
    } catch (cause) {
      if (brandFetchRequest.current === requestId) setError(messageFor(cause));
    } finally {
      if (brandFetchRequest.current === requestId) setFetching(false);
    }
  }, [brand.websiteUrl]);

  async function selectStoryClip(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError('');
    setVideoError('');
    try {
      for (const file of files.slice(0, 10 - product.storyClips.length)) {
        const asset = await uploadStoryVideo(file, (stage, percent) =>
          setVideoStage(
            stage === 'uploading' && percent !== undefined
              ? `Uploading ${percent}%`
              : stage,
          ),
        );
        setProduct((current) => ({
          ...current,
          storyClips: [
            ...current.storyClips,
            { mediaAssetId: asset.id, url: asset.publicUrl },
          ],
        }));
      }
      setNotice('Story clip uploaded and verified.');
    } catch (cause) {
      setVideoError(messageFor(cause));
    } finally {
      setUploading(false);
      setVideoStage('');
      event.target.value = '';
    }
  }

  async function selectProductImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(
      0,
      10 - (product.additionalImages.length + 1),
    );
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        const asset = await uploadRecommendationImage(file, () => undefined);
        setProduct((current) => {
          if (!current.imageAssetId && !current.imageUrl) {
            return { ...current, imageAssetId: asset.id, imageUrl: asset.publicUrl };
          }
          return {
            ...current,
            additionalImages: [
              ...current.additionalImages,
              { imageAssetId: asset.id, url: asset.publicUrl },
            ].slice(0, 9),
          };
        });
      }
      setNotice('Product photos uploaded. The first photo is the default.');
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function addStoryLink() {
    const url = product.storyLink.trim();
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw new Error();
    } catch {
      setError('Use a valid HTTPS video link.');
      return;
    }
    setProduct((current) => ({
      ...current,
      storyClips: [...current.storyClips, { mediaAssetId: '', url }].slice(0, 10),
      storyLink: '',
    }));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    productFetchRequest.current += 1;
    setFetching(false);
    setNotice('');
    const isLinkCard = product.contentKind === 'link';
    const price = product.priceIls.trim() ? Number(product.priceIls) : 0;
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!product.brandDiscountCodeId && product.discountValue.trim()) {
      const value = Number(product.discountValue);
      if (
        !Number.isFinite(value) ||
        value <= 0 ||
        (product.discountType === 'percent' &&
          (!Number.isInteger(value) || value > 100)) ||
        (product.discountType === 'amount' &&
          (!Number.isInteger(value * 100) || value < 0.01))
      ) {
        setError(
          product.discountType === 'percent'
            ? 'Enter a whole-number discount from 1 to 100%.'
            : 'Enter a fixed discount of at least ₪0.01, with up to two decimals.',
        );
        return;
      }
    }
    if (
      product.instagramStoryUrl.trim() &&
      !normalizeInstagramStoryUrl(product.instagramStoryUrl)
    ) {
      setError('Use a valid HTTPS Instagram Story or Highlight link.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const storyClips: StoryClipInput[] = product.storyClips.map((clip) =>
        clip.mediaAssetId ? { mediaAssetId: clip.mediaAssetId } : { videoUrl: clip.url },
      );
      const body = {
        brandName: isLinkCard ? 'Links' : product.brandName,
        categoryId: product.categoryId,
        categoryIds: product.categoryIds.length
          ? product.categoryIds
          : [product.categoryId],
        commercialRelationship: 'organic',
        contentKind: product.contentKind,
        discountCode: product.brandDiscountCodeId
          ? null
          : product.discountCode.trim() || null,
        brandDiscountCodeId: product.brandDiscountCodeId || null,
        discountPercent:
          !product.brandDiscountCodeId &&
          product.discountType === 'percent' &&
          product.discountValue
            ? Number(product.discountValue)
            : null,
        discountAmountMinor:
          !product.brandDiscountCodeId &&
          product.discountType === 'amount' &&
          product.discountValue
            ? Math.round(Number(product.discountValue) * 100)
            : null,
        discountExpiresAt: product.brandDiscountCodeId
          ? null
          : toIso(product.discountExpiresAt),
        discountLabel:
          !product.brandDiscountCodeId && product.discountValue.trim()
            ? product.discountType === 'percent'
              ? `${product.discountValue.trim()}% off`
              : `₪${product.discountValue.trim()} off`
            : null,
        imageAssetId: product.imageAssetId || null,
        imageUrl: product.imageAssetId ? null : product.imageUrl || null,
        instagramStoryUrl: normalizeInstagramStoryUrl(product.instagramStoryUrl),
        additionalImages: isLinkCard
          ? []
          : product.additionalImages.map((image) =>
              image.imageAssetId
                ? { imageAssetId: image.imageAssetId }
                : { imageUrl: image.url },
            ),
        priceAmountMinor: isLinkCard ? 0 : Math.round(price * 100),
        productName: product.productName,
        productUrl: recommendationProductUrl(product.productUrl),
        reviewHe: isLinkCard
          ? product.linkHasBackground
            ? 'Link card / backdrop'
            : 'Link card'
          : product.reviewHe.trim() || 'לא צורפה ביקורת',
        storyClips: isLinkCard ? [] : storyClips,
        videoUrl: isLinkCard
          ? null
          : (storyClips.find((clip) => clip.videoUrl)?.videoUrl ?? null),
      };
      let savedProduct: CreatorRecommendation;
      if (editingProduct) {
        const update = (version: number) =>
          saveRecommendation<CreatorRecommendation>(
            `/creator/recommendations/${editingProduct.id}`,
            body,
            { headers: { 'if-match': `"${version}"` }, method: 'PATCH' },
          );
        try {
          savedProduct = await update(editingProduct.version);
        } catch (cause) {
          if (
            !(cause instanceof Error) ||
            !cause.message.includes('Reload the recommendation')
          ) {
            throw cause;
          }
          const current = await apiRequest<CreatorRecommendation>(
            `/creator/recommendations/${editingProduct.id}`,
          );
          savedProduct = await update(current.version);
        }
      } else {
        savedProduct = await saveRecommendation<CreatorRecommendation>(
          '/creator/recommendations',
          body,
          { idempotent: true, method: 'POST' },
        );
      }
      const currentCollectionIds = curatedSections
        .filter(
          (section) =>
            section.kind === 'collection' &&
            section.recommendationIds.includes(savedProduct.id),
        )
        .map(({ id }) => id);
      const collectionsChanged =
        [...product.collectionIds].sort().join(':') !==
        [...currentCollectionIds].sort().join(':');
      const nextSections = collectionsChanged
        ? curatedSections.map((section) => {
            if (section.kind !== 'collection') return section;
            const recommendationIds = section.recommendationIds.filter(
              (id) => id !== savedProduct.id,
            );
            return {
              ...section,
              recommendationIds: product.collectionIds.includes(section.id)
                ? [...recommendationIds, savedProduct.id]
                : recommendationIds,
            };
          })
        : curatedSections;
      const withoutStandalone = contentOrder.filter(
        ({ kind, id }) => !(kind === 'recommendation' && id === savedProduct.id),
      );
      const nextOrder = product.collectionIds.length
        ? withoutStandalone
        : [
            ...withoutStandalone,
            { kind: 'recommendation' as const, id: savedProduct.id },
          ];
      if (
        (collectionsChanged || !editingProduct) &&
        !(await saveSections(selectedSections, nextSections, nextOrder))
      ) {
        setEditingProduct(savedProduct);
        return;
      }
      closeComposer();
      await refreshAfterSave();
      setNotice(
        editingProduct
          ? 'Recommendation updated on your storefront.'
          : 'Recommendation added to your storefront.',
      );
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function saveDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedMerchantUrl = discount.merchantUrl.trim();
    const merchantUrlChanged =
      !editingDiscount || normalizedMerchantUrl !== editingDiscount.merchantUrl.trim();
    if (merchantUrlChanged && !normalizedProductUrl(normalizedMerchantUrl)) {
      setError('Enter a full HTTPS merchant URL, for example https://www.example.com.');
      return;
    }
    if (
      discount.discountPercent &&
      (!Number.isInteger(Number(discount.discountPercent)) ||
        Number(discount.discountPercent) < 1 ||
        Number(discount.discountPercent) > 100)
    ) {
      setError('Enter a whole-number discount from 1 to 100%.');
      return;
    }
    if (
      discount.discountAmount &&
      (!Number.isFinite(Number(discount.discountAmount)) ||
        Number(discount.discountAmount) <= 0)
    ) {
      setError('Enter a fixed discount greater than ₪0.');
      return;
    }
    setSaving(true);
    setError('');
    const [rawScopeKind = 'brand', scopeId = ''] = discount.scopeTarget.split(':');
    const scopeKind = rawScopeKind as DiscountOfferPayload['scopeKind'];
    const body: DiscountOfferPayload = {
      brandId: discount.brandId || null,
      code: discount.code.trim() || null,
      detailsHe: discount.detailsHe.trim() || null,
      discountPercent: discount.discountPercent ? Number(discount.discountPercent) : null,
      discountAmountMinor: discount.discountAmount
        ? Math.round(Number(discount.discountAmount) * 100)
        : null,
      storyClips: discount.storyClips.map((clip) =>
        clip.mediaAssetId ? { mediaAssetId: clip.mediaAssetId } : { videoUrl: clip.url },
      ),
      expiresAt: toDateTimeIso(discount.expiresAt),
      label: discount.label.trim() || null,
      merchantUrl: normalizedMerchantUrl,
      offerType: discount.offerType,
      priority: Number(discount.priority) || 0,
      recurrenceRule: discount.recurrenceRule,
      scopeId: scopeId || null,
      scopeKind,
      source: 'manual',
      stackable: discount.stackable,
      startsAt: toDateTimeIso(discount.startsAt),
    };
    const removingOffer = Boolean(
      editingDiscount &&
      !body.code &&
      !body.discountPercent &&
      !body.discountAmountMinor &&
      !body.label &&
      !body.detailsHe &&
      !body.storyClips?.length,
    );
    try {
      if (editingDiscount) {
        const latest = await apiRequest<CreatorDiscountCode>(
          `/creator/discount-codes/${editingDiscount.id}`,
        );
        if (removingOffer) {
          await apiRequest(`/creator/discount-codes/${editingDiscount.id}/archive`, {
            headers: { 'if-match': `"${latest.version}"` },
            idempotent: true,
            method: 'POST',
          });
          setNotice('Discount removed from your storefront.');
        } else {
          const updated = await saveOffer<CreatorDiscountCode>(
            `/creator/discount-codes/${editingDiscount.id}`,
            body,
            {
              headers: { 'if-match': `"${latest.version}"` },
              method: 'PATCH',
            },
          );
          const refreshed = await apiRequest<CreatorDiscountCode>(
            `/creator/discount-codes/${updated.id}`,
          );
          if (refreshed.lifecycle !== 'published') {
            await apiRequest(`/creator/discount-codes/${updated.id}/confirm`, {
              headers: { 'if-match': `"${refreshed.version}"` },
              idempotent: true,
              method: 'POST',
            });
          }
          setNotice('Discount updated and published.');
        }
      } else {
        const created = await saveOffer<CreatorDiscountCode>(
          '/creator/discount-codes',
          body,
          {
            idempotent: true,
            method: 'POST',
          },
        );
        if (
          !(await saveSections(selectedSections, curatedSections, [
            ...contentOrder,
            { kind: 'discount', id: created.id },
          ]))
        )
          return;
        setNotice('Brand discount saved as a draft. Turn Live on when it is ready.');
      }
      closeComposer();
      await refreshAfterSave();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function recommendationCommand(
    item: CreatorRecommendation,
    command: 'archive' | 'publish' | 'unpublish',
  ) {
    setError('');
    try {
      const latest = await apiRequest<CreatorRecommendation>(
        `/creator/recommendations/${item.id}`,
      );
      await apiRequest(`/creator/recommendations/${item.id}/${command}`, {
        headers: { 'if-match': `"${latest.version}"` },
        idempotent: true,
        method: 'POST',
      });
      await load();
      if (command === 'archive') {
        setNotice('Recommendation removed from your storefront.');
      }
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  async function toggleDiscount(item: CreatorDiscountCode) {
    const command = item.lifecycle === 'published' ? 'hide' : 'confirm';
    setError('');
    try {
      const latest = await apiRequest<CreatorDiscountCode>(
        `/creator/discount-codes/${item.id}`,
      );
      await apiRequest(`/creator/discount-codes/${item.id}/${command}`, {
        headers: { 'if-match': `"${latest.version}"` },
        idempotent: true,
        method: 'POST',
      });
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  async function archiveDiscount(item: CreatorDiscountCode) {
    setError('');
    try {
      const latest = await apiRequest<CreatorDiscountCode>(
        `/creator/discount-codes/${item.id}`,
      );
      await apiRequest(`/creator/discount-codes/${item.id}/archive`, {
        headers: { 'if-match': `"${latest.version}"` },
        idempotent: true,
        method: 'POST',
      });
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  function editProduct(item: CreatorRecommendation) {
    setEditingProduct(item);
    setProduct({
      additionalImages: (item.images ?? []).slice(1).map((image) => ({
        imageAssetId: image.imageAssetId ?? '',
        url: image.url,
      })),
      brandName: item.brandName,
      categoryId: item.categoryId,
      categoryIds: item.categoryIds,
      collectionIds: curatedSections
        .filter(
          (section) =>
            section.kind === 'collection' && section.recommendationIds.includes(item.id),
        )
        .map(({ id }) => id),
      contentKind: item.contentKind,
      discountCode: item.discount?.code ?? '',
      brandDiscountCodeId:
        discounts.find(
          (offer) =>
            offer.id === item.discount?.id &&
            offer.brandId &&
            offer.scopeKind === 'brand',
        )?.id ?? '',
      discountExpiresAt: toLocalDate(item.discount?.expiresAt ?? null),
      discountLabel: item.discount?.label ?? '',
      discountType: item.discount?.label?.includes('%') ? 'percent' : 'amount',
      discountValue: (item.discount?.label ?? '').replace(/[^0-9.]/gu, ''),
      imageAssetId: item.imageAssetId ?? '',
      imageUrl: item.imageUrl,
      instagramStoryUrl: item.instagramStoryUrl ?? '',
      linkHasBackground: item.review.value === 'Link card / backdrop',
      priceIls: item.price.amountMinor > 0 ? String(item.price.amountMinor / 100) : '',
      productName: item.productName,
      productUrl: isManualRecommendationUrl(item.productUrl) ? '' : item.productUrl,
      reviewHe: item.review.value === 'לא צורפה ביקורת' ? '' : item.review.value,
      storyClips: item.storyClips.map((clip) => ({
        mediaAssetId: clip.mediaAssetId ?? '',
        url: clip.url,
      })),
      storyLink: '',
    });
    setComposer('product');
    window.scrollTo({ behavior: 'smooth', top: 120 });
  }

  function editDiscount(item: CreatorDiscountCode) {
    setEditingDiscount(item);
    setDiscount({
      brandId: item.brandId ?? '',
      code: item.code ?? '',
      detailsHe: item.details?.value ?? '',
      discountPercent: item.discountPercent?.toString() ?? '',
      discountType: item.discountAmountMinor ? 'amount' : 'percent',
      discountAmount: item.discountAmountMinor
        ? String(item.discountAmountMinor / 100)
        : '',
      expiresAt: toLocalDateTime(item.expiresAt),
      label: item.label ?? '',
      merchantUrl: item.merchantUrl,
      offerType: item.offerType,
      priority: item.priority.toString(),
      recurrenceRule: item.recurrenceRule,
      scopeTarget:
        item.scopeKind === 'brand' ? 'brand' : `${item.scopeKind}:${item.scopeId}`,
      stackable: item.stackable,
      startsAt: toLocalDateTime(item.startsAt),
      storyClips: item.storyClips.map((clip) => ({
        mediaAssetId: clip.mediaAssetId ?? '',
        url: clip.url,
      })),
    });
    setComposer('discount');
    window.scrollTo({ behavior: 'smooth', top: 120 });
  }

  async function saveSections(
    nextCategories = selectedSections,
    nextCurated = curatedSections,
    nextOrder = contentOrder,
    nextLabels = storefrontLabels,
    nextHiddenBrands = hiddenBrandIds,
    nextHiddenCollections = hiddenCollectionIds,
    nextHiddenRecommendations = hiddenRecommendationIds,
    nextFeaturedMedia = featuredMedia,
  ) {
    if (!configuration) return false;
    const collectionSections = nextCurated.filter(({ kind }) => kind !== 'page');
    setSaving(true);
    setError('');
    try {
      const groupedIds = new Set(
        collectionSections.flatMap(({ recommendationIds }) => recommendationIds),
      );
      const normalizedOrder = nextOrder.filter(
        ({ kind, id }) =>
          (kind !== 'recommendation' || !groupedIds.has(id)) &&
          (kind !== 'category' || nextCategories.includes(id)),
      );
      for (const id of nextCategories) {
        if (
          !normalizedOrder.some((layer) => layer.kind === 'category' && layer.id === id)
        ) {
          normalizedOrder.push({ kind: 'category', id });
        }
      }
      const input = {
        categoryIds: nextCategories,
        curatedSections: collectionSections.map(
          ({
            id,
            kind,
            brandId,
            recommendationIds,
            title,
            description,
            imageUrl,
            parentCollectionId,
            showItemsIndividually,
          }) => ({
            id,
            kind,
            brandId,
            recommendationIds,
            title,
            description,
            imageUrl,
            parentCollectionId,
            showItemsIndividually,
          }),
        ),
        contentOrder: normalizedOrder,
        featuredMedia: nextFeaturedMedia,
        labels: nextLabels,
        hiddenBrandIds: nextHiddenBrands,
        hiddenCollectionIds: nextHiddenCollections,
        hiddenRecommendationIds: nextHiddenRecommendations,
      };
      const persist = (version: number) =>
        apiRequest<CreatorStorefrontConfiguration>(
          '/creator/studio/storefront-sections',
          {
            body: JSON.stringify(input),
            headers: { 'if-match': `"${version}"` },
            method: 'PUT',
          },
        );
      let updated: CreatorStorefrontConfiguration;
      try {
        updated = await persist(configuration.version);
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 412) throw cause;
        const latest = await apiRequest<CreatorStorefrontConfiguration>(
          '/creator/studio/storefront-sections',
        );
        updated = await persist(latest.version);
      }
      const savedOrder = Array.isArray(updated.contentOrder)
        ? updated.contentOrder
        : normalizedOrder;
      setConfiguration({ ...updated, contentOrder: savedOrder });
      setSelectedSections(nextCategories);
      setCuratedSections(updated.curatedSections);
      setContentOrder(savedOrder);
      setStorefrontLabels(updated.labels);
      setHiddenBrandIds(updated.hiddenBrandIds ?? []);
      setHiddenCollectionIds(updated.hiddenCollectionIds ?? []);
      setHiddenRecommendationIds(updated.hiddenRecommendationIds ?? []);
      setFeaturedMedia(updated.featuredMedia ?? []);
      setNotice('Storefront sections saved.');
      return true;
    } catch (cause) {
      setError(messageFor(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function saveCuratedSections(nextCurated: CuratedSection[]) {
    const sectionIds = new Set(nextCurated.map(({ id }) => id));
    const nextOrder: ContentLayer[] = contentOrder.filter(
      ({ kind, id }) =>
        (kind !== 'section' && kind !== 'collection') || sectionIds.has(id),
    );
    for (const { id, kind } of nextCurated) {
      if (kind === 'page') continue;
      if (!nextOrder.some((layer) => layer.kind === kind && layer.id === id)) {
        nextOrder.push({ kind, id });
      }
    }
    return saveSections(selectedSections, nextCurated, nextOrder);
  }

  function startMediaEditor(item?: FeaturedMedia) {
    setMediaEditorOpen(true);
    setEditingMediaId(item?.id ?? null);
    setMediaDraft(
      item
        ? {
            provider: item.provider,
            url: item.url,
            title: item.title,
            thumbnailUrl: item.thumbnailUrl,
            displayMode: item.displayMode,
          }
        : {
            provider: 'youtube',
            url: '',
            title: '',
            thumbnailUrl: null,
            displayMode: 'embed',
          },
    );
    setError('');
  }

  async function saveFeaturedMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const detected = detectFeaturedMedia(mediaDraft.url);
    if (!detected) {
      setError('Paste a valid YouTube, Instagram, Spotify or Apple Music link.');
      return;
    }
    const item: FeaturedMedia = {
      ...mediaDraft,
      provider: detected.provider,
      thumbnailUrl: mediaDraft.thumbnailUrl || detected.thumbnailUrl,
      id: editingMediaId ?? randomUuid(),
      title: mediaDraft.title.trim() || detected.title,
      url: mediaDraft.url.trim(),
      visible: editingMediaId
        ? (featuredMedia.find(({ id }) => id === editingMediaId)?.visible ?? true)
        : true,
    };
    const nextMedia = editingMediaId
      ? featuredMedia.map((current) => (current.id === item.id ? item : current))
      : [...featuredMedia, item];
    const nextOrder = contentOrder.some(
      ({ kind, id }) => kind === 'media' && id === item.id,
    )
      ? contentOrder
      : [...contentOrder, { kind: 'media' as const, id: item.id }];
    if (
      await saveSections(
        selectedSections,
        curatedSections,
        nextOrder,
        storefrontLabels,
        hiddenBrandIds,
        hiddenCollectionIds,
        hiddenRecommendationIds,
        nextMedia,
      )
    ) {
      setMediaDraft({
        provider: 'youtube',
        url: '',
        title: '',
        thumbnailUrl: null,
        displayMode: 'embed',
      });
      setEditingMediaId(null);
      setMediaEditorOpen(false);
    }
  }

  async function removeFeaturedMedia(id: string) {
    const nextMedia = featuredMedia.filter((item) => item.id !== id);
    const nextOrder = contentOrder.filter(
      (layer) => layer.kind !== 'media' || layer.id !== id,
    );
    await saveSections(
      selectedSections,
      curatedSections,
      nextOrder,
      storefrontLabels,
      hiddenBrandIds,
      hiddenCollectionIds,
      hiddenRecommendationIds,
      nextMedia,
    );
  }

  async function toggleFeaturedMedia(id: string) {
    const nextMedia = featuredMedia.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item,
    );
    await saveSections(
      selectedSections,
      curatedSections,
      contentOrder,
      storefrontLabels,
      hiddenBrandIds,
      hiddenCollectionIds,
      hiddenRecommendationIds,
      nextMedia,
    );
  }

  function toggleVisibility(
    kind: 'brand' | 'collection' | 'recommendation',
    id: string,
    visible: boolean,
  ) {
    const current =
      kind === 'brand'
        ? hiddenBrandIds
        : kind === 'collection'
          ? hiddenCollectionIds
          : hiddenRecommendationIds;
    const next = visible ? current.filter((value) => value !== id) : [...current, id];
    return saveSections(
      selectedSections,
      curatedSections,
      contentOrder,
      storefrontLabels,
      kind === 'brand' ? next : hiddenBrandIds,
      kind === 'collection' ? next : hiddenCollectionIds,
      kind === 'recommendation' ? next : hiddenRecommendationIds,
    );
  }

  const activeRecommendations = recommendations.filter(
    ({ lifecycle }) => lifecycle !== 'archived',
  );
  const placedDiscountIds = new Set(
    activeRecommendations.flatMap(({ discount }) => (discount?.id ? [discount.id] : [])),
  );
  const activeDiscounts = discounts.filter(
    ({ brandId, id, lifecycle }) =>
      !brandId && lifecycle !== 'archived' && !placedDiscountIds.has(id),
  );
  const collections = curatedSections.filter(({ kind }) => kind === 'collection');
  const collectedProductIds = new Set(
    collections.flatMap(({ recommendationIds }) => recommendationIds),
  );
  const manageEntries: Array<
    | CollectionManageEntry
    | { kind: 'recommendation'; item: CreatorRecommendation }
    | { kind: 'discount'; item: CreatorDiscountCode }
  > = [
    ...collections.map((section) => ({
      kind: 'collection' as const,
      section,
      items: section.recommendationIds.flatMap(
        (id) => activeRecommendations.find((item) => item.id === id) ?? [],
      ),
    })),
    ...activeRecommendations
      .filter(({ id }) => !collectedProductIds.has(id))
      .map((item) => ({ kind: 'recommendation' as const, item })),
    ...activeDiscounts.map((item) => ({ kind: 'discount' as const, item })),
  ].sort((a, b) => {
    const leftId = a.kind === 'collection' ? a.section.id : a.item.id;
    const rightId = b.kind === 'collection' ? b.section.id : b.item.id;
    const left = contentOrder.findIndex(
      ({ kind, id }) => kind === a.kind && id === leftId,
    );
    const right = contentOrder.findIndex(
      ({ kind, id }) => kind === b.kind && id === rightId,
    );
    return (
      (left < 0 ? Number.MAX_SAFE_INTEGER : left) -
      (right < 0 ? Number.MAX_SAFE_INTEGER : right)
    );
  });
  const collectionEntries = manageEntries.filter(
    (entry): entry is CollectionManageEntry => entry.kind === 'collection',
  );
  const standaloneRecommendations = manageEntries.flatMap((entry) =>
    entry.kind === 'recommendation' ? [entry.item] : [],
  );
  const normalizedBrandName = (value: string) => value.trim().toLocaleLowerCase();
  const groupedCollectionIds = new Set<string>();
  const groupedRecommendationIds = new Set<string>();
  const brandGroups = brands.map((managedBrand) => {
    const brandName = normalizedBrandName(managedBrand.name);
    const brandCollections = collectionEntries.filter(
      ({ section, items }) =>
        section.brandId === managedBrand.brandId ||
        items.some((item) => normalizedBrandName(item.brandName) === brandName),
    );
    const brandItems = standaloneRecommendations.filter(
      (item) =>
        item.brandId === managedBrand.brandId ||
        normalizedBrandName(item.brandName) === brandName,
    );
    brandCollections.forEach(({ section }) => groupedCollectionIds.add(section.id));
    brandItems.forEach(({ id }) => groupedRecommendationIds.add(id));
    return { brand: managedBrand, collections: brandCollections, items: brandItems };
  });
  const ungroupedEntries = manageEntries.filter((entry) =>
    entry.kind === 'collection'
      ? !groupedCollectionIds.has(entry.section.id)
      : entry.kind === 'recommendation'
        ? !groupedRecommendationIds.has(entry.item.id)
        : true,
  );
  const firstName = profile?.displayName.trim().split(/\s+/)[0];

  async function copyStorefrontLink() {
    if (!profile?.handle) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${encodeURIComponent(profile.handle)}`,
      );
      setNotice('Storefront link copied.');
      setError('');
    } catch {
      setError('Could not copy the link. Open your storefront to copy its URL.');
    }
  }

  return (
    <main
      className={`creatorDashboardMain creatorDashboardMainWithSidebar ${styles.root}`}
    >
      <section className="creatorDashboardIntro">
        <div>
          <p className="eyebrow">CREATOR STUDIO / DASHBOARD</p>
          <h1 aria-busy={!profile}>
            {firstName ? (
              `Your studio, ${firstName}.`
            ) : (
              <span aria-hidden="true">&nbsp;</span>
            )}
          </h1>
          <p>Make your page feel like you, one recommendation at a time.</p>
        </div>
        {profile?.handle ? (
          <Link
            className={styles.storefrontLink}
            href={`/${encodeURIComponent(profile.handle)}`}
          >
            <ExternalLink aria-hidden="true" size={16} />
            View storefront
          </Link>
        ) : null}
      </section>

      {profile?.handle ? (
        <section aria-label="Your live storefront" className={styles.liveBanner}>
          <span className={styles.liveIcon}>
            <Check aria-hidden="true" size={18} />
          </span>
          <div className={styles.liveCopy}>
            <strong>Your page is live</strong>
            <span>
              swavii.com/{profile.handle} · Share it wherever your audience finds you.
            </span>
          </div>
          <button
            aria-label="Copy storefront link"
            className={styles.copyButton}
            onClick={() => void copyStorefrontLink()}
            type="button"
          >
            <Copy aria-hidden="true" size={15} />
            <span>Copy link</span>
          </button>
        </section>
      ) : null}

      {error ? (
        <p className="formError" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="formSuccess" role="status">
          {notice}
        </p>
      ) : null}

      <div className="creatorDashboardWorkspace">
        <nav aria-label="Dashboard sections" className="creatorDashboardSidebar">
          <p className="eyebrow">MANAGE</p>
          <button
            aria-current={dashboardView === 'labels' ? 'page' : undefined}
            onClick={() => setDashboardView('labels')}
            type="button"
          >
            <Tag aria-hidden="true" size={17} />
            <span className="creatorDashboardNavDesktop">Storefront labels</span>
            <span className="creatorDashboardNavMobile">Storefront labels</span>
          </button>
          <button
            aria-current={dashboardView === 'recommendations' ? 'page' : undefined}
            onClick={() => setDashboardView('recommendations')}
            type="button"
          >
            <LayoutGrid aria-hidden="true" size={17} />
            <span className="creatorDashboardNavDesktop">Recommendations</span>
            <span className="creatorDashboardNavMobile">Recommendations</span>
          </button>
          <button
            aria-current={dashboardView === 'media' ? 'page' : undefined}
            onClick={() => setDashboardView('media')}
            type="button"
          >
            <PlayCircle aria-hidden="true" size={17} />
            <span className="creatorDashboardNavDesktop">Featured content</span>
            <span className="creatorDashboardNavMobile">Featured content</span>
          </button>
          <button
            aria-current={dashboardView === 'connectors' ? 'page' : undefined}
            onClick={() => setDashboardView('connectors')}
            type="button"
          >
            <Link2 aria-hidden="true" size={17} />
            <span className="creatorDashboardNavDesktop">Social links</span>
            <span className="creatorDashboardNavMobile">Social links</span>
          </button>
        </nav>
        <div className="creatorDashboardPanel">
          {dashboardView === 'media' ? (
            <section className="creatorRecommendationSection">
              <div className="creatorSectionHeading">
                <div>
                  <h2>Featured content</h2>
                  <p>Add videos, posts and music from your social platforms.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => startMediaEditor()}
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} />
                  <span>Add media</span>
                </button>
              </div>
              {mediaEditorOpen ? (
                <form
                  className="creatorComposer creatorComposerBody creatorFormGrid"
                  onSubmit={(event) => void saveFeaturedMedia(event)}
                >
                  <label>
                    Media link
                    <input
                      required
                      type="url"
                      value={mediaDraft.url}
                      onChange={(event) => {
                        const url = event.target.value;
                        const detected = detectFeaturedMedia(url);
                        setMediaDraft((current) => ({
                          ...current,
                          url,
                          provider: detected?.provider ?? current.provider,
                          thumbnailUrl: detected?.thumbnailUrl ?? current.thumbnailUrl,
                          title: current.title || detected?.title || '',
                        }));
                      }}
                      placeholder="https://www.youtube.com/watch?v=…"
                    />
                    <small>
                      Paste a YouTube, Instagram, Spotify or Apple Music link.
                    </small>
                  </label>
                  <label>
                    Title
                    <input
                      required
                      maxLength={160}
                      value={mediaDraft.title}
                      onChange={(event) =>
                        setMediaDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Display
                    <select
                      value={mediaDraft.displayMode}
                      onChange={(event) =>
                        setMediaDraft((current) => ({
                          ...current,
                          displayMode: event.target.value as FeaturedMedia['displayMode'],
                        }))
                      }
                    >
                      <option value="embed">Embedded player</option>
                      <option value="link">Link card</option>
                    </select>
                  </label>
                  {mediaDraft.thumbnailUrl ? (
                    <div className="creatorMediaPreview">
                      <Image
                        alt=""
                        fill
                        sizes="320px"
                        src={mediaDraft.thumbnailUrl}
                        unoptimized
                      />
                    </div>
                  ) : null}
                  <div className="creatorFormActions creatorFullField">
                    <button className="button primary" disabled={saving} type="submit">
                      {saving ? 'Saving…' : editingMediaId ? 'Save media' : 'Add media'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingMediaId(null);
                        setMediaEditorOpen(false);
                        setMediaDraft({
                          provider: 'youtube',
                          url: '',
                          title: '',
                          thumbnailUrl: null,
                          displayMode: 'embed',
                        });
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
              <div className="creatorMediaManageList">
                {featuredMedia.map((item) => (
                  <article className="creatorMediaManageCard" key={item.id}>
                    {item.thumbnailUrl ? (
                      <Image
                        alt=""
                        fill
                        sizes="120px"
                        src={item.thumbnailUrl}
                        unoptimized
                      />
                    ) : null}
                    <div>
                      <small>{item.provider.replace('_', ' ')}</small>
                      <h3>{item.title}</h3>
                    </div>
                    <label className="creatorLiveToggle">
                      <input
                        checked={item.visible}
                        onChange={() => void toggleFeaturedMedia(item.id)}
                        type="checkbox"
                      />
                      <span /> {item.visible ? 'On' : 'Off'}
                    </label>
                    <button
                      aria-label={`Edit ${item.title}`}
                      onClick={() => startMediaEditor(item)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label={`Remove ${item.title}`}
                      onClick={() => void removeFeaturedMedia(item.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </article>
                ))}
                {!featuredMedia.length ? (
                  <p className="creatorEmptyState">No featured content yet.</p>
                ) : null}
              </div>
            </section>
          ) : dashboardView === 'recommendations' ? (
            <section className="creatorRecommendationSection">
              <div className="creatorSectionHeading">
                <div>
                  <h2>Recommendations</h2>
                  <p>
                    Keep your brands, collections and individual picks beautifully
                    organized.
                  </p>
                </div>
                <button
                  className="button primary"
                  onClick={() => showComposer('choose')}
                  type="button"
                >
                  <Plus aria-hidden="true" size={16} />
                  <span>Add recommendation</span>
                </button>
              </div>

              {composer ? (
                <div className="creatorComposer" id="creator-composer">
                  {composer === 'choose' ? (
                    <>
                      <ComposerHeader title="Add recommendation" onClose={closeComposer}>
                        Choose what you want to share with your audience.
                      </ComposerHeader>
                      <div className="creatorTypeGrid">
                        <button onClick={() => setComposer('brand')} type="button">
                          <span aria-hidden="true">
                            <Sparkles size={16} />
                          </span>
                          <strong>Brand</strong>
                          <small>Create a brand card. A discount code is optional.</small>
                        </button>
                        <button
                          onClick={() => {
                            setProduct(emptyProduct);
                            setComposer('product');
                          }}
                          type="button"
                        >
                          <span aria-hidden="true">
                            <Tag size={16} />
                          </span>
                          <strong>Item</strong>
                          <small>
                            Recommend one specific product with its price, details and
                            story clips.
                          </small>
                        </button>
                        <button onClick={() => setComposer('collection')} type="button">
                          <span aria-hidden="true">
                            <LayoutGrid size={16} />
                          </span>
                          <strong>Collection</strong>
                          <small>
                            Group your favorite products in one named storefront row.
                          </small>
                        </button>
                      </div>
                    </>
                  ) : null}
                  {composer === 'product' ? (
                    <ProductForm
                      brands={brands}
                      discounts={discounts}
                      categories={categories}
                      collections={curatedSections.filter(
                        ({ kind }) => kind === 'collection',
                      )}
                      recommendations={activeRecommendations}
                      editor={product}
                      editing={Boolean(editingProduct)}
                      fetching={fetching}
                      fetchWarnings={fetchWarnings}
                      onAddStoryLink={addStoryLink}
                      onCategoryCreated={(category) =>
                        setCategories((current) => [...current, category])
                      }
                      onChange={setProduct}
                      onChangeType={() => {
                        setProduct(emptyProduct);
                        setComposer('choose');
                      }}
                      onClose={closeComposer}
                      onFetch={fetchProductDetails}
                      onImages={selectProductImages}
                      onValidationError={() => setNotice('')}
                      onSave={saveProduct}
                      onStory={selectStoryClip}
                      videoStage={videoStage}
                      videoError={videoError}
                      saving={saving || uploading}
                    />
                  ) : null}
                  {composer === 'brand' ? (
                    <>
                      <ComposerHeader
                        title={editingBrand ? 'Edit brand' : 'Add brand'}
                        onClose={closeComposer}
                      >
                        Add the brand once. Its discount details are optional and can be
                        edited later.
                      </ComposerHeader>
                      <form
                        className="creatorComposerBody creatorFormGrid"
                        onSubmit={(event) => void saveBrand(event)}
                      >
                        <label>
                          Brand website
                          <input
                            required
                            inputMode="url"
                            type="text"
                            placeholder="https://www.adidas.com"
                            value={brand.websiteUrl}
                            onBlur={() => {
                              setBrand((current) => ({
                                ...current,
                                name:
                                  current.name || brandNameFromUrl(current.websiteUrl),
                              }));
                            }}
                            onChange={(event) =>
                              setBrand({ ...brand, websiteUrl: event.target.value })
                            }
                          />
                          <button
                            className="creatorInlineAction"
                            disabled={fetching || saving || uploading}
                            onClick={() => void fetchBrandDetails()}
                            type="button"
                          >
                            {fetching ? 'Fetching…' : 'Fetch name and image'}
                          </button>
                        </label>
                        <label>
                          Brand name
                          <input
                            required
                            maxLength={120}
                            value={brand.name}
                            onChange={(event) =>
                              setBrand({ ...brand, name: event.target.value })
                            }
                          />
                          <small>
                            Filled automatically from the website and remains editable.
                          </small>
                        </label>
                        <label className="creatorFullField">
                          Brand image <span className="fieldOptional">Optional</span>
                          <input
                            accept={recommendationImageAccept}
                            disabled={saving || uploading}
                            type="file"
                            onChange={(event) => void selectBrandLogo(event)}
                          />
                          <input
                            inputMode="url"
                            placeholder="https://brand.com/logo.png"
                            type="url"
                            value={brand.logoUrl}
                            onChange={(event) =>
                              setBrand({
                                ...brand,
                                logoAssetId: '',
                                logoUrl: event.target.value,
                              })
                            }
                          />
                          {brand.logoUrl ? (
                            <div className="creatorProductPhotoGrid">
                              <span>
                                <Image
                                  alt="Brand image preview"
                                  fill
                                  sizes="96px"
                                  src={brand.logoUrl}
                                  unoptimized
                                />
                                <small>Default</small>
                                <button
                                  aria-label="Remove brand image"
                                  onClick={() =>
                                    setBrand({ ...brand, logoAssetId: '', logoUrl: '' })
                                  }
                                  type="button"
                                >
                                  <X aria-hidden="true" size={12} />
                                </button>
                              </span>
                            </div>
                          ) : null}
                          <small>
                            We suggest the brand&apos;s favicon from its website. Replace
                            it with an upload or image URL if needed.
                          </small>
                        </label>
                        <label>
                          Code <span className="fieldOptional">Optional</span>
                          <input
                            maxLength={50}
                            value={brand.code}
                            onChange={(event) =>
                              setBrand({
                                ...brand,
                                code: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Discount type <span className="fieldOptional">Optional</span>
                          <select
                            value={brand.discountType}
                            onChange={(event) =>
                              setBrand({
                                ...brand,
                                discountType: event.target
                                  .value as BrandEditor['discountType'],
                                discountPercent: '',
                                discountAmount: '',
                              })
                            }
                          >
                            <option value="percent">Percent off</option>
                            <option value="amount">Fixed ₪ amount off</option>
                          </select>
                        </label>
                        <label>
                          {brand.discountType === 'amount'
                            ? 'Amount off (₪)'
                            : 'Percent off'}
                          <input
                            min="1"
                            max={brand.discountType === 'amount' ? undefined : '100'}
                            type="number"
                            value={
                              brand.discountType === 'amount'
                                ? brand.discountAmount
                                : brand.discountPercent
                            }
                            onChange={(event) =>
                              setBrand({
                                ...brand,
                                [brand.discountType === 'amount'
                                  ? 'discountAmount'
                                  : 'discountPercent']: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          Expires <span className="fieldOptional">Optional</span>
                          <input
                            type="date"
                            value={brand.expiresAt}
                            onChange={(event) =>
                              setBrand({ ...brand, expiresAt: event.target.value })
                            }
                          />
                        </label>
                        <label className="creatorFullField">
                          Details <span className="fieldOptional">Optional</span>
                          <textarea
                            dir="auto"
                            rows={3}
                            value={brand.detailsHe}
                            onChange={(event) =>
                              setBrand({ ...brand, detailsHe: event.target.value })
                            }
                          />
                        </label>
                        <div className="creatorFullField">
                          <button
                            className="button primary"
                            disabled={saving}
                            type="submit"
                          >
                            {saving
                              ? 'Saving…'
                              : editingBrand
                                ? 'Save brand'
                                : 'Add brand'}
                          </button>
                        </div>
                      </form>
                    </>
                  ) : null}
                  {composer === 'discount' ? (
                    <DiscountForm
                      brands={brands}
                      collections={curatedSections.filter(
                        ({ kind }) => kind === 'collection',
                      )}
                      editor={discount}
                      editing={Boolean(editingDiscount)}
                      onChange={setDiscount}
                      onClose={closeComposer}
                      onSave={saveDiscount}
                      recommendations={activeRecommendations}
                      saving={saving}
                    />
                  ) : null}
                  {composer === 'collection' ? (
                    <>
                      <ComposerHeader title="New collection" onClose={closeComposer}>
                        Curate products into one storefront row.
                      </ComposerHeader>
                      <div className="creatorComposerBody">
                        <CuratedSectionForm
                          brands={brands}
                          kind="collection"
                          recommendations={activeRecommendations}
                          onAddNewItem={async (section, brandName) => {
                            const saved = await saveSections(
                              selectedSections,
                              [...curatedSections, section],
                              [...contentOrder, { kind: 'collection', id: section.id }],
                            );
                            if (!saved) return false;
                            setProduct({
                              ...emptyProduct,
                              brandName,
                              collectionIds: [section.id],
                              categoryId: '',
                              categoryIds: [],
                            });
                            setComposer('product');
                            return true;
                          }}
                          onCreateBrand={async (input) => {
                            const created = await apiRequest<CreatorBrand>(
                              '/creator/brands',
                              {
                                body: JSON.stringify(input),
                                idempotent: true,
                                method: 'POST',
                              },
                            );
                            setBrands((current) => [
                              ...current.filter(({ id }) => id !== created.id),
                              created,
                            ]);
                            return created;
                          }}
                          onCancel={closeComposer}
                          onSave={(section) =>
                            saveSections(
                              selectedSections,
                              [...curatedSections, section],
                              [...contentOrder, { kind: 'collection', id: section.id }],
                            )
                          }
                          saving={saving}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div aria-label="Recommendation totals" className={styles.counts}>
                <span>
                  <strong>{brands.length}</strong> brands
                </span>
                <span>
                  <strong>{collections.length}</strong> collections
                </span>
                <span>
                  <strong>{activeRecommendations.length}</strong> picks
                </span>
              </div>

              {loading ? <DelayedLoading>Loading recommendations…</DelayedLoading> : null}
              <div className="creatorManageList">
                {brandGroups.map(
                  ({
                    brand: managedBrand,
                    collections: brandCollections,
                    items: brandItems,
                  }) => (
                    <section
                      className="creatorManageCollection creatorBrandManageCard"
                      key={managedBrand.id}
                    >
                      <header className="creatorManageCollectionHeader">
                        <button
                          aria-expanded={expandedBrandId === managedBrand.id}
                          aria-controls={`brand-contents-${managedBrand.id}`}
                          className="creatorBrandToggle"
                          onClick={() =>
                            setExpandedBrandId((current) =>
                              current === managedBrand.id ? null : managedBrand.id,
                            )
                          }
                          type="button"
                        >
                          <ChevronDown aria-hidden="true" size={18} />
                          <span>
                            <strong>{managedBrand.name}</strong>
                            <small>
                              {brandCollections.length} collections ?{' '}
                              {
                                new Set([
                                  ...brandCollections.flatMap(({ items }) =>
                                    items.map(({ id }) => id),
                                  ),
                                  ...brandItems.map(({ id }) => id),
                                ]).size
                              }{' '}
                              items
                            </small>
                          </span>
                        </button>
                        <div className="creatorManageCollectionActions">
                          <label
                            className="creatorLiveToggle"
                            title={
                              hiddenBrandIds.includes(managedBrand.id)
                                ? 'Show brand'
                                : 'Hide brand'
                            }
                          >
                            <input
                              checked={!hiddenBrandIds.includes(managedBrand.id)}
                              onChange={(event) =>
                                void toggleVisibility(
                                  'brand',
                                  managedBrand.id,
                                  event.target.checked,
                                )
                              }
                              type="checkbox"
                            />
                            <span />
                            {hiddenBrandIds.includes(managedBrand.id) ? 'Off' : 'On'}
                          </label>
                          <a
                            href={managedBrand.websiteUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            aria-label={`Edit ${managedBrand.name}`}
                            onClick={() => {
                              const offer = discounts.find(
                                (item) =>
                                  item.brandId === managedBrand.id &&
                                  item.scopeKind === 'brand',
                              );
                              setEditingBrand(managedBrand);
                              setBrand({
                                code: offer?.code ?? '',
                                discountType: offer?.discountAmountMinor
                                  ? 'amount'
                                  : 'percent',
                                detailsHe: offer?.details?.value ?? '',
                                discountPercent: offer?.discountPercent?.toString() ?? '',
                                discountAmount: offer?.discountAmountMinor
                                  ? String(offer.discountAmountMinor / 100)
                                  : '',
                                expiresAt: toLocalDate(offer?.expiresAt ?? null),
                                name: managedBrand.name,
                                websiteUrl: managedBrand.websiteUrl,
                                logoAssetId: managedBrand.logoAssetId ?? '',
                                logoUrl: managedBrand.logoUrl ?? '',
                              });
                              setComposer('brand');
                              window.scrollTo({ behavior: 'smooth', top: 120 });
                            }}
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${managedBrand.name}`}
                            disabled={saving}
                            onClick={() => {
                              const archiveRecommendations =
                                managedBrand.itemCount > 0 &&
                                window.confirm(
                                  `Also remove ${managedBrand.itemCount} recommendation${managedBrand.itemCount === 1 ? '' : 's'} under ${managedBrand.name}? Choose OK to remove them too, or Cancel to keep them.`,
                                );
                              void apiRequest(
                                `/creator/brands/${managedBrand.id}?archiveRecommendations=${archiveRecommendations}`,
                                {
                                  headers: { 'if-match': `"${managedBrand.version}"` },
                                  method: 'DELETE',
                                },
                              )
                                .then(() => load())
                                .catch((cause: unknown) => setError(messageFor(cause)));
                            }}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </header>
                      <div
                        id={`brand-contents-${managedBrand.id}`}
                        hidden={expandedBrandId !== managedBrand.id}
                      >
                        {brandCollections.length || brandItems.length ? (
                          <div className="creatorBrandManageContents">
                            {brandCollections.map((entry) => (
                              <CollectionManageCard
                                brands={brands}
                                editing={editingCollectionId === entry.section.id}
                                entry={entry}
                                key={entry.section.id}
                                nested
                                onArchiveItem={(item) => {
                                  if (
                                    window.confirm(
                                      'Remove this recommendation from your storefront?',
                                    )
                                  )
                                    void recommendationCommand(item, 'archive');
                                }}
                                onCreateBrand={async (input) => {
                                  const created = await apiRequest<CreatorBrand>(
                                    '/creator/brands',
                                    {
                                      body: JSON.stringify(input),
                                      idempotent: true,
                                      method: 'POST',
                                    },
                                  );
                                  setBrands((current) => [
                                    ...current.filter(({ id }) => id !== created.id),
                                    created,
                                  ]);
                                  return created;
                                }}
                                onDelete={() => {
                                  if (
                                    !window.confirm(
                                      `Delete the ${entry.section.title} collection? Its products will remain in your recommendations.`,
                                    )
                                  )
                                    return;
                                  void saveCuratedSections(
                                    curatedSections
                                      .filter(({ id }) => id !== entry.section.id)
                                      .map((section) =>
                                        section.parentCollectionId === entry.section.id
                                          ? { ...section, parentCollectionId: null }
                                          : section,
                                      ),
                                  ).then((saved) => {
                                    if (saved) setEditingCollectionId(null);
                                  });
                                }}
                                onEditItem={editProduct}
                                onToggleItem={(item) =>
                                  toggleVisibility(
                                    'recommendation',
                                    item.id,
                                    !hiddenRecommendationIds.includes(item.id),
                                  )
                                }
                                isItemVisible={(item) =>
                                  !hiddenRecommendationIds.includes(item.id)
                                }
                                visible={!hiddenCollectionIds.includes(entry.section.id)}
                                onToggleVisibility={(visible) =>
                                  toggleVisibility(
                                    'collection',
                                    entry.section.id,
                                    visible,
                                  )
                                }
                                onEditState={(editing) =>
                                  setEditingCollectionId(
                                    editing ? entry.section.id : null,
                                  )
                                }
                                onSave={(updated) =>
                                  saveCuratedSections(
                                    curatedSections.map((section) =>
                                      section.id === entry.section.id ? updated : section,
                                    ),
                                  )
                                }
                                profileHandle={profile?.handle}
                                recommendations={activeRecommendations}
                                saving={saving}
                              />
                            ))}
                            {brandItems.length ? (
                              <details className="creatorBrandStandaloneItems creatorManageDisclosure">
                                <summary>
                                  Individual items <span>({brandItems.length})</span>
                                </summary>
                                {brandItems.map((item) => (
                                  <RecommendationManageCard
                                    item={item}
                                    key={item.id}
                                    onToggle={() =>
                                      void toggleVisibility(
                                        'recommendation',
                                        item.id,
                                        !hiddenRecommendationIds.includes(item.id),
                                      )
                                    }
                                    visible={!hiddenRecommendationIds.includes(item.id)}
                                    onArchive={() => {
                                      if (
                                        window.confirm(
                                          'Remove this recommendation from your storefront?',
                                        )
                                      )
                                        void recommendationCommand(item, 'archive');
                                    }}
                                    onEdit={() => editProduct(item)}
                                  />
                                ))}
                              </details>
                            ) : null}
                          </div>
                        ) : (
                          <p className="creatorManageCollectionEmpty">
                            No recommendations have been added to this brand yet.
                          </p>
                        )}
                      </div>
                    </section>
                  ),
                )}
                {ungroupedEntries.map((entry) =>
                  entry.kind === 'collection' ? (
                    <section
                      aria-label={`${entry.section.title} collection`}
                      className="creatorManageCollection"
                      key={entry.section.id}
                    >
                      <header className="creatorManageCollectionHeader">
                        <div>
                          <span className="eyebrow">COLLECTION</span>
                          <h3>{entry.section.title}</h3>
                          <p>
                            {activeRecommendations.find(
                              ({ brandId }) => brandId === entry.section.brandId,
                            )?.brandName ?? 'Brand'}
                            {' · '}
                            {entry.items.length}{' '}
                            {entry.items.length === 1 ? 'item' : 'items'}
                          </p>
                        </div>
                        <div className="creatorManageCollectionActions">
                          <label
                            className="creatorLiveToggle"
                            title={
                              hiddenCollectionIds.includes(entry.section.id)
                                ? 'Show collection'
                                : 'Hide collection'
                            }
                          >
                            <input
                              checked={!hiddenCollectionIds.includes(entry.section.id)}
                              onChange={(event) =>
                                void toggleVisibility(
                                  'collection',
                                  entry.section.id,
                                  event.target.checked,
                                )
                              }
                              type="checkbox"
                            />
                            <span />
                            {hiddenCollectionIds.includes(entry.section.id)
                              ? 'Off'
                              : 'On'}
                          </label>
                          {profile ? (
                            <Link
                              href={`/${profile.handle}/pages/${entry.section.id}`}
                              target="_blank"
                            >
                              View page
                            </Link>
                          ) : null}
                          <button
                            aria-label={`Edit ${entry.section.title} collection`}
                            disabled={saving}
                            onClick={() => setEditingCollectionId(entry.section.id)}
                            title="Edit collection"
                            type="button"
                          >
                            <Pencil aria-hidden="true" size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${entry.section.title} collection`}
                            disabled={saving}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Delete the ${entry.section.title} collection? Its products will remain in your recommendations.`,
                                )
                              )
                                return;
                              void saveCuratedSections(
                                curatedSections
                                  .filter(({ id }) => id !== entry.section.id)
                                  .map((section) =>
                                    section.parentCollectionId === entry.section.id
                                      ? { ...section, parentCollectionId: null }
                                      : section,
                                  ),
                              ).then((saved) => {
                                if (saved) setEditingCollectionId(null);
                              });
                            }}
                            title="Delete collection"
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={16} />
                          </button>
                        </div>
                      </header>
                      {editingCollectionId === entry.section.id ? (
                        <div className="creatorManageCollectionEditor">
                          <CuratedSectionForm
                            brands={brands}
                            initial={entry.section}
                            kind="collection"
                            onCancel={() => setEditingCollectionId(null)}
                            onCreateBrand={async (input) => {
                              const created = await apiRequest<CreatorBrand>(
                                '/creator/brands',
                                {
                                  body: JSON.stringify(input),
                                  idempotent: true,
                                  method: 'POST',
                                },
                              );
                              setBrands((current) => [
                                ...current.filter(({ id }) => id !== created.id),
                                created,
                              ]);
                              return created;
                            }}
                            onSave={(updated) =>
                              saveCuratedSections(
                                curatedSections.map((section) =>
                                  section.id === entry.section.id ? updated : section,
                                ),
                              )
                            }
                            recommendations={activeRecommendations}
                            saving={saving}
                          />
                        </div>
                      ) : entry.items.length ? (
                        <div className="creatorManageCollectionItems">
                          {entry.items.map((item) => (
                            <RecommendationManageCard
                              item={item}
                              key={item.id}
                              onToggle={() =>
                                void toggleVisibility(
                                  'recommendation',
                                  item.id,
                                  !hiddenRecommendationIds.includes(item.id),
                                )
                              }
                              visible={!hiddenRecommendationIds.includes(item.id)}
                              onArchive={() => {
                                if (
                                  window.confirm(
                                    'Remove this recommendation from your storefront?',
                                  )
                                )
                                  void recommendationCommand(item, 'archive');
                              }}
                              onEdit={() => editProduct(item)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="creatorManageCollectionEmpty">
                          No active products in this collection. Edit it to add one.
                        </p>
                      )}
                    </section>
                  ) : entry.kind === 'recommendation' ? (
                    <RecommendationManageCard
                      item={entry.item}
                      key={entry.item.id}
                      onToggle={() =>
                        void toggleVisibility(
                          'recommendation',
                          entry.item.id,
                          !hiddenRecommendationIds.includes(entry.item.id),
                        )
                      }
                      visible={!hiddenRecommendationIds.includes(entry.item.id)}
                      onArchive={() => {
                        if (
                          window.confirm(
                            'Remove this recommendation from your storefront?',
                          )
                        )
                          void recommendationCommand(entry.item, 'archive');
                      }}
                      onEdit={() => editProduct(entry.item)}
                    />
                  ) : (
                    <DiscountManageCard
                      item={entry.item}
                      key={entry.item.id}
                      onArchive={() => void archiveDiscount(entry.item)}
                      onEdit={() => editDiscount(entry.item)}
                      onToggle={() => void toggleDiscount(entry.item)}
                    />
                  ),
                )}
                {!loading && !manageEntries.length ? (
                  <div className="creatorEmpty">
                    No recommendations yet. Add your first one above.
                  </div>
                ) : null}
              </div>
            </section>
          ) : dashboardView === 'labels' ? (
            <StorefrontLabelsEditor
              brands={brands}
              categories={categories}
              collections={collections}
              key={storefrontLabels.map(({ id, title }) => `${id}:${title}`).join('|')}
              labels={storefrontLabels}
              onSave={(labels) =>
                void saveSections(selectedSections, curatedSections, contentOrder, labels)
              }
              recommendations={activeRecommendations}
              saving={saving}
            />
          ) : (
            <CreatorConnectorsEditor
              key={profile ? `${profile.id}:${profile.version}` : 'loading'}
              onSaved={(updatedProfile) => {
                setLoadedProfile(updatedProfile);
                setCreatorProfile(updatedProfile);
              }}
              profile={profile}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function CollectionManageCard({
  brands,
  editing,
  entry,
  nested = false,
  onArchiveItem,
  onCreateBrand,
  onDelete,
  onEditItem,
  onToggleItem,
  onToggleVisibility,
  isItemVisible,
  visible = true,
  onEditState,
  onSave,
  profileHandle,
  recommendations,
  saving,
}: {
  brands: CreatorBrand[];
  editing: boolean;
  entry: CollectionManageEntry;
  nested?: boolean;
  onArchiveItem: (item: CreatorRecommendation) => void;
  onCreateBrand: (input: { name: string; websiteUrl: string }) => Promise<CreatorBrand>;
  onDelete: () => void;
  onEditItem: (item: CreatorRecommendation) => void;
  onToggleItem: (item: CreatorRecommendation) => Promise<boolean> | void;
  onToggleVisibility: (visible: boolean) => Promise<boolean> | void;
  isItemVisible: (item: CreatorRecommendation) => boolean;
  visible?: boolean;
  onEditState: (editing: boolean) => void;
  onSave: (updated: CuratedSection) => Promise<boolean>;
  profileHandle: string | undefined;
  recommendations: CreatorRecommendation[];
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      aria-label={`${entry.section.title} collection`}
      className={`creatorManageCollection${nested ? ' creatorManageNestedCollection' : ''}`}
    >
      <header className="creatorManageCollectionHeader">
        <button
          className="creatorBrandToggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={`collection-items-${entry.section.id}`}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown aria-hidden="true" size={16} />
          <span>
            <strong>{entry.section.title}</strong>
            <small>{entry.items.length} items</small>
          </span>
        </button>
        <div className="creatorManageCollectionActions">
          <label className="creatorLiveToggle" title="Toggle collection visibility">
            <input
              checked={visible}
              onChange={(event) => void onToggleVisibility(event.target.checked)}
              type="checkbox"
            />
            <span /> {visible ? 'On' : 'Off'}
          </label>
          {profileHandle ? (
            <Link href={`/${profileHandle}/pages/${entry.section.id}`} target="_blank">
              View page
            </Link>
          ) : null}
          <button
            aria-label={`Edit ${entry.section.title} collection`}
            disabled={saving}
            onClick={() => onEditState(true)}
            title="Edit collection"
            type="button"
          >
            <Pencil aria-hidden="true" size={16} />
          </button>
          <button
            aria-label={`Delete ${entry.section.title} collection`}
            disabled={saving}
            onClick={onDelete}
            title="Delete collection"
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      </header>
      <div id={`collection-items-${entry.section.id}`} hidden={!expanded && !editing}>
        {editing ? (
          <div className="creatorManageCollectionEditor">
            <CuratedSectionForm
              brands={brands}
              initial={entry.section}
              kind="collection"
              onCancel={() => onEditState(false)}
              onCreateBrand={onCreateBrand}
              onSave={onSave}
              recommendations={recommendations}
              saving={saving}
            />
          </div>
        ) : entry.items.length ? (
          <div className="creatorManageCollectionItems">
            {entry.items.map((item) => (
              <RecommendationManageCard
                item={item}
                key={item.id}
                onToggle={() => void onToggleItem(item)}
                visible={isItemVisible(item)}
                onArchive={() => onArchiveItem(item)}
                onEdit={() => onEditItem(item)}
              />
            ))}
          </div>
        ) : (
          <p className="creatorManageCollectionEmpty">
            No active products in this collection. Edit it to add one.
          </p>
        )}
      </div>
    </section>
  );
}

function ComposerHeader({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <header className="creatorComposerHeader">
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      <button aria-label="Close" onClick={onClose} type="button">
        <X aria-hidden="true" size={16} />
      </button>
    </header>
  );
}

function StorefrontLabelsEditor({
  brands,
  categories,
  collections,
  labels,
  onSave,
  recommendations,
  saving,
}: {
  brands: CreatorBrand[];
  categories: CategoryCard[];
  collections: CuratedSection[];
  labels: StorefrontLabel[];
  onSave: (labels: StorefrontLabel[]) => void;
  recommendations: CreatorRecommendation[];
  saving: boolean;
}) {
  const [draft, setDraft] = useState(labels);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // A newly-created label is appended to the saved order, but temporarily
  // surfaced first so its fields open directly beneath the add action.
  const [newLabelId, setNewLabelId] = useState<string | null>(null);
  const brandGroups = useMemo(() => {
    const normalized = (value: string) => value.trim().toLocaleLowerCase();
    const groupedRecommendationIds = new Set<string>();
    const groupedCollectionIds = new Set<string>();
    const groups = brands
      .map((brand) => {
        const items = recommendations.filter(
          (item) =>
            item.brandId === brand.brandId ||
            normalized(item.brandName) === normalized(brand.name),
        );
        const groupedCollections = collections.filter(
          (collection) => collection.brandId === brand.brandId,
        );
        items.forEach(({ id }) => groupedRecommendationIds.add(id));
        groupedCollections.forEach(({ id }) => groupedCollectionIds.add(id));
        return {
          id: brand.id,
          items,
          collections: groupedCollections,
          title: brand.name,
        };
      })
      .filter(({ items, collections }) => items.length || collections.length);
    const otherItems = recommendations.filter(
      ({ id }) => !groupedRecommendationIds.has(id),
    );
    const otherCollections = collections.filter(
      ({ id }) => !groupedCollectionIds.has(id),
    );
    if (otherItems.length || otherCollections.length) {
      groups.push({
        id: 'other',
        items: otherItems,
        collections: otherCollections,
        title: 'Other recommendations',
      });
    }
    return groups;
  }, [brands, collections, recommendations]);
  const update = (id: string, patch: Partial<StorefrontLabel>) =>
    setDraft((current) =>
      current.map((label) => (label.id === id ? { ...label, ...patch } : label)),
    );
  const visibleLabels =
    newLabelId && expandedId === newLabelId
      ? [
          ...draft.filter(({ id }) => id === newLabelId),
          ...draft.filter(({ id }) => id !== newLabelId),
        ]
      : draft;
  const toggleLabel = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (newLabelId && next !== newLabelId) setNewLabelId(null);
  };
  return (
    <section className="creatorLabelsEditor">
      <div className="creatorSectionHeading">
        <div>
          <h2>Storefront labels</h2>
          <p>Add category filters or create your own groups such as My favorites.</p>
        </div>
        <button
          className="button secondary"
          disabled={draft.length >= 12}
          onClick={() => {
            const id = randomUuid();
            setDraft((current) => [
              ...current,
              {
                id,
                title: 'New label',
                categorySlug: null,
                brandIds: [],
                collectionIds: [],
                layout: 'grid',
                recommendationIds: [],
              },
            ]);
            setExpandedId(id);
            setNewLabelId(id);
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={15} /> Add label
        </button>
      </div>
      <div className="creatorLabelList">
        {visibleLabels.map((label) => (
          <article className="creatorLabelEditorCard" key={label.id}>
            <div className="creatorLabelSummaryRow">
              <button
                className="creatorLabelToggle"
                type="button"
                aria-expanded={expandedId === label.id}
                aria-controls={`label-fields-${label.id}`}
                onClick={() => toggleLabel(label.id)}
              >
                <ChevronDown aria-hidden="true" size={16} />
                <span>
                  <strong>{label.title || 'Untitled label'}</strong>
                  <small>
                    {label.categorySlug
                      ? (categories.find(({ slug }) => slug === label.categorySlug)
                          ?.name ?? label.categorySlug)
                      : `${label.recommendationIds.length} items · ${(label.collectionIds ?? []).length} collections`}
                  </small>
                </span>
              </button>
              <div className="creatorLabelActions">
                <button
                  aria-label={`Delete ${label.title}`}
                  onClick={() => {
                    setDraft((current) => current.filter(({ id }) => id !== label.id));
                    if (expandedId === label.id) setExpandedId(null);
                    if (newLabelId === label.id) setNewLabelId(null);
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </div>
            </div>
            <div id={`label-fields-${label.id}`} hidden={expandedId !== label.id}>
              <div className="creatorLabelEditorTop">
                <label>
                  Label name
                  <input
                    maxLength={40}
                    value={label.title}
                    onChange={(event) => update(label.id, { title: event.target.value })}
                  />
                </label>
                <label>
                  Filter by
                  <select
                    value={label.categorySlug ?? 'custom'}
                    onChange={(event) =>
                      update(
                        label.id,
                        event.target.value === 'custom'
                          ? { categorySlug: null }
                          : {
                              categorySlug: event.target.value,
                              brandIds: [],
                              collectionIds: [],
                              recommendationIds: [],
                            },
                      )
                    }
                  >
                    <option value="custom">Selected items</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!label.categorySlug ? (
                <fieldset className="creatorLabelItems">
                  <legend>
                    Choose by brand · {label.recommendationIds.length} items ·{' '}
                    {(label.collectionIds ?? []).length} collections ·{' '}
                    {(label.brandIds ?? []).length} brand cards
                  </legend>
                  {!recommendations.length ? (
                    <p className="creatorLabelEmpty">
                      Add recommendations first to select items for this label.
                    </p>
                  ) : null}
                  {brandGroups.map((brand) => (
                    <details className="creatorLabelBrandGroup" key={brand.id}>
                      <summary>
                        <span>{brand.title}</span>
                        <small>
                          {brand.collections.length} collections · {brand.items.length}{' '}
                          items
                        </small>
                      </summary>
                      <div className="creatorLabelBrandChoices">
                        <label className="creatorLabelCollectionChoice">
                          <input
                            checked={(label.brandIds ?? []).includes(brand.id)}
                            onChange={(event) =>
                              update(label.id, {
                                layout: 'grid',
                                brandIds: event.target.checked
                                  ? [...(label.brandIds ?? []), brand.id]
                                  : (label.brandIds ?? []).filter(
                                      (id) => id !== brand.id,
                                    ),
                              })
                            }
                            type="checkbox"
                          />
                          <LayoutGrid aria-hidden="true" size={18} />
                          <span>
                            <strong>Show {brand.title} as a card</strong>
                            <small>
                              Includes this brand&apos;s products and collections
                            </small>
                          </span>
                        </label>
                        {brand.collections.map((collection) => (
                          <label
                            className="creatorLabelCollectionChoice"
                            key={collection.id}
                          >
                            <input
                              checked={(label.collectionIds ?? []).includes(
                                collection.id,
                              )}
                              onChange={(event) =>
                                update(label.id, {
                                  collectionIds: event.target.checked
                                    ? [...(label.collectionIds ?? []), collection.id]
                                    : (label.collectionIds ?? []).filter(
                                        (id) => id !== collection.id,
                                      ),
                                })
                              }
                              type="checkbox"
                            />
                            <LayoutGrid aria-hidden="true" size={18} />
                            <span dir="auto">
                              <strong>{collection.title}</strong>
                              <small>
                                Collection · {collection.recommendationIds.length} items
                              </small>
                            </span>
                          </label>
                        ))}
                        {brand.items.map((item) => (
                          <label key={item.id}>
                            <input
                              checked={label.recommendationIds.includes(item.id)}
                              onChange={(event) =>
                                update(label.id, {
                                  recommendationIds: event.target.checked
                                    ? [...label.recommendationIds, item.id]
                                    : label.recommendationIds.filter(
                                        (id) => id !== item.id,
                                      ),
                                })
                              }
                              type="checkbox"
                            />
                            <Image
                              alt=""
                              height={40}
                              width={40}
                              src={item.imageUrl}
                              unoptimized
                            />
                            <span dir="auto">{item.productName}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </fieldset>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <button
        className="button primary"
        disabled={saving || draft.some(({ title }) => !title.trim())}
        onClick={() =>
          onSave(draft.map((label) => ({ ...label, title: label.title.trim() })))
        }
        type="button"
      >
        {saving ? 'Saving…' : 'Save labels'}
      </button>
    </section>
  );
}

function ProductForm({
  brands,
  categories,
  collections,
  discounts,
  recommendations,
  editor,
  editing,
  fetching,
  fetchWarnings,
  onAddStoryLink,
  onCategoryCreated,
  onChange,
  onChangeType,
  onClose,
  onFetch,
  onImages,
  onValidationError,
  onSave,
  onStory,
  saving,
  videoStage,
  videoError,
}: {
  brands: CreatorBrand[];
  categories: CategoryCard[];
  collections: CuratedSection[];
  discounts: CreatorDiscountCode[];
  recommendations: CreatorRecommendation[];
  editor: ProductEditor;
  editing: boolean;
  fetching: boolean;
  fetchWarnings: string[];
  onAddStoryLink: () => void;
  onCategoryCreated: (category: CategoryCard) => void;
  onChange: (value: ProductEditor) => void;
  onClose: () => void;
  onChangeType: () => void;
  onFetch: (url: string) => void;
  onImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onValidationError: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onStory: (event: ChangeEvent<HTMLInputElement>) => void;
  saving: boolean;
  videoStage: string;
  videoError: string;
}) {
  const [validationError, setValidationError] = useState('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const isLinkCard = editor.contentKind === 'link';
  const matchingBrand = brands.find(
    (brand) =>
      brand.name.toLocaleLowerCase() === editor.brandName.trim().toLocaleLowerCase(),
  );
  const brandOffer = discounts.find(
    (offer) =>
      offer.brandId === matchingBrand?.id &&
      offer.scopeKind === 'brand' &&
      offer.lifecycle === 'published' &&
      offer.code,
  );
  const matchingCollections = collections.filter((collection) => {
    const brandName =
      recommendations.find(({ brandId }) => brandId === collection.brandId)?.brandName ??
      '';
    return (
      !editor.brandName.trim() ||
      brandName.toLocaleLowerCase() === editor.brandName.trim().toLocaleLowerCase()
    );
  });
  const saveLabel = isLinkCard
    ? editing
      ? 'Save link card'
      : 'Add link card'
    : editor.collectionIds.length
      ? `Save to ${editor.collectionIds.length} ${editor.collectionIds.length === 1 ? 'collection' : 'collections'}`
      : fetchWarnings.length
        ? 'Save anyway'
        : 'Save recommendation';
  const update = <K extends keyof ProductEditor>(key: K, value: ProductEditor[K]) =>
    onChange({ ...editor, [key]: value });

  return (
    <form
      onChangeCapture={() => setValidationError('')}
      onInvalidCapture={() => {
        onValidationError();
        setValidationError('Complete the highlighted required field before saving.');
      }}
      onSubmit={(event) => {
        setValidationError('');
        onSave(event);
      }}
    >
      <ComposerHeader
        title={
          editing
            ? isLinkCard
              ? 'Edit link card'
              : 'Edit item'
            : isLinkCard
              ? 'Add link card'
              : 'Add item'
        }
        onClose={onClose}
      >
        {isLinkCard
          ? 'Give your audience a useful destination, with an optional cover photo.'
          : 'Add the details yourself, or paste a link to fill them in automatically.'}
      </ComposerHeader>
      <div className="creatorComposerBody">
        <button className="creatorBack" onClick={onChangeType} type="button">
          <ArrowLeft aria-hidden="true" size={16} />
          Change type
        </button>
        <div className="creatorFullField creatorProductLinkField">
          <label htmlFor="creator-product-link">
            {isLinkCard ? (
              'Destination link'
            ) : (
              <>
                Item link <small>Optional</small>
              </>
            )}
          </label>
          <span className="creatorInlineField">
            <input
              id="creator-product-link"
              required={isLinkCard}
              type="url"
              value={editor.productUrl}
              onChange={(event) => update('productUrl', event.target.value)}
              placeholder="https://www.terminalx.com/..."
            />
            {!isLinkCard ? (
              <button
                className="button secondary"
                disabled={fetching}
                onClick={() => {
                  const url = normalizedProductUrl(editor.productUrl);
                  if (url) onFetch(url);
                }}
                type="button"
              >
                <Sparkles aria-hidden="true" size={16} />
                {fetching ? 'Fetching…' : 'Fetch details'}
              </button>
            ) : null}
          </span>
          <small>
            {isLinkCard
              ? 'This opens directly when someone taps the card.'
              : 'Select Fetch details to fill in details from a link. Or leave it blank and add the item manually — a photo is optional.'}
          </small>
        </div>
        <div className="creatorProductSavePrompt">
          <span>
            {isLinkCard
              ? 'A title and destination link are all you need.'
              : 'Add the item details, then save. A photo and shopping link are optional.'}
          </span>
          <button className="button primary" disabled={saving || fetching} type="submit">
            {fetching ? 'Fetching details…' : saving ? 'Saving…' : saveLabel}
          </button>
        </div>
        {fetchWarnings.length ? (
          <aside className="creatorFetchWarnings" role="status">
            <strong>Some details need review</strong>
            <ul>
              {fetchWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <button
              className="button secondary"
              onClick={() => {
                const target = document.querySelector<HTMLElement>(
                  '[data-fetch-field="price"], [data-fetch-field="image"], [data-fetch-field="category"]',
                );
                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target?.focus();
              }}
              type="button"
            >
              Complete details
            </button>
            <small>Or choose “Save anyway” to keep the recommendation as-is.</small>
          </aside>
        ) : null}
        <div className="creatorFormGrid">
          <label>
            {isLinkCard ? 'Link title' : 'Item name'}
            <input
              required
              value={editor.productName}
              onChange={(event) => update('productName', event.target.value)}
            />
          </label>
          {!isLinkCard ? (
            <label>
              Brand
              <input
                required
                list="creator-saved-brands"
                value={editor.brandName}
                onChange={(event) => {
                  const nextBrandName = event.target.value;
                  const nextBrand = brands.find(
                    (brand) =>
                      brand.name.toLocaleLowerCase() ===
                      nextBrandName.trim().toLocaleLowerCase(),
                  );
                  const nextBrandOffer = discounts.find(
                    (offer) =>
                      offer.brandId === nextBrand?.id &&
                      offer.scopeKind === 'brand' &&
                      offer.lifecycle === 'published' &&
                      offer.code,
                  );
                  onChange({
                    ...editor,
                    brandName: nextBrandName,
                    brandDiscountCodeId: nextBrandOffer?.id ?? '',
                    collectionIds: [],
                    discountCode: nextBrandOffer ? '' : editor.discountCode,
                    discountExpiresAt: nextBrandOffer ? '' : editor.discountExpiresAt,
                    discountLabel: nextBrandOffer ? '' : editor.discountLabel,
                    discountValue: nextBrandOffer ? '' : editor.discountValue,
                  });
                }}
              />
              <datalist id="creator-saved-brands">
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.name} />
                ))}
              </datalist>
            </label>
          ) : null}
          {isLinkCard ? (
            <label className="creatorLinkBackdropOption creatorFullField">
              <input
                checked={editor.linkHasBackground}
                onChange={(event) => update('linkHasBackground', event.target.checked)}
                type="checkbox"
              />
              <span>
                Add a subtle section background
                <small>Optional — gives the text a soft collection-style backdrop.</small>
              </span>
            </label>
          ) : null}
          {!isLinkCard ? (
            <fieldset
              className="creatorProductPhotos creatorFullField"
              data-fetch-field="image"
              id="creator-product-photos"
            >
              <legend>
                {isLinkCard ? 'Cover photo' : 'Product photos'}{' '}
                {isLinkCard ? <small>Optional</small> : null}
              </legend>
              <p>
                {isLinkCard
                  ? 'A cover is optional. Without one, your link will use a clean text-first card.'
                  : 'A photo is optional. Add one if you want the recommendation to include product imagery; text-only items are supported.'}
              </p>
              {editor.imageUrl ? (
                <div className="creatorProductPhotoGrid">
                  {[
                    { imageAssetId: editor.imageAssetId, url: editor.imageUrl },
                    ...editor.additionalImages,
                  ].map((image, index) => (
                    <span key={`${image.url}:${index}`}>
                      <Image alt="" fill sizes="96px" src={image.url} unoptimized />
                      {index === 0 ? <small>Default</small> : null}
                      <button
                        aria-label={`Remove photo ${index + 1}`}
                        onClick={() => {
                          const images = [
                            { imageAssetId: editor.imageAssetId, url: editor.imageUrl },
                            ...editor.additionalImages,
                          ].filter((_, imageIndex) => imageIndex !== index);
                          const [primary, ...additionalImages] = images;
                          onChange({
                            ...editor,
                            additionalImages,
                            imageAssetId: primary?.imageAssetId ?? '',
                            imageUrl: primary?.url ?? '',
                          });
                        }}
                        type="button"
                      >
                        <X aria-hidden="true" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="creatorPhotoControls">
                <label className="button secondary">
                  <Upload aria-hidden="true" size={16} />
                  Add photos
                  <input
                    accept={recommendationImageAccept}
                    multiple
                    onChange={onImages}
                    type="file"
                  />
                </label>
                <input
                  aria-label="Primary image link"
                  type="url"
                  value={editor.imageAssetId ? '' : editor.imageUrl}
                  onChange={(event) =>
                    onChange({
                      ...editor,
                      imageAssetId: '',
                      imageUrl: event.target.value,
                    })
                  }
                  placeholder="Or paste an image link"
                />
              </div>
            </fieldset>
          ) : null}
          {!isLinkCard ? (
            <>
              <label>
                Price (₪) <small>Optional</small>
                <input
                  data-fetch-field="price"
                  inputMode="decimal"
                  value={editor.priceIls}
                  onChange={(event) => update('priceIls', event.target.value)}
                />
              </label>
              <div className="creatorCompactPicker">
                <span>
                  Categories <small>Optional</small>
                </span>
                <details data-fetch-field="category">
                  <summary>
                    {categories
                      .filter(({ id }) => editor.categoryIds.includes(id))
                      .map(({ name }) => name)
                      .join(', ') || 'Select categories'}
                  </summary>
                  <div className="creatorCompactPickerPanel">
                    <div className="creatorPickerOptions">
                      {categories.map((category) => (
                        <label key={category.id}>
                          <input
                            checked={editor.categoryIds.includes(category.id)}
                            onChange={(event) => {
                              const categoryIds = event.target.checked
                                ? [...editor.categoryIds, category.id]
                                : editor.categoryIds.filter((id) => id !== category.id);
                              onChange({
                                ...editor,
                                categoryId: categoryIds[0] ?? editor.categoryId,
                                categoryIds,
                              });
                            }}
                            type="checkbox"
                          />
                          {category.name}
                        </label>
                      ))}
                    </div>
                    <span className="creatorCustomCategory">
                      <input
                        aria-label="New category name"
                        maxLength={100}
                        placeholder="Add your own category"
                        value={customCategoryName}
                        onChange={(event) => setCustomCategoryName(event.target.value)}
                      />
                      <button
                        className="button secondary"
                        disabled={creatingCategory || !customCategoryName.trim()}
                        onClick={() => {
                          setCreatingCategory(true);
                          void apiRequest<CategoryCard>('/creator/categories', {
                            body: JSON.stringify({ name: customCategoryName }),
                            method: 'POST',
                          })
                            .then((category) => {
                              onCategoryCreated(category);
                              onChange({
                                ...editor,
                                categoryId: category.id,
                                categoryIds: [...editor.categoryIds, category.id],
                              });
                              setCustomCategoryName('');
                            })
                            .finally(() => setCreatingCategory(false));
                        }}
                        type="button"
                      >
                        <Plus aria-hidden="true" size={14} />{' '}
                        {creatingCategory ? 'Adding…' : 'Add'}
                      </button>
                    </span>
                  </div>
                </details>
              </div>
              <div className="creatorCompactPicker">
                <span>
                  Collections <small>Optional</small>
                </span>
                <details>
                  <summary>
                    {matchingCollections
                      .filter(({ id }) => editor.collectionIds.includes(id))
                      .map(({ title }) => title)
                      .join(', ') || 'Select collections'}
                  </summary>
                  <div className="creatorCompactPickerPanel">
                    <p>An item can belong to multiple collections from the same brand.</p>
                    <div className="creatorPickerOptions">
                      {matchingCollections.length ? (
                        matchingCollections.map((collection) => (
                          <label key={collection.id}>
                            <input
                              checked={editor.collectionIds.includes(collection.id)}
                              disabled={
                                collection.recommendationIds.length >= 20 &&
                                !editor.collectionIds.includes(collection.id)
                              }
                              onChange={(event) =>
                                update(
                                  'collectionIds',
                                  event.target.checked
                                    ? [...editor.collectionIds, collection.id]
                                    : editor.collectionIds.filter(
                                        (id) => id !== collection.id,
                                      ),
                                )
                              }
                              type="checkbox"
                            />
                            {collection.title}
                            {collection.recommendationIds.length >= 20 ? ' (full)' : ''}
                          </label>
                        ))
                      ) : (
                        <small>No collections exist for this brand yet.</small>
                      )}
                    </div>
                  </div>
                </details>
              </div>
              {brandOffer ? (
                <div className="creatorBrandOfferChoice creatorFullField">
                  <label className="creatorCheckboxField">
                    <input
                      type="checkbox"
                      checked={editor.brandDiscountCodeId === brandOffer.id}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onChange({
                            ...editor,
                            brandDiscountCodeId: brandOffer.id,
                            discountCode: '',
                            discountExpiresAt: '',
                            discountLabel: '',
                            discountValue: '',
                          });
                        } else {
                          onChange({
                            ...editor,
                            brandDiscountCodeId: '',
                            discountCode: '',
                            discountExpiresAt: '',
                            discountLabel: '',
                            discountValue: '',
                          });
                        }
                      }}
                    />
                    <span>
                      <strong>Use the same discount as {matchingBrand?.name}</strong>
                      <small>
                        ({brandOffer.code}
                        {brandOffer.discountPercent
                          ? ` · ${brandOffer.discountPercent}% off`
                          : brandOffer.discountAmountMinor
                            ? ` · ₪${(brandOffer.discountAmountMinor / 100).toFixed(2)} off`
                            : ''}
                        {brandOffer.expiresAt
                          ? ` · ends ${new Date(brandOffer.expiresAt).toLocaleDateString()}`
                          : ''}
                        )
                      </small>
                    </span>
                  </label>
                </div>
              ) : null}
              {!editor.brandDiscountCodeId ? (
                <label>
                  Discount code
                  <input
                    value={editor.discountCode}
                    onChange={(event) => update('discountCode', event.target.value)}
                  />
                </label>
              ) : null}
              {!editor.brandDiscountCodeId ? (
                <label>
                  Discount
                  <span
                    className="creatorDiscountType"
                    role="group"
                    aria-label="Discount type"
                  >
                    <button
                      aria-pressed={editor.discountType === 'percent'}
                      onClick={() => update('discountType', 'percent')}
                      type="button"
                    >
                      Percent
                    </button>
                    <button
                      aria-pressed={editor.discountType === 'amount'}
                      onClick={() => update('discountType', 'amount')}
                      type="button"
                    >
                      Fixed amount
                    </button>
                  </span>
                  <input
                    inputMode="decimal"
                    onChange={(event) => update('discountValue', event.target.value)}
                    placeholder={editor.discountType === 'percent' ? '20' : '100'}
                    value={editor.discountValue}
                  />
                </label>
              ) : null}
              {!editor.brandDiscountCodeId ? (
                <label>
                  Expires at
                  <input
                    type="date"
                    value={editor.discountExpiresAt}
                    onChange={(event) => update('discountExpiresAt', event.target.value)}
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </div>
        {!isLinkCard ? (
          <>
            <label className="creatorFullField">
              Review <small>Optional</small>
              <textarea
                dir="auto"
                maxLength={1000}
                rows={3}
                value={editor.reviewHe}
                onChange={(event) => update('reviewHe', event.target.value)}
              />
            </label>
            <label className="creatorFullField">
              Instagram story or Highlight link (optional)
              <input
                inputMode="url"
                placeholder="https://www.instagram.com/stories/..."
                type="url"
                value={editor.instagramStoryUrl}
                onChange={(event) =>
                  update('instagramStoryUrl', event.target.value.trim())
                }
              />
            </label>
            <fieldset className="creatorStoryFields">
              <legend>Story clips (optional)</legend>
              <p>
                Attach short videos like your Instagram stories. They appear on this
                recommendation card in order.
              </p>
              <label className="creatorStoryUpload creatorVideoUploadButton">
                <Upload aria-hidden="true" size={16} />
                <span>{videoStage ? `${videoStage}…` : 'Upload videos'}</span>
                <input
                  accept={storyVideoAccept}
                  disabled={saving}
                  multiple
                  onChange={onStory}
                  type="file"
                />
              </label>
              {videoError ? (
                <p className="formError" role="alert">
                  {videoError}
                </p>
              ) : null}
              {editor.storyClips.length ? (
                <div className="creatorStoryThumbs">
                  {editor.storyClips.map((clip, index) => (
                    <span key={`${clip.url}:${index}`}>
                      <video muted playsInline src={clip.url} />
                      <button
                        aria-label="Remove clip"
                        onClick={() =>
                          update(
                            'storyClips',
                            editor.storyClips.filter(
                              (_, clipIndex) => clipIndex !== index,
                            ),
                          )
                        }
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <span className="creatorInlineField">
                <input
                  type="url"
                  value={editor.storyLink}
                  onChange={(event) => update('storyLink', event.target.value)}
                  placeholder="…or paste a video link (https://)"
                />
                <button
                  className="button secondary"
                  onClick={onAddStoryLink}
                  type="button"
                >
                  <Link2 aria-hidden="true" size={16} />
                  Add link
                </button>
              </span>
            </fieldset>
          </>
        ) : null}
        <div className="creatorFormActions">
          {validationError ? (
            <p className="formError" role="alert">
              {validationError}
            </p>
          ) : null}
          <button className="button primary" disabled={saving || fetching} type="submit">
            {fetching ? 'Fetching details…' : saving ? 'Saving…' : saveLabel}
          </button>
          <button onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function normalizedProductUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

function brandNameFromUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./i, '');
    const name = hostname.split('.')[0]?.replaceAll('-', ' ').trim() ?? '';
    return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return '';
  }
}

function brandLogoFromUrl(value: string) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? `${parsed.origin}/favicon.ico` : '';
  } catch {
    return '';
  }
}

function DiscountForm({
  brands,
  collections,
  editor,
  editing,
  onChange,
  onClose,
  onSave,
  recommendations,
  saving,
}: {
  brands: CreatorBrand[];
  collections: CuratedSection[];
  editor: DiscountEditor;
  editing: boolean;
  onChange: (value: DiscountEditor) => void;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  recommendations: CreatorRecommendation[];
  saving: boolean;
}) {
  const update = <K extends keyof DiscountEditor>(key: K, value: DiscountEditor[K]) =>
    onChange({ ...editor, [key]: value });
  return (
    <form onSubmit={onSave}>
      <ComposerHeader title={editing ? 'Edit offer' : 'Add offer'} onClose={onClose}>
        Add a creator code or a timed brand promotion and choose where it applies.
      </ComposerHeader>
      <div className="creatorComposerBody">
        <label className="creatorFullField">
          Brand link
          <input
            required
            inputMode="url"
            type="text"
            value={editor.merchantUrl}
            onChange={(event) => update('merchantUrl', event.target.value)}
            placeholder="https://www.terminalx.com"
          />
        </label>
        <div className="creatorFormGrid">
          <label>
            Offer type
            <select
              value={editor.offerType}
              onChange={(event) =>
                update('offerType', event.target.value as DiscountEditor['offerType'])
              }
            >
              <option value="creator_code">Creator discount</option>
              <option value="brand_promotion">Brand promotion</option>
            </select>
          </label>
          <label>
            Brand
            <select
              value={editor.brandId}
              onChange={(event) => update('brandId', event.target.value)}
            >
              <option value="">No linked brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Applies to
            <select
              value={editor.scopeTarget}
              onChange={(event) => update('scopeTarget', event.target.value)}
            >
              <option value="brand">Entire brand</option>
              {collections.map((collection) => (
                <option key={collection.id} value={`collection:${collection.id}`}>
                  Collection · {collection.title}
                </option>
              ))}
              {recommendations.map((item) => (
                <option key={item.id} value={`item:${item.id}`}>
                  Item · {item.productName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Code (optional)
            <input
              value={editor.code}
              onChange={(event) => update('code', event.target.value)}
            />
          </label>
          <label>
            Discount type
            <select
              value={editor.discountType}
              onChange={(event) =>
                onChange({
                  ...editor,
                  discountType: event.target.value as DiscountEditor['discountType'],
                  discountPercent: '',
                  discountAmount: '',
                })
              }
            >
              <option value="percent">Percent off</option>
              <option value="amount">Fixed ₪ amount off</option>
            </select>
          </label>
          <label>
            {editor.discountType === 'amount' ? 'Amount off (₪)' : 'Percent off'}
            <input
              min="1"
              max={editor.discountType === 'amount' ? undefined : '100'}
              type="number"
              value={
                editor.discountType === 'amount'
                  ? editor.discountAmount
                  : editor.discountPercent
              }
              onChange={(event) =>
                update(
                  editor.discountType === 'amount' ? 'discountAmount' : 'discountPercent',
                  event.target.value,
                )
              }
            />
          </label>
          <label>
            Discount label
            <input
              value={editor.label}
              onChange={(event) => update('label', event.target.value)}
              placeholder="15% off"
            />
          </label>
          <label>
            Starts
            <input
              type="datetime-local"
              value={editor.startsAt}
              onChange={(event) => update('startsAt', event.target.value)}
            />
          </label>
          <label>
            Expires
            <input
              type="datetime-local"
              value={editor.expiresAt}
              onChange={(event) => update('expiresAt', event.target.value)}
            />
          </label>
          <label>
            Schedule
            <select
              value={editor.recurrenceRule}
              onChange={(event) =>
                update(
                  'recurrenceRule',
                  event.target.value as DiscountEditor['recurrenceRule'],
                )
              }
            >
              <option value="none">Date window / always</option>
              <option value="month_end_week">Last 7 days of every month</option>
            </select>
          </label>
          <label>
            Priority
            <input
              min="-1000"
              max="1000"
              type="number"
              value={editor.priority}
              onChange={(event) => update('priority', event.target.value)}
            />
          </label>
          <label className="creatorCheckboxField">
            <input
              checked={editor.stackable}
              onChange={(event) => update('stackable', event.target.checked)}
              type="checkbox"
            />
            Can be combined with another active offer
          </label>
        </div>
        <label className="creatorFullField">
          Details (optional)
          <textarea
            dir="auto"
            rows={4}
            value={editor.detailsHe}
            onChange={(event) => update('detailsHe', event.target.value)}
          />
        </label>
        <div className="creatorFormActions">
          <button className="button primary" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save code'}
          </button>
          <button onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function RecommendationManageCard({
  item,
  onArchive,
  onEdit,
  onToggle,
  visible = true,
}: {
  item: CreatorRecommendation;
  onArchive: () => void;
  onEdit: () => void;
  onToggle?: () => void;
  visible?: boolean;
}) {
  return (
    <article className="creatorManageCard">
      {hasRecommendationImage(item.imageUrl) ? (
        <span className="creatorManageImage">
          <Image alt="" fill sizes="120px" src={item.imageUrl} unoptimized />
        </span>
      ) : (
        <span aria-hidden="true" className="creatorManageImage creatorManageImageEmpty" />
      )}
      <div className="creatorManageCopy">
        <p className="productBrand">{item.brandName}</p>
        <h3>{item.productName}</h3>
        {!isManualRecommendationUrl(item.productUrl) ? (
          <a href={item.productUrl} rel="noreferrer" target="_blank">
            Product link
            <ExternalLink aria-hidden="true" size={12} />
          </a>
        ) : null}
      </div>
      <div className="creatorManageActions">
        {onToggle ? (
          <label className="creatorLiveToggle" title="Toggle recommendation visibility">
            <input checked={visible} onChange={onToggle} type="checkbox" />
            <span /> {visible ? 'On' : 'Off'}
          </label>
        ) : null}
        <button aria-label="Edit recommendation" onClick={onEdit} type="button">
          <Pencil aria-hidden="true" size={16} />
        </button>
        <button
          aria-label="Remove recommendation"
          onClick={onArchive}
          title="Remove recommendation"
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
        </button>
      </div>
    </article>
  );
}

function DiscountManageCard({
  item,
  onArchive,
  onEdit,
  onToggle,
}: {
  item: CreatorDiscountCode;
  onArchive: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="creatorManageCard creatorDiscountManageCard">
      <div className="creatorManageCopy">
        <p className="productBrand">{item.merchantHostname}</p>
        <h3>{item.code || item.label || 'Brand promotion'}</h3>
        {item.label ? (
          <span className="creatorCodePill">
            <Tag aria-hidden="true" size={12} />
            {item.label}
          </span>
        ) : null}
        <p dir="rtl" lang="he">
          {item.details?.value}
        </p>
        <small>
          {item.offerType === 'brand_promotion' ? 'Brand promotion' : 'Creator discount'}
          {' · '}priority {item.priority}
          {item.recurrenceRule === 'month_end_week' ? ' · last week monthly' : ''}
          {item.stackable ? ' · stackable' : ''}
        </small>
        <a href={item.merchantUrl} rel="noreferrer" target="_blank">
          Brand link
          <ExternalLink aria-hidden="true" size={12} />
        </a>
      </div>
      <div className="creatorManageActions">
        <label className="creatorLiveToggle">
          <input
            checked={item.lifecycle === 'published'}
            onChange={onToggle}
            type="checkbox"
          />
          <span /> Live
        </label>
        <button aria-label="Edit discount" onClick={onEdit} type="button">
          <Pencil aria-hidden="true" size={16} />
        </button>
        <button aria-label="Archive discount" onClick={onArchive} type="button">
          <Trash2 aria-hidden="true" size={16} />
        </button>
      </div>
    </article>
  );
}

function CuratedSectionForm({
  brands = [],
  collections = [],
  initial,
  kind,
  onCancel,
  onAddNewItem,
  onCreateBrand,
  onSave,
  recommendations,
  saving,
}: {
  brands?: CreatorBrand[];
  collections?: CuratedSection[];
  initial?: CuratedSection;
  kind: CuratedSection['kind'];
  onCancel: () => void;
  onAddNewItem?: (section: CuratedSection, brandName: string) => Promise<boolean>;
  onCreateBrand?: (input: { name: string; websiteUrl: string }) => Promise<CreatorBrand>;
  onSave: (section: CuratedSection) => Promise<boolean>;
  recommendations: CreatorRecommendation[];
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [availableBrands, setAvailableBrands] = useState(brands);
  const [brandId, setBrandId] = useState(initial?.brandId ?? '');
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandUrl, setNewBrandUrl] = useState('');
  const sectionId = useState(initial?.id ?? randomUuid())[0];
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [parentCollectionId, setParentCollectionId] = useState(
    initial?.parentCollectionId ?? '',
  );
  const [recommendationIds, setRecommendationIds] = useState<string[]>(
    initial?.recommendationIds ?? [],
  );
  const [showItemsIndividually, setShowItemsIndividually] = useState(
    initial?.showItemsIndividually ?? false,
  );
  const [selectionError, setSelectionError] = useState('');
  const [draggingRecommendationId, setDraggingRecommendationId] = useState<string | null>(
    null,
  );
  const visibleRecommendations = brandId
    ? recommendations.filter((item) => item.brandId === brandId)
    : recommendations;
  const recommendationGroups = Array.from(
    visibleRecommendations.reduce((groups, item) => {
      const key = item.brandId || `unassigned:${item.brandName}`;
      const group = groups.get(key) ?? {
        name: item.brandName || 'Other products',
        items: [],
      };
      group.items.push(item);
      groups.set(key, group);
      return groups;
    }, new Map<string, { name: string; items: CreatorRecommendation[] }>()),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recommendationIds.length) {
      setSelectionError('Choose at least one product.');
      return;
    }
    const saved = await onSave({
      id: sectionId,
      kind,
      brandId: brandId || null,
      recommendationIds,
      showItemsIndividually,
      title: title.trim(),
      description: kind === 'page' ? description.trim() : (initial?.description ?? ''),
      imageUrl: imageUrl || null,
      parentCollectionId:
        kind === 'page'
          ? parentCollectionId || null
          : (initial?.parentCollectionId ?? null),
    });
    if (saved) onCancel();
  }

  return (
    <form className="creatorCuratedForm" onSubmit={(event) => void submit(event)}>
      <label>
        {kind === 'collection'
          ? 'Collection name'
          : kind === 'page'
            ? 'Page title'
            : 'Section name'}
        <input
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            kind === 'collection'
              ? 'Favorites from Fox'
              : kind === 'page'
                ? 'My summer picks'
                : 'Weekend picks'
          }
          required
          value={title}
        />
      </label>
      {kind === 'collection' ? (
        <label>
          Brand
          <select
            required
            value={brandId}
            onChange={(event) => {
              setBrandId(event.target.value);
              if (event.target.value) setCreatingBrand(false);
              setRecommendationIds((ids) =>
                ids.filter(
                  (id) =>
                    recommendations.find((item) => item.id === id)?.brandId ===
                    event.target.value,
                ),
              );
            }}
          >
            <option value="">All brands — browse products</option>
            {availableBrands.map((brand) => (
              <option key={brand.brandId} value={brand.brandId}>
                {brand.name}
              </option>
            ))}
          </select>
          {brandId && availableBrands.find((item) => item.brandId === brandId) ? (
            <small>Using this brand&apos;s saved name and website.</small>
          ) : null}
          {onCreateBrand ? (
            <button
              className="creatorInlineAction"
              onClick={() => setCreatingBrand((value) => !value)}
              type="button"
            >
              {creatingBrand ? 'Use an existing brand' : '+ Create a new brand'}
            </button>
          ) : null}
        </label>
      ) : null}
      {kind === 'collection' ? (
        <label>
          Collection cover
          <span className="creatorCollectionCoverInput">
            {imageUrl ? (
              <Image alt="" height={96} src={imageUrl} unoptimized width={128} />
            ) : null}
            <input
              accept={recommendationImageAccept}
              disabled={saving || uploadingCover}
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploadingCover(true);
                setSelectionError('');
                void uploadRecommendationImage(file, () => undefined)
                  .then((asset) => setImageUrl(asset.publicUrl))
                  .catch((cause: unknown) => setSelectionError(messageFor(cause)))
                  .finally(() => setUploadingCover(false));
              }}
            />
            <small>
              {uploadingCover
                ? 'Uploading…'
                : imageUrl
                  ? 'Replace image'
                  : 'Upload image'}
            </small>
          </span>
        </label>
      ) : null}
      {kind === 'collection' && creatingBrand && onCreateBrand ? (
        <div className="creatorInlineCreator creatorFormGrid">
          <label>
            Brand website
            <input
              required={creatingBrand}
              type="url"
              value={newBrandUrl}
              onBlur={() => {
                if (!newBrandName.trim()) setNewBrandName(brandNameFromUrl(newBrandUrl));
              }}
              onChange={(event) => setNewBrandUrl(event.target.value)}
            />
          </label>
          <label>
            Brand name
            <input
              required={creatingBrand}
              value={newBrandName}
              onChange={(event) => setNewBrandName(event.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={saving || !newBrandName.trim() || !newBrandUrl.trim()}
            onClick={() =>
              void onCreateBrand({
                name: newBrandName.trim(),
                websiteUrl: newBrandUrl.trim(),
              })
                .then((created) => {
                  setAvailableBrands((current) => [
                    ...current.filter(({ id }) => id !== created.id),
                    created,
                  ]);
                  setBrandId(created.brandId);
                  setCreatingBrand(false);
                })
                .catch((cause: unknown) => setSelectionError(messageFor(cause)))
            }
            type="button"
          >
            Create brand
          </button>
        </div>
      ) : null}
      {kind === 'page' ? (
        <>
          <label>
            Short description
            <textarea
              maxLength={240}
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
          <label>
            Show inside collection
            <select
              onChange={(event) => {
                const parentId = event.target.value;
                setParentCollectionId(parentId);
                setBrandId(collections.find(({ id }) => id === parentId)?.brandId ?? '');
              }}
              value={parentCollectionId}
            >
              <option value="">No collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <fieldset>
        <legend>Products in this {kind}</legend>
        {recommendations.length ? (
          <div className="creatorCuratedChoices">
            {recommendationGroups.map(([id, group]) => (
              <section className="creatorCuratedBrandGroup" key={id}>
                {!brandId ? <h3>{group.name}</h3> : null}
                {group.items.map((item) => (
                  <label key={item.id}>
                    <input
                      checked={recommendationIds.includes(item.id)}
                      type="checkbox"
                      disabled={
                        recommendationIds.length >= 20 &&
                        !recommendationIds.includes(item.id)
                      }
                      onChange={(event) => {
                        setSelectionError('');
                        setRecommendationIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        );
                      }}
                    />
                    <span className="creatorCuratedProductThumb">
                      {item.imageUrl ? (
                        <Image alt="" fill sizes="44px" src={item.imageUrl} unoptimized />
                      ) : null}
                    </span>
                    <span>
                      {item.productName}
                      {!brandId ? <small>{item.brandName}</small> : null}
                    </span>
                  </label>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <p>Add a product recommendation first.</p>
        )}
      </fieldset>
      {kind === 'collection' ? (
        <label className="creatorCheckboxField">
          <input
            checked={showItemsIndividually}
            onChange={(event) => setShowItemsIndividually(event.target.checked)}
            type="checkbox"
          />
          Also show these items as individual recommendations
        </label>
      ) : null}
      {kind === 'collection' && onAddNewItem ? (
        <button
          className="creatorInlineAction"
          disabled={saving || !title.trim() || !brandId}
          onClick={() => {
            const selectedBrand = availableBrands.find(
              (item) => item.brandId === brandId,
            );
            void onAddNewItem(
              {
                id: sectionId,
                kind: 'collection',
                brandId,
                recommendationIds,
                title: title.trim(),
                description: '',
                imageUrl: imageUrl || null,
                parentCollectionId: null,
                showItemsIndividually,
              },
              selectedBrand?.name ?? '',
            ).catch((cause: unknown) => setSelectionError(messageFor(cause)));
          }}
          type="button"
        >
          + Save collection and create a new item
        </button>
      ) : null}
      {recommendationIds.length > 1 ? (
        <div className="creatorCuratedOrder">
          <p>Product order in this {kind}</p>
          <ol>
            {recommendationIds.map((id, index) => {
              const item = recommendations.find(
                (recommendation) => recommendation.id === id,
              );
              if (!item) return null;
              return (
                <li
                  key={id}
                  onDragOver={(event: DragEvent<HTMLLIElement>) => {
                    if (!draggingRecommendationId || saving) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event: DragEvent<HTMLLIElement>) => {
                    event.preventDefault();
                    const sourceId = event.dataTransfer.getData('text/plain');
                    const from = recommendationIds.indexOf(sourceId);
                    setDraggingRecommendationId(null);
                    if (saving || from < 0 || from === index) return;
                    setRecommendationIds(move(recommendationIds, from, index));
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="creatorLayerDragHandle"
                    draggable={!saving}
                    onDragEnd={() => setDraggingRecommendationId(null)}
                    onDragStart={(event: DragEvent<HTMLSpanElement>) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', id);
                      setDraggingRecommendationId(id);
                    }}
                  >
                    <GripVertical size={16} />
                  </span>
                  <span>{item.productName}</span>
                  <button
                    aria-label={`Move ${item.productName} up`}
                    disabled={index === 0 || saving}
                    onClick={() =>
                      setRecommendationIds(move(recommendationIds, index, index - 1))
                    }
                    type="button"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    aria-label={`Move ${item.productName} down`}
                    disabled={index === recommendationIds.length - 1 || saving}
                    onClick={() =>
                      setRecommendationIds(move(recommendationIds, index, index + 1))
                    }
                    type="button"
                  >
                    <ArrowDown size={15} />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
      {selectionError ? (
        <p className="formError" role="alert">
          {selectionError}
        </p>
      ) : null}
      <div className="creatorCuratedActions">
        <button
          className="button primary"
          disabled={saving || !recommendations.length}
          type="submit"
        >
          {saving ? 'Saving...' : initial ? 'Save changes' : `Create ${kind}`}
        </button>
        <button className="button secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

function move<T>(values: T[], from: number, to: number): T[] {
  const next = [...values];
  const [value] = next.splice(from, 1);
  if (value) next.splice(to, 0, value);
  return next;
}

async function loadCreatorRecommendations(): Promise<CreatorRecommendation[]> {
  const items: CreatorRecommendation[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '48' });
    if (cursor) query.set('cursor', cursor);
    const page = await apiCollectionRequest<CreatorRecommendation>(
      `/creator/recommendations?${query.toString()}`,
    );
    items.push(...page.data);
    cursor = page.page.nextCursor;
  } while (cursor);
  return items;
}
function toIso(value: string) {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null;
}
function toLocalDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}
function toDateTimeIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}
function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function normalizeInstagramStoryUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return null;
    }
    if (url.hostname === 'ig.me') return url.pathname.length > 1 ? url.toString() : null;
    if (!['instagram.com', 'www.instagram.com'].includes(url.hostname)) return null;
    const path = url.pathname.toLowerCase();
    if (
      !path.startsWith('/stories/') &&
      !path.startsWith('/s/') &&
      !path.startsWith('/share/') &&
      !path.startsWith('/highlights/')
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}

const manualRecommendationUrlPrefix = 'https://swavii.com/manual-recommendation/';

function recommendationProductUrl(value: string) {
  return normalizedProductUrl(value) || `${manualRecommendationUrlPrefix}${randomUuid()}`;
}

function detectFeaturedMedia(value: string): {
  provider: FeaturedMedia['provider'];
  thumbnailUrl: string | null;
  title: string;
} | null {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') {
      const videoId =
        host === 'youtu.be'
          ? url.pathname.slice(1).split('/')[0]
          : (url.searchParams.get('v') ??
            url.pathname.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1]);
      if (!videoId) return null;
      return {
        provider: 'youtube',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        title: 'YouTube video',
      };
    }
    if (host === 'instagram.com' && /^\/(?:p|reel)\//u.test(url.pathname)) {
      return { provider: 'instagram', thumbnailUrl: null, title: 'Instagram post' };
    }
    if (host === 'open.spotify.com' || host === 'spotify.link') {
      return { provider: 'spotify', thumbnailUrl: null, title: 'Spotify content' };
    }
    if (host === 'music.apple.com') {
      return {
        provider: 'apple_music',
        thumbnailUrl: null,
        title: 'Apple Music content',
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isManualRecommendationUrl(value: string) {
  return value.startsWith(manualRecommendationUrlPrefix);
}

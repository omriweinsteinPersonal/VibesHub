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
  StoryClipInput,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  GripVertical,
  LayoutGrid,
  Link2,
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
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react';

import { apiCollectionRequest, apiRequest } from '../../lib/api';
import {
  recommendationImageAccept,
  storyVideoAccept,
  uploadRecommendationImage,
  uploadStoryVideo,
} from '../../lib/recommendation-media';
import { randomUuid } from '../../lib/random-id';
import { CreatorConnectorsEditor } from './creator-connectors-editor';
import { CreatorShellHeader } from './creator-shell-header';
import { SiteFooter } from './site-footer';

type Composer = null | 'choose' | 'product' | 'discount' | 'brand' | 'collection';
type CuratedSection = CreatorStorefrontConfigurationInput['curatedSections'][number];
type ContentLayer = CreatorStorefrontConfigurationInput['contentOrder'][number];
type StorefrontLabel = CreatorStorefrontConfigurationInput['labels'][number];
type CollectionManageEntry = {
  kind: 'collection';
  section: CuratedSection;
  items: CreatorRecommendation[];
};

interface ProductEditor {
  additionalImages: Array<{ imageAssetId: string; url: string }>;
  brandName: string;
  categoryId: string;
  categoryIds: string[];
  collectionIds: string[];
  discountCode: string;
  discountExpiresAt: string;
  discountLabel: string;
  imageAssetId: string;
  imageUrl: string;
  instagramStoryUrl: string;
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
  discountPercent: string;
  expiresAt: string;
  label: string;
  merchantUrl: string;
  offerType: 'brand_promotion' | 'creator_code';
  priority: string;
  recurrenceRule: 'month_end_week' | 'none';
  scopeTarget: string;
  stackable: boolean;
  startsAt: string;
}
interface BrandEditor {
  code: string;
  detailsHe: string;
  discountPercent: string;
  expiresAt: string;
  name: string;
  websiteUrl: string;
}

const emptyProduct: ProductEditor = {
  additionalImages: [],
  brandName: '',
  categoryId: '',
  categoryIds: [],
  collectionIds: [],
  discountCode: '',
  discountExpiresAt: '',
  discountLabel: '',
  imageAssetId: '',
  imageUrl: '',
  instagramStoryUrl: '',
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
  discountPercent: '',
  expiresAt: '',
  label: '',
  merchantUrl: '',
  offerType: 'creator_code',
  priority: '0',
  recurrenceRule: 'none',
  scopeTarget: 'brand',
  stackable: false,
  startsAt: '',
};

export function CreatorDashboard() {
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
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
    detailsHe: '',
    discountPercent: '',
    expiresAt: '',
    name: '',
    websiteUrl: '',
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
  const [storefrontLabels, setStorefrontLabels] = useState<StorefrontLabel[]>([]);
  const [expandedBrandId, setExpandedBrandId] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [dashboardView, setDashboardView] = useState<
    'recommendations' | 'labels' | 'connectors'
  >('recommendations');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const productFetchRequest = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        categoryPage,
        loadedProfile,
        loadedRecommendations,
        discountPage,
        config,
        loadedBrands,
      ] = await Promise.all([
        apiCollectionRequest<CategoryCard>('/creator/categories'),
        apiRequest<CreatorProfileSettings>('/creator/profile'),
        loadCreatorRecommendations(),
        apiCollectionRequest<CreatorDiscountCode>('/creator/discount-codes?limit=48'),
        apiRequest<CreatorStorefrontConfiguration>('/creator/studio/storefront-sections'),
        apiRequest<CreatorBrand[]>('/creator/brands'),
      ]);
      setCategories(categoryPage.data);
      setProfile(loadedProfile);
      setRecommendations(loadedRecommendations);
      setDiscounts(discountPage.data);
      setBrands(loadedBrands);
      const loadedOrder = Array.isArray(config.contentOrder) ? config.contentOrder : [];
      setConfiguration({ ...config, contentOrder: loadedOrder });
      setStorefrontLabels(config.labels ?? []);
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
          recommendationIds: section.recommendationIds.filter((id) => activeIds.has(id)),
        })),
      );
      setProduct((current) => ({
        ...current,
        categoryId: current.categoryId || loadedProfile.primaryCategory.id,
        categoryIds: current.categoryIds.length
          ? current.categoryIds
          : [current.categoryId || loadedProfile.primaryCategory.id],
      }));
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, []);

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
    setNotice('');
  }

  function closeComposer() {
    productFetchRequest.current += 1;
    setFetching(false);
    setError('');
    setNotice('');
    setComposer(null);
    setEditingProduct(null);
    setEditingDiscount(null);
    setEditingBrand(null);
    const categoryId = profile?.primaryCategory.id ?? '';
    setProduct({
      ...emptyProduct,
      categoryId,
      categoryIds: categoryId ? [categoryId] : [],
    });
    setDiscount(emptyDiscount);
    setBrand({
      code: '',
      detailsHe: '',
      discountPercent: '',
      expiresAt: '',
      name: '',
      websiteUrl: '',
    });
  }

  async function saveBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const savedBrand = await apiRequest<CreatorBrand>(
        editingBrand ? `/creator/brands/${editingBrand.id}` : '/creator/brands',
        {
          body: JSON.stringify({ name: brand.name, websiteUrl: brand.websiteUrl }),
          ...(editingBrand
            ? { headers: { 'if-match': `"${editingBrand.version}"` } }
            : {}),
          idempotent: !editingBrand,
          method: editingBrand ? 'PATCH' : 'POST',
        },
      );
      const existingOffer = editingBrand
        ? discounts.find(
            (offer) => offer.brandId === editingBrand.id && offer.scopeKind === 'brand',
          )
        : null;
      const hasOffer = Boolean(
        brand.code.trim() ||
        brand.discountPercent ||
        brand.expiresAt ||
        brand.detailsHe.trim(),
      );
      if (hasOffer) {
        const offerBody = JSON.stringify({
          brandId: savedBrand.id,
          code: brand.code.trim() || null,
          detailsHe: brand.detailsHe.trim() || null,
          discountPercent: brand.discountPercent ? Number(brand.discountPercent) : null,
          expiresAt: toDateTimeIso(brand.expiresAt),
          label: brand.discountPercent ? `${brand.discountPercent}% off` : null,
          merchantUrl: savedBrand.websiteUrl,
          offerType: 'creator_code',
          priority: 0,
          recurrenceRule: 'none',
          scopeId: null,
          scopeKind: 'brand',
          source: 'manual',
          stackable: false,
          startsAt: null,
        });
        if (existingOffer) {
          const updated = await apiRequest<CreatorDiscountCode>(
            `/creator/discount-codes/${existingOffer.id}`,
            {
              body: offerBody,
              headers: { 'if-match': `"${existingOffer.version}"` },
              method: 'PATCH',
            },
          );
          await apiRequest(`/creator/discount-codes/${updated.id}/confirm`, {
            headers: { 'if-match': `"${updated.version}"` },
            idempotent: true,
            method: 'POST',
          });
        } else {
          const created = await apiRequest<CreatorDiscountCode>(
            '/creator/discount-codes',
            { body: offerBody, idempotent: true, method: 'POST' },
          );
          await apiRequest(`/creator/discount-codes/${created.id}/confirm`, {
            headers: { 'if-match': `"${created.version}"` },
            idempotent: true,
            method: 'POST',
          });
          await saveSections(selectedSections, curatedSections, [
            ...contentOrder,
            { kind: 'discount', id: created.id },
          ]);
        }
      } else if (existingOffer) {
        await apiRequest(`/creator/discount-codes/${existingOffer.id}/archive`, {
          headers: { 'if-match': `"${existingOffer.version}"` },
          idempotent: true,
          method: 'POST',
        });
      }
      closeComposer();
      await load();
      setNotice(
        editingBrand
          ? 'Brand updated.'
          : 'Brand added. You can now add items and collections to it.',
      );
    } catch (cause) {
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
      setError('');
      try {
        const metadata = await apiRequest<CreatorProductMetadata>(
          '/creator/recommendations/fetch-details',
          { body: JSON.stringify({ url: requestedUrl }), method: 'POST' },
        );
        if (productFetchRequest.current !== requestId) return;
        setProduct((current) => {
          const categoryId =
            categories.find((category) => category.slug === metadata.categorySlug)?.id ??
            current.categoryId;
          return normalizedProductUrl(current.productUrl) === requestedUrl
            ? {
                ...current,
                brandName: metadata.brandName ?? current.brandName,
                categoryId,
                categoryIds: current.categoryIds.length
                  ? current.categoryIds
                  : categoryId
                    ? [categoryId]
                    : [],
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
              ? 'Product details fetched. Review them, then select Save recommendation.'
              : 'Product details fetched, but this store did not provide a photo. Add one before selecting Save recommendation.',
          );
        }
      } catch (cause) {
        if (productFetchRequest.current === requestId) {
          setError(messageFor(cause));
        }
      } finally {
        if (productFetchRequest.current === requestId) {
          setFetching(false);
        }
      }
    },
    [categories],
  );

  async function selectStoryClip(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of files.slice(0, 10 - product.storyClips.length)) {
        const asset = await uploadStoryVideo(file, () => undefined);
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
      setError(messageFor(cause));
    } finally {
      setUploading(false);
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
    const price = product.priceIls.trim() ? Number(product.priceIls) : 0;
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!product.imageAssetId && !product.imageUrl) {
      setError('Add a product photo to save this recommendation.');
      document.getElementById('creator-product-photos')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
      return;
    }
    setSaving(true);
    setError('');
    try {
      const storyClips: StoryClipInput[] = product.storyClips.map((clip) =>
        clip.mediaAssetId ? { mediaAssetId: clip.mediaAssetId } : { videoUrl: clip.url },
      );
      const body = JSON.stringify({
        brandName: product.brandName,
        categoryId: product.categoryId,
        categoryIds: product.categoryIds.length
          ? product.categoryIds
          : [product.categoryId],
        commercialRelationship: 'organic',
        discountCode: product.discountCode.trim() || null,
        discountExpiresAt: toIso(product.discountExpiresAt),
        discountLabel: product.discountLabel.trim() || null,
        imageAssetId: product.imageAssetId || null,
        imageUrl: product.imageAssetId ? null : product.imageUrl,
        instagramStoryUrl: product.instagramStoryUrl.trim() || null,
        additionalImages: product.additionalImages.map((image) =>
          image.imageAssetId
            ? { imageAssetId: image.imageAssetId }
            : { imageUrl: image.url },
        ),
        priceAmountMinor: Math.round(price * 100),
        productName: product.productName,
        productUrl: product.productUrl,
        reviewHe: product.reviewHe.trim() || 'לא צורפה ביקורת',
        storyClips,
        videoUrl: storyClips.find((clip) => clip.videoUrl)?.videoUrl ?? null,
      });
      let savedProduct: CreatorRecommendation;
      if (editingProduct) {
        savedProduct = await apiRequest<CreatorRecommendation>(
          `/creator/recommendations/${editingProduct.id}`,
          {
            body,
            headers: { 'if-match': `"${editingProduct.version}"` },
            method: 'PATCH',
          },
        );
      } else {
        savedProduct = await apiRequest<CreatorRecommendation>(
          '/creator/recommendations',
          {
            body,
            idempotent: true,
            method: 'POST',
          },
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
      await load();
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
    setSaving(true);
    setError('');
    const [scopeKind, scopeId = ''] = discount.scopeTarget.split(':');
    const body = JSON.stringify({
      brandId: discount.brandId || null,
      code: discount.code.trim() || null,
      detailsHe: discount.detailsHe.trim() || null,
      discountPercent: discount.discountPercent ? Number(discount.discountPercent) : null,
      expiresAt: toDateTimeIso(discount.expiresAt),
      label: discount.label.trim() || null,
      merchantUrl: discount.merchantUrl,
      offerType: discount.offerType,
      priority: Number(discount.priority) || 0,
      recurrenceRule: discount.recurrenceRule,
      scopeId: scopeId || null,
      scopeKind,
      source: 'manual',
      stackable: discount.stackable,
      startsAt: toDateTimeIso(discount.startsAt),
    });
    try {
      if (editingDiscount) {
        const latest = await apiRequest<CreatorDiscountCode>(
          `/creator/discount-codes/${editingDiscount.id}`,
        );
        await apiRequest(`/creator/discount-codes/${editingDiscount.id}`, {
          body,
          headers: { 'if-match': `"${latest.version}"` },
          method: 'PATCH',
        });
        setNotice('Brand discount updated.');
      } else {
        const created = await apiRequest<CreatorDiscountCode>('/creator/discount-codes', {
          body,
          idempotent: true,
          method: 'POST',
        });
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
      await load();
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
      await apiRequest(`/creator/recommendations/${item.id}/${command}`, {
        headers: { 'if-match': `"${item.version}"` },
        idempotent: true,
        method: 'POST',
      });
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  async function toggleDiscount(item: CreatorDiscountCode) {
    const command = item.lifecycle === 'published' ? 'hide' : 'confirm';
    setError('');
    try {
      await apiRequest(`/creator/discount-codes/${item.id}/${command}`, {
        headers: { 'if-match': `"${item.version}"` },
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
      discountCode: item.discount?.code ?? '',
      discountExpiresAt: toLocalDate(item.discount?.expiresAt ?? null),
      discountLabel: item.discount?.label ?? '',
      imageAssetId: item.imageAssetId ?? '',
      imageUrl: item.imageUrl,
      instagramStoryUrl: item.instagramStoryUrl ?? '',
      priceIls: item.price.amountMinor > 0 ? String(item.price.amountMinor / 100) : '',
      productName: item.productName,
      productUrl: item.productUrl,
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
    });
    setComposer('discount');
    window.scrollTo({ behavior: 'smooth', top: 120 });
  }

  async function saveSections(
    nextCategories = selectedSections,
    nextCurated = curatedSections,
    nextOrder = contentOrder,
    nextLabels = storefrontLabels,
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
      const updated = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
        {
          body: JSON.stringify({
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
            labels: nextLabels,
          }),
          headers: { 'if-match': `"${configuration.version}"` },
          method: 'PUT',
        },
      );
      const savedOrder = Array.isArray(updated.contentOrder)
        ? updated.contentOrder
        : normalizedOrder;
      setConfiguration({ ...updated, contentOrder: savedOrder });
      setSelectedSections(nextCategories);
      setCuratedSections(updated.curatedSections);
      setContentOrder(savedOrder);
      setStorefrontLabels(updated.labels);
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
  return (
    <div className="creatorShellPage">
      <CreatorShellHeader />
      <main className="creatorDashboardMain creatorDashboardMainWithSidebar">
        <section className="creatorDashboardIntro">
          <div>
            <p className="eyebrow">CREATOR DASHBOARD</p>
            <h1>{profile?.displayName ?? 'Your storefront'}</h1>
            <p>Add and manage everything that appears on your public storefront.</p>
          </div>
        </section>

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
              Storefront labels
            </button>
            <button
              aria-current={dashboardView === 'recommendations' ? 'page' : undefined}
              onClick={() => setDashboardView('recommendations')}
              type="button"
            >
              Recommendations
            </button>
            <button
              aria-current={dashboardView === 'connectors' ? 'page' : undefined}
              onClick={() => setDashboardView('connectors')}
              type="button"
            >
              Social links
            </button>
          </nav>
          <div className="creatorDashboardPanel">
            {dashboardView === 'recommendations' ? (
              <section className="creatorRecommendationSection">
                <div className="creatorSectionHeading">
                  <div>
                    <h2>Recommendations</h2>
                    <p>
                      Add brands, collections and individual items. Every collection gets
                      its own product page automatically.
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
                        <ComposerHeader
                          title="Add recommendation"
                          onClose={closeComposer}
                        >
                          Choose what you want to share with your audience.
                        </ComposerHeader>
                        <div className="creatorTypeGrid">
                          <button onClick={() => setComposer('brand')} type="button">
                            <span aria-hidden="true">
                              <Sparkles size={16} />
                            </span>
                            <strong>Brand</strong>
                            <small>
                              Create a brand card. A discount code is optional.
                            </small>
                          </button>
                          <button onClick={() => setComposer('product')} type="button">
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
                        categories={categories}
                        collections={curatedSections.filter(
                          ({ kind }) => kind === 'collection',
                        )}
                        recommendations={activeRecommendations}
                        editor={product}
                        editing={Boolean(editingProduct)}
                        fetching={fetching}
                        photoError={
                          error === 'Add a product photo to save this recommendation.' &&
                          !product.imageAssetId &&
                          !product.imageUrl
                        }
                        onAddStoryLink={addStoryLink}
                        onCategoryCreated={(category) =>
                          setCategories((current) => [...current, category])
                        }
                        onChange={setProduct}
                        onChangeType={() => setComposer('choose')}
                        onClose={closeComposer}
                        onFetch={fetchProductDetails}
                        onImages={selectProductImages}
                        onValidationError={() => setNotice('')}
                        onSave={saveProduct}
                        onStory={selectStoryClip}
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
                              type="url"
                              placeholder="https://www.adidas.com"
                              value={brand.websiteUrl}
                              onBlur={() => {
                                if (!brand.name.trim())
                                  setBrand((current) => ({
                                    ...current,
                                    name: brandNameFromUrl(current.websiteUrl),
                                  }));
                              }}
                              onChange={(event) =>
                                setBrand({ ...brand, websiteUrl: event.target.value })
                              }
                            />
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
                          <label>
                            Code <span className="fieldOptional">Optional</span>
                            <input
                              maxLength={50}
                              value={brand.code}
                              onChange={(event) =>
                                setBrand({
                                  ...brand,
                                  code: event.target.value.toUpperCase(),
                                })
                              }
                            />
                          </label>
                          <label>
                            Discount percent{' '}
                            <span className="fieldOptional">Optional</span>
                            <input
                              min="1"
                              max="100"
                              type="number"
                              value={brand.discountPercent}
                              onChange={(event) =>
                                setBrand({
                                  ...brand,
                                  discountPercent: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            Expires <span className="fieldOptional">Optional</span>
                            <input
                              type="datetime-local"
                              value={brand.expiresAt}
                              onChange={(event) =>
                                setBrand({ ...brand, expiresAt: event.target.value })
                              }
                            />
                          </label>
                          <label className="creatorFullField">
                            Details <span className="fieldOptional">Optional</span>
                            <textarea
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
                                categoryId: profile?.primaryCategory.id ?? '',
                                categoryIds: profile?.primaryCategory.id
                                  ? [profile.primaryCategory.id]
                                  : [],
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

                {loading ? (
                  <div className="creatorLoading">Loading recommendations…</div>
                ) : null}
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
                                  detailsHe: offer?.details?.value ?? '',
                                  discountPercent:
                                    offer?.discountPercent?.toString() ?? '',
                                  expiresAt: toLocalDateTime(offer?.expiresAt ?? null),
                                  name: managedBrand.name,
                                  websiteUrl: managedBrand.websiteUrl,
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
                                if (
                                  !window.confirm(
                                    `Remove the ${managedBrand.name} brand card? Its items and collections will remain.`,
                                  )
                                )
                                  return;
                                void apiRequest(`/creator/brands/${managedBrand.id}`, {
                                  headers: { 'if-match': `"${managedBrand.version}"` },
                                  method: 'DELETE',
                                })
                                  .then(load)
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
                                  onEditState={(editing) =>
                                    setEditingCollectionId(
                                      editing ? entry.section.id : null,
                                    )
                                  }
                                  onSave={(updated) =>
                                    saveCuratedSections(
                                      curatedSections.map((section) =>
                                        section.id === entry.section.id
                                          ? updated
                                          : section,
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
                            {profile ? (
                              <Link
                                href={`/creators/${profile.handle}/pages/${entry.section.id}`}
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
                        onArchive={() =>
                          void apiRequest(
                            `/creator/discount-codes/${entry.item.id}/archive`,
                            {
                              headers: { 'if-match': `"${entry.item.version}"` },
                              idempotent: true,
                              method: 'POST',
                            },
                          )
                            .then(load)
                            .catch((cause: unknown) => setError(messageFor(cause)))
                        }
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
                categories={categories}
                key={storefrontLabels.map(({ id, title }) => `${id}:${title}`).join('|')}
                labels={storefrontLabels}
                onSave={(labels) =>
                  void saveSections(
                    selectedSections,
                    curatedSections,
                    contentOrder,
                    labels,
                  )
                }
                recommendations={activeRecommendations}
                saving={saving}
              />
            ) : (
              <CreatorConnectorsEditor
                key={profile ? `${profile.id}:${profile.version}` : 'loading'}
                onSaved={setProfile}
                profile={profile}
              />
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
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
          {profileHandle ? (
            <Link
              href={`/creators/${profileHandle}/pages/${entry.section.id}`}
              target="_blank"
            >
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
  categories,
  labels,
  onSave,
  recommendations,
  saving,
}: {
  categories: CategoryCard[];
  labels: StorefrontLabel[];
  onSave: (labels: StorefrontLabel[]) => void;
  recommendations: CreatorRecommendation[];
  saving: boolean;
}) {
  const [draft, setDraft] = useState(labels);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const update = (id: string, patch: Partial<StorefrontLabel>) =>
    setDraft((current) =>
      current.map((label) => (label.id === id ? { ...label, ...patch } : label)),
    );
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    const [label] = next.splice(index, 1);
    if (!label) return;
    next.splice(target, 0, label);
    setDraft(next);
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
              { id, title: 'New label', categorySlug: null, recommendationIds: [] },
            ]);
            setExpandedId(id);
          }}
          type="button"
        >
          <Plus aria-hidden="true" size={15} /> Add label
        </button>
      </div>
      <div className="creatorLabelList">
        {draft.map((label, index) => (
          <article className="creatorLabelEditorCard" key={label.id}>
            <div className="creatorLabelSummaryRow">
              <button
                className="creatorLabelToggle"
                type="button"
                aria-expanded={expandedId === label.id}
                aria-controls={`label-fields-${label.id}`}
                onClick={() =>
                  setExpandedId((current) => (current === label.id ? null : label.id))
                }
              >
                <ChevronDown aria-hidden="true" size={16} />
                <span>
                  <strong>{label.title || 'Untitled label'}</strong>
                  <small>
                    {label.categorySlug
                      ? (categories.find(({ slug }) => slug === label.categorySlug)
                          ?.name ?? label.categorySlug)
                      : `${label.recommendationIds.length} selected items`}
                  </small>
                </span>
              </button>
              <div className="creatorLabelActions">
                <button
                  aria-label={`Move ${label.title} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label={`Move ${label.title} down`}
                  disabled={index === draft.length - 1}
                  onClick={() => move(index, 1)}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" size={15} />
                </button>
                <button
                  aria-label={`Delete ${label.title}`}
                  onClick={() =>
                    setDraft((current) => current.filter(({ id }) => id !== label.id))
                  }
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
                          : { categorySlug: event.target.value, recommendationIds: [] },
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
                    Choose items ? {label.recommendationIds.length} selected
                  </legend>
                  {!recommendations.length ? (
                    <p className="creatorLabelEmpty">
                      Add recommendations first to select items for this label.
                    </p>
                  ) : null}
                  {recommendations.map((item) => (
                    <label key={item.id}>
                      <input
                        checked={label.recommendationIds.includes(item.id)}
                        onChange={(event) =>
                          update(label.id, {
                            recommendationIds: event.target.checked
                              ? [...label.recommendationIds, item.id]
                              : label.recommendationIds.filter((id) => id !== item.id),
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
  categories,
  collections,
  recommendations,
  editor,
  editing,
  fetching,
  photoError,
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
}: {
  categories: CategoryCard[];
  collections: CuratedSection[];
  recommendations: CreatorRecommendation[];
  editor: ProductEditor;
  editing: boolean;
  fetching: boolean;
  photoError: boolean;
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
}) {
  const lastAutomaticallyFetchedUrl = useRef(
    editing ? normalizedProductUrl(editor.productUrl) : null,
  );
  const [validationError, setValidationError] = useState('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const matchingCollections = collections.filter((collection) => {
    const brandName =
      recommendations.find(({ brandId }) => brandId === collection.brandId)?.brandName ??
      '';
    return (
      !editor.brandName.trim() ||
      brandName.toLocaleLowerCase() === editor.brandName.trim().toLocaleLowerCase()
    );
  });
  const saveLabel = editor.collectionIds.length
    ? `Save to ${editor.collectionIds.length} ${editor.collectionIds.length === 1 ? 'collection' : 'collections'}`
    : 'Save recommendation';
  const update = <K extends keyof ProductEditor>(key: K, value: ProductEditor[K]) =>
    onChange({ ...editor, [key]: value });

  useEffect(() => {
    const url = normalizedProductUrl(editor.productUrl);
    if (!url) {
      lastAutomaticallyFetchedUrl.current = null;
      return;
    }
    if (url === lastAutomaticallyFetchedUrl.current) return;
    const timer = window.setTimeout(() => {
      lastAutomaticallyFetchedUrl.current = url;
      onFetch(url);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [editor.productUrl, onFetch]);

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
      <ComposerHeader title={editing ? 'Edit item' : 'Add item'} onClose={onClose}>
        Paste a link to fill in available details automatically.
      </ComposerHeader>
      <div className="creatorComposerBody">
        <button className="creatorBack" onClick={onChangeType} type="button">
          <ArrowLeft aria-hidden="true" size={16} />
          Change type
        </button>
        <div className="creatorFullField creatorProductLinkField">
          <label htmlFor="creator-product-link">Item link</label>
          <span className="creatorInlineField">
            <input
              id="creator-product-link"
              required
              type="url"
              value={editor.productUrl}
              onChange={(event) => update('productUrl', event.target.value)}
              placeholder="https://www.terminalx.com/..."
            />
            <button
              className="button secondary"
              disabled={fetching}
              onClick={() => {
                const url = normalizedProductUrl(editor.productUrl);
                lastAutomaticallyFetchedUrl.current = url;
                if (url) onFetch(url);
              }}
              type="button"
            >
              <Sparkles aria-hidden="true" size={16} />
              {fetching ? 'Fetching…' : 'Fetch details'}
            </button>
          </span>
          <small>
            Paste the link and we&apos;ll fill in available details. Everything stays
            editable.
          </small>
        </div>
        <div className="creatorProductSavePrompt">
          <span>
            Fetch details fills the form. Save adds the product to your storefront.
          </span>
          <button className="button primary" disabled={saving || fetching} type="submit">
            {fetching ? 'Fetching details…' : saving ? 'Saving…' : saveLabel}
          </button>
        </div>
        <div className="creatorFormGrid">
          <label>
            Item name
            <input
              required
              value={editor.productName}
              onChange={(event) => update('productName', event.target.value)}
            />
          </label>
          <label>
            Brand
            <input
              required
              value={editor.brandName}
              onChange={(event) =>
                onChange({ ...editor, brandName: event.target.value, collectionIds: [] })
              }
            />
          </label>
          <fieldset
            className="creatorProductPhotos creatorFullField"
            id="creator-product-photos"
          >
            <legend>Product photos</legend>
            <p>
              Add at least one photo. The first is shown by default; you can add up to 10.
            </p>
            {photoError ? (
              <p className="formError" role="alert">
                Add a product photo to save this recommendation.
              </p>
            ) : null}
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
                  onChange({ ...editor, imageAssetId: '', imageUrl: event.target.value })
                }
                placeholder="Or paste an image link"
              />
            </div>
          </fieldset>
          <label>
            Price (₪) <small>Optional</small>
            <input
              inputMode="decimal"
              value={editor.priceIls}
              onChange={(event) => update('priceIls', event.target.value)}
            />
          </label>
          <div className="creatorCompactPicker">
            <span>
              Categories <small>Optional</small>
            </span>
            <details>
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
          <label>
            Discount code
            <input
              value={editor.discountCode}
              onChange={(event) =>
                update('discountCode', event.target.value.toUpperCase())
              }
            />
          </label>
          <label>
            Discount label
            <input
              value={editor.discountLabel}
              onChange={(event) => update('discountLabel', event.target.value)}
              placeholder="15% off"
            />
          </label>
          <label>
            Expires at
            <input
              type="date"
              value={editor.discountExpiresAt}
              onChange={(event) => update('discountExpiresAt', event.target.value)}
            />
          </label>
        </div>
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
            pattern="https://(www\.)?instagram\.com/stories/.+"
            placeholder="https://www.instagram.com/stories/..."
            type="url"
            value={editor.instagramStoryUrl}
            onChange={(event) => update('instagramStoryUrl', event.target.value)}
          />
        </label>
        <fieldset className="creatorStoryFields">
          <legend>Story clips (optional)</legend>
          <p>
            Attach short videos like your Instagram stories. They appear on this
            recommendation card in order.
          </p>
          <label className="creatorStoryUpload">
            <Upload aria-hidden="true" size={16} />
            <input accept={storyVideoAccept} multiple onChange={onStory} type="file" />
          </label>
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
                        editor.storyClips.filter((_, clipIndex) => clipIndex !== index),
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
            <button className="button secondary" onClick={onAddStoryLink} type="button">
              <Link2 aria-hidden="true" size={16} />
              Add link
            </button>
          </span>
        </fieldset>
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
            type="url"
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
              onChange={(event) => update('code', event.target.value.toUpperCase())}
            />
          </label>
          <label>
            Discount percent
            <input
              min="1"
              max="100"
              type="number"
              value={editor.discountPercent}
              onChange={(event) => update('discountPercent', event.target.value)}
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
          Details (Hebrew)
          <textarea
            dir="rtl"
            lang="he"
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
}: {
  item: CreatorRecommendation;
  onArchive: () => void;
  onEdit: () => void;
}) {
  return (
    <article className="creatorManageCard">
      <span className="creatorManageImage">
        <Image alt="" fill sizes="120px" src={item.imageUrl} unoptimized />
      </span>
      <div className="creatorManageCopy">
        <p className="productBrand">{item.brandName}</p>
        <h3>{item.productName}</h3>
        <a href={item.productUrl} rel="noreferrer" target="_blank">
          Product link
          <ExternalLink aria-hidden="true" size={12} />
        </a>
      </div>
      <div className="creatorManageActions">
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
              setRecommendationIds((ids) =>
                ids.filter(
                  (id) =>
                    recommendations.find((item) => item.id === id)?.brandId ===
                    event.target.value,
                ),
              );
            }}
          >
            <option value="">Choose a brand</option>
            {availableBrands.map((brand) => (
              <option key={brand.brandId} value={brand.brandId}>
                {brand.name}
              </option>
            ))}
          </select>
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
            {recommendations
              .filter((item) => !brandId || item.brandId === brandId)
              .map((item) => (
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
                  <span>
                    {item.productName}
                    <small>{item.brandName}</small>
                  </span>
                </label>
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
function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}

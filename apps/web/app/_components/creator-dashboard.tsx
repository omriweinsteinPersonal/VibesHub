'use client';

import type {
  CategoryCard,
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
  ExternalLink,
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
  type FormEvent,
  type ReactNode,
} from 'react';

import {
  apiCollectionRequest,
  apiRequest,
  publicApiCollectionRequest,
} from '../../lib/api';
import {
  recommendationImageAccept,
  storyVideoAccept,
  uploadRecommendationImage,
  uploadStoryVideo,
} from '../../lib/recommendation-media';
import { randomUuid } from '../../lib/random-id';
import { CreatorShellHeader } from './creator-shell-header';
import { SiteFooter } from './site-footer';

type Composer = null | 'choose' | 'product' | 'discount' | 'collection';
type CuratedSection = CreatorStorefrontConfigurationInput['curatedSections'][number];

interface ProductEditor {
  additionalImages: Array<{ imageAssetId: string; url: string }>;
  brandName: string;
  categoryId: string;
  collectionId: string;
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
  code: string;
  detailsHe: string;
  expiresAt: string;
  label: string;
  merchantUrl: string;
}

const emptyProduct: ProductEditor = {
  additionalImages: [],
  brandName: '',
  categoryId: '',
  collectionId: '',
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
  code: '',
  detailsHe: '',
  expiresAt: '',
  label: '',
  merchantUrl: '',
};

export function CreatorDashboard() {
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [recommendations, setRecommendations] = useState<CreatorRecommendation[]>([]);
  const [discounts, setDiscounts] = useState<CreatorDiscountCode[]>([]);
  const [configuration, setConfiguration] =
    useState<CreatorStorefrontConfiguration | null>(null);
  const [composer, setComposer] = useState<Composer>(null);
  const [product, setProduct] = useState<ProductEditor>(emptyProduct);
  const [discount, setDiscount] = useState<DiscountEditor>(emptyDiscount);
  const [editingProduct, setEditingProduct] = useState<CreatorRecommendation | null>(
    null,
  );
  const [editingDiscount, setEditingDiscount] = useState<CreatorDiscountCode | null>(
    null,
  );
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [curatedSections, setCuratedSections] = useState<CuratedSection[]>([]);
  const [inventoryCategory, setInventoryCategory] = useState('all');
  const [inventorySort, setInventorySort] = useState<'newest' | 'oldest' | 'name'>(
    'newest',
  );
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
      const [categoryPage, loadedProfile, loadedRecommendations, discountPage, config] =
        await Promise.all([
          publicApiCollectionRequest<CategoryCard>('/categories'),
          apiRequest<CreatorProfileSettings>('/creator/profile'),
          loadCreatorRecommendations(),
          apiCollectionRequest<CreatorDiscountCode>('/creator/discount-codes?limit=48'),
          apiRequest<CreatorStorefrontConfiguration>(
            '/creator/studio/storefront-sections',
          ),
        ]);
      setCategories(categoryPage.data);
      setProfile(loadedProfile);
      setRecommendations(loadedRecommendations);
      setDiscounts(discountPage.data);
      setConfiguration(config);
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
    setError('');
    setNotice('');
  }

  function closeComposer() {
    setComposer(null);
    setEditingProduct(null);
    setEditingDiscount(null);
    setProduct({ ...emptyProduct, categoryId: profile?.primaryCategory.id ?? '' });
    setDiscount(emptyDiscount);
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
        setProduct((current) =>
          normalizedProductUrl(current.productUrl) === requestedUrl
            ? {
                ...current,
                brandName: metadata.brandName ?? current.brandName,
                categoryId:
                  categories.find((category) => category.slug === metadata.categorySlug)
                    ?.id ?? current.categoryId,
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
            : current,
        );
        if (productFetchRequest.current === requestId) {
          setNotice(
            'Available product details were filled in. Everything stays editable.',
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
    const price = Number(product.priceIls);
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!product.imageAssetId && !product.imageUrl) {
      setError('Add a product image before saving.');
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
        reviewHe: product.reviewHe,
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
        setNotice('Recommendation updated.');
      } else {
        savedProduct = await apiRequest<CreatorRecommendation>(
          '/creator/recommendations',
          {
            body,
            idempotent: true,
            method: 'POST',
          },
        );
        setNotice('Recommendation published to your storefront.');
      }
      const currentCollectionId =
        curatedSections.find(
          (section) =>
            section.kind === 'collection' &&
            section.recommendationIds.includes(savedProduct.id),
        )?.id ?? '';
      if (product.collectionId !== currentCollectionId) {
        const nextSections = curatedSections.map((section) => {
          if (section.kind !== 'collection') return section;
          const recommendationIds = section.recommendationIds.filter(
            (id) => id !== savedProduct.id,
          );
          return {
            ...section,
            recommendationIds:
              section.id === product.collectionId
                ? [...recommendationIds, savedProduct.id]
                : recommendationIds,
          };
        });
        if (!(await saveSections(selectedSections, nextSections))) {
          setEditingProduct(savedProduct);
          return;
        }
      }
      closeComposer();
      await load();
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
    const body = JSON.stringify({
      code: discount.code,
      detailsHe: discount.detailsHe.trim() || null,
      expiresAt: toIso(discount.expiresAt),
      label: discount.label.trim() || null,
      merchantUrl: discount.merchantUrl,
      startsAt: null,
    });
    try {
      if (editingDiscount) {
        await apiRequest(`/creator/discount-codes/${editingDiscount.id}`, {
          body,
          headers: { 'if-match': `"${editingDiscount.version}"` },
          method: 'PATCH',
        });
        setNotice('Brand discount updated.');
      } else {
        await apiRequest('/creator/discount-codes', {
          body,
          idempotent: true,
          method: 'POST',
        });
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
      collectionId:
        curatedSections.find(
          (section) =>
            section.kind === 'collection' && section.recommendationIds.includes(item.id),
        )?.id ?? '',
      discountCode: item.discount?.code ?? '',
      discountExpiresAt: toLocalDate(item.discount?.expiresAt ?? null),
      discountLabel: item.discount?.label ?? '',
      imageAssetId: item.imageAssetId ?? '',
      imageUrl: item.imageUrl,
      instagramStoryUrl: item.instagramStoryUrl ?? '',
      priceIls: String(item.price.amountMinor / 100),
      productName: item.productName,
      productUrl: item.productUrl,
      reviewHe: item.review.value,
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
      code: item.code,
      detailsHe: item.details?.value ?? '',
      expiresAt: toLocalDate(item.expiresAt),
      label: item.label ?? '',
      merchantUrl: item.merchantUrl,
    });
    setComposer('discount');
    window.scrollTo({ behavior: 'smooth', top: 120 });
  }

  async function saveSections(
    nextCategories = selectedSections,
    nextCurated = curatedSections,
  ) {
    if (!configuration) return false;
    setSaving(true);
    setError('');
    try {
      const updated = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
        {
          body: JSON.stringify({
            categoryIds: nextCategories,
            curatedSections: nextCurated.map(
              ({ id, kind, recommendationIds, title }) => ({
                id,
                kind,
                recommendationIds,
                title,
              }),
            ),
          }),
          headers: { 'if-match': `"${configuration.version}"` },
          method: 'PUT',
        },
      );
      setConfiguration(updated);
      setSelectedSections(nextCategories);
      setCuratedSections(updated.curatedSections);
      setNotice('Storefront sections saved.');
      return true;
    } catch (cause) {
      setError(messageFor(cause));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const activeRecommendations = recommendations.filter(
    ({ lifecycle }) => lifecycle !== 'archived',
  );
  const visibleCategories = categories.filter((category) =>
    activeRecommendations.some((item) => item.categoryId === category.id),
  );
  const placedDiscountIds = new Set(
    activeRecommendations.flatMap(({ discount }) => (discount?.id ? [discount.id] : [])),
  );
  const activeDiscounts = discounts.filter(
    ({ id, lifecycle }) => lifecycle !== 'archived' && !placedDiscountIds.has(id),
  );

  return (
    <div className="creatorShellPage">
      <CreatorShellHeader />
      <main className="creatorDashboardMain">
        <section className="creatorDashboardIntro">
          <div>
            <p className="eyebrow">CREATOR DASHBOARD</p>
            <h1>{profile?.displayName ?? 'Your storefront'}</h1>
            <p>Add and manage everything that appears on your public storefront.</p>
          </div>
          <div className="creatorDashboardLinks">
            {profile ? (
              <Link className="button secondary" href={`/creator/${profile.handle}`}>
                View storefront
                <ExternalLink aria-hidden="true" size={14} />
              </Link>
            ) : null}
            <Link href="/account">Edit profile</Link>
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

        <section className="creatorRecommendationSection">
          <div className="creatorSectionHeading">
            <div>
              <h2>Recommendations</h2>
              <p>
                Add a single product or a general brand discount. Link details are filled
                automatically.
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
                    <button onClick={() => setComposer('product')} type="button">
                      <span aria-hidden="true">
                        <Tag size={16} />
                      </span>
                      <strong>Product</strong>
                      <small>
                        Recommend one specific product with its price, details and story
                        clips.
                      </small>
                    </button>
                    <button onClick={() => setComposer('discount')} type="button">
                      <span aria-hidden="true">
                        <Sparkles size={16} />
                      </span>
                      <strong>Brand Discount</strong>
                      <small>
                        Share a store-wide offer, discount code and expiry date.
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
                  editor={product}
                  editing={Boolean(editingProduct)}
                  fetching={fetching}
                  onAddStoryLink={addStoryLink}
                  onChange={setProduct}
                  onChangeType={() => setComposer('choose')}
                  onClose={closeComposer}
                  onFetch={fetchProductDetails}
                  onImages={selectProductImages}
                  onSave={saveProduct}
                  onStory={selectStoryClip}
                  saving={saving || uploading}
                />
              ) : null}
              {composer === 'discount' ? (
                <DiscountForm
                  editor={discount}
                  editing={Boolean(editingDiscount)}
                  onChange={setDiscount}
                  onClose={closeComposer}
                  onSave={saveDiscount}
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
                      kind="collection"
                      recommendations={activeRecommendations}
                      onCancel={closeComposer}
                      onSave={(section) =>
                        saveSections(selectedSections, [...curatedSections, section])
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
          <div className="creatorInventoryControls">
            <div className="creatorInventoryFilter">
              <label htmlFor="inventory-category">Category</label>
              <select
                id="inventory-category"
                onChange={(event) => setInventoryCategory(event.target.value)}
                value={inventoryCategory}
              >
                <option value="all">
                  All categories ({activeRecommendations.length})
                </option>
                {visibleCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="creatorInventoryFilter">
              <label htmlFor="inventory-sort">Sort</label>
              <select
                id="inventory-sort"
                onChange={(event) =>
                  setInventorySort(event.target.value as 'newest' | 'oldest' | 'name')
                }
                value={inventorySort}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Product name</option>
              </select>
            </div>
          </div>
          {visibleCategories
            .filter(
              (category) =>
                inventoryCategory === 'all' || inventoryCategory === category.id,
            )
            .map((category) => {
              const items = activeRecommendations
                .filter((item) => item.categoryId === category.id)
                .sort((a, b) =>
                  inventorySort === 'name'
                    ? a.productName.localeCompare(b.productName)
                    : inventorySort === 'oldest'
                      ? a.createdAt.localeCompare(b.createdAt)
                      : b.createdAt.localeCompare(a.createdAt),
                );
              return (
                <section className="creatorInventoryGroup" key={category.id}>
                  <h3>
                    {category.name} <span>{items.length}</span>
                  </h3>
                  <div className="creatorManageList">
                    {items.map((item) => (
                      <RecommendationManageCard
                        item={item}
                        key={item.id}
                        onArchive={() => {
                          if (
                            window.confirm(
                              'Remove this recommendation from your storefront?',
                            )
                          ) {
                            void recommendationCommand(item, 'archive');
                          }
                        }}
                        onEdit={() => editProduct(item)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          <div className="creatorManageList">
            {activeDiscounts.map((item) => (
              <DiscountManageCard
                item={item}
                key={item.id}
                onArchive={() =>
                  void apiRequest(`/creator/discount-codes/${item.id}/archive`, {
                    headers: { 'if-match': `"${item.version}"` },
                    idempotent: true,
                    method: 'POST',
                  })
                    .then(load)
                    .catch((cause: unknown) => setError(messageFor(cause)))
                }
                onEdit={() => editDiscount(item)}
                onToggle={() => void toggleDiscount(item)}
              />
            ))}
            {!loading && !activeRecommendations.length && !activeDiscounts.length ? (
              <div className="creatorEmpty">
                No recommendations yet. Add your first one above.
              </div>
            ) : null}
          </div>
        </section>

        <StorefrontSections
          categories={categories}
          onChange={setSelectedSections}
          onSave={() => void saveSections()}
          onSaveCurated={(next) => saveSections(selectedSections, next)}
          curatedSections={curatedSections}
          recommendations={activeRecommendations}
          saving={saving}
          selected={selectedSections}
        />
      </main>
      <SiteFooter />
    </div>
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

function ProductForm({
  categories,
  collections,
  editor,
  editing,
  fetching,
  onAddStoryLink,
  onChange,
  onChangeType,
  onClose,
  onFetch,
  onImages,
  onSave,
  onStory,
  saving,
}: {
  categories: CategoryCard[];
  collections: CuratedSection[];
  editor: ProductEditor;
  editing: boolean;
  fetching: boolean;
  onAddStoryLink: () => void;
  onChange: (value: ProductEditor) => void;
  onClose: () => void;
  onChangeType: () => void;
  onFetch: (url: string) => void;
  onImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onStory: (event: ChangeEvent<HTMLInputElement>) => void;
  saving: boolean;
}) {
  const lastAutomaticallyFetchedUrl = useRef(
    editing ? normalizedProductUrl(editor.productUrl) : null,
  );
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
    <form onSubmit={onSave}>
      <ComposerHeader title={editing ? 'Edit product' : 'Add product'} onClose={onClose}>
        Paste a link to fill in available details automatically.
      </ComposerHeader>
      <div className="creatorComposerBody">
        <button className="creatorBack" onClick={onChangeType} type="button">
          <ArrowLeft aria-hidden="true" size={16} />
          Change type
        </button>
        <div className="creatorFullField creatorProductLinkField">
          <label htmlFor="creator-product-link">Product link</label>
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
        <div className="creatorFormGrid">
          <label>
            Product name
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
              onChange={(event) => update('brandName', event.target.value)}
            />
          </label>
          <fieldset className="creatorProductPhotos creatorFullField">
            <legend>Product photos</legend>
            <p>The first photo is shown by default. Add up to 10 photos.</p>
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
            Price (₪) — override with your special price
            <input
              required
              inputMode="decimal"
              value={editor.priceIls}
              onChange={(event) => update('priceIls', event.target.value)}
            />
          </label>
          <label>
            Category
            <select
              required
              value={editor.categoryId}
              onChange={(event) => update('categoryId', event.target.value)}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Collection
            <select
              value={editor.collectionId}
              onChange={(event) => update('collectionId', event.target.value)}
            >
              <option value="">No collection</option>
              {collections.map((collection) => (
                <option
                  disabled={
                    collection.recommendationIds.length >= 20 &&
                    collection.id !== editor.collectionId
                  }
                  key={collection.id}
                  value={collection.id}
                >
                  {collection.title}
                  {collection.recommendationIds.length >= 20 ? ' (full)' : ''}
                </option>
              ))}
            </select>
          </label>
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
          Review
          <textarea
            dir="auto"
            maxLength={1000}
            required
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
          <button className="button primary" disabled={saving} type="submit">
            {saving ? 'Saving…' : 'Save recommendation'}
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

function DiscountForm({
  editor,
  editing,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  editor: DiscountEditor;
  editing: boolean;
  onChange: (value: DiscountEditor) => void;
  onClose: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const update = <K extends keyof DiscountEditor>(key: K, value: DiscountEditor[K]) =>
    onChange({ ...editor, [key]: value });
  return (
    <form onSubmit={onSave}>
      <ComposerHeader
        title={editing ? 'Edit brand discount' : 'Add brand discount'}
        onClose={onClose}
      >
        Share a store-wide offer, code and expiry date.
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
            Code
            <input
              required
              value={editor.code}
              onChange={(event) => update('code', event.target.value.toUpperCase())}
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
            Expires
            <input
              type="date"
              value={editor.expiresAt}
              onChange={(event) => update('expiresAt', event.target.value)}
            />
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
        <h3>{item.code}</h3>
        {item.label ? (
          <span className="creatorCodePill">
            <Tag aria-hidden="true" size={12} />
            {item.label}
          </span>
        ) : null}
        <p dir="rtl" lang="he">
          {item.details?.value}
        </p>
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

function StorefrontSections({
  categories,
  curatedSections,
  onChange,
  onSave,
  onSaveCurated,
  recommendations,
  saving,
  selected,
}: {
  categories: CategoryCard[];
  curatedSections: CuratedSection[];
  onChange: (ids: string[]) => void;
  onSave: () => void;
  onSaveCurated: (sections: CuratedSection[]) => Promise<boolean>;
  recommendations: CreatorRecommendation[];
  saving: boolean;
  selected: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const selectedCategories = selected.flatMap(
    (id) => categories.find((category) => category.id === id) ?? [],
  );
  return (
    <section className="creatorStorefrontSections">
      <h2>Storefront sections</h2>
      <p>
        Choose which category rows appear on your storefront and in what order. Each
        section shows only the recommendations in that category.
      </p>
      <div className="creatorCustomSectionList">
        {curatedSections.map((section, index) => (
          <div className="creatorCustomSection" key={section.id}>
            {editingId === section.id ? (
              <CuratedSectionForm
                initial={section}
                kind={section.kind}
                onCancel={() => setEditingId(null)}
                onSave={async (updated) => {
                  const next = curatedSections.map((item) =>
                    item.id === section.id ? updated : item,
                  );
                  return onSaveCurated(next);
                }}
                recommendations={recommendations}
                saving={saving}
              />
            ) : (
              <>
                <div>
                  <strong>{section.title}</strong>
                  <small>
                    {section.kind === 'collection' ? 'Collection' : 'Custom section'}
                    {' · '}
                    {section.recommendationIds.length} products
                  </small>
                </div>
                <div className="creatorCustomSectionActions">
                  <button
                    aria-label={`Move ${section.title} up`}
                    disabled={index === 0 || saving}
                    onClick={() =>
                      void onSaveCurated(move(curatedSections, index, index - 1))
                    }
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label={`Move ${section.title} down`}
                    disabled={index === curatedSections.length - 1 || saving}
                    onClick={() =>
                      void onSaveCurated(move(curatedSections, index, index + 1))
                    }
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label={`Edit ${section.title}`}
                    onClick={() => setEditingId(section.id)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={16} />
                  </button>
                  <button
                    aria-label={`Remove ${section.title}`}
                    disabled={saving}
                    onClick={() =>
                      void onSaveCurated(
                        curatedSections.filter(({ id }) => id !== section.id),
                      )
                    }
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {adding ? (
        <CuratedSectionForm
          kind="section"
          onCancel={() => setAdding(false)}
          onSave={(section) => onSaveCurated([...curatedSections, section])}
          recommendations={recommendations}
          saving={saving}
        />
      ) : (
        <button
          className="button secondary creatorAddSection"
          onClick={() => setAdding(true)}
          type="button"
        >
          <Plus aria-hidden="true" size={16} /> Add a section
        </button>
      )}
      <hr />
      <p className="eyebrow">CATEGORY ROWS</p>
      {selectedCategories.length ? (
        <ol>
          {selectedCategories.map((category, index) => (
            <li key={category.id}>
              <span>{category.name}</span>
              <span>
                <button
                  disabled={index === 0}
                  onClick={() => onChange(move(selected, index, index - 1))}
                  type="button"
                >
                  <ArrowUp aria-hidden="true" size={16} />
                </button>
                <button
                  disabled={index === selected.length - 1}
                  onClick={() => onChange(move(selected, index, index + 1))}
                  type="button"
                >
                  <ArrowDown aria-hidden="true" size={16} />
                </button>
                <button
                  aria-label={`Remove ${category.name} section`}
                  onClick={() => onChange(selected.filter((id) => id !== category.id))}
                  type="button"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="creatorEmpty">
          No category rows selected. Products outside custom sections appear in More
          picks.
        </div>
      )}
      <p className="eyebrow">ADD CATEGORY ROW</p>
      <div className="creatorSectionPills">
        {categories
          .filter(({ id }) => !selected.includes(id))
          .map((category) => (
            <button
              key={category.id}
              onClick={() => onChange([...selected, category.id])}
              type="button"
            >
              + {category.name}
            </button>
          ))}
      </div>
      <hr />
      <button className="button primary" disabled={saving} onClick={onSave} type="button">
        Save sections
      </button>
    </section>
  );
}

function CuratedSectionForm({
  initial,
  kind,
  onCancel,
  onSave,
  recommendations,
  saving,
}: {
  initial?: CuratedSection;
  kind: CuratedSection['kind'];
  onCancel: () => void;
  onSave: (section: CuratedSection) => Promise<boolean>;
  recommendations: CreatorRecommendation[];
  saving: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [recommendationIds, setRecommendationIds] = useState<string[]>(
    initial?.recommendationIds ?? [],
  );
  const [selectionError, setSelectionError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recommendationIds.length) {
      setSelectionError('Choose at least one product.');
      return;
    }
    const saved = await onSave({
      id: initial?.id ?? randomUuid(),
      kind,
      recommendationIds,
      title: title.trim(),
    });
    if (saved) onCancel();
  }

  return (
    <form className="creatorCuratedForm" onSubmit={(event) => void submit(event)}>
      <label>
        {kind === 'collection' ? 'Collection name' : 'Section name'}
        <input
          maxLength={80}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={kind === 'collection' ? 'Favorites from Fox' : 'Weekend picks'}
          required
          value={title}
        />
      </label>
      <fieldset>
        <legend>Products in this {kind}</legend>
        {recommendations.length ? (
          <div className="creatorCuratedChoices">
            {recommendations.map((item) => (
              <label key={item.id}>
                <input
                  checked={recommendationIds.includes(item.id)}
                  type="checkbox"
                  disabled={
                    recommendationIds.length >= 20 && !recommendationIds.includes(item.id)
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
function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}

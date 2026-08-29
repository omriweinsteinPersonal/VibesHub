'use client';

import type {
  CategoryCard,
  CreatorDiscountCode,
  CreatorProductMetadata,
  CreatorProfileSettings,
  CreatorRecommendation,
  CreatorStorefrontConfiguration,
  StoryClipInput,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
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
import { storyVideoAccept, uploadStoryVideo } from '../../lib/recommendation-media';
import { CreatorShellHeader } from './creator-shell-header';
import { SiteFooter } from './site-footer';

type Composer = null | 'choose' | 'product' | 'discount';

interface ProductEditor {
  brandName: string;
  categoryId: string;
  discountCode: string;
  discountExpiresAt: string;
  discountLabel: string;
  imageAssetId: string;
  imageUrl: string;
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
  brandName: '',
  categoryId: '',
  discountCode: '',
  discountExpiresAt: '',
  discountLabel: '',
  imageAssetId: '',
  imageUrl: '',
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
      const [categoryPage, loadedProfile, recommendationPage, discountPage, config] =
        await Promise.all([
          publicApiCollectionRequest<CategoryCard>('/categories'),
          apiRequest<CreatorProfileSettings>('/creator/profile'),
          apiCollectionRequest<CreatorRecommendation>(
            '/creator/recommendations?limit=48',
          ),
          apiCollectionRequest<CreatorDiscountCode>('/creator/discount-codes?limit=48'),
          apiRequest<CreatorStorefrontConfiguration>(
            '/creator/studio/storefront-sections',
          ),
        ]);
      setCategories(categoryPage.data);
      setProfile(loadedProfile);
      setRecommendations(recommendationPage.data);
      setDiscounts(discountPage.data);
      setConfiguration(config);
      setSelectedSections(config.sections.map(({ category }) => category.id));
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

  const fetchProductDetails = useCallback(async (rawUrl: string) => {
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
              imageAssetId: metadata.imageUrl ? '' : current.imageAssetId,
              imageUrl: metadata.imageUrl ?? current.imageUrl,
              priceIls:
                metadata.priceAmountMinor === null
                  ? current.priceIls
                  : String(metadata.priceAmountMinor / 100),
              productName: metadata.productName ?? current.productName,
              productUrl: metadata.productUrl,
            }
          : current,
      );
      if (productFetchRequest.current === requestId) {
        setNotice('Available product details were filled in. Everything stays editable.');
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
  }, []);

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
        priceAmountMinor: Math.round(price * 100),
        productName: product.productName,
        productUrl: product.productUrl,
        reviewHe: product.reviewHe,
        storyClips,
        videoUrl: storyClips.find((clip) => clip.videoUrl)?.videoUrl ?? null,
      });
      if (editingProduct) {
        await apiRequest(`/creator/recommendations/${editingProduct.id}`, {
          body,
          headers: { 'if-match': `"${editingProduct.version}"` },
          method: 'PATCH',
        });
        setNotice('Recommendation updated.');
      } else {
        await apiRequest('/creator/recommendations', {
          body,
          idempotent: true,
          method: 'POST',
        });
        setNotice('Recommendation saved as a draft. Turn Live on when it is ready.');
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

  async function toggleRecommendation(item: CreatorRecommendation) {
    const command = item.lifecycle === 'published' ? 'unpublish' : 'publish';
    await recommendationCommand(item, command);
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
      brandName: item.brandName,
      categoryId: item.categoryId,
      discountCode: item.discount?.code ?? '',
      discountExpiresAt: toLocalDate(item.discount?.expiresAt ?? null),
      discountLabel: item.discount?.label ?? '',
      imageAssetId: item.imageAssetId ?? '',
      imageUrl: item.imageUrl,
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

  async function saveSections() {
    if (!configuration) return;
    setSaving(true);
    setError('');
    try {
      const updated = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
        {
          body: JSON.stringify({ categoryIds: selectedSections }),
          headers: { 'if-match': `"${configuration.version}"` },
          method: 'PUT',
        },
      );
      setConfiguration(updated);
      setNotice('Storefront sections saved.');
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  const activeRecommendations = recommendations.filter(
    ({ lifecycle }) => lifecycle !== 'archived',
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
            <div className="creatorComposer">
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
                  </div>
                </>
              ) : null}
              {composer === 'product' ? (
                <ProductForm
                  categories={categories}
                  editor={product}
                  editing={Boolean(editingProduct)}
                  fetching={fetching}
                  onAddStoryLink={addStoryLink}
                  onChange={setProduct}
                  onChangeType={() => setComposer('choose')}
                  onClose={closeComposer}
                  onFetch={fetchProductDetails}
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
            </div>
          ) : null}

          {loading ? (
            <div className="creatorLoading">Loading recommendations…</div>
          ) : null}
          <div className="creatorManageList">
            {activeRecommendations.map((item) => (
              <RecommendationManageCard
                item={item}
                key={item.id}
                onArchive={() => void recommendationCommand(item, 'archive')}
                onEdit={() => editProduct(item)}
                onToggle={() => void toggleRecommendation(item)}
              />
            ))}
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
  editor,
  editing,
  fetching,
  onAddStoryLink,
  onChange,
  onChangeType,
  onClose,
  onFetch,
  onSave,
  onStory,
  saving,
}: {
  categories: CategoryCard[];
  editor: ProductEditor;
  editing: boolean;
  fetching: boolean;
  onAddStoryLink: () => void;
  onChange: (value: ProductEditor) => void;
  onClose: () => void;
  onChangeType: () => void;
  onFetch: (url: string) => void;
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
        <label className="creatorFullField">
          Product link
          <span className="creatorInlineField">
            <input
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
        </label>
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
          <label>
            Image link
            <input
              type="url"
              value={editor.imageAssetId ? '' : editor.imageUrl}
              onChange={(event) =>
                onChange({ ...editor, imageAssetId: '', imageUrl: event.target.value })
              }
              placeholder="https://"
            />
          </label>
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
          Review (Hebrew)
          <textarea
            dir="rtl"
            lang="he"
            maxLength={1000}
            required
            rows={3}
            value={editor.reviewHe}
            onChange={(event) => update('reviewHe', event.target.value)}
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
  onToggle,
}: {
  item: CreatorRecommendation;
  onArchive: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="creatorManageCard">
      <span className="creatorManageImage">
        <Image alt="" fill sizes="120px" src={item.imageUrl} unoptimized />
      </span>
      <div className="creatorManageCopy">
        <p className="productBrand">{item.brandName}</p>
        <h3>{item.productName}</h3>
        <p dir="rtl" lang="he">
          {item.review.value}
        </p>
        <a href={item.productUrl} rel="noreferrer" target="_blank">
          Product link
          <ExternalLink aria-hidden="true" size={12} />
        </a>
        {item.storyClips.length ? (
          <div className="creatorStoryThumbs">
            {item.storyClips.map((clip) => (
              <span key={clip.id}>
                <video muted playsInline src={clip.url} />
              </span>
            ))}
          </div>
        ) : null}
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
        <button aria-label="Edit recommendation" onClick={onEdit} type="button">
          <Pencil aria-hidden="true" size={16} />
        </button>
        <button aria-label="Archive recommendation" onClick={onArchive} type="button">
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
  onChange,
  onSave,
  saving,
  selected,
}: {
  categories: CategoryCard[];
  onChange: (ids: string[]) => void;
  onSave: () => void;
  saving: boolean;
  selected: string[];
}) {
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
                  ↑
                </button>
                <button
                  disabled={index === selected.length - 1}
                  onClick={() => onChange(move(selected, index, index + 1))}
                  type="button"
                >
                  ↓
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
          No sections chosen yet — your storefront shows a row for every category you
          already use.
        </div>
      )}
      <p className="eyebrow">ADD A SECTION</p>
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

function move(values: string[], from: number, to: number) {
  const next = [...values];
  const [value] = next.splice(from, 1);
  if (value) next.splice(to, 0, value);
  return next;
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

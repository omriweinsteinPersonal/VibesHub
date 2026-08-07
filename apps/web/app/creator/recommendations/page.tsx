'use client';

import type {
  CategoryCard,
  CommercialRelationship,
  CreatorRecommendation,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import {
  apiCollectionRequest,
  apiRequest,
  publicApiCollectionRequest,
} from '../../../lib/api';
import {
  recommendationImageAccept,
  uploadRecommendationImage,
} from '../../../lib/recommendation-media';
import { RecommendationCardView } from '../../_components/recommendation-card';

interface EditorState {
  brandName: string;
  categoryId: string;
  commercialRelationship: CommercialRelationship;
  discountCode: string;
  discountLabel: string;
  imageAssetId: string;
  imageUrl: string;
  priceIls: string;
  productName: string;
  productUrl: string;
  reviewHe: string;
  videoUrl: string;
}

type ContentFilter = 'all' | 'draft' | 'published' | 'archived';

const emptyEditor: EditorState = {
  brandName: '',
  categoryId: '',
  commercialRelationship: 'organic',
  discountCode: '',
  discountLabel: '',
  imageAssetId: '',
  imageUrl: '',
  priceIls: '',
  productName: '',
  productUrl: '',
  reviewHe: '',
  videoUrl: '',
};

export default function CreatorRecommendationsPage() {
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [recommendations, setRecommendations] = useState<CreatorRecommendation[]>([]);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [editing, setEditing] = useState<CreatorRecommendation | null>(null);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState<
    'idle' | 'authorizing' | 'uploading' | 'validating' | 'ready'
  >('idle');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryPage, recommendationPage] = await Promise.all([
        publicApiCollectionRequest<CategoryCard>('/categories'),
        apiCollectionRequest<CreatorRecommendation>('/creator/recommendations?limit=48'),
      ]);
      setCategories(categoryPage.data);
      setRecommendations(recommendationPage.data);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCreatorContent()
      .then(
        ({ categories: loadedCategories, recommendations: loadedRecommendations }) => {
          if (!active) return;
          setCategories(loadedCategories);
          setRecommendations(loadedRecommendations);
        },
      )
      .catch((cause: unknown) => {
        if (active) setError(messageFor(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const amount = Number(editor.priceIls);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Enter a valid product price.');
      }
      if (!editor.imageAssetId && !editor.imageUrl) {
        throw new Error('Upload a product image before saving.');
      }
      const body = JSON.stringify({
        brandName: editor.brandName,
        categoryId: editor.categoryId,
        commercialRelationship: editor.commercialRelationship,
        discountCode: editor.discountCode.trim() || null,
        discountLabel: editor.discountLabel.trim() || null,
        imageAssetId: editor.imageAssetId || null,
        imageUrl: editor.imageAssetId ? null : editor.imageUrl || null,
        priceAmountMinor: Math.round(amount * 100),
        productName: editor.productName,
        productUrl: editor.productUrl,
        reviewHe: editor.reviewHe,
        videoUrl: editor.videoUrl.trim() || null,
      });
      if (editing) {
        await apiRequest<CreatorRecommendation>(
          `/creator/recommendations/${editing.id}`,
          {
            body,
            headers: { 'if-match': `"${editing.version}"` },
            method: 'PATCH',
          },
        );
        setNotice('Recommendation updated.');
      } else {
        await apiRequest<CreatorRecommendation>('/creator/recommendations', {
          body,
          idempotent: true,
          method: 'POST',
        });
        setNotice('Draft recommendation created. Review it, then publish it.');
      }
      cancelEditing();
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function transition(
    recommendation: CreatorRecommendation,
    command: 'archive' | 'publish' | 'restore' | 'unpublish',
  ) {
    if (
      command === 'archive' &&
      !window.confirm(
        'Archive this recommendation? It will leave your storefront and can be restored later.',
      )
    ) {
      return;
    }
    setError('');
    setNotice('');
    try {
      await apiRequest<CreatorRecommendation>(
        `/creator/recommendations/${recommendation.id}/${command}`,
        {
          headers: { 'if-match': `"${recommendation.version}"` },
          idempotent: true,
          method: 'POST',
        },
      );
      setNotice(transitionNotice(command));
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  async function move(recommendation: CreatorRecommendation, direction: 'up' | 'down') {
    setError('');
    setNotice('');
    try {
      await apiRequest<CreatorRecommendation>(
        `/creator/recommendations/${recommendation.id}/move`,
        {
          body: JSON.stringify({ direction }),
          headers: { 'if-match': `"${recommendation.version}"` },
          idempotent: true,
          method: 'POST',
        },
      );
      setNotice('Storefront order updated.');
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  function beginEditing(recommendation: CreatorRecommendation) {
    setEditing(recommendation);
    setEditor({
      brandName: recommendation.brandName,
      categoryId: recommendation.categoryId,
      commercialRelationship: recommendation.commercialRelationship,
      discountCode: recommendation.discount?.code ?? '',
      discountLabel: recommendation.discount?.label ?? '',
      imageAssetId: recommendation.imageAssetId ?? '',
      imageUrl: recommendation.imageUrl,
      priceIls: String(recommendation.price.amountMinor / 100),
      productName: recommendation.productName,
      productUrl: recommendation.productUrl,
      reviewHe: recommendation.review.value,
      videoUrl: recommendation.videoUrl ?? '',
    });
    setUploadStage(recommendation.imageAssetId ? 'ready' : 'idle');
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }

  function cancelEditing() {
    setEditing(null);
    setEditor(emptyEditor);
    setUploadStage('idle');
  }

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => ({ ...current, [key]: value }));
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const previous = { imageAssetId: editor.imageAssetId, imageUrl: editor.imageUrl };
    const previewUrl = URL.createObjectURL(file);
    setEditor((current) => ({ ...current, imageAssetId: '', imageUrl: previewUrl }));
    setError('');
    setNotice('');
    try {
      const asset = await uploadRecommendationImage(file, setUploadStage);
      setEditor((current) => ({
        ...current,
        imageAssetId: asset.id,
        imageUrl: asset.publicUrl,
      }));
      setUploadStage('ready');
      setNotice('Image uploaded and validated.');
    } catch (cause) {
      setEditor((current) => ({ ...current, ...previous }));
      setUploadStage(previous.imageAssetId ? 'ready' : 'idle');
      setError(messageFor(cause));
    } finally {
      URL.revokeObjectURL(previewUrl);
      event.target.value = '';
    }
  }

  const imageIsUploading =
    uploadStage === 'authorizing' ||
    uploadStage === 'uploading' ||
    uploadStage === 'validating';
  const activeRecommendations = recommendations.filter(
    (recommendation) => recommendation.lifecycle !== 'archived',
  );
  const visibleRecommendations =
    filter === 'all'
      ? recommendations
      : recommendations.filter((recommendation) => recommendation.lifecycle === filter);

  return (
    <main className="workspacePage">
      <header className="workspaceHeader creatorStudioHeader">
        <Link className="logo" href="/">
          <span>✣</span> VibesHub
        </Link>
        <nav aria-label="Creator studio navigation">
          <Link href="/account">Account</Link>
          <Link aria-current="page" href="/creator/recommendations">
            Recommendations
          </Link>
          <Link href="/creator/discount-codes">Discount codes</Link>
          <Link href="/creators">Storefronts</Link>
        </nav>
      </header>

      <section className="workspaceContent creatorStudio">
        <div className="studioIntro">
          <div>
            <p className="eyebrow">CREATOR STUDIO</p>
            <h1>Build your storefront</h1>
            <p className="workspaceLead">
              Add the product first, write your honest recommendation in Hebrew, then
              publish when the card is ready.
            </p>
          </div>
          <Link className="button secondary" href="/account">
            Back to account
          </Link>
        </div>

        {error ? <p className="formError">{error}</p> : null}
        {notice ? <p className="formSuccess">{notice}</p> : null}

        <form className="applicationForm recommendationForm" onSubmit={save}>
          <div className="formHeading">
            <div>
              <p className="eyebrow">{editing ? 'EDIT DRAFT' : 'NEW RECOMMENDATION'}</p>
              <h2>{editing ? editing.productName : 'Add a product you actually use'}</h2>
            </div>
            {editing ? (
              <button className="button secondary" type="button" onClick={cancelEditing}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="recommendationImageUploader">
            <div className="recommendationImagePreview">
              {editor.imageUrl ? (
                <Image
                  alt="Product image preview"
                  fill
                  sizes="(max-width: 800px) 100vw, 420px"
                  src={editor.imageUrl}
                  unoptimized
                />
              ) : (
                <div className="imageUploadPlaceholder" aria-hidden="true">
                  <span>＋</span>
                  Product image
                </div>
              )}
            </div>
            <div className="recommendationImageControls">
              <label>
                Product image
                <input
                  accept={recommendationImageAccept}
                  disabled={imageIsUploading || saving}
                  required={!editor.imageUrl}
                  type="file"
                  onChange={selectImage}
                />
              </label>
              <p className="fieldHint">
                JPEG, PNG or WebP, up to 5 MB. Use a clear portrait or square product
                photo.
              </p>
              {uploadStage !== 'idle' ? (
                <div className={`imageUploadProgress ${uploadStage}`} role="status">
                  {imageIsUploading ? (
                    <progress aria-label="Image upload progress" />
                  ) : null}
                  <span>{uploadStageLabel(uploadStage)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="fieldGrid">
            <label>
              Product name
              <input
                maxLength={200}
                required
                value={editor.productName}
                onChange={(event) => update('productName', event.target.value)}
              />
            </label>
            <label>
              Brand
              <input
                maxLength={120}
                required
                value={editor.brandName}
                onChange={(event) => update('brandName', event.target.value)}
              />
            </label>
            <label>
              Product link
              <input
                placeholder="https://brand.co.il/product"
                required
                type="url"
                value={editor.productUrl}
                onChange={(event) => update('productUrl', event.target.value)}
              />
            </label>
            <label>
              Price (₪)
              <input
                inputMode="decimal"
                min="0"
                required
                step="0.01"
                type="number"
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
              Discount code (optional)
              <input
                maxLength={50}
                placeholder="NOA10"
                value={editor.discountCode}
                onChange={(event) => update('discountCode', event.target.value)}
              />
            </label>
            <label>
              Discount label (optional)
              <input
                maxLength={100}
                placeholder="10% off"
                value={editor.discountLabel}
                onChange={(event) => update('discountLabel', event.target.value)}
              />
            </label>
            <label>
              Video preview URL (optional)
              <input
                placeholder="https://videos.example.com/story.mp4"
                type="url"
                value={editor.videoUrl}
                onChange={(event) => update('videoUrl', event.target.value)}
              />
            </label>
            <label>
              Commercial relationship
              <select
                value={editor.commercialRelationship}
                onChange={(event) =>
                  update(
                    'commercialRelationship',
                    event.target.value as CommercialRelationship,
                  )
                }
              >
                <option value="organic">None / organic</option>
                <option value="affiliate">Affiliate link or code</option>
                <option value="gifted">Gifted product</option>
                <option value="sponsored">Sponsored recommendation</option>
              </select>
            </label>
          </div>

          <label>
            Recommendation (Hebrew)
            <textarea
              dir="rtl"
              lang="he"
              maxLength={1000}
              placeholder="כתבו המלצה אמיתית בעברית…"
              required
              rows={5}
              value={editor.reviewHe}
              onChange={(event) => update('reviewHe', event.target.value)}
            />
            <small className="fieldHint">
              The storefront card displays up to five lines. Full text is still stored.
            </small>
          </label>

          <button
            className="button primary studioSave"
            disabled={saving || imageIsUploading}
            type="submit"
          >
            {saving ? 'Saving…' : editing ? 'Save recommendation' : 'Create draft'}
          </button>
        </form>

        <section className="studioCollection" aria-labelledby="recommendations-title">
          <div className="directoryHeading">
            <div>
              <p className="eyebrow">YOUR CONTENT</p>
              <h2 id="recommendations-title">Recommendations</h2>
            </div>
            <p>{recommendations.length} total</p>
          </div>

          <div className="studioFilters" aria-label="Filter recommendations">
            {(['all', 'draft', 'published', 'archived'] as const).map((value) => (
              <button
                aria-pressed={filter === value}
                className={filter === value ? 'active' : ''}
                key={value}
                type="button"
                onClick={() => setFilter(value)}
              >
                {filterLabel(value)}
                <span>
                  {value === 'all'
                    ? recommendations.length
                    : recommendations.filter(
                        (recommendation) => recommendation.lifecycle === value,
                      ).length}
                </span>
              </button>
            ))}
          </div>

          <p className="studioOrderHint">
            Use the arrows to choose the order shoppers see on your storefront. Drafts
            keep their position when published.
          </p>

          {loading ? (
            <div className="directoryState" role="status">
              Loading recommendations…
            </div>
          ) : recommendations.length === 0 ? (
            <div className="directoryState">
              <h3>Your storefront is ready for its first product</h3>
              <p>Create a draft above. Nothing becomes public until you publish it.</p>
            </div>
          ) : visibleRecommendations.length === 0 ? (
            <div className="directoryState">
              <h3>No {filterLabel(filter).toLocaleLowerCase('en')} recommendations</h3>
              <p>Choose another filter or create a new recommendation above.</p>
            </div>
          ) : (
            <div className="studioRecommendationGrid">
              {visibleRecommendations.map((recommendation) => {
                const activeIndex = activeRecommendations.findIndex(
                  (item) => item.id === recommendation.id,
                );
                return (
                  <div className="studioRecommendation" key={recommendation.id}>
                    <div className="studioStatusRow">
                      <span className={`statusPill ${recommendation.lifecycle}`}>
                        {recommendation.lifecycle}
                      </span>
                      <span>
                        {recommendation.lifecycle === 'archived'
                          ? 'Not shown on storefront'
                          : `Storefront position ${activeIndex + 1}`}
                      </span>
                    </div>
                    <RecommendationCardView recommendation={recommendation} />
                    {recommendation.lifecycle !== 'archived' ? (
                      <div className="studioOrderActions" aria-label="Storefront order">
                        <button
                          aria-label={`Move ${recommendation.productName} earlier`}
                          disabled={activeIndex <= 0}
                          type="button"
                          onClick={() => move(recommendation, 'up')}
                        >
                          ↑ Earlier
                        </button>
                        <button
                          aria-label={`Move ${recommendation.productName} later`}
                          disabled={activeIndex === activeRecommendations.length - 1}
                          type="button"
                          onClick={() => move(recommendation, 'down')}
                        >
                          ↓ Later
                        </button>
                      </div>
                    ) : null}
                    <div className="studioActions">
                      {recommendation.lifecycle !== 'archived' ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => beginEditing(recommendation)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {recommendation.lifecycle === 'draft' ? (
                        <button
                          className="button primary"
                          type="button"
                          onClick={() => transition(recommendation, 'publish')}
                        >
                          Publish
                        </button>
                      ) : recommendation.lifecycle === 'published' ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => transition(recommendation, 'unpublish')}
                        >
                          Unpublish
                        </button>
                      ) : recommendation.lifecycle === 'archived' ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => transition(recommendation, 'restore')}
                        >
                          Restore as draft
                        </button>
                      ) : null}
                      {recommendation.lifecycle !== 'archived' ? (
                        <button
                          className="button danger"
                          type="button"
                          onClick={() => transition(recommendation, 'archive')}
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function uploadStageLabel(
  stage: 'idle' | 'authorizing' | 'uploading' | 'validating' | 'ready',
): string {
  return {
    authorizing: 'Preparing secure upload…',
    idle: '',
    ready: 'Image ready',
    uploading: 'Uploading image…',
    validating: 'Checking image type and size…',
  }[stage];
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}

function filterLabel(filter: ContentFilter): string {
  return {
    all: 'All',
    archived: 'Archived',
    draft: 'Drafts',
    published: 'Live',
  }[filter];
}

function transitionNotice(
  command: 'archive' | 'publish' | 'restore' | 'unpublish',
): string {
  return {
    archive: 'Recommendation archived and removed from your storefront.',
    publish: 'Recommendation is live on your storefront.',
    restore: 'Recommendation restored as a draft at the end of your storefront order.',
    unpublish: 'Recommendation moved back to drafts.',
  }[command];
}

async function fetchCreatorContent(): Promise<{
  categories: CategoryCard[];
  recommendations: CreatorRecommendation[];
}> {
  const [categoryPage, recommendationPage] = await Promise.all([
    publicApiCollectionRequest<CategoryCard>('/categories'),
    apiCollectionRequest<CreatorRecommendation>('/creator/recommendations?limit=48'),
  ]);
  return {
    categories: categoryPage.data,
    recommendations: recommendationPage.data,
  };
}

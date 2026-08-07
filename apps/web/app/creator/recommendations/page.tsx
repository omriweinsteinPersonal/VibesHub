'use client';

import type {
  CategoryCard,
  CommercialRelationship,
  RecommendationCard,
} from '@vibeshub/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { apiRequest, publicApiCollectionRequest } from '../../../lib/api';
import { RecommendationCardView } from '../../_components/recommendation-card';

interface EditorState {
  brandName: string;
  categoryId: string;
  commercialRelationship: CommercialRelationship;
  discountCode: string;
  discountLabel: string;
  imageUrl: string;
  priceIls: string;
  productName: string;
  productUrl: string;
  reviewHe: string;
  videoUrl: string;
}

const emptyEditor: EditorState = {
  brandName: '',
  categoryId: '',
  commercialRelationship: 'organic',
  discountCode: '',
  discountLabel: '',
  imageUrl: '',
  priceIls: '',
  productName: '',
  productUrl: '',
  reviewHe: '',
  videoUrl: '',
};

export default function CreatorRecommendationsPage() {
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [editing, setEditing] = useState<RecommendationCard | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryPage, recommendationPage] = await Promise.all([
        publicApiCollectionRequest<CategoryCard>('/categories'),
        apiRequest<RecommendationCard[]>('/creator/recommendations?limit=48'),
      ]);
      setCategories(categoryPage.data);
      setRecommendations(recommendationPage);
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
      const body = JSON.stringify({
        brandName: editor.brandName,
        categoryId: editor.categoryId,
        commercialRelationship: editor.commercialRelationship,
        discountCode: editor.discountCode.trim() || null,
        discountLabel: editor.discountLabel.trim() || null,
        imageUrl: editor.imageUrl,
        priceAmountMinor: Math.round(amount * 100),
        productName: editor.productName,
        productUrl: editor.productUrl,
        reviewHe: editor.reviewHe,
        videoUrl: editor.videoUrl.trim() || null,
      });
      if (editing) {
        await apiRequest<RecommendationCard>(`/creator/recommendations/${editing.id}`, {
          body,
          headers: { 'if-match': `"${editing.version}"` },
          method: 'PATCH',
        });
        setNotice('Recommendation updated.');
      } else {
        await apiRequest<RecommendationCard>('/creator/recommendations', {
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
    recommendation: RecommendationCard,
    command: 'publish' | 'unpublish',
  ) {
    setError('');
    setNotice('');
    try {
      await apiRequest<RecommendationCard>(
        `/creator/recommendations/${recommendation.id}/${command}`,
        {
          headers: { 'if-match': `"${recommendation.version}"` },
          idempotent: true,
          method: 'POST',
        },
      );
      setNotice(
        command === 'publish'
          ? 'Recommendation is live on your storefront.'
          : 'Recommendation moved back to drafts.',
      );
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  function beginEditing(recommendation: RecommendationCard) {
    const category = categories.find(
      (candidate) => candidate.slug === recommendation.category.slug,
    );
    setEditing(recommendation);
    setEditor({
      brandName: recommendation.brandName,
      categoryId: category?.id ?? '',
      commercialRelationship: recommendation.commercialRelationship,
      discountCode: recommendation.discount?.code ?? '',
      discountLabel: recommendation.discount?.label ?? '',
      imageUrl: recommendation.imageUrl,
      priceIls: String(recommendation.price.amountMinor / 100),
      productName: recommendation.productName,
      productUrl: recommendation.shopUrl,
      reviewHe: recommendation.review.value,
      videoUrl: recommendation.videoUrl ?? '',
    });
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }

  function cancelEditing() {
    setEditing(null);
    setEditor(emptyEditor);
  }

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => ({ ...current, [key]: value }));
  }

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
              Product image URL
              <input
                placeholder="https://images.example.com/product.jpg"
                required
                type="url"
                value={editor.imageUrl}
                onChange={(event) => update('imageUrl', event.target.value)}
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

          <button className="button primary studioSave" disabled={saving} type="submit">
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

          {loading ? (
            <div className="directoryState" role="status">
              Loading recommendations…
            </div>
          ) : recommendations.length === 0 ? (
            <div className="directoryState">
              <h3>Your storefront is ready for its first product</h3>
              <p>Create a draft above. Nothing becomes public until you publish it.</p>
            </div>
          ) : (
            <div className="studioRecommendationGrid">
              {recommendations.map((recommendation) => (
                <div className="studioRecommendation" key={recommendation.id}>
                  <div className="studioStatusRow">
                    <span className={`statusPill ${recommendation.lifecycle}`}>
                      {recommendation.lifecycle}
                    </span>
                    <span>Version {recommendation.version}</span>
                  </div>
                  <RecommendationCardView recommendation={recommendation} />
                  <div className="studioActions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => beginEditing(recommendation)}
                    >
                      Edit
                    </button>
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
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The request could not be completed.';
}

async function fetchCreatorContent(): Promise<{
  categories: CategoryCard[];
  recommendations: RecommendationCard[];
}> {
  const [categoryPage, recommendationPage] = await Promise.all([
    publicApiCollectionRequest<CategoryCard>('/categories'),
    apiRequest<RecommendationCard[]>('/creator/recommendations?limit=48'),
  ]);
  return {
    categories: categoryPage.data,
    recommendations: recommendationPage,
  };
}

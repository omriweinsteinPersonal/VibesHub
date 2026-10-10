'use client';

import {
  defaultStorefrontTheme,
  storefrontThemeSchema,
  storefrontTitlesSchema,
  type StorefrontTitle,
  type StorefrontTheme,
} from '@vibeshub/contracts';

import type {
  CreatorStorefront,
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  CreatorDiscountCode,
  CreatorRecommendation,
  CreatorProfileSocialLink,
  FeaturedMedia,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { StorefrontLayout, StorefrontRegion, StorefrontSlot } from './storefront-layout';
import { apiCollectionRequest, apiRequest } from '../../lib/api';
import { connectorLabel } from '../../lib/creator-connectors';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { textOnAccent } from '../../lib/storefront-theme';
import { StorefrontViewTracker, TrackedInstagramLink } from './analytics-events';
import { CreatorConnectorIcon } from './creator-connector-icon';
import { RecommendationCardView } from './recommendation-card';

type StorefrontLayer = CreatorStorefrontConfigurationInput['contentOrder'][number];

function safeProfileImageUrl(value: string | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function textDirectionFor(value: string): 'rtl' | 'ltr' {
  return /^[^A-Za-z\u0590-\u05ff]*[\u0590-\u05ff]/u.test(value) ? 'rtl' : 'ltr';
}

export function CreatorStorefrontView({
  codes,
  editable = false,
  recommendations,
  storefront,
  trackStorefrontView = true,
}: {
  codes: PublicDiscountCode[];
  editable?: boolean;
  recommendations: RecommendationCard[];
  storefront: CreatorStorefront;
  trackStorefrontView?: boolean;
}) {
  const [previewBrandOrder, setPreviewBrandOrder] = useState<string[]>(
    storefront.brandOrder ?? [],
  );
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [previewTitles, setPreviewTitles] = useState<StorefrontTitle[]>(
    storefront.titles ?? [],
  );
  const [previewBio, setPreviewBio] = useState(storefront.bio.value);
  const [previewSocialLinks, setPreviewSocialLinks] = useState(storefront.socialLinks);
  const [query, setQuery] = useState('');
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<StorefrontTheme>(
    storefront.theme ?? defaultStorefrontTheme,
  );
  const [canEdit, setCanEdit] = useState(editable);
  const [configuration, setConfiguration] =
    useState<CreatorStorefrontConfiguration | null>(null);
  const [order, setOrder] = useState<StorefrontLayer[]>([]);
  const [orderError, setOrderError] = useState('');
  const [previewMode, setPreviewMode] = useState(true);
  const isMobilePreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('mobilePreview');
  const profileImageUrl =
    safeProfileImageUrl(previewTheme.profileImageUrl) ||
    safeProfileImageUrl(
      storefront.avatarUrl ? publicAssetUrl(storefront.avatarUrl) : undefined,
    );
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('mobilePreview')) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent)
        return;
      const data = event.data as {
        creatorId?: string;
        theme?: unknown;
        titles?: unknown;
        brandOrder?: unknown;
        bio?: unknown;
        socialLinks?: unknown;
        selectedBlock?: string | null;
        editingContent?: boolean;
        previewMode?: boolean;
        type?: string;
      };
      if (data.type !== 'swavii:theme-preview' || data.creatorId !== storefront.id)
        return;
      const parsed = storefrontThemeSchema.safeParse(data.theme);
      if (parsed.success) setPreviewTheme(parsed.data);
      const titles = storefrontTitlesSchema.safeParse(data.titles);
      if (titles.success) setPreviewTitles(titles.data);
      if (
        Array.isArray(data.brandOrder) &&
        data.brandOrder.every((id) => typeof id === 'string')
      )
        setPreviewBrandOrder(data.brandOrder);
      if (typeof data.bio === 'string') setPreviewBio(data.bio);
      if (
        Array.isArray(data.socialLinks) &&
        data.socialLinks.every(
          (link) =>
            typeof link === 'object' &&
            link !== null &&
            'platform' in link &&
            'url' in link,
        )
      )
        setPreviewSocialLinks(
          (data.socialLinks as CreatorProfileSocialLink[]).map((link) => ({
            ...link,
            handle: link.handle ?? null,
          })),
        );
      setSelectedBlock(data.selectedBlock ?? null);
      setEditingContent(data.editingContent === true);
      setPreviewMode(data.previewMode === true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [storefront]);
  useEffect(() => {
    if (editable || !new URLSearchParams(window.location.search).has('mobilePreview'))
      return;
    let active = true;
    apiRequest<{ creator: { handle: string } | null }>('/me')
      .then(({ creator }) => {
        if (active && creator?.handle.toLowerCase() === storefront.handle.toLowerCase())
          setCanEdit(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [editable, storefront.handle]);
  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    Promise.allSettled([
      apiRequest<CreatorStorefrontConfiguration>('/creator/studio/storefront-sections'),
      loadCreatorInventory<CreatorRecommendation>('/creator/recommendations'),
      loadCreatorInventory<CreatorDiscountCode>('/creator/discount-codes'),
    ])
      .then(([configurationResult, inventoryResult, discountResult]) => {
        if (!active) return;
        if (configurationResult.status !== 'fulfilled') {
          setOrderError('Could not load storefront editing. Refresh and try again.');
          return;
        }
        const value = configurationResult.value;
        const inventory =
          inventoryResult.status === 'fulfilled'
            ? inventoryResult.value
            : recommendations;
        const discounts =
          discountResult.status === 'fulfilled' ? discountResult.value : [];
        const validRecommendations = new Set(
          inventory
            .filter(({ lifecycle }) => lifecycle !== 'archived')
            .map(({ id }) => id),
        );
        const validDiscounts = new Set(
          discounts
            .filter(({ lifecycle }) => lifecycle !== 'archived')
            .map(({ id }) => id),
        );
        const cleaned = {
          ...value,
          curatedSections: value.curatedSections.map((section) => ({
            ...section,
            recommendationIds: section.recommendationIds.filter((id) =>
              validRecommendations.has(id),
            ),
          })),
          contentOrder: value.contentOrder.filter(({ kind, id }) =>
            kind === 'recommendation'
              ? validRecommendations.has(id)
              : kind === 'discount'
                ? validDiscounts.has(id)
                : true,
          ),
        };
        setConfiguration(cleaned);
        // Match the public grouping exactly; synthesizing individual layers here
        // would create editor-only keys that the public page cannot restore.
        setOrder(cleaned.contentOrder);
        if (
          inventoryResult.status === 'rejected' ||
          discountResult.status === 'rejected'
        ) {
          setOrderError(
            'Some storefront data could not be refreshed. You can still edit the available content.',
          );
        } else {
          setOrderError('');
        }
      })
      .catch(() => {
        if (active)
          setOrderError('Could not load storefront editing. Refresh and try again.');
      });
    return () => {
      active = false;
    };
  }, [canEdit, recommendations, codes]);
  const contentOrder = useMemo(
    () =>
      configuration
        ? order
        : Array.isArray(storefront.contentOrder)
          ? storefront.contentOrder
          : [],
    [configuration, order, storefront.contentOrder],
  );
  const hiddenBrandIds = useMemo(
    () => new Set(storefront.hiddenBrandIds ?? []),
    [storefront.hiddenBrandIds],
  );
  const hiddenCollectionIds = useMemo(
    () => new Set(storefront.hiddenCollectionIds ?? []),
    [storefront.hiddenCollectionIds],
  );
  const hiddenRecommendationIds = useMemo(() => {
    const ids = new Set(storefront.hiddenRecommendationIds ?? []);
    for (const section of storefront.curatedSections ?? []) {
      if (hiddenCollectionIds.has(section.id))
        section.recommendationIds.forEach((id) => ids.add(id));
    }
    return ids;
  }, [
    hiddenCollectionIds,
    storefront.curatedSections,
    storefront.hiddenRecommendationIds,
  ]);
  const visibleCuratedSections = useMemo(
    () =>
      (storefront.curatedSections ?? []).filter(
        (section) =>
          !hiddenCollectionIds.has(section.id) &&
          !hiddenBrandIds.has(section.brandId ?? ''),
      ),
    [hiddenBrandIds, hiddenCollectionIds, storefront.curatedSections],
  );
  const visibleRecommendations = useMemo(
    () =>
      recommendations.filter(
        (item) =>
          !hiddenRecommendationIds.has(item.id) &&
          ![...hiddenBrandIds].some((brandId) =>
            storefront.brands.find(
              (brand) =>
                brand.id === brandId && brandKey(brand.name) === brandKey(item.brandName),
            ),
          ),
      ),
    [hiddenBrandIds, hiddenRecommendationIds, recommendations, storefront.brands],
  );
  const visibleFeaturedMedia = useMemo(
    () =>
      (configuration?.featuredMedia ?? storefront.featuredMedia ?? []).filter(
        ({ visible }) => visible,
      ),
    [configuration?.featuredMedia, storefront.featuredMedia],
  );
  const orderedStorefront = useMemo(
    () => ({ ...storefront, contentOrder, curatedSections: visibleCuratedSections }),
    [storefront, contentOrder, visibleCuratedSections],
  );
  const labels = useMemo(
    () => configuration?.labels ?? storefront.labels ?? [],
    [configuration?.labels, storefront.labels],
  );
  const displayBrands = useMemo(() => {
    const byName = new Map<string, CreatorStorefront['brands'][number]>();
    for (const brand of storefront.brands) {
      const key = brandKey(brand.name);
      const current = byName.get(key);
      const hasOffer = codes.some(
        (code) => code.brandId === brand.id && code.scopeKind === 'brand',
      );
      const currentHasOffer = current
        ? codes.some((code) => code.brandId === current.id && code.scopeKind === 'brand')
        : false;
      if (!current || (hasOffer && !currentHasOffer)) byName.set(key, brand);
    }
    return [...byName.values()].filter((brand) => !hiddenBrandIds.has(brand.id));
  }, [codes, hiddenBrandIds, storefront.brands]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('he-IL');
    const label = labels.find(({ id }) => id === activeLabelId);
    const collectionRecommendationIds = new Set(
      (label?.collectionIds ?? [])
        .flatMap(
          (collectionId) =>
            visibleCuratedSections.find(
              ({ id, kind }) => id === collectionId && kind === 'collection',
            )?.recommendationIds ?? [],
        )
        .filter(Boolean) ?? [],
    );
    const cardBrandNames = new Set(
      displayBrands
        .filter((brand) => (label?.brandIds ?? []).includes(brand.id))
        .map((brand) => brandKey(brand.name)),
    );
    return visibleRecommendations.filter((item) => {
      const matchesLabel =
        !label ||
        (label.categorySlug
          ? item.category.slug === label.categorySlug
          : label.recommendationIds.includes(item.id) ||
            collectionRecommendationIds.has(item.id) ||
            cardBrandNames.has(brandKey(item.brandName)));
      const matchesSearch =
        !term ||
        [item.productName, item.brandName, item.review.value, item.category.name].some(
          (value) => value.toLocaleLowerCase('he-IL').includes(term),
        );
      return matchesLabel && matchesSearch;
    });
  }, [
    activeLabelId,
    labels,
    query,
    visibleRecommendations,
    displayBrands,
    visibleCuratedSections,
  ]);
  const rows = useMemo(() => {
    const brandNames = new Set(displayBrands.map(({ name }) => brandKey(name)));
    return groupRecommendations(
      orderedStorefront,
      filtered.filter(({ brandName }) => !brandNames.has(brandKey(brandName))),
    );
  }, [displayBrands, filtered, orderedStorefront]);
  const activeLabel = labels.find(({ id }) => id === activeLabelId) ?? null;
  const selectedCardBrands = useMemo(
    () =>
      displayBrands.filter((brand) => (activeLabel?.brandIds ?? []).includes(brand.id)),
    [activeLabel?.brandIds, displayBrands],
  );
  const compactLabelItems = useMemo(() => {
    if (
      !activeLabel ||
      activeLabel.categorySlug ||
      (activeLabel.layout ?? 'grid') !== 'grid'
    ) {
      return [];
    }
    const cardBrandNames = new Set(
      selectedCardBrands.map((brand) => brandKey(brand.name)),
    );
    return filtered.filter((item) => !cardBrandNames.has(brandKey(item.brandName)));
  }, [activeLabel, filtered, selectedCardBrands]);
  const showingCompactLabelGrid = Boolean(
    activeLabel && !activeLabel.categorySlug && (activeLabel.layout ?? 'grid') === 'grid',
  );
  const blocks = useMemo(() => {
    const remainingRows = [...rows];
    // A label is a focused view of recommendations. Do not leak unrelated
    // standalone discount blocks into it; brand offers remain visible only
    // inside a brand card that has at least one matching recommendation.
    const remainingCodes = activeLabelId ? [] : codes.filter(({ brandId }) => !brandId);
    const result: Array<{
      key: string;
      layer: StorefrontLayer | null;
      row?: (typeof rows)[number];
      code?: PublicDiscountCode;
      media?: FeaturedMedia;
    }> = [];
    for (const layer of contentOrder) {
      if (layer.kind === 'media') {
        if (activeLabelId) continue;
        const media = visibleFeaturedMedia.find(({ id }) => id === layer.id);
        if (media) result.push({ key: `media:${media.id}`, layer, media });
      } else if (layer.kind === 'discount') {
        const index = remainingCodes.findIndex(({ id }) => id === layer.id);
        if (index >= 0) {
          const [code] = remainingCodes.splice(index, 1);
          if (code) result.push({ key: `discount:${layer.id}`, layer, code });
        }
      } else {
        const index = remainingRows.findIndex(({ key }) => key === layer.id);
        if (index >= 0) {
          const [row] = remainingRows.splice(index, 1);
          if (row) result.push({ key: `${layer.kind}:${layer.id}`, layer, row });
        }
      }
    }
    remainingRows.forEach((row) =>
      result.push({ key: `row:${row.key}`, layer: null, row }),
    );
    remainingCodes.forEach((code) =>
      result.push({
        key: `discount:${code.id}`,
        layer: { kind: 'discount', id: code.id },
        code,
      }),
    );
    return result;
  }, [activeLabelId, rows, codes, contentOrder, visibleFeaturedMedia]);
  const validTargets = new Set([
    ...displayBrands.map(({ id }) => id),
    ...rows.map(({ key }) => key),
    ...visibleFeaturedMedia.map(({ id }) => id),
  ]);
  function renderTitles(beforeId: string | null) {
    return previewTitles
      .filter((title) =>
        beforeId === null
          ? title.beforeId === null || !validTargets.has(title.beforeId)
          : title.beforeId === beforeId,
      )
      .map((title) => {
        const Tag = title.format === 'paragraph' ? 'p' : 'h2';
        const showButton = Boolean(title.url && title.buttonLabel);
        const contentKind = title.contentKind ?? 'text';
        const cardStyle =
          title.appearance === 'card'
            ? {
                background: title.background ?? previewTheme.discountBackground,
                backgroundImage: title.backgroundImageUrl
                  ? `linear-gradient(rgb(255 255 255 / 0.28), rgb(255 255 255 / 0.28)), url(${title.backgroundImageUrl})`
                  : undefined,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                padding: { small: 12, medium: 20, large: 28 }[title.padding ?? 'small'],
                borderRadius: { square: 0, rounded: 10, soft: 20 }[
                  title.radius ?? 'rounded'
                ],
                border: '1px solid #e2d5c8',
              }
            : {};
        return (
          <StorefrontSlot
            key={title.id}
            id={`text:${title.id}`}
            label={title.text.slice(0, 60)}
          >
            <div
              className="storefrontContentBlock"
              data-editor-block={title.id}
              data-selected={selectedBlock === title.id}
              style={cardStyle}
            >
              {contentKind === 'text' ? (
                <>
                  <Tag
                    dir="auto"
                    className={`storefrontContentTitle storefrontContentTitle-${title.size} storefrontContentText-${title.format ?? 'heading'}`}
                    style={{ textAlign: title.align }}
                  >
                    {title.url && !showButton ? (
                      <a href={title.url} rel="noreferrer" target="_blank">
                        {title.text}
                      </a>
                    ) : (
                      title.text
                    )}
                  </Tag>
                  {showButton ? (
                    <a
                      className="storefrontContentButton"
                      href={title.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {title.buttonLabel}
                    </a>
                  ) : null}
                </>
              ) : (
                <div className="storefrontMediaBlock">
                  <h2 className="storefrontMediaHeading" dir="auto">
                    {title.text}
                  </h2>
                  {contentKind === 'photo-gallery' && title.mediaUrls?.length ? (
                    <div className="storefrontPhotoGallery">
                      {title.mediaUrls.map((src, index) => (
                        // External media URLs are creator-provided HTTPS images.
                        <Image
                          key={`${src}-${index}`}
                          src={src}
                          alt={`${title.text}, photo ${index + 1}`}
                          loading="lazy"
                          unoptimized
                          width={600}
                          height={600}
                        />
                      ))}
                    </div>
                  ) : null}
                  {contentKind === 'photo-gallery' &&
                  !title.mediaUrls?.length &&
                  canEdit &&
                  !previewMode ? (
                    <p className="storefrontMediaEmpty">
                      Add photo URLs to fill this gallery.
                    </p>
                  ) : null}
                  {contentKind === 'video' && title.videoUrl ? (
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      src={title.videoUrl}
                      aria-label={title.text}
                    />
                  ) : null}
                  {contentKind === 'video' &&
                  !title.videoUrl &&
                  canEdit &&
                  !previewMode ? (
                    <p className="storefrontMediaEmpty">
                      Add a video URL to show your video here.
                    </p>
                  ) : null}
                  {contentKind === 'instagram' && title.instagramUrl ? (
                    <>
                      <iframe
                        title={`${title.text} Instagram post`}
                        src={`https://www.instagram.com${new URL(title.instagramUrl).pathname.replace(/\/$/, '')}/embed/`}
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                      <a
                        href={title.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Instagram ↗
                      </a>
                    </>
                  ) : null}
                  {contentKind === 'instagram' &&
                  !title.instagramUrl &&
                  canEdit &&
                  !previewMode ? (
                    <p className="storefrontMediaEmpty">
                      Add a public Instagram post URL to embed it here.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </StorefrontSlot>
        );
      });
  }
  return (
    <>
      <div
        className="creatorStorefrontCanvas"
        data-mobile-preview={isMobilePreview}
        data-editing-content={canEdit && !previewMode && editingContent}
        onClickCapture={(event) => {
          if (
            !canEdit ||
            previewMode ||
            window.parent === window ||
            !new URLSearchParams(window.location.search).has('mobilePreview')
          )
            return;
          const target = event.target as HTMLElement;
          const block = target.closest<HTMLElement>('[data-editor-block]');
          if (block && !target.closest('input, button')) {
            event.preventDefault();
            event.stopPropagation();
            window.parent.postMessage(
              {
                type: 'swavii:block-select',
                creatorId: storefront.id,
                blockId: block.dataset.editorBlock,
              },
              window.location.origin,
            );
            return;
          }
          if (target.closest('.referenceCollectionPages, .referenceStandalonePages'))
            return;
          if (target.closest('input, button')) return;
          const section = target.closest('.referenceDiscountLayer')
            ? 'discount'
            : target.closest('.storeProductCard')
              ? 'product'
              : target.closest('.referenceCollectionFrame')
                ? 'collection'
                : target.closest('.referenceStorefrontHero')
                  ? 'profile'
                  : 'recommendations';
          window.parent.postMessage(
            { type: 'swavii:theme-select', creatorId: storefront.id, section },
            window.location.origin,
          );
        }}
        style={
          {
            '--sf-profile': previewTheme.profileBackground,
            '--sf-profile-image': profileImageUrl
              ? `url("${profileImageUrl.replace(/["\\)]/g, '')}")`
              : 'none',
            '--sf-page': previewTheme.recommendationsBackground,
            '--sf-divider': previewTheme.dividerColor,
            '--sf-product': previewTheme.productBackground,
            '--sf-discount': previewTheme.discountBackground,
            '--sf-collection': previewTheme.collectionBackground,
            '--sf-accent': previewTheme.accentColor,
            '--sf-accent-ink': textOnAccent(previewTheme.accentColor),
            '--sf-text': previewTheme.textColor,
          } as CSSProperties
        }
      >
        {trackStorefrontView ? <StorefrontViewTracker creatorId={storefront.id} /> : null}
        <StorefrontLayout
          compactPreview={isMobilePreview}
          creatorId={storefront.id}
          theme={previewTheme}
          editable={
            canEdit && !previewMode && Boolean(configuration) && !query && !activeLabelId
          }
          onTheme={setPreviewTheme}
        >
          <StorefrontRegion>
            <StorefrontSlot id="profile" label="Profile" kind="profile">
              <div className="referenceStorefrontInner">
                <span className="referenceStorefrontAvatar">
                  {storefront.avatarUrl ? (
                    <Image
                      alt={`${storefront.displayName} profile photo`}
                      fill
                      priority
                      sizes="180px"
                      src={publicAssetUrl(storefront.avatarUrl)}
                      unoptimized
                    />
                  ) : (
                    <b>{initials(storefront.displayName)}</b>
                  )}
                </span>
                <div className="referenceStorefrontName">
                  <div>
                    <h1>{storefront.displayName}</h1>
                    {storefront.verificationStatus === 'verified' ? (
                      <span aria-label="Verified creator">
                        <BadgeCheck aria-hidden="true" size={24} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </StorefrontSlot>
            {previewBio || (canEdit && !previewMode) ? (
              <StorefrontSlot id="bio" label="Bio" kind="profile">
                <p
                  className="referenceStorefrontBio"
                  data-editor-block="bio"
                  data-selected={selectedBlock === 'bio'}
                  dir="auto"
                  lang={storefront.bio.language}
                >
                  {previewBio || 'Tap to add your bio'}
                </p>
              </StorefrontSlot>
            ) : null}
            {previewSocialLinks.length ? (
              <StorefrontRegion>
                {previewSocialLinks.map((link) => {
                  const label = connectorLabel(link.platform);
                  const content = (
                    <>
                      <CreatorConnectorIcon platform={link.platform} />
                      <span className="srOnly">{label}</span>
                    </>
                  );
                  return (
                    <StorefrontSlot
                      key={link.platform}
                      id={`social:${link.platform}`}
                      label={label}
                      kind="social"
                    >
                      {link.platform === 'instagram' ? (
                        <TrackedInstagramLink
                          className="referenceConnectorLink"
                          creatorId={storefront.id}
                          data-editor-block={`social:${link.platform}`}
                          data-selected={selectedBlock === `social:${link.platform}`}
                          href={link.url}
                          key={link.platform}
                          title={label}
                        >
                          {content}
                        </TrackedInstagramLink>
                      ) : (
                        <a
                          className="referenceConnectorLink"
                          data-editor-block={`social:${link.platform}`}
                          data-selected={selectedBlock === `social:${link.platform}`}
                          href={link.url}
                          key={link.platform}
                          rel="noopener noreferrer"
                          target="_blank"
                          title={label}
                        >
                          {content}
                        </a>
                      )}
                    </StorefrontSlot>
                  );
                })}
              </StorefrontRegion>
            ) : null}
          </StorefrontRegion>

          <StorefrontRegion>
            {labels.length ? (
              <StorefrontSlot id="labels" label="Labels">
                <nav aria-label="Store filters" className="referenceStorefrontLabels">
                  <button
                    aria-pressed={activeLabelId === null}
                    onClick={() => setActiveLabelId(null)}
                    type="button"
                  >
                    All
                  </button>
                  {labels.map((label) => (
                    <button
                      aria-pressed={activeLabelId === label.id}
                      key={label.id}
                      data-label-id={label.id}
                      onClick={() => setActiveLabelId(label.id)}
                      type="button"
                    >
                      {label.title}
                    </button>
                  ))}
                </nav>
              </StorefrontSlot>
            ) : null}
            <StorefrontSlot id="search" label="Search">
              <header>
                <label>
                  <Search aria-hidden="true" size={16} />
                  <input
                    aria-label="Search this store"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search this store…"
                    type="search"
                    value={query}
                  />
                </label>
              </header>
            </StorefrontSlot>
            {showingCompactLabelGrid ? (
              <StorefrontSlot id="filtered" label="Filtered recommendations">
                <div className="referenceCompactLabelGroups">
                  {selectedCardBrands.map((brand) => (
                    <BrandBlock
                      brand={brand}
                      collections={visibleCuratedSections.filter(
                        (section) =>
                          section.kind === 'collection' &&
                          section.brandId === brand.brandId,
                      )}
                      creatorId={storefront.id}
                      discountCodes={codes}
                      handle={storefront.handle}
                      items={filtered.filter(
                        (item) => brandKey(item.brandName) === brandKey(brand.name),
                      )}
                      key={brand.id}
                      offer={
                        codes.find(
                          (code) =>
                            code.brandId === brand.id && code.scopeKind === 'brand',
                        ) ?? null
                      }
                    />
                  ))}
                  {compactLabelItems.length ? (
                    <div className="referenceCompactLabelGrid">
                      {compactLabelItems.map((item) => (
                        <RecommendationCardView
                          creatorId={storefront.id}
                          key={item.id}
                          recommendation={item}
                          showBrand
                          showPrice={false}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </StorefrontSlot>
            ) : null}
            {!showingCompactLabelGrid
              ? displayBrands
                  .filter((brand) =>
                    activeLabelId
                      ? filtered.some(
                          (item) => brandKey(item.brandName) === brandKey(brand.name),
                        )
                      : true,
                  )
                  .sort((a, b) => {
                    const ai = previewBrandOrder.indexOf(a.id),
                      bi = previewBrandOrder.indexOf(b.id);
                    return (ai < 0 ? 1000 : ai) - (bi < 0 ? 1000 : bi);
                  })
                  .map((brand) => (
                    <Fragment key={brand.id}>
                      {renderTitles(brand.id)}
                      <StorefrontSlot id={`brand:${brand.id}`} label={brand.name}>
                        <div
                          className="referenceBrandBlockWrapper"
                          data-editor-block={brand.id}
                          data-selected={selectedBlock === brand.id}
                        >
                          <BrandBlock
                            brand={brand}
                            collections={visibleCuratedSections.filter(
                              (section) =>
                                section.kind === 'collection' &&
                                section.brandId === brand.brandId,
                            )}
                            creatorId={storefront.id}
                            discountCodes={codes}
                            handle={storefront.handle}
                            items={filtered.filter(
                              (item) => brandKey(item.brandName) === brandKey(brand.name),
                            )}
                            offer={
                              codes.find(
                                (code) =>
                                  code.brandId === brand.id && code.scopeKind === 'brand',
                              ) ?? null
                            }
                            key={brand.id}
                          />
                        </div>
                      </StorefrontSlot>
                    </Fragment>
                  ))
              : null}
            {!showingCompactLabelGrid &&
            visibleCuratedSections.some(
              (section) => section.kind === 'page' && !section.parentCollectionId,
            ) ? (
              <StorefrontRegion>
                {visibleCuratedSections
                  .filter(
                    (section) => section.kind === 'page' && !section.parentCollectionId,
                  )
                  .map((page) => (
                    <StorefrontSlot
                      key={page.id}
                      id={`page:${page.id}`}
                      label={page.title}
                    >
                      <div className="referenceStandalonePages referenceCollectionPages">
                        <Link
                          href={`/${encodeURIComponent(storefront.handle)}/pages/${page.id}`}
                          key={page.id}
                        >
                          <span>PRODUCT PAGE</span>
                          <strong>{page.title}</strong>
                          <small>{page.recommendationIds.length} picks →</small>
                        </Link>
                      </div>
                    </StorefrontSlot>
                  ))}
              </StorefrontRegion>
            ) : null}
            {orderError ? (
              <StorefrontSlot id="error" label="Editing status">
                <p className="formError" role="alert">
                  {orderError}
                </p>
              </StorefrontSlot>
            ) : null}
            {!showingCompactLabelGrid &&
            !blocks.length &&
            !visibleCuratedSections.some(({ kind }) => kind === 'page')
              ? null
              : !showingCompactLabelGrid
                ? blocks.map(({ key, row, code, media }) => {
                    const productContent = row ? (
                      <StorefrontRow
                        creatorId={storefront.id}
                        framed={row.framed}
                        pages={visibleCuratedSections.filter(
                          (section) =>
                            section.kind === 'page' &&
                            section.parentCollectionId === row.key,
                        )}
                        recommendations={row.items}
                        storefrontHandle={storefront.handle}
                        title={row.title}
                      />
                    ) : code ? (
                      <DiscountBlock
                        brandLogoUrl={
                          code.brandId
                            ? (storefront.brands.find(({ id }) => id === code.brandId)
                                ?.logoUrl ?? null)
                            : null
                        }
                        code={code}
                      />
                    ) : media ? (
                      <FeaturedMediaBlock media={media} />
                    ) : null;
                    return (
                      <Fragment key={key}>
                        {renderTitles(row?.key ?? code?.id ?? key)}
                        <StorefrontSlot
                          id={`content:${row?.key ?? code?.id ?? key}`}
                          label={
                            row?.title ??
                            code?.merchantName ??
                            media?.title ??
                            'Recommendations'
                          }
                        >
                          {productContent}
                        </StorefrontSlot>
                      </Fragment>
                    );
                  })
                : null}
            {!showingCompactLabelGrid ? renderTitles(null) : null}
          </StorefrontRegion>
        </StorefrontLayout>
      </div>
    </>
  );
}

function StandaloneRecommendationCard({
  brand,
  discount,
  handle,
  item,
}: {
  brand: CreatorStorefront['brands'][number];
  discount: RecommendationCard['discount'] | PublicDiscountCode | null;
  handle: string;
  item: RecommendationCard;
}) {
  const value = discount ? discountValue(discount) : null;
  return (
    <Link
      aria-label={`View ${item.productName} at ${brand.name}`}
      className="referenceStandaloneRecommendation"
      href={`/products/${encodeURIComponent(item.id)}?from=/${encodeURIComponent(handle)}`}
    >
      <div className="referenceStandaloneRecommendationContent" dir="auto">
        <div className="referenceStandaloneRecommendationTopline">
          <p className="referenceStandaloneRecommendationBrand">{brand.name}</p>
          {value ? <span>{value}</span> : null}
        </div>
        <div className="referenceStandaloneRecommendationOffer">
          <span
            className={`referenceDiscountExpiry${discount?.expiresAt ? '' : ' is-empty'}`}
          >
            <span>Discount expires</span>
            <strong>
              {discount?.expiresAt ? formatOfferDate(discount.expiresAt) : '\u00a0'}
            </strong>
          </span>
          {discount?.code ? (
            <strong>{discount.code}</strong>
          ) : (
            <span aria-hidden="true" className="referenceDiscountCodePlaceholder" />
          )}
        </div>
        <h3 dir={textDirectionFor(item.productName)}>{item.productName}</h3>
      </div>
      <div className="referenceStandaloneRecommendationImage">
        <Image
          alt={item.productName}
          fill
          sizes="(max-width: 620px) 42vw, 220px"
          src={publicAssetUrl(item.imageUrl)}
          unoptimized
        />
      </div>
    </Link>
  );
}

function FeaturedMediaBlock({ media }: { media: FeaturedMedia }) {
  const embedUrl = featuredMediaEmbedUrl(media);
  return (
    <article className="featuredMediaBlock">
      {media.thumbnailUrl && !embedUrl ? (
        <div className="featuredMediaCover">
          <Image
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 640px"
            src={media.thumbnailUrl}
            unoptimized
          />
        </div>
      ) : null}
      {media.displayMode === 'embed' && embedUrl ? (
        <div className="featuredMediaEmbed">
          <iframe
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={embedUrl}
            title={media.title}
          />
        </div>
      ) : (
        <a
          className="featuredMediaLink"
          href={media.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {media.thumbnailUrl ? (
            <div className="featuredMediaCover">
              <Image
                alt=""
                fill
                sizes="(max-width: 700px) 100vw, 640px"
                src={media.thumbnailUrl}
                unoptimized
              />
              <span className="featuredMediaPlay">▶</span>
            </div>
          ) : null}
          <span>
            <small>{media.provider.replace('_', ' ')}</small>
            <strong>{media.title}</strong>
            <em>
              Open on {media.provider === 'apple_music' ? 'Apple Music' : media.provider}
            </em>
          </span>
        </a>
      )}
    </article>
  );
}

function featuredMediaEmbedUrl(media: FeaturedMedia): string | null {
  try {
    const url = new URL(media.url);
    if (media.provider === 'youtube') {
      const id =
        url.hostname.replace(/^www\./, '') === 'youtu.be'
          ? url.pathname.slice(1).split('/')[0]
          : (url.searchParams.get('v') ??
            url.pathname.match(/\/(?:shorts|embed)\/([^/]+)/)?.[1]);
      return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
    }
    if (media.provider === 'instagram' && /^\/(?:p|reel)\//u.test(url.pathname)) {
      return `https://www.instagram.com${url.pathname.replace(/\/$/, '')}/embed/`;
    }
    if (
      media.provider === 'spotify' &&
      /^(?:open\.spotify\.com|spotify\.link)$/u.test(url.hostname.replace(/^www\./, ''))
    ) {
      return url.hostname === 'spotify.link'
        ? null
        : url.href.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    if (media.provider === 'apple_music' && url.hostname === 'music.apple.com') {
      return url.href.replace('music.apple.com/', 'embed.music.apple.com/');
    }
    return null;
  } catch {
    return null;
  }
}

function SingleBrandProductCard({
  brand,
  handle,
  item,
  offer,
}: {
  brand: CreatorStorefront['brands'][number];
  handle: string;
  item: RecommendationCard;
  offer: PublicDiscountCode;
}) {
  return (
    <Link
      aria-label={`View ${item.productName} at ${brand.name}`}
      className="referenceBrandSingleProduct"
      href={`/products/${encodeURIComponent(item.id)}?from=/${encodeURIComponent(handle)}`}
    >
      <div className="referenceBrandSingleProductCopy" dir="auto">
        <div className="referenceBrandSingleProductMeta">
          <span>{brand.name}</span>
          {offerValue(offer) ? <strong>{offerValue(offer)}</strong> : null}
        </div>
        <div className="referenceBrandSingleProductOffer">
          <span
            className={`referenceDiscountExpiry${offer.expiresAt ? '' : ' is-empty'}`}
          >
            <span>Discount expires</span>
            <strong>
              {offer.expiresAt ? formatOfferDate(offer.expiresAt) : '\u00a0'}
            </strong>
          </span>
          {offer.code ? (
            <strong>{offer.code}</strong>
          ) : (
            <span aria-hidden="true" className="referenceDiscountCodePlaceholder" />
          )}
        </div>
        <h3 dir={textDirectionFor(item.productName)}>{item.productName}</h3>
        {offer.details ? <p>{offer.details.value}</p> : null}
      </div>
      <div className="referenceBrandSingleProductImage">
        <Image
          alt={item.productName}
          fill
          sizes="(max-width: 620px) 42vw, 300px"
          src={publicAssetUrl(item.imageUrl)}
          unoptimized
        />
      </div>
    </Link>
  );
}

function BrandBlock({
  brand,
  collections,
  creatorId,
  discountCodes,
  handle,
  items,
  offer,
}: {
  brand: CreatorStorefront['brands'][number];
  collections: CreatorStorefront['curatedSections'];
  creatorId: string;
  discountCodes: PublicDiscountCode[];
  handle: string;
  items: RecommendationCard[];
  offer: PublicDiscountCode | null;
}) {
  // Existing API deployments may not yet include the optional offer video field.
  // Treat it as an empty rail so older offers keep rendering during rollout.
  const storyClips = offer?.storyClips ?? [];
  const collectedIds = new Set(
    collections
      .filter(({ showItemsIndividually }) => !showItemsIndividually)
      .flatMap(({ recommendationIds }) => recommendationIds),
  );
  const standaloneItems = items.filter(({ id }) => !collectedIds.has(id));
  if (items.length === 1 && collections.length === 0) {
    const item = items[0]!;
    if (offer) {
      return (
        <SingleBrandProductCard brand={brand} handle={handle} item={item} offer={offer} />
      );
    }
    const discount =
      item.discount ??
      discountCodes.find(
        (code) => code.scopeKind === 'item' && code.scopeId === item.id,
      ) ??
      null;
    return (
      <StandaloneRecommendationCard
        brand={brand}
        discount={discount}
        handle={handle}
        item={item}
      />
    );
  }
  const isBrandOnly = collections.length === 0 && standaloneItems.length === 0;
  if (isBrandOnly && offer) {
    return <BrandOnlyRecommendationCard brand={brand} offer={offer} />;
  }
  const brandLogoUrl = brand.logoUrl;
  return (
    <section
      className="referenceBrandBlock"
      data-brand-only={isBrandOnly ? 'true' : undefined}
      data-has-logo={isBrandOnly && brandLogoUrl ? 'true' : undefined}
    >
      <a
        aria-label={`Visit ${brand.name}`}
        className="referenceBrandHitArea"
        href={brand.websiteUrl}
        rel="noopener noreferrer"
        target="_blank"
      />
      <header>
        <h3>{brand.name}</h3>
        {offer ? (
          <div className="referenceBrandOffer">
            {offer.discountPercent || offer.discountAmountMinor || offer.label ? (
              <span>{offerValue(offer)}</span>
            ) : null}
            {offer.code ? <strong>{offer.code}</strong> : null}
          </div>
        ) : null}
      </header>
      {isBrandOnly && brandLogoUrl ? (
        <div className="referenceBrandOnlyImage">
          <Image
            alt={`${brand.name} logo`}
            fill
            sizes="76px"
            src={publicAssetUrl(brandLogoUrl)}
            unoptimized
          />
        </div>
      ) : null}
      {offer && (offer.details || offer.expiresAt || storyClips.length) ? (
        <div className="referenceBrandOfferBody">
          {offer.details ? (
            <p dir={offer.details.direction}>{offer.details.value}</p>
          ) : null}
          {offer.expiresAt ? (
            <small className="referenceBrandOfferExpiry">
              <span>Discount expires</span>
              <strong>{formatOfferDate(offer.expiresAt)}</strong>
            </small>
          ) : null}
          {storyClips.length ? (
            <div className="referenceBrandVideoRail" aria-label={`${brand.name} videos`}>
              {storyClips.map((clip) => (
                <video
                  key={clip.id}
                  controls
                  playsInline
                  preload="metadata"
                  src={clip.url}
                  aria-label={`${brand.name} video ${clip.position + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {collections.length || standaloneItems.length ? (
        <div
          className="referenceBrandShelf"
          data-item-count={collections.length + standaloneItems.length}
        >
          {collections.map((collection) => {
            const firstItem = collection.recommendationIds.flatMap(
              (id) => items.find((item) => item.id === id) ?? [],
            )[0];
            const cover = collection.imageUrl || firstItem?.imageUrl;
            const textDirection = /^[^A-Za-z\u0590-\u05ff]*[\u0590-\u05ff]/u.test(
              collection.title,
            )
              ? 'rtl'
              : 'ltr';
            return (
              <Link
                className="referenceBrandCollectionCard"
                data-text-direction={textDirection}
                href={`/${encodeURIComponent(handle)}/pages/${collection.id}`}
                key={collection.id}
              >
                {cover ? (
                  <span className="referenceBrandCardImage">
                    <Image alt="" fill sizes="220px" src={cover} unoptimized />
                  </span>
                ) : null}
                <span dir={textDirection}>
                  <strong>{collection.title}</strong>
                </span>
              </Link>
            );
          })}
          {standaloneItems.map((item) => (
            <RecommendationCardView
              creatorId={creatorId}
              hideDiscount={offer?.id === item.discount?.id}
              key={item.id}
              recommendation={item}
              showPrice={false}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BrandOnlyRecommendationCard({
  brand,
  offer,
}: {
  brand: CreatorStorefront['brands'][number];
  offer: PublicDiscountCode;
}) {
  const logoUrl =
    brand.logoUrl ||
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      new URL(brand.websiteUrl).hostname,
    )}&sz=128`;
  return (
    <a
      aria-label={`Visit ${brand.name}${offer.code ? ` with discount code ${offer.code}` : ''}`}
      className="referenceStandaloneRecommendation referenceBrandRecommendation"
      href={brand.websiteUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      <div className="referenceStandaloneRecommendationContent" dir="auto">
        <div className="referenceStandaloneRecommendationTopline">
          <p className="referenceStandaloneRecommendationBrand">{brand.name}</p>
          <span>{offerValue(offer) || null}</span>
        </div>
        <div className="referenceStandaloneRecommendationOffer">
          <span
            className={`referenceDiscountExpiry${offer.expiresAt ? '' : ' is-empty'}`}
          >
            <span>Discount expires</span>
            <strong>
              {offer.expiresAt ? formatOfferDate(offer.expiresAt) : '\u00a0'}
            </strong>
          </span>
          {offer.code ? (
            <strong>{offer.code}</strong>
          ) : (
            <span aria-hidden="true" className="referenceDiscountCodePlaceholder" />
          )}
        </div>
        {offer.details ? (
          <h3 dir={offer.details.direction}>{offer.details.value}</h3>
        ) : null}
      </div>
      <div className="referenceStandaloneRecommendationImage">
        <Image
          alt={`${brand.name} logo`}
          fill
          sizes="(max-width: 620px) 42vw, 220px"
          src={publicAssetUrl(logoUrl)}
          unoptimized
        />
      </div>
    </a>
  );
}

function formatOfferDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function discountValue(
  discount: NonNullable<RecommendationCard['discount']> | PublicDiscountCode,
): string | null {
  if ('discountPercent' in discount && discount.discountPercent) {
    return `${discount.discountPercent}% off`;
  }
  if ('discountAmountMinor' in discount && discount.discountAmountMinor) {
    return `₪${discount.discountAmountMinor / 100} off`;
  }
  if ('details' in discount && discount.details) return discount.details.value;
  return discount.label;
}

function DiscountBlock({
  brandLogoUrl,
  code,
}: {
  brandLogoUrl?: string | null;
  code: PublicDiscountCode;
}) {
  const brandName =
    code.merchantHostname
      .replace(/^www\./i, '')
      .split('.')[0]
      ?.replaceAll('-', ' ') || code.merchantName;
  const merchantUrl = code.merchantUrl || `https://${code.merchantHostname}`;
  const logoUrl =
    brandLogoUrl ||
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(code.merchantHostname)}&sz=64`;
  return (
    <section className="referenceStorefrontCodes referenceDiscountLayer">
      <a
        aria-label={`Visit ${brandName}${code.code ? ` with discount code ${code.code}` : ''}`}
        className="referenceStandaloneRecommendation referenceDiscountRecommendation"
        href={merchantUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="referenceStandaloneRecommendationContent" dir="auto">
          <div className="referenceStandaloneRecommendationTopline">
            <p className="referenceStandaloneRecommendationBrand">{brandName}</p>
            <span>{offerValue(code) || null}</span>
          </div>
          <div className="referenceStandaloneRecommendationOffer">
            <span
              className={`referenceDiscountExpiry${code.expiresAt ? '' : ' is-empty'}`}
            >
              <span>Discount expires</span>
              <strong>
                {code.expiresAt ? formatOfferDate(code.expiresAt) : '\u00a0'}
              </strong>
            </span>
            {code.code ? (
              <strong>{code.code}</strong>
            ) : (
              <span aria-hidden="true" className="referenceDiscountCodePlaceholder" />
            )}
          </div>
        </div>
        <div className="referenceStandaloneRecommendationImage">
          <Image
            alt={`${brandName} logo`}
            fill
            sizes="(max-width: 620px) 42vw, 220px"
            src={logoUrl}
            unoptimized
          />
        </div>
      </a>
    </section>
  );
}

function offerValue(offer: PublicDiscountCode): string | null {
  if (offer.discountPercent) return `${offer.discountPercent}% off`;
  if (offer.discountAmountMinor) return `₪${offer.discountAmountMinor / 100} off`;
  return offer.label;
}

function StorefrontRow({
  creatorId,
  framed,
  pages,
  recommendations,
  storefrontHandle,
  title,
}: {
  creatorId: string;
  framed?: boolean | undefined;
  pages: CreatorStorefront['curatedSections'];
  recommendations: RecommendationCard[];
  storefrontHandle: string;
  title: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  function scroll(direction: number) {
    row.current?.scrollBy({
      behavior: 'smooth',
      left: direction * Math.min(760, row.current.clientWidth * 0.8),
    });
  }
  return (
    <section
      className={`referenceStorefrontRow${framed ? ' referenceCollectionFrame' : ''}`}
    >
      <header>
        <div>
          <h3>{title}</h3>
          <p>
            {recommendations.length
              ? `${recommendations.length} ${recommendations.length === 1 ? 'item' : 'items'}`
              : `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`}
          </p>
        </div>
        {recommendations.length ? (
          <div>
            <button
              aria-label={`Previous ${title}`}
              onClick={() => scroll(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
            <button aria-label={`Next ${title}`} onClick={() => scroll(1)} type="button">
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
        ) : null}
      </header>
      {recommendations.length ? (
        <div className="referenceStorefrontScroller" ref={row}>
          {recommendations.map((recommendation) => (
            <RecommendationCardView
              creatorId={creatorId}
              key={recommendation.id}
              recommendation={recommendation}
              showPrice={false}
            />
          ))}
        </div>
      ) : null}
      {pages.length ? (
        <div className="referenceCollectionPages">
          {pages.map((page) => (
            <Link
              href={`/${encodeURIComponent(storefrontHandle)}/pages/${page.id}`}
              key={page.id}
            >
              <span>PRODUCT PAGE</span>
              <strong>{page.title}</strong>
              <small>{page.recommendationIds.length} picks →</small>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function groupRecommendations(
  storefront: CreatorStorefront,
  recommendations: RecommendationCard[],
) {
  const sections = storefront.storefrontSections ?? [];
  const curatedSections = storefront.curatedSections ?? [];
  const contentOrder = Array.isArray(storefront.contentOrder)
    ? storefront.contentOrder
    : [];
  if (contentOrder.length) {
    // A curated group owns its selected products regardless of where its layer sits.
    // Category rows must not consume them before the collection is rendered.
    const curatedProductIds = new Set(
      curatedSections
        .filter(({ kind }) => kind !== 'page')
        .flatMap(({ recommendationIds }) => recommendationIds),
    );
    const used = new Set<string>();
    const rows: Array<{
      items: RecommendationCard[];
      key: string;
      title: string;
      framed?: boolean;
    }> = [];
    for (const layer of contentOrder) {
      if (layer.kind === 'collection' || layer.kind === 'section') {
        const section = curatedSections.find(
          ({ id, kind }) => id === layer.id && kind === layer.kind,
        );
        const items =
          section?.recommendationIds.flatMap(
            (id) => recommendations.find((item) => item.id === id) ?? [],
          ) ?? [];
        items.forEach(({ id }) => used.add(id));
        if (
          items.length ||
          curatedSections.some(
            (page) => page.kind === 'page' && page.parentCollectionId === layer.id,
          )
        )
          rows.push({
            items,
            key: layer.id,
            title: section?.title ?? 'Collection',
            framed: layer.kind === 'collection',
          });
      } else if (layer.kind === 'recommendation') {
        const item = recommendations.find(
          ({ id }) => id === layer.id && !used.has(id) && !curatedProductIds.has(id),
        );
        if (item) {
          used.add(item.id);
          rows.push({ items: [item], key: item.id, title: item.brandName });
        }
      } else if (layer.kind === 'category') {
        const category = sections.find(({ id }) => id === layer.id);
        const items = category
          ? recommendations.filter(
              (item) =>
                item.category.slug === category.slug &&
                !used.has(item.id) &&
                !curatedProductIds.has(item.id),
            )
          : [];
        items.forEach(({ id }) => used.add(id));
        if (items.length)
          rows.push({ items, key: layer.id, title: category?.name ?? 'Category' });
      }
    }
    for (const section of curatedSections.filter(({ kind }) => kind !== 'page')) {
      if (contentOrder.some(({ kind, id }) => kind === section.kind && id === section.id))
        continue;
      const items = section.recommendationIds.flatMap(
        (id) => recommendations.find((item) => item.id === id) ?? [],
      );
      items.forEach(({ id }) => used.add(id));
      if (
        items.length ||
        curatedSections.some(
          (page) => page.kind === 'page' && page.parentCollectionId === section.id,
        )
      )
        rows.push({
          items,
          key: section.id,
          title: section.title,
          framed: section.kind === 'collection',
        });
    }
    for (const category of sections) {
      if (contentOrder.some(({ kind, id }) => kind === 'category' && id === category.id))
        continue;
      const items = recommendations.filter(
        (item) =>
          item.category.slug === category.slug &&
          !used.has(item.id) &&
          !curatedProductIds.has(item.id),
      );
      items.forEach(({ id }) => used.add(id));
      if (items.length) rows.push({ items, key: category.id, title: category.name });
    }
    const remaining = recommendations.filter(({ id }) => !used.has(id));
    if (remaining.length)
      rows.push({ items: remaining, key: 'more', title: 'More picks' });
    return rows;
  }
  if (!sections.length && !curatedSections.some(({ kind }) => kind !== 'page'))
    return recommendations.length
      ? [{ items: recommendations, key: 'all', title: 'More picks' }]
      : [];
  const used = new Set<string>();
  const rows: Array<{
    items: RecommendationCard[];
    key: string;
    title: string;
    framed?: boolean;
  }> = curatedSections
    .filter(({ kind }) => kind !== 'page')
    .flatMap((section) => {
      const items = section.recommendationIds.flatMap(
        (id) => recommendations.find((item) => item.id === id) ?? [],
      );
      if (
        !items.length &&
        !curatedSections.some(
          (page) => page.kind === 'page' && page.parentCollectionId === section.id,
        )
      )
        return [];
      items.forEach(({ id }) => used.add(id));
      return [
        {
          items,
          key: section.id,
          title: section.title,
          framed: section.kind === 'collection',
        },
      ];
    });
  rows.push(
    ...sections.flatMap((category) => {
      const items = recommendations.filter(
        (item) => item.category.slug === category.slug && !used.has(item.id),
      );
      if (!items.length) return [];
      items.forEach(({ id }) => used.add(id));
      return [{ items, key: category.slug, title: category.name }];
    }),
  );
  const remaining = recommendations.filter(({ id }) => !used.has(id));
  if (remaining.length) rows.push({ items: remaining, key: 'more', title: 'More picks' });
  return rows;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function brandKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[’'`´]/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLocaleLowerCase('he-IL');
}

async function loadCreatorInventory<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '48' });
    if (cursor) query.set('cursor', cursor);
    const page = await apiCollectionRequest<T>(`${path}?${query.toString()}`);
    items.push(...page.data);
    cursor = page.page.nextCursor;
  } while (cursor);
  return items;
}

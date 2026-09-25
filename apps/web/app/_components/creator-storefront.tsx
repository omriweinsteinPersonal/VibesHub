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
  CreatorDiscountCode,
  CreatorRecommendation,
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
  type PointerEvent,
} from 'react';

import { apiCollectionRequest, apiRequest } from '../../lib/api';
import { connectorLabel } from '../../lib/creator-connectors';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { storefrontEditOrder, type StorefrontLayer } from '../../lib/storefront-order';
import { textOnAccent } from '../../lib/storefront-theme';
import { StorefrontViewTracker, TrackedInstagramLink } from './analytics-events';
import { CreatorConnectorIcon } from './creator-connector-icon';
import { EngagementProvider } from './engagement';
import { RecommendationCardView } from './recommendation-card';

export function CreatorStorefrontView({
  codes,
  editable = false,
  recommendations,
  storefront,
}: {
  codes: PublicDiscountCode[];
  editable?: boolean;
  recommendations: RecommendationCard[];
  storefront: CreatorStorefront;
}) {
  const [previewBrandOrder, setPreviewBrandOrder] = useState<string[]>(
    storefront.brandOrder ?? [],
  );
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [previewTitles, setPreviewTitles] = useState<StorefrontTitle[]>(
    storefront.titles ?? [],
  );
  const [query, setQuery] = useState('');
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<StorefrontTheme>(
    storefront.theme ?? defaultStorefrontTheme,
  );
  const [canEdit, setCanEdit] = useState(editable);
  const [configuration, setConfiguration] =
    useState<CreatorStorefrontConfiguration | null>(null);
  const [order, setOrder] = useState<StorefrontLayer[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const suppressClick = useRef(false);
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
        selectedBlock?: string | null;
        editingContent?: boolean;
        type?: string;
      };
      if (data.type !== 'swave:theme-preview' || data.creatorId !== storefront.id) return;
      const parsed = storefrontThemeSchema.safeParse(data.theme);
      if (parsed.success) setPreviewTheme(parsed.data);
      const titles = storefrontTitlesSchema.safeParse(data.titles);
      if (titles.success) setPreviewTitles(titles.data);
      if (
        Array.isArray(data.brandOrder) &&
        data.brandOrder.every((id) => typeof id === 'string')
      )
        setPreviewBrandOrder(data.brandOrder);
      setSelectedBlock(data.selectedBlock ?? null);
      setEditingContent(data.editingContent === true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [storefront.id]);
  useEffect(() => {
    if (editable) return;
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
    Promise.all([
      apiRequest<CreatorStorefrontConfiguration>('/creator/studio/storefront-sections'),
      loadCreatorInventory<CreatorRecommendation>('/creator/recommendations'),
      loadCreatorInventory<CreatorDiscountCode>('/creator/discount-codes'),
    ])
      .then(([value, inventory, discounts]) => {
        if (!active) return;
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
        setOrder(storefrontEditOrder(cleaned, recommendations, codes));
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
  const orderedStorefront = useMemo(
    () => ({ ...storefront, contentOrder }),
    [storefront, contentOrder],
  );
  const labels = useMemo(
    () => configuration?.labels ?? storefront.labels ?? [],
    [configuration?.labels, storefront.labels],
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('he-IL');
    const label = labels.find(({ id }) => id === activeLabelId);
    return recommendations.filter((item) => {
      const matchesLabel =
        !label ||
        (label.categorySlug
          ? item.category.slug === label.categorySlug
          : label.recommendationIds.includes(item.id));
      const matchesSearch =
        !term ||
        [item.productName, item.brandName, item.review.value, item.category.name].some(
          (value) => value.toLocaleLowerCase('he-IL').includes(term),
        );
      return matchesLabel && matchesSearch;
    });
  }, [activeLabelId, labels, query, recommendations]);
  const rows = useMemo(() => {
    const brandNames = new Set(
      storefront.brands.map(({ name }) => name.toLocaleLowerCase()),
    );
    return groupRecommendations(
      orderedStorefront,
      filtered.filter(({ brandName }) => !brandNames.has(brandName.toLocaleLowerCase())),
    );
  }, [filtered, orderedStorefront, storefront.brands]);
  const blocks = useMemo(() => {
    const remainingRows = [...rows];
    const remainingCodes = codes.filter(({ brandId }) => !brandId);
    const result: Array<{
      key: string;
      layer: StorefrontLayer | null;
      row?: (typeof rows)[number];
      code?: PublicDiscountCode;
    }> = [];
    for (const layer of contentOrder) {
      if (layer.kind === 'discount') {
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
  }, [rows, codes, contentOrder]);
  async function saveOrder(nextOrder: StorefrontLayer[], previous: StorefrontLayer[]) {
    if (!configuration || savingOrder) return;
    setSavingOrder(true);
    setOrderError('');
    try {
      const saved = await apiRequest<CreatorStorefrontConfiguration>(
        '/creator/studio/storefront-sections',
        {
          method: 'PUT',
          headers: { 'if-match': `"${configuration.version}"` },
          body: JSON.stringify({
            categoryIds: configuration.sections.map(({ category }) => category.id),
            curatedSections: configuration.curatedSections.map(
              ({
                id,
                kind,
                brandId,
                title,
                description,
                imageUrl,
                parentCollectionId,
                recommendationIds,
                showItemsIndividually,
              }) => ({
                id,
                kind,
                brandId,
                title,
                description,
                imageUrl,
                parentCollectionId,
                recommendationIds,
                showItemsIndividually,
              }),
            ),
            contentOrder: nextOrder,
            labels: configuration.labels,
          }),
        },
      );
      setConfiguration(saved);
      setOrder(storefrontEditOrder(saved, recommendations, codes));
    } catch (cause) {
      setOrder(previous);
      setOrderError(
        cause instanceof Error
          ? cause.message
          : 'Could not save the new order. Please try again.',
      );
    } finally {
      setSavingOrder(false);
      setDragSource(null);
      setDropTarget(null);
    }
  }
  function moveLayer(source: string, target: string) {
    if (savingOrder || source === target) return;
    const nextOrder = reorderLayers(order, source, target);
    if (nextOrder === order) return;
    setOrder(nextOrder);
    void saveOrder(nextOrder, order);
  }
  const validTargets = new Set([
    ...storefront.brands.map(({ id }) => id),
    ...rows.map(({ key }) => key),
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
        return (
          <Tag
            key={title.id}
            dir="auto"
            className={`storefrontContentTitle storefrontContentTitle-${title.size} storefrontContentText-${title.format ?? 'heading'}`}
            data-editor-block={title.id}
            data-selected={selectedBlock === title.id}
            style={{
              textAlign: title.align,
              ...(title.appearance === 'card'
                ? {
                    background: title.background ?? '#f1e8dc',
                    padding: { small: 12, medium: 20, large: 28 }[
                      title.padding ?? 'small'
                    ],
                    borderRadius: { square: 0, rounded: 10, soft: 20 }[
                      title.radius ?? 'rounded'
                    ],
                  }
                : {}),
            }}
          >
            {title.text}
          </Tag>
        );
      });
  }
  return (
    <EngagementProvider
      creatorIds={[storefront.id]}
      productIds={recommendations.map(({ productId }) => productId)}
    >
      <div
        className="creatorStorefrontCanvas"
        data-editing-content={canEdit && editingContent}
        onClickCapture={(event) => {
          if (
            !canEdit ||
            window.parent === window ||
            !new URLSearchParams(window.location.search).has('mobilePreview')
          )
            return;
          const target = event.target as HTMLElement;
          const block = target.closest<HTMLElement>('[data-editor-block]');
          if (
            block &&
            !target.closest('input, button') &&
            (editingContent || !target.closest('a'))
          ) {
            event.preventDefault();
            event.stopPropagation();
            window.parent.postMessage(
              {
                type: 'swave:block-select',
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
            { type: 'swave:theme-select', creatorId: storefront.id, section },
            window.location.origin,
          );
        }}
        style={
          {
            '--sf-profile': previewTheme.profileBackground,
            '--sf-page': previewTheme.recommendationsBackground,
            '--sf-product': previewTheme.productBackground,
            '--sf-discount': previewTheme.discountBackground,
            '--sf-collection': previewTheme.collectionBackground,
            '--sf-accent': previewTheme.accentColor,
            '--sf-accent-ink': textOnAccent(previewTheme.accentColor),
            '--sf-text': previewTheme.textColor,
          } as CSSProperties
        }
      >
        <StorefrontViewTracker creatorId={storefront.id} />
        <section className="referenceStorefrontHero">
          <div
            className={`referenceStorefrontInner${storefront.socialLinks.length ? '' : ' noConnectors'}`}
          >
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
              <p>
                {storefront.primaryCategory.name} <span>@{storefront.handle}</span>
              </p>
            </div>
            {storefront.socialLinks.length ? (
              <nav
                aria-label="Creator links"
                className="referenceStorefrontActions referenceConnectors"
              >
                {storefront.socialLinks.map((link) => {
                  const label = connectorLabel(link.platform);
                  const content = (
                    <>
                      <CreatorConnectorIcon platform={link.platform} />
                      <span className="srOnly">{label}</span>
                    </>
                  );
                  return link.platform === 'instagram' ? (
                    <TrackedInstagramLink
                      className="referenceConnectorLink"
                      creatorId={storefront.id}
                      href={link.url}
                      key={link.platform}
                      title={label}
                    >
                      {content}
                    </TrackedInstagramLink>
                  ) : (
                    <a
                      className="referenceConnectorLink"
                      href={link.url}
                      key={link.platform}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={label}
                    >
                      {content}
                    </a>
                  );
                })}
              </nav>
            ) : null}
          </div>
        </section>

        <section className="referenceStorefrontProducts">
          {labels.length ? (
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
                  onClick={() => setActiveLabelId(label.id)}
                  type="button"
                >
                  {label.title}
                </button>
              ))}
            </nav>
          ) : null}
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
          {storefront.brands
            .filter((brand) =>
              filtered.some(
                (item) =>
                  item.brandName.toLocaleLowerCase() === brand.name.toLocaleLowerCase(),
              ),
            )
            .sort((a, b) => {
              const ai = previewBrandOrder.indexOf(a.id),
                bi = previewBrandOrder.indexOf(b.id);
              return (ai < 0 ? 1000 : ai) - (bi < 0 ? 1000 : bi);
            })
            .map((brand) => (
              <Fragment key={brand.id}>
                {renderTitles(brand.id)}
                <div
                  data-editor-block={brand.id}
                  data-selected={selectedBlock === brand.id}
                >
                  <BrandBlock
                    brand={brand}
                    collections={storefront.curatedSections.filter(
                      (section) =>
                        section.kind === 'collection' &&
                        section.brandId === brand.brandId,
                    )}
                    creatorId={storefront.id}
                    handle={storefront.handle}
                    items={filtered.filter(
                      (item) =>
                        item.brandName.toLocaleLowerCase() ===
                        brand.name.toLocaleLowerCase(),
                    )}
                    offer={
                      codes.find(
                        (code) => code.brandId === brand.id && code.scopeKind === 'brand',
                      ) ?? null
                    }
                    key={brand.id}
                  />
                </div>
              </Fragment>
            ))}
          {storefront.curatedSections.some(
            (section) => section.kind === 'page' && !section.parentCollectionId,
          ) ? (
            <div className="referenceStandalonePages referenceCollectionPages">
              {storefront.curatedSections
                .filter(
                  (section) => section.kind === 'page' && !section.parentCollectionId,
                )
                .map((page) => (
                  <Link
                    href={`/creators/${encodeURIComponent(storefront.handle)}/pages/${page.id}`}
                    key={page.id}
                  >
                    <span>PRODUCT PAGE</span>
                    <strong>{page.title}</strong>
                    <small>{page.recommendationIds.length} picks →</small>
                  </Link>
                ))}
            </div>
          ) : null}
          {orderError ? (
            <p className="formError" role="alert">
              {orderError}
            </p>
          ) : null}
          {!blocks.length &&
          !storefront.curatedSections.some(({ kind }) => kind === 'page')
            ? null
            : blocks.map(({ key, layer, row, code }) => {
                const productContent = row ? (
                  <StorefrontRow
                    creatorId={storefront.id}
                    framed={row.framed}
                    pages={storefront.curatedSections.filter(
                      (section) =>
                        section.kind === 'page' && section.parentCollectionId === row.key,
                    )}
                    recommendations={row.items}
                    storefrontHandle={storefront.handle}
                    title={row.title}
                  />
                ) : code ? (
                  <DiscountBlock code={code} />
                ) : null;
                const content = (
                  <>
                    {renderTitles(row?.key ?? code?.id ?? key)}
                    {productContent}
                  </>
                );
                if (!canEdit || !configuration || !layer || query)
                  return <div key={key}>{content}</div>;
                const layerKey = `${layer.kind}:${layer.id}`;
                const draggableBlocks = blocks.filter(({ layer: item }) => item);
                const position = draggableBlocks.findIndex(
                  ({ layer: item }) => item?.kind === layer.kind && item.id === layer.id,
                );
                const label = row?.title ?? code?.merchantName ?? 'Recommendation';
                return (
                  <div
                    aria-label={`${label}. Drag to change its position, or use the arrow keys.`}
                    className="storefrontDraggableBlock"
                    data-dragging={dragSource === layerKey}
                    data-drop-target={dropTarget === layerKey}
                    data-storefront-layer={layerKey}
                    key={key}
                    onClickCapture={(event) => {
                      if (!suppressClick.current) return;
                      event.preventDefault();
                      event.stopPropagation();
                      suppressClick.current = false;
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                    onDragStartCapture={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || savingOrder) return;
                      const offset =
                        event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
                      if (!offset) return;
                      const target = draggableBlocks[position + offset]?.layer;
                      if (!target) return;
                      event.preventDefault();
                      void moveLayer(layerKey, `${target.kind}:${target.id}`);
                    }}
                    onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
                      if (
                        savingOrder ||
                        (event.pointerType === 'mouse' && event.button !== 0)
                      )
                        return;
                      const pointerId = event.pointerId;
                      const isTouch = event.pointerType === 'touch';
                      const gesture = {
                        source: layerKey,
                        startX: event.clientX,
                        startY: event.clientY,
                        active: false,
                        order,
                        changed: false,
                      };
                      const pressTimer = window.setTimeout(() => {
                        gesture.active = true;
                        setDragSource(layerKey);
                      }, 280);
                      const cleanup = () => {
                        window.clearTimeout(pressTimer);
                        window.removeEventListener('pointermove', onMove);
                        window.removeEventListener('pointerup', onUp);
                        window.removeEventListener('pointercancel', onCancel);
                        window.removeEventListener('touchmove', onTouchMove);
                        window.removeEventListener('touchend', onTouchEnd);
                        window.removeEventListener('touchcancel', onTouchCancel);
                        setDragSource(null);
                        setDropTarget(null);
                      };
                      const updatePosition = (x: number, y: number) => {
                        if (!gesture.active) {
                          if (Math.hypot(x - gesture.startX, y - gesture.startY) > 8)
                            window.clearTimeout(pressTimer);
                          return;
                        }
                        const target =
                          document
                            .elementFromPoint(x, y)
                            ?.closest<HTMLElement>('[data-storefront-layer]')?.dataset
                            .storefrontLayer ?? null;
                        if (target && target !== layerKey) {
                          const nextOrder = reorderLayers(
                            gesture.order,
                            layerKey,
                            target,
                          );
                          if (nextOrder !== gesture.order) {
                            gesture.order = nextOrder;
                            gesture.changed = true;
                            setOrder(nextOrder);
                          }
                        }
                        setDropTarget(target);
                        if (y < 64) window.scrollBy(0, -18);
                        else if (y > window.innerHeight - 64) window.scrollBy(0, 18);
                      };
                      const onMove = (pointer: globalThis.PointerEvent) => {
                        if (pointer.pointerId === pointerId)
                          updatePosition(pointer.clientX, pointer.clientY);
                      };
                      const finish = () => {
                        const active = gesture.active;
                        cleanup();
                        if (active) {
                          suppressClick.current = true;
                          if (gesture.changed) void saveOrder(gesture.order, order);
                          window.setTimeout(() => {
                            suppressClick.current = false;
                          }, 400);
                        }
                      };
                      const onUp = (pointer: globalThis.PointerEvent) => {
                        if (pointer.pointerId === pointerId) finish();
                      };
                      const onCancel = (pointer: globalThis.PointerEvent) => {
                        if (pointer.pointerId === pointerId) {
                          if (isTouch && gesture.active) return;
                          cleanup();
                          if (gesture.changed) setOrder(order);
                        }
                      };
                      const onTouchMove = (touch: TouchEvent) => {
                        if (!isTouch) return;
                        if (gesture.active) touch.preventDefault();
                        const point = touch.touches[0];
                        if (point) updatePosition(point.clientX, point.clientY);
                      };
                      const onTouchEnd = () => {
                        if (isTouch) finish();
                      };
                      const onTouchCancel = () => {
                        if (isTouch) {
                          cleanup();
                          if (gesture.changed) setOrder(order);
                        }
                      };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                      window.addEventListener('pointercancel', onCancel);
                      window.addEventListener('touchmove', onTouchMove, {
                        passive: false,
                      });
                      window.addEventListener('touchend', onTouchEnd);
                      window.addEventListener('touchcancel', onTouchCancel);
                    }}
                    tabIndex={0}
                  >
                    {content}
                  </div>
                );
              })}
          {renderTitles(null)}
        </section>
      </div>
    </EngagementProvider>
  );
}

function BrandBlock({
  brand,
  collections,
  creatorId,
  handle,
  items,
  offer,
}: {
  brand: CreatorStorefront['brands'][number];
  collections: CreatorStorefront['curatedSections'];
  creatorId: string;
  handle: string;
  items: RecommendationCard[];
  offer: PublicDiscountCode | null;
}) {
  const collectedIds = new Set(
    collections
      .filter(({ showItemsIndividually }) => !showItemsIndividually)
      .flatMap(({ recommendationIds }) => recommendationIds),
  );
  const standaloneItems = items.filter(({ id }) => !collectedIds.has(id));
  return (
    <section className="referenceBrandBlock">
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
            {offer.discountPercent || offer.label ? (
              <span>
                {offer.discountPercent ? `${offer.discountPercent}% off` : offer.label}
              </span>
            ) : null}
            {offer.code ? <strong>{offer.code}</strong> : null}
          </div>
        ) : null}
      </header>
      {collections.length || standaloneItems.length ? (
        <div className="referenceBrandShelf">
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
                href={`/creators/${encodeURIComponent(handle)}/pages/${collection.id}`}
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
              key={item.id}
              recommendation={item}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DiscountBlock({ code }: { code: PublicDiscountCode }) {
  const brandName =
    code.merchantHostname
      .replace(/^www\./i, '')
      .split('.')[0]
      ?.replaceAll('-', ' ') || code.merchantName;
  const merchantUrl = code.merchantUrl || `https://${code.merchantHostname}`;
  const logoUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(code.merchantHostname)}&sz=64`;
  return (
    <section className="referenceStorefrontCodes referenceDiscountLayer">
      <article>
        <a
          aria-label={`Visit ${brandName}${code.code ? ` with discount code ${code.code}` : ''}`}
          className="referenceDiscountHitArea"
          href={merchantUrl}
          rel="noopener noreferrer"
          target="_blank"
        />
        <div className="referenceDiscountIdentity">
          <Image
            alt=""
            className="referenceDiscountLogo"
            height={36}
            src={logoUrl}
            unoptimized
            width={36}
          />
          <div>
            <p>{brandName}</p>
            <h3>
              {code.label ||
                (code.discountPercent ? `${code.discountPercent}% off` : 'Brand offer')}
            </h3>
          </div>
        </div>
        {code.code ? (
          <p className="referenceDiscountCode">
            <span>Code</span>
            <strong>{code.code}</strong>
          </p>
        ) : (
          <p className="referenceDiscountCode">
            <span>Offer</span>
            <strong>
              {code.discountPercent ? `${code.discountPercent}%` : 'Active'}
            </strong>
          </p>
        )}
      </article>
    </section>
  );
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
              showSave
            />
          ))}
        </div>
      ) : null}
      {pages.length ? (
        <div className="referenceCollectionPages">
          {pages.map((page) => (
            <Link
              href={`/creators/${encodeURIComponent(storefrontHandle)}/pages/${page.id}`}
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

function reorderLayers(order: StorefrontLayer[], source: string, target: string) {
  const from = order.findIndex(({ kind, id }) => `${kind}:${id}` === source);
  const to = order.findIndex(({ kind, id }) => `${kind}:${id}` === target);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

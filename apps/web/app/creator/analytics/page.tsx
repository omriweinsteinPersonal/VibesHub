'use client';

import type {
  CreatorAnalyticsDashboard,
  CreatorStudioSummary,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  MousePointerClick,
  Package,
  Tag,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import { apiRequest } from '../../../lib/api';
import { publicAssetUrl } from '../../../lib/public-asset-url';
import { DelayedLoading } from '../../_components/delayed-loading';
import { InstagramIcon } from '../../_components/instagram-icon';

export default function CreatorAnalyticsPage() {
  const [dashboard, setDashboard] = useState<CreatorAnalyticsDashboard | null>(null);
  const [studio, setStudio] = useState<CreatorStudioSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      apiRequest<CreatorAnalyticsDashboard>('/creator/analytics?days=30'),
      apiRequest<CreatorStudioSummary>('/creator/studio'),
    ])
      .then(([loadedDashboard, loadedStudio]) => {
        setDashboard(loadedDashboard);
        setStudio(loadedStudio);
      })
      .catch((cause: unknown) => setError(messageFor(cause)));
  }, []);

  return (
    <main className="creatorAnalyticsMain">
      <header className="creatorAnalyticsHeading">
        <div>
          <p className="eyebrow">INSIGHTS</p>
          <h1>Analytics</h1>
          <p>How shoppers interact with your storefront — last 30 days.</p>
        </div>
        <Link
          className="button secondary"
          href={studio ? `/${studio.handle}` : '/dashboard'}
        >
          View storefront
        </Link>
      </header>
      {error ? <p className="formError">{error}</p> : null}
      {!dashboard && !error ? (
        <DelayedLoading>Loading your insights…</DelayedLoading>
      ) : null}
      {dashboard ? <AnalyticsDashboard dashboard={dashboard} /> : null}
    </main>
  );
}

function AnalyticsDashboard({ dashboard }: { dashboard: CreatorAnalyticsDashboard }) {
  const [explorerView, setExplorerView] = useState<'brands' | 'categories' | 'products'>(
    'brands',
  );
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<AnalyticsProduct | null>(null);
  const metrics = [
    [Eye, 'Storefront visits', dashboard.summary.storefrontViews],
    [Users, 'Unique visitors', dashboard.summary.uniqueVisitors],
    [MousePointerClick, 'Product clicks', dashboard.summary.shopClicks],
    [Tag, 'Code clicks', dashboard.summary.codeCopies],
  ] as const;
  const brands = useMemo(
    () => groupProducts(dashboard.recommendations, (item) => item.brandName),
    [dashboard.recommendations],
  );
  const categories = useMemo(
    () => groupProducts(dashboard.recommendations, (item) => item.categoryName),
    [dashboard.recommendations],
  );
  const groups = explorerView === 'brands' ? brands : categories;
  return (
    <>
      <section className="creatorAnalyticsPageMetrics">
        {metrics.map(([Icon, label, value]) => (
          <article key={label}>
            <p>
              <Icon aria-hidden="true" size={14} />
              {label}
            </p>
            <strong>{value.toLocaleString('en-IL')}</strong>
          </article>
        ))}
      </section>
      <section className="creatorAnalyticsCard">
        <div className="creatorTrafficHeading">
          <h2>Traffic — last 30 days</h2>
          <span>
            <InstagramIcon aria-hidden="true" size={15} />
            {dashboard.summary.instagramTaps.toLocaleString('en-IL')} Instagram taps
          </span>
        </div>
        <TrafficChart series={dashboard.series} />
      </section>
      {selectedProduct ? (
        <ProductLens product={selectedProduct} onBack={() => setSelectedProduct(null)} />
      ) : (
        <section className="creatorAnalyticsCard productExplorer">
          <div className="productTrafficHeading">
            <div>
              <p className="eyebrow">PRODUCT EXPLORER</p>
              <h2>Your product world</h2>
              <p>Explore your recommendations by brand, category or product.</p>
            </div>
            <span>{dashboard.recommendations.length} products</span>
          </div>
          <div
            className="productExplorerTabs"
            role="tablist"
            aria-label="Product explorer view"
          >
            {[
              ['brands', 'Brands'],
              ['categories', 'Categories'],
              ['products', 'All products'],
            ].map(([value, label]) => (
              <button
                aria-selected={explorerView === value}
                className={explorerView === value ? 'active' : ''}
                key={value}
                onClick={() => {
                  setExplorerView(value as typeof explorerView);
                  setExpandedGroup(null);
                }}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {explorerView === 'products' ? (
            <ProductList
              items={dashboard.recommendations}
              onSelect={setSelectedProduct}
            />
          ) : groups.length ? (
            <div className="productExplorerGroups">
              {groups.map((group) => {
                const groupId = `${explorerView}-${group.name}`;
                const expanded = expandedGroup === groupId;
                return (
                  <article key={groupId}>
                    <button
                      aria-expanded={expanded}
                      onClick={() => setExpandedGroup(expanded ? null : groupId)}
                      type="button"
                    >
                      <span>
                        {expanded ? (
                          <ChevronDown aria-hidden="true" size={18} />
                        ) : (
                          <ChevronRight aria-hidden="true" size={18} />
                        )}
                        <span>
                          <strong>{group.name}</strong>
                          <small>
                            {group.items.length} products · {group.categories.join(', ')}
                          </small>
                        </span>
                      </span>
                      <b>{group.shopClicks.toLocaleString('en-US')} clicks</b>
                    </button>
                    {expanded ? (
                      <ProductList items={group.items} onSelect={setSelectedProduct} />
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="creatorAnalyticsEmpty">No recommendations yet.</div>
          )}
        </section>
      )}
    </>
  );
}

type AnalyticsProduct = CreatorAnalyticsDashboard['recommendations'][number];

function groupProducts(
  products: AnalyticsProduct[],
  getGroupName: (product: AnalyticsProduct) => string,
) {
  const groups = new Map<string, AnalyticsProduct[]>();
  products.forEach((product) => {
    const name = getGroupName(product);
    groups.set(name, [...(groups.get(name) ?? []), product]);
  });
  return Array.from(groups, ([name, items]) => ({
    categories: Array.from(new Set(items.map((item) => item.categoryName))),
    items,
    name,
    shopClicks: items.reduce((total, item) => total + item.shopClicks, 0),
  })).sort(
    (left, right) =>
      right.shopClicks - left.shopClicks || left.name.localeCompare(right.name),
  );
}

function ProductList({
  items,
  onSelect,
}: {
  items: AnalyticsProduct[];
  onSelect: (product: AnalyticsProduct) => void;
}) {
  return (
    <div className="productExplorerList">
      {items.map((product) => (
        <button key={product.id} onClick={() => onSelect(product)} type="button">
          <ProductThumbnail product={product} />
          <span>
            <strong>{product.productName}</strong>
            <small>
              {product.brandName} · {product.categoryName}
            </small>
          </span>
          <b>{product.shopClicks.toLocaleString('en-US')}</b>
          <ChevronRight aria-hidden="true" size={17} />
        </button>
      ))}
    </div>
  );
}

function ProductLens({
  product,
  onBack,
}: {
  product: AnalyticsProduct;
  onBack: () => void;
}) {
  const metrics = [
    ['Views', product.views],
    ['Shop clicks', product.shopClicks],
    ['Story opens', product.storyOpens],
    ['Code copies', product.codeCopies],
  ] as const;
  return (
    <section className="creatorAnalyticsCard productLens">
      <button className="productLensBack" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to product explorer
      </button>
      <div className="productLensHeading">
        <ProductThumbnail product={product} />
        <div>
          <p className="eyebrow">PRODUCT LENS</p>
          <h2>{product.productName}</h2>
          <p>
            {product.brandName} · {product.categoryName}
          </p>
        </div>
      </div>
      <div className="productLensMetrics">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{value.toLocaleString('en-US')}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductThumbnail({ product }: { product: AnalyticsProduct }) {
  return (
    <span className="productTrafficThumbnail">
      {product.imageUrl ? (
        <Image
          alt=""
          fill
          sizes="48px"
          src={publicAssetUrl(product.imageUrl)}
          unoptimized
        />
      ) : (
        <Package aria-hidden="true" size={19} />
      )}
    </span>
  );
}

function TrafficChart({ series }: { series: CreatorAnalyticsDashboard['series'] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState(320);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setChartWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const width = chartWidth;
    const height = chartWidth < 560 ? 185 : 260;
    const left = chartWidth < 560 ? 30 : 42;
    const top = 18;
    const bottom = 28;
    const maximum = Math.max(
      1,
      ...series.flatMap((item) => [item.storefrontViews, item.shopClicks]),
    );
    const yMax = Math.max(4, Math.ceil(maximum / 2) * 2);
    const point = (value: number, index: number) => ({
      x: left + (index / Math.max(1, series.length - 1)) * (width - left - 16),
      y: top + (1 - value / yMax) * (height - top - bottom),
    });
    const visits = series.map((item, index) => point(item.storefrontViews, index));
    const clicks = series.map((item, index) => point(item.shopClicks, index));
    const path = (points: Array<{ x: number; y: number }>) =>
      points.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' ');
    return { bottom, clicks, height, left, path, top, visits, width, yMax };
  }, [chartWidth, series]);

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!series.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * geometry.width;
    const ratio = (x - geometry.left) / (geometry.width - geometry.left - 16);
    setHovered(
      Math.max(0, Math.min(series.length - 1, Math.round(ratio * (series.length - 1)))),
    );
  }

  const active = hovered === null ? null : series[hovered];
  const activePoint = hovered === null ? null : geometry.visits[hovered];
  return (
    <div className="creatorTrafficChart" ref={chartRef}>
      <svg
        aria-label="Storefront visits and product clicks for the last 30 days"
        onPointerLeave={() => setHovered(null)}
        onPointerMove={move}
        role="img"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      >
        {[0, 1, 2, 3, 4].map((row) => {
          const value = Math.round(geometry.yMax - (row * geometry.yMax) / 4);
          const y =
            geometry.top + (row * (geometry.height - geometry.top - geometry.bottom)) / 4;
          return (
            <g key={row}>
              <line
                className="grid"
                x1={geometry.left}
                x2={geometry.width - 16}
                y1={y}
                y2={y}
              />
              <text x="8" y={y + 4}>
                {value}
              </text>
            </g>
          );
        })}
        <path
          className="visitsArea"
          d={`${geometry.path(geometry.visits)} L ${geometry.visits.at(-1)?.x ?? 0} ${geometry.height - geometry.bottom} L ${geometry.left} ${geometry.height - geometry.bottom} Z`}
        />
        <path className="visitsLine" d={geometry.path(geometry.visits)} />
        <path className="clicksLine" d={geometry.path(geometry.clicks)} />
        {activePoint ? (
          <>
            <line
              className="hoverLine"
              x1={activePoint.x}
              x2={activePoint.x}
              y1={geometry.top}
              y2={geometry.height - geometry.bottom}
            />
            <circle className="hoverDot" cx={activePoint.x} cy={activePoint.y} r="4" />
          </>
        ) : null}
        {series.map((item, index) =>
          index % (chartWidth < 560 ? 7 : 5) === 0 || index === series.length - 1 ? (
            <text
              className="dateLabel"
              key={item.date}
              textAnchor="middle"
              x={geometry.visits[index]?.x}
              y={geometry.height - 8}
            >
              {shortDate(item.date)}
            </text>
          ) : null,
        )}
      </svg>
      {active && activePoint ? (
        <div
          className="creatorChartTooltip"
          style={{
            left: `${(activePoint.x / geometry.width) * 100}%`,
            top: `${(activePoint.y / geometry.height) * 100}%`,
          }}
        >
          <strong>{shortDate(active.date)}</strong>
          <span>Storefront visits: {active.storefrontViews}</span>
          <span>Clicks: {active.shopClicks}</span>
        </div>
      ) : null}
    </div>
  );
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to load analytics.';
}

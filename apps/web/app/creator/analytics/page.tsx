'use client';

import type {
  CreatorAnalyticsDashboard,
  CreatorStudioSummary,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, MousePointerClick, Package, Tag, Users } from 'lucide-react';
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
          href={studio ? `/creator/${studio.handle}` : '/dashboard'}
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
  const [category, setCategory] = useState('all');
  const [product, setProduct] = useState('all');
  const metrics = [
    [Eye, 'Storefront visits', dashboard.summary.storefrontViews],
    [Users, 'Unique visitors', dashboard.summary.uniqueVisitors],
    [MousePointerClick, 'Product clicks', dashboard.summary.shopClicks],
    [Tag, 'Code clicks', dashboard.summary.codeCopies],
  ] as const;
  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          dashboard.recommendations.map((item) => [item.categorySlug, item.categoryName]),
        ).entries(),
      ),
    [dashboard.recommendations],
  );
  const categoryProducts = dashboard.recommendations.filter(
    (item) => category === 'all' || item.categorySlug === category,
  );
  const visibleProducts = categoryProducts.filter(
    (item) => product === 'all' || item.id === product,
  );
  return (
    <>
      <section className="creatorAnalyticsMetrics">
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
      <section className="creatorAnalyticsCard productTrafficCard">
        <div className="productTrafficHeading">
          <div>
            <h2>Product traffic</h2>
            <p>Shop link taps by recommendation</p>
          </div>
          <span>{visibleProducts.length} products</span>
        </div>
        <div className="productTrafficFilters">
          <label>
            Category
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setProduct('all');
              }}
            >
              <option value="all">All categories</option>
              {categories.map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Product
            <select value={product} onChange={(event) => setProduct(event.target.value)}>
              <option value="all">All products</option>
              {categoryProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.productName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {visibleProducts.length ? (
          <div className="productTrafficRows">
            <div className="productTrafficColumns" aria-hidden="true">
              <span>Product</span>
              <span>Clicks</span>
            </div>
            {visibleProducts.map((item) => (
              <div key={item.id}>
                <span className="productTrafficIdentity">
                  <span className="productTrafficThumbnail">
                    {item.imageUrl ? (
                      <Image
                        alt=""
                        fill
                        sizes="48px"
                        src={publicAssetUrl(item.imageUrl)}
                        unoptimized
                      />
                    ) : (
                      <Package aria-hidden="true" size={19} />
                    )}
                  </span>
                  <span className="productTrafficName">
                    <strong>{item.productName}</strong>
                    <small>{item.categoryName}</small>
                  </span>
                </span>
                <strong>{item.shopClicks.toLocaleString('en-IL')}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="creatorAnalyticsEmpty">No products in this category yet.</div>
        )}
      </section>
    </>
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

'use client';

import type {
  CreatorAnalyticsDashboard,
  CreatorStudioSummary,
} from '@vibeshub/contracts';
import Link from 'next/link';
import { createLucideIcon, Eye, MousePointerClick, Tag, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type PointerEvent } from 'react';

import { apiRequest } from '../../../lib/api';
import { CreatorShellHeader } from '../../_components/creator-shell-header';
import { SiteFooter } from '../../_components/site-footer';

const Instagram = createLucideIcon('Instagram', [
  [
    'rect',
    {
      height: '20',
      key: 'instagram-frame',
      rx: '5',
      ry: '5',
      width: '20',
      x: '2',
      y: '2',
    },
  ],
  [
    'path',
    {
      d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z',
      key: 'instagram-lens',
    },
  ],
  [
    'line',
    {
      key: 'instagram-highlight',
      x1: '17.5',
      x2: '17.51',
      y1: '6.5',
      y2: '6.5',
    },
  ],
]);

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
    <div className="creatorShellPage">
      <CreatorShellHeader />
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
          <div className="creatorLoading">Loading your insights…</div>
        ) : null}
        {dashboard ? <AnalyticsDashboard dashboard={dashboard} /> : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function AnalyticsDashboard({ dashboard }: { dashboard: CreatorAnalyticsDashboard }) {
  const metrics = [
    [Eye, 'Storefront visits', dashboard.summary.storefrontViews],
    [Users, 'Unique visitors', dashboard.summary.uniqueVisitors],
    [MousePointerClick, 'Product clicks', dashboard.summary.shopClicks],
    [Tag, 'Code clicks', dashboard.summary.codeCopies],
    [Instagram, 'Instagram taps', dashboard.summary.instagramTaps],
  ] as const;
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
        <h2>Traffic — last 30 days</h2>
        <TrafficChart series={dashboard.series} />
      </section>
      <section className="creatorAnalyticsCard productTrafficCard">
        <h2>Product traffic</h2>
        <p>Taps on “Shop now”, per product.</p>
        {dashboard.recommendations.some(({ shopClicks }) => shopClicks > 0) ? (
          <div className="productTrafficRows">
            {dashboard.recommendations.map((item) => (
              <div key={item.id}>
                <span>{item.productName}</span>
                <strong>{item.shopClicks.toLocaleString('en-IL')}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="creatorAnalyticsEmpty">
            No product clicks yet — clicks show up here as soon as shoppers tap “Shop
            now”.
          </div>
        )}
      </section>
    </>
  );
}

function TrafficChart({ series }: { series: CreatorAnalyticsDashboard['series'] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const width = 1000;
    const height = 300;
    const left = 42;
    const top = 20;
    const bottom = 34;
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
  }, [series]);

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
    <div className="creatorTrafficChart">
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
          index % 5 === 0 || index === series.length - 1 ? (
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

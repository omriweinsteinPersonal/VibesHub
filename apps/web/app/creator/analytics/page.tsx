'use client';

import type { CreatorAnalyticsDashboard } from '@vibeshub/contracts';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../../../lib/api';

const ranges = [7, 30, 90] as const;

export default function CreatorAnalyticsPage() {
  const [days, setDays] = useState<(typeof ranges)[number]>(30);
  const [dashboard, setDashboard] = useState<CreatorAnalyticsDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void apiRequest<CreatorAnalyticsDashboard>(`/creator/analytics?days=${days}`)
      .then((result) => {
        if (active) setDashboard(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageFor(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days, revision]);

  function selectRange(range: (typeof ranges)[number]) {
    setDays(range);
    setDashboard(null);
    setError('');
    setLoading(true);
  }

  function retry() {
    setDashboard(null);
    setError('');
    setLoading(true);
    setRevision((current) => current + 1);
  }

  return (
    <main className="workspacePage">
      <header className="workspaceHeader creatorStudioHeader">
        <Link className="logo" href="/">
          <span>✣</span> VibesHub
        </Link>
        <nav aria-label="Creator studio navigation">
          <Link href="/account">Account</Link>
          <Link href="/creator/recommendations">Recommendations</Link>
          <Link href="/creator/discount-codes">Discount codes</Link>
          <Link aria-current="page" href="/creator/analytics">
            Analytics
          </Link>
          <Link href="/creators">Storefronts</Link>
        </nav>
      </header>

      <section className="workspaceContent creatorStudio analyticsStudio">
        <div className="analyticsHeading">
          <div>
            <p className="eyebrow">CREATOR INSIGHTS</p>
            <h1>Analytics</h1>
            <p className="workspaceLead">
              Understand how shoppers discover and act on your recommendations.
            </p>
          </div>
          <div className="analyticsRanges" aria-label="Analytics date range">
            {ranges.map((range) => (
              <button
                aria-pressed={days === range}
                className={days === range ? 'active' : ''}
                key={range}
                onClick={() => selectRange(range)}
                type="button"
              >
                {range} days
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="analyticsState" role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={retry} type="button">
              Try again
            </button>
          </div>
        ) : null}

        {loading ? <p className="analyticsState">Loading your insights…</p> : null}

        {dashboard ? <AnalyticsDashboard dashboard={dashboard} /> : null}
      </section>
    </main>
  );
}

function AnalyticsDashboard({ dashboard }: { dashboard: CreatorAnalyticsDashboard }) {
  const metrics = [
    ['Storefront visits', dashboard.summary.storefrontViews],
    ['Unique visitor sessions', dashboard.summary.uniqueVisitors],
    ['Product views', dashboard.summary.recommendationViews],
    ['Shop clicks', dashboard.summary.shopClicks],
    ['Code copies', dashboard.summary.codeCopies],
  ] as const;

  return (
    <>
      <div className="analyticsMetricGrid">
        {metrics.map(([label, value]) => (
          <article className="analyticsMetric" key={label}>
            <p>{label}</p>
            <strong>{value.toLocaleString('en-IL')}</strong>
          </article>
        ))}
      </div>

      <section className="workspaceCard analyticsChartCard">
        <div>
          <p className="eyebrow">DAILY ACTIVITY</p>
          <h2>Storefront visits</h2>
        </div>
        <LineChart series={dashboard.series} />
        <div className="analyticsChartLegend" aria-hidden="true">
          <span>{formatDate(dashboard.range.from)}</span>
          <span>{formatDate(dashboard.range.to)}</span>
        </div>
      </section>

      <section className="workspaceCard analyticsTableCard">
        <div>
          <p className="eyebrow">PRODUCT PERFORMANCE</p>
          <h2>Top recommendations</h2>
        </div>
        {dashboard.recommendations.length ? (
          <div className="analyticsTableScroll">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Views</th>
                  <th>Shop clicks</th>
                  <th>Code copies</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recommendations.map((recommendation) => (
                  <tr key={recommendation.id}>
                    <th scope="row">{recommendation.productName}</th>
                    <td>{recommendation.views.toLocaleString('en-IL')}</td>
                    <td>{recommendation.shopClicks.toLocaleString('en-IL')}</td>
                    <td>{recommendation.codeCopies.toLocaleString('en-IL')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="analyticsEmpty">
            Publish your first recommendation to start seeing product performance.
          </p>
        )}
      </section>
    </>
  );
}

function LineChart({ series }: { series: CreatorAnalyticsDashboard['series'] }) {
  const geometry = useMemo(() => {
    const width = 1000;
    const height = 250;
    const padding = 16;
    const maximum = Math.max(1, ...series.map((metric) => metric.storefrontViews));
    const points = series.map((metric, index) => {
      const x =
        padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
      const y =
        height - padding - (metric.storefrontViews / maximum) * (height - padding * 2);
      return `${x},${y}`;
    });
    return { height, points: points.join(' '), width };
  }, [series]);

  return (
    <svg
      aria-label="Daily storefront visits line chart"
      className="analyticsChart"
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
    >
      <line x1="16" x2="984" y1="234" y2="234" />
      <polyline points={geometry.points} />
    </svg>
  );
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-IL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to load analytics.';
}

'use client';

import type {
  CreatorAnalyticsDashboard,
  CreatorStudioSummary,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  Eye,
  MousePointerClick,
  Package,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import { apiRequest } from '../../../lib/api';
import { publicAssetUrl } from '../../../lib/public-asset-url';
import { DelayedLoading } from '../../_components/delayed-loading';
import { InstagramIcon } from '../../_components/instagram-icon';
import styles from './analytics.module.css';

type Dashboard = CreatorAnalyticsDashboard;
type Product = Dashboard['recommendations'][number];
type Metric = Dashboard['summary'];
type Range = 7 | 30;
type View = 'brands' | 'categories' | 'products';
type Group = {
  name: string;
  items: Product[];
  clicks: number;
  views: number;
  storyOpens: number;
  codeCopies: number;
};
const number = new Intl.NumberFormat('en-US');

export default function CreatorAnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [previous, setPrevious] = useState<Metric | null>(null);
  const [studio, setStudio] = useState<CreatorStudioSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<CreatorStudioSummary>('/creator/studio')
      .then((value) => {
        if (!cancelled) setStudio(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      apiRequest<Dashboard>(`/creator/analytics?days=${range}`),
      apiRequest<Dashboard>(`/creator/analytics?days=${range * 2}`).catch(() => null),
    ])
      .then(([current, extended]) => {
        if (cancelled) return;
        setDashboard(current);
        setPrevious(extended ? sumMetrics(extended.series.slice(0, range)) : null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(messageFor(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>YOUR AUDIENCE / ANALYTICS</p>
          <h1>See what resonates.</h1>
          <p className={styles.lede}>A clear view of what people explore on your page.</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.rangeControl}>
            <span className={styles.visuallyHidden}>Date range</span>
            <select
              value={range}
              onChange={(event) => {
                setLoading(true);
                setError('');
                setDashboard(null);
                setPrevious(null);
                setRange(Number(event.target.value) as Range);
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </label>
          {studio ? (
            <Link
              className={styles.viewPage}
              href={`/${encodeURIComponent(studio.handle)}`}
            >
              <ArrowUpRight aria-hidden="true" size={16} /> View page
            </Link>
          ) : null}
        </div>
      </header>
      {error ? (
        <div className={styles.error} role="alert">
          {error} Refresh the page to try again.
        </div>
      ) : null}
      {loading && !dashboard && !error ? (
        <DelayedLoading>Loading your insights…</DelayedLoading>
      ) : null}
      {dashboard && !error ? (
        <AnalyticsDashboard
          dashboard={dashboard}
          previous={previous}
          range={range}
          loading={loading}
        />
      ) : null}
    </main>
  );
}

function AnalyticsDashboard({
  dashboard,
  previous,
  range,
  loading,
}: {
  dashboard: Dashboard;
  previous: Metric | null;
  range: Range;
  loading: boolean;
}) {
  const [view, setView] = useState<View>('brands');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const products = dashboard.recommendations;
  const selectedProduct = products.find((item) => item.id === selectedProductId) ?? null;
  const groups = useMemo(() => groupProducts(products, view), [products, view]);
  const activeGroup = groups.find((item) => item.name === selectedGroup) ?? null;
  const topProducts = useMemo(
    () =>
      [...products]
        .filter((item) => item.shopClicks > 0)
        .sort((a, b) => b.shopClicks - a.shopClicks || b.views - a.views)
        .slice(0, 4),
    [products],
  );
  const standout = topProducts[0];
  const metrics = [
    {
      label: 'Page views',
      value: dashboard.summary.storefrontViews,
      prior: previous?.storefrontViews,
      icon: Eye,
    },
    {
      label: 'Unique visitors',
      value: dashboard.summary.uniqueVisitors,
      prior: previous?.uniqueVisitors,
      icon: UsersRound,
    },
    {
      label: 'Product clicks',
      value: dashboard.summary.shopClicks,
      prior: previous?.shopClicks,
      icon: MousePointerClick,
    },
    {
      label: 'Instagram taps',
      value: dashboard.summary.instagramTaps,
      prior: previous?.instagramTaps,
      icon: InstagramIcon,
    },
  ];
  function openProduct(id: string) {
    setSelectedProductId(id);
    document.getElementById('analytics-explorer')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  }
  return (
    <div aria-busy={loading}>
      <section
        className={styles.metrics}
        aria-label={`Key metrics for the last ${range} days`}
      >
        {metrics.map(({ label, value, prior, icon: Icon }) => (
          <article className={styles.metric} key={label}>
            <div className={styles.metricLabel}>
              <Icon aria-hidden="true" size={16} />
              {label}
            </div>
            <strong>{number.format(value)}</strong>
            <span className={styles.metricChange}>{comparison(value, prior)}</span>
          </article>
        ))}
      </section>
      <div className={styles.primaryGrid}>
        <section className={styles.panel} aria-labelledby="analytics-activity-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="analytics-activity-title">Activity over time</h2>
              <p>How people visit and interact with your page.</p>
            </div>
            <div className={styles.legend}>
              <span>
                <i className={styles.viewsKey} /> Page views
              </span>
              <span>
                <i className={styles.clicksKey} /> Product clicks
              </span>
            </div>
          </div>
          <TrafficChart series={dashboard.series} range={range} />
        </section>
        <section className={styles.panel} aria-labelledby="analytics-most-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="analytics-most-title">Most explored</h2>
              <p>Your most-clicked recommendations.</p>
            </div>
          </div>
          {topProducts.length ? (
            <ol className={styles.ranking}>
              {topProducts.map((product, index) => (
                <li key={product.id}>
                  <button type="button" onClick={() => openProduct(product.id)}>
                    <span className={styles.rank}>{index + 1}</span>
                    <ProductThumbnail product={product} />
                    <span className={styles.rankIdentity}>
                      <strong>{product.productName}</strong>
                      <small>{product.brandName} · recommendation</small>
                    </span>
                    <span className={styles.rankValue}>
                      {number.format(product.shopClicks)}
                      <small>clicks</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
      <div className={styles.secondaryGrid}>
        <section
          className={styles.panel}
          id="analytics-explorer"
          aria-labelledby="analytics-explorer-title"
        >
          {selectedProduct ? (
            <ProductDetail
              product={selectedProduct}
              onBack={() => setSelectedProductId(null)}
            />
          ) : activeGroup ? (
            <GroupDetail
              group={activeGroup}
              kind={view}
              onBack={() => setSelectedGroup(null)}
              onProduct={openProduct}
            />
          ) : (
            <>
              <div className={styles.panelHeading}>
                <div>
                  <h2 id="analytics-explorer-title">Explore your content</h2>
                  <p>See what performs across your recommendations.</p>
                </div>
              </div>
              <div className={styles.tabs} role="tablist" aria-label="Explore content by">
                {(
                  [
                    ['brands', 'Brands'],
                    ['categories', 'Categories'],
                    ['products', 'All products'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={view === key}
                    className={view === key ? styles.activeTab : ''}
                    onClick={() => {
                      setView(key);
                      setSelectedGroup(null);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view === 'products' ? (
                <ProductRows items={products} onProduct={openProduct} />
              ) : groups.length ? (
                <div className={styles.groupRows}>
                  {groups.map((group) => (
                    <button
                      type="button"
                      className={styles.groupRow}
                      key={group.name}
                      onClick={() => setSelectedGroup(group.name)}
                    >
                      <span className={styles.groupIdentity}>
                        <strong>{group.name}</strong>
                        <small>
                          {group.items.length} recommendation
                          {group.items.length === 1 ? '' : 's'}
                        </small>
                      </span>
                      <span className={styles.barTrack}>
                        <span
                          style={{
                            width: `${Math.max(4, (group.clicks / Math.max(1, groups[0]?.clicks ?? 1)) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className={styles.rowCount}>
                        {number.format(group.clicks)}
                      </span>
                      <ChevronRight aria-hidden="true" size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState />
              )}
            </>
          )}
        </section>
        <section className={styles.panel} aria-labelledby="analytics-standout-title">
          <div className={styles.standout}>
            <p className={styles.standoutLabel}>STANDOUT RECOMMENDATION</p>
            {standout ? (
              <>
                <h2 id="analytics-standout-title">{standout.productName}</h2>
                <p>
                  Your most-clicked recommendation for this period. Open it to see the
                  details behind the interest.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroup(null);
                    openProduct(standout.id);
                  }}
                >
                  View product analytics <ArrowUpRight aria-hidden="true" size={16} />
                </button>
                <div className={styles.standoutValue}>
                  <span>Product clicks</span>
                  <strong>{number.format(standout.shopClicks)}</strong>
                </div>
              </>
            ) : (
              <>
                <h2 id="analytics-standout-title">Your next insight starts here.</h2>
                <p>
                  Add a recommendation and share your page to begin seeing what people
                  explore.
                </p>
                <Link href="/dashboard">
                  Open dashboard <ArrowUpRight aria-hidden="true" size={16} />
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function groupProducts(products: Product[], view: View): Group[] {
  if (view === 'products') return [];
  const map = new Map<string, Product[]>();
  for (const item of products) {
    const name = view === 'brands' ? item.brandName : item.categoryName;
    map.set(name, [...(map.get(name) ?? []), item]);
  }
  return [...map]
    .map(([name, items]) => ({
      name,
      items,
      clicks: items.reduce((sum, item) => sum + item.shopClicks, 0),
      views: items.reduce((sum, item) => sum + item.views, 0),
      storyOpens: items.reduce((sum, item) => sum + item.storyOpens, 0),
      codeCopies: items.reduce((sum, item) => sum + item.codeCopies, 0),
    }))
    .sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name));
}

function GroupDetail({
  group,
  kind,
  onBack,
  onProduct,
}: {
  group: Group;
  kind: View;
  onBack: () => void;
  onProduct: (id: string) => void;
}) {
  return (
    <div>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={16} /> All {kind}
      </button>
      <p className={styles.detailEyebrow}>
        {kind === 'brands' ? 'BRAND ANALYTICS' : 'CATEGORY ANALYTICS'}
      </p>
      <h2 className={styles.detailTitle} id="analytics-explorer-title">
        {group.name}
      </h2>
      <p className={styles.detailDescription}>
        Combined activity for {group.items.length} recommendation
        {group.items.length === 1 ? '' : 's'} in this{' '}
        {kind === 'brands' ? 'brand' : 'category'}.
      </p>
      <DetailMetrics
        values={[
          ['Views', group.views],
          ['Product clicks', group.clicks],
          ['Story opens', group.storyOpens],
          ['Code copies', group.codeCopies],
        ]}
      />
      <h3 className={styles.listHeading}>Recommendations</h3>
      <ProductRows items={group.items} onProduct={onProduct} />
    </div>
  );
}

function ProductDetail({ product, onBack }: { product: Product; onBack: () => void }) {
  return (
    <div>
      <button type="button" className={styles.back} onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={16} /> Back to explorer
      </button>
      <div className={styles.productDetailHeading}>
        <ProductThumbnail product={product} />
        <div>
          <p className={styles.detailEyebrow}>PRODUCT ANALYTICS</p>
          <h2 className={styles.detailTitle} id="analytics-explorer-title">
            {product.productName}
          </h2>
          <p className={styles.detailDescription}>
            {product.brandName} · {product.categoryName}
          </p>
        </div>
      </div>
      <DetailMetrics
        values={[
          ['Views', product.views],
          ['Product clicks', product.shopClicks],
          ['Story opens', product.storyOpens],
          ['Code copies', product.codeCopies],
        ]}
      />
      <p className={styles.detailFootnote}>
        Views count recommendation impressions. Product clicks count visits to the linked
        product.
      </p>
    </div>
  );
}

function DetailMetrics({ values }: { values: [string, number][] }) {
  return (
    <div className={styles.detailMetrics}>
      {values.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{number.format(value)}</strong>
        </div>
      ))}
    </div>
  );
}
function ProductRows({
  items,
  onProduct,
}: {
  items: Product[];
  onProduct: (id: string) => void;
}) {
  if (!items.length) return <EmptyState />;
  return (
    <div className={styles.productRows}>
      {items.map((product) => (
        <button type="button" key={product.id} onClick={() => onProduct(product.id)}>
          <ProductThumbnail product={product} />
          <span className={styles.productIdentity}>
            <strong>{product.productName}</strong>
            <small>
              {product.brandName} · {product.categoryName}
            </small>
          </span>
          <span className={styles.rowCount}>
            {number.format(product.shopClicks)} <small>clicks</small>
          </span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      ))}
    </div>
  );
}
function ProductThumbnail({ product }: { product: Product }) {
  return (
    <span className={styles.thumbnail}>
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
function EmptyState() {
  return (
    <p className={styles.empty}>
      No recommendation activity yet. Share your page to start seeing what people explore.
    </p>
  );
}

function TrafficChart({ series, range }: { series: Dashboard['series']; range: Range }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const compact = width < 500;
  const height = compact ? 206 : 260;
  const left = compact ? 34 : 44;
  const top = 12;
  const bottom = 28;
  const plotWidth = width - left - 12;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(
    4,
    ...series.flatMap((item) => [item.storefrontViews, item.shopClicks]),
  );
  const ceiling = Math.ceil(maxValue / 4) * 4;
  const point = (value: number, index: number) => ({
    x: left + (index / Math.max(1, series.length - 1)) * plotWidth,
    y: top + plotHeight - (value / ceiling) * plotHeight,
  });
  const visits = series.map((item, index) => point(item.storefrontViews, index));
  const clicks = series.map((item, index) => point(item.shopClicks, index));
  const path = (points: typeof visits) =>
    points.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' ');
  const area = visits.length
    ? `${path(visits)} L ${visits.at(-1)?.x} ${top + plotHeight} L ${visits[0]?.x} ${top + plotHeight} Z`
    : '';
  const selected = active === null ? null : series[active];
  const selectedPoint = active === null ? null : visits[active];
  const labelCount = compact ? 3 : 5;
  function onMove(event: PointerEvent<SVGSVGElement>) {
    if (!series.length) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * width;
    setActive(
      Math.min(
        series.length - 1,
        Math.max(0, Math.round(((x - left) / plotWidth) * (series.length - 1))),
      ),
    );
  }
  if (!series.length || !series.some((day) => day.storefrontViews || day.shopClicks))
    return (
      <p className={styles.chartEmpty}>
        No activity for these dates yet. Share your page to start seeing a trend.
      </p>
    );
  return (
    <div className={styles.chart} ref={container}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Page views and product clicks over the last ${range} days`}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const y = top + (index * plotHeight) / 4;
          return (
            <g key={index}>
              <line className={styles.gridLine} x1={left} x2={width - 12} y1={y} y2={y} />
              <text className={styles.axisLabel} x={0} y={y + 4}>
                {number.format((ceiling * (4 - index)) / 4)}
              </text>
            </g>
          );
        })}
        <path className={styles.chartArea} d={area} />
        <path className={styles.viewsLine} d={path(visits)} />
        <path className={styles.clicksLine} d={path(clicks)} />
        {selectedPoint ? (
          <>
            <line
              className={styles.guideLine}
              x1={selectedPoint.x}
              x2={selectedPoint.x}
              y1={top}
              y2={top + plotHeight}
            />
            <circle
              className={styles.point}
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r="5"
            />
          </>
        ) : null}
        {Array.from({ length: labelCount }, (_, index) => {
          const dataIndex = Math.round((index * (series.length - 1)) / (labelCount - 1));
          const item = series[dataIndex];
          return item ? (
            <text
              key={index}
              className={styles.axisLabel}
              x={visits[dataIndex]?.x}
              y={height - 5}
              textAnchor={
                index === 0 ? 'start' : index === labelCount - 1 ? 'end' : 'middle'
              }
            >
              {shortDate(item.date)}
            </text>
          ) : null;
        })}
      </svg>
      {selected && selectedPoint ? (
        <div
          className={styles.chartTooltip}
          style={{
            left: `${Math.max(14, Math.min(83, (selectedPoint.x / width) * 100))}%`,
            top: `${Math.max(5, (selectedPoint.y / height) * 100)}%`,
          }}
        >
          <strong>{longDate(selected.date)}</strong>
          <span>{number.format(selected.storefrontViews)} page views</span>
          <span>{number.format(selected.shopClicks)} product clicks</span>
        </div>
      ) : null}
      <details className={styles.dailyDetails}>
        <summary>View daily numbers</summary>
        <div className={styles.dailyTableWrap}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Page views</th>
                <th>Product clicks</th>
              </tr>
            </thead>
            <tbody>
              {series.map((day) => (
                <tr key={day.date}>
                  <td>{longDate(day.date)}</td>
                  <td>{number.format(day.storefrontViews)}</td>
                  <td>{number.format(day.shopClicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function sumMetrics(series: Dashboard['series']): Metric {
  return series.reduce(
    (total, item) => ({
      codeCopies: total.codeCopies + item.codeCopies,
      instagramTaps: total.instagramTaps + item.instagramTaps,
      recommendationViews: total.recommendationViews + item.recommendationViews,
      shopClicks: total.shopClicks + item.shopClicks,
      storyCompletions: total.storyCompletions + item.storyCompletions,
      storyOpens: total.storyOpens + item.storyOpens,
      storefrontViews: total.storefrontViews + item.storefrontViews,
      uniqueVisitors: total.uniqueVisitors + item.uniqueVisitors,
    }),
    {
      codeCopies: 0,
      instagramTaps: 0,
      recommendationViews: 0,
      shopClicks: 0,
      storyCompletions: 0,
      storyOpens: 0,
      storefrontViews: 0,
      uniqueVisitors: 0,
    },
  );
}
function comparison(current: number, previous: number | undefined): string {
  if (previous === undefined) return 'Previous period unavailable';
  if (previous === 0)
    return current === 0 ? 'No change from previous period' : 'New activity this period';
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? '↑ ' : change < 0 ? '↓ ' : ''}${Math.abs(change)}% vs previous period`;
}
function shortDate(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`;
}
function longDate(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to load analytics.';
}

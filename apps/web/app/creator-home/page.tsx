'use client';

import type { CreatorAnalyticsDashboard, CreatorStudioSummary } from '@vibeshub/contracts';
import Link from 'next/link';
import { ArrowUpRight, Eye, MousePointerClick } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../../lib/api';
import { DelayedLoading } from '../_components/delayed-loading';
import styles from './creator-home.module.css';

type Dashboard = CreatorAnalyticsDashboard;

const number = new Intl.NumberFormat('en-US');

export default function CreatorHomePage() {
  const [summary, setSummary] = useState<CreatorStudioSummary | null>(null);
  const [analytics, setAnalytics] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<CreatorStudioSummary>('/creator/studio')
      .then((value) => {
        if (active) setSummary(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(messageFor(cause));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<Dashboard>('/creator/analytics?days=7')
      .then((value) => {
        if (active) setAnalytics(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main className={styles.main}>
        <p className="formError" role="alert">
          {error}
        </p>
      </main>
    );
  }

  if (!summary) {
    return (
      <main aria-busy="true" className={styles.main}>
        <DelayedLoading delay={180}>
          <span className="srOnly">Opening your studio…</span>
          <CreatorHomeSkeleton />
        </DelayedLoading>
      </main>
    );
  }

  const firstName = summary.displayName.trim().split(/\s+/)[0] || summary.displayName;
  const storefrontHref = `/creator/${encodeURIComponent(summary.handle)}`;
  const previewUrl = `/${encodeURIComponent(summary.handle)}?mobilePreview=1`;

  return (
    <main className={styles.main} id="creator-home-main">
      <header className={styles.greeting}>
        <h1>Hey, {firstName}.</h1>
      </header>

      <div className={styles.homeGrid}>
        <section aria-labelledby="storefront-preview-title" className={styles.storefrontCard}>
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.kicker}>YOUR STOREFRONT</p>
              <h2 id="storefront-preview-title">Your page, as it is right now.</h2>
            </div>
            <span className={styles.liveStatus}>
              <i aria-hidden="true" /> Live
            </span>
          </div>

          <Link
            aria-label={`Open ${summary.displayName}'s storefront`}
            className={styles.storefrontPreview}
            href={storefrontHref}
          >
            <div aria-hidden="true" className={styles.previewViewport}>
              <iframe
                className={styles.previewFrame}
                scrolling="no"
                src={previewUrl}
                tabIndex={-1}
                title={`${summary.displayName}'s live storefront preview`}
              />
            </div>
            <span className={styles.previewScrim} />
            <span className={styles.previewAction}>
              Open storefront <ArrowUpRight aria-hidden="true" size={16} />
            </span>
          </Link>
        </section>

        <section aria-labelledby="page-pulse-title" className={styles.pulseCard}>
          <div className={styles.pulseHeader}>
            <div>
              <p className={styles.kicker}>PAGE PULSE</p>
              <h2 id="page-pulse-title">A glance at your week.</h2>
            </div>
            <span className={styles.range}>Last 7 days</span>
          </div>

          <MiniTrafficChart series={analytics?.series ?? []} />

          <div className={styles.metrics}>
            <Metric icon={Eye} label="Page visits" value={analytics?.summary.storefrontViews ?? 0} />
            <Metric
              icon={MousePointerClick}
              label="Link taps"
              value={analytics?.summary.shopClicks ?? 0}
            />
          </div>

          <Link className={styles.analyticsLink} href="/analytics">
            Open analytics <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className={styles.metric}>
      <span aria-hidden="true" className={styles.metricIcon}>
        <Icon size={15} />
      </span>
      <span>
        <strong>{number.format(value)}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

function MiniTrafficChart({ series }: { series: Dashboard['series'] }) {
  const { clicksPath, hasActivity, viewPath } = useMemo(() => {
    const values = series.flatMap((item) => [item.storefrontViews, item.shopClicks]);
    const max = Math.max(4, ...values);
    const point = (value: number, index: number) => {
      const x = series.length > 1 ? 4 + (index / (series.length - 1)) * 292 : 150;
      const y = 86 - (value / max) * 72;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    return {
      clicksPath: series.map((item, index) => point(item.shopClicks, index)).join(' '),
      hasActivity: values.some(Boolean),
      viewPath: series.map((item, index) => point(item.storefrontViews, index)).join(' '),
    };
  }, [series]);

  return (
    <div className={styles.chartWrap}>
      {hasActivity ? (
        <svg aria-label="Page visits and link taps over the last seven days" role="img" viewBox="0 0 300 96">
          <line className={styles.chartGuide} x1="4" x2="296" y1="14" y2="14" />
          <line className={styles.chartGuide} x1="4" x2="296" y1="50" y2="50" />
          <line className={styles.chartGuide} x1="4" x2="296" y1="86" y2="86" />
          <polyline className={styles.chartVisits} points={viewPath} />
          <polyline className={styles.chartClicks} points={clicksPath} />
        </svg>
      ) : (
        <p>Share your page to start seeing activity here.</p>
      )}
      <span className={styles.chartLegend}>
        <i aria-hidden="true" /> Visits
        <i aria-hidden="true" /> Taps
      </span>
    </div>
  );
}

function CreatorHomeSkeleton() {
  return (
    <div aria-hidden="true" className={styles.skeleton}>
      <span className={styles.skeletonGreeting} />
      <div className={styles.skeletonGrid}>
        <span />
        <span />
      </div>
    </div>
  );
}

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The creator studio could not be opened.';
}

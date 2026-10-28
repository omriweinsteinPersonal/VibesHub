'use client';

import type { CreatorStudioSummary } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Check, Copy, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../lib/api';
import { DelayedLoading } from '../_components/delayed-loading';
import styles from './creator-home.module.css';

export default function CreatorHomePage() {
  const [summary, setSummary] = useState<CreatorStudioSummary | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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

  const storefrontHref = `/creator/${encodeURIComponent(summary.handle)}`;
  const previewUrl = `/${encodeURIComponent(summary.handle)}?mobilePreview=1`;
  const storeUrl =
    typeof window === 'undefined'
      ? `https://swavii.com/${summary.handle}`
      : `${window.location.origin}/${summary.handle}`;
  const shareTitle = `${summary.displayName} on Swavii`;

  async function copyStoreUrl() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_500);
    } catch {
      window.prompt('Copy your storefront link', storeUrl);
    }
  }

  async function shareStoreUrl() {
    if (navigator.share) {
      await navigator.share({
        title: shareTitle,
        url: storeUrl,
      });
      return;
    }
    await copyStoreUrl();
  }

  return (
    <main className={styles.main} id="creator-home-main">
      <div className={styles.homeGrid}>
        <div className={styles.storefrontColumn}>
          <section aria-labelledby="share-storefront-title" className={styles.shareCard}>
            <div className={styles.shareHeading}>
              <h2 id="share-storefront-title">Share your storefront</h2>
            </div>
            <div className={styles.shareUrlRow}>
              <span aria-label="Your storefront address" className={styles.storeUrl}>
                swavii.com/{summary.handle}
              </span>
              <button
                className={styles.copyLinkButton}
                onClick={() => void copyStoreUrl()}
                type="button"
              >
                {copied ? (
                  <Check aria-hidden="true" size={16} />
                ) : (
                  <Copy aria-hidden="true" size={16} />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className={styles.shareActions}>
              <button
                className={styles.shareButton}
                onClick={() => void shareStoreUrl()}
                type="button"
              >
                <Share2 aria-hidden="true" size={16} /> Share
              </button>
            </div>
          </section>

          <section
            aria-labelledby="storefront-preview-title"
            className={styles.storefrontCard}
          >
            <div className={styles.cardHeading}>
              <h2 id="storefront-preview-title">Your storefront</h2>
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
        </div>

        <section
          aria-labelledby="analytics-feature-title"
          className={styles.analyticsFeature}
        >
          <Image
            alt="Swavii creator analytics on a phone"
            className={styles.analyticsFeatureImage}
            fill
            sizes="(max-width: 900px) 100vw, 390px"
            priority
            quality={95}
            src="/images/creator-analytics-feature.jpg"
          />
          <div className={styles.analyticsFeatureShade} />
          <div className={styles.analyticsFeatureCopy}>
            <p className={styles.kicker}>CREATOR ANALYTICS</p>
            <h2 id="analytics-feature-title">See what your audience is discovering.</h2>
            <Link className={styles.analyticsLink} href="/analytics">
              Open analytics <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
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
  return cause instanceof Error
    ? cause.message
    : 'The creator studio could not be opened.';
}

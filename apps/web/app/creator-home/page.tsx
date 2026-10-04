'use client';

import type { CreatorStudioSummary } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  Copy,
  LayoutTemplate,
  Link2,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { DelayedLoading } from '../_components/delayed-loading';
import styles from './creator-home.module.css';

export default function CreatorHomePage() {
  const [summary, setSummary] = useState<CreatorStudioSummary | null>(null);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void apiRequest<CreatorStudioSummary>('/creator/studio')
      .then(setSummary)
      .catch((cause: unknown) => setError(messageFor(cause)));
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyPageLink() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${encodeURIComponent(summary.handle)}`,
      );
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Could not copy the link. Open your page to copy its URL.');
    }
  }

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
  const pageHref = `/${encodeURIComponent(summary.handle)}`;
  const editorHref = `/creator/${encodeURIComponent(summary.handle)}`;

  return (
    <main className={styles.main} id="creator-home-main">
      <section className={styles.welcome}>
        <div className={styles.welcomeCopy}>
          <p className={styles.eyebrow}>CREATOR STUDIO / HOME</p>
          <h1>
            Welcome back,
            <br />
            {firstName}.
          </h1>
          <p>Your page is yours to shape. Pick up wherever inspiration left you.</p>
        </div>
        <div className={styles.portrait}>
          {summary.avatarUrl ? (
            <Image
              alt=""
              fill
              sizes="(max-width: 600px) 58px, 84px"
              src={publicAssetUrl(summary.avatarUrl)}
              unoptimized
            />
          ) : (
            <span aria-hidden="true">
              {summary.displayName
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </span>
          )}
        </div>
      </section>

      <section aria-label="Your storefront" className={styles.pagePanel}>
        <div className={styles.pagePanelCopy}>
          <p className={styles.liveLabel}>
            <span aria-hidden="true" />
            Your page is live
          </p>
          <h2>Your page, ready to share.</h2>
          <p>Every link, photo and recommendation in a space that feels like you.</p>
          <span className={styles.pageUrl}>
            <Link2 aria-hidden="true" size={16} />
            swavii.com/{summary.handle}
          </span>
        </div>
        <div className={styles.pageActions}>
          <Link className={styles.viewButton} href={pageHref}>
            View your page
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
          <button
            className={styles.copyButton}
            onClick={() => void copyPageLink()}
            type="button"
          >
            {copied ? (
              <Check aria-hidden="true" size={16} />
            ) : (
              <Copy aria-hidden="true" size={16} />
            )}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
          </button>
        </div>
      </section>
      {copyError ? (
        <p className={styles.copyError} role="alert">
          {copyError}
        </p>
      ) : null}

      <section aria-labelledby="creator-home-next" className={styles.nextSection}>
        <div className={styles.nextHeading}>
          <div>
            <h2 id="creator-home-next">What would you like to do?</h2>
            <p>Make a change, add a find, or see what resonates.</p>
          </div>
          <Link className={styles.accountLink} href="/account">
            Account settings <ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        </div>
        <div className={styles.actionGrid}>
          <HomeAction
            action="Open dashboard"
            href="/dashboard"
            icon={Plus}
            title="Add to your page"
            tone="clay"
          >
            Share a new recommendation or build a collection.
          </HomeAction>
          <HomeAction
            action="Edit storefront"
            href={editorHref}
            icon={LayoutTemplate}
            title="Make it yours"
            tone="sage"
          >
            Arrange sections and style the page around your point of view.
          </HomeAction>
          <HomeAction
            action="View analytics"
            href="/analytics"
            icon={ChartNoAxesCombined}
            title="See what connects"
            tone="sand"
          >
            Understand which pages, picks and collections draw attention.
          </HomeAction>
        </div>
      </section>
    </main>
  );
}

function HomeAction({
  action,
  children,
  href,
  icon: Icon,
  title,
  tone,
}: {
  action: string;
  children: ReactNode;
  href: string;
  icon: LucideIcon;
  title: string;
  tone: 'clay' | 'sage' | 'sand';
}) {
  return (
    <Link className={`${styles.actionCard} ${styles[tone]}`} href={href}>
      <span aria-hidden="true" className={styles.actionIcon}>
        <Icon size={17} />
      </span>
      <span className={styles.actionTitle}>{title}</span>
      <span className={styles.actionDescription}>{children}</span>
      <span className={styles.actionFoot}>
        {action}
        <ArrowUpRight aria-hidden="true" size={16} />
      </span>
    </Link>
  );
}

function CreatorHomeSkeleton() {
  return (
    <div aria-hidden="true" className={styles.skeleton}>
      <div className={styles.skeletonIntro}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.skeletonPanel} />
      <div className={styles.skeletonCards}>
        <span />
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

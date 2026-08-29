'use client';

import type { CreatorStudioSummary } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api';
import { CreatorShellHeader } from '../_components/creator-shell-header';
import { SiteFooter } from '../_components/site-footer';

export default function CreatorHomePage() {
  const [summary, setSummary] = useState<CreatorStudioSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<CreatorStudioSummary>('/creator/studio')
      .then(setSummary)
      .catch((cause: unknown) => setError(messageFor(cause)));
  }, []);

  return (
    <div className="creatorShellPage">
      <CreatorShellHeader />
      <main className="creatorHomeMain">
        {error ? <p className="formError">{error}</p> : null}
        {!summary && !error ? (
          <div className="creatorLoading">Opening your studio…</div>
        ) : null}
        {summary ? (
          <>
            <section className="creatorWelcome">
              <p className="eyebrow">CREATOR STUDIO</p>
              <div className="creatorWelcomeTitle">
                {summary.avatarUrl ? (
                  <span className="creatorWelcomeAvatar">
                    <Image alt="" fill sizes="84px" src={summary.avatarUrl} unoptimized />
                  </span>
                ) : null}
                <h1>Welcome back, {summary.displayName}</h1>
              </div>
              <p>Everything your storefront needs, in one place.</p>
              <div className="creatorCountPills">
                <span>{summary.counts.recommendations} recommendations</span>
                <span>{summary.counts.brandDiscounts} brand discounts</span>
                <span>{summary.counts.storyClips} story clips</span>
              </div>
            </section>

            <section className="creatorHomeGrid">
              <HomeCard
                icon="▦"
                title="Dashboard"
                href="/dashboard"
                action="Open dashboard"
              >
                Add and edit product recommendations, brand discounts and story clips.
              </HomeCard>
              <HomeCard
                icon="▥"
                title="Analytics"
                href="/analytics"
                action="View analytics"
              >
                Storefront visits, product clicks and Instagram taps — updated live.
              </HomeCard>
              <HomeCard
                icon="▣"
                title="Your storefront"
                href={`/creator/${summary.handle}`}
                action="View storefront"
              >
                See your page exactly as shoppers see it, and share the link.
              </HomeCard>
              <HomeCard icon="⚙" title="Account" href="/account" action="Edit profile">
                Profile photo, bio, category, media kit and your Instagram link.
              </HomeCard>
            </section>

            <section className="creatorQuickTip">
              <span aria-hidden="true">✣</span>
              <p>
                <strong>Quick tip:</strong> paste a product link in the dashboard and
                we&apos;ll pull the photo, brand and price for you — then attach a story
                clip so shoppers see it in action.
              </p>
              <Link className="button primary" href="/dashboard?add=product">
                Add a recommendation
              </Link>
            </section>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function HomeCard({
  action,
  children,
  href,
  icon,
  title,
}: {
  action: string;
  children: ReactNode;
  href: string;
  icon: string;
  title: string;
}) {
  return (
    <article className="creatorHomeCard">
      <span className="creatorHomeIcon" aria-hidden="true">
        {icon}
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      <Link href={href}>{action} ↗</Link>
    </article>
  );
}

function messageFor(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'The creator studio could not be opened.';
}

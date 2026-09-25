'use client';

import type { CreatorStudioSummary } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  ChartColumn,
  LayoutDashboard,
  Plus,
  Settings,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { apiRequest } from '../../lib/api';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { DelayedLoading } from '../_components/delayed-loading';

export default function CreatorHomePage() {
  const [summary, setSummary] = useState<CreatorStudioSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<CreatorStudioSummary>('/creator/studio')
      .then(setSummary)
      .catch((cause: unknown) => setError(messageFor(cause)));
  }, []);

  return (
    <main className="creatorHomeMain">
      {error ? <p className="formError">{error}</p> : null}
      {!summary && !error ? <DelayedLoading>Opening your studio…</DelayedLoading> : null}
      {summary ? (
        <>
          <section className="creatorWelcome">
            <p className="eyebrow">CREATOR STUDIO</p>
            <div className="creatorWelcomeTitle">
              <span className="creatorWelcomeAvatar">
                {summary.avatarUrl ? (
                  <Image
                    alt=""
                    fill
                    sizes="84px"
                    src={publicAssetUrl(summary.avatarUrl)}
                    unoptimized
                  />
                ) : (
                  <b>
                    {summary.displayName
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase()}
                  </b>
                )}
              </span>
              <div className="creatorWelcomeIdentity">
                <h1>Welcome back, {summary.displayName}</h1>
                <p>Everything your storefront needs, in one place.</p>
              </div>
            </div>
            <div className="creatorCountPills">
              <span>
                <strong>{summary.counts.recommendations}</strong> recommendations
              </span>
              <span>
                <strong>{summary.counts.brandDiscounts}</strong> brand discounts
              </span>
              <span>
                <strong>{summary.counts.collections}</strong> collections
              </span>
            </div>
            <Link
              className="button primary creatorWelcomeAction"
              href="/dashboard?add=product"
            >
              <Plus aria-hidden="true" size={17} />
              Add recommendation
            </Link>
          </section>

          <section className="creatorHomeGrid">
            <HomeCard
              icon={LayoutDashboard}
              title="Dashboard"
              href="/dashboard"
              action="Open dashboard"
            >
              Add and edit product recommendations, brand discounts and story clips.
            </HomeCard>
            <HomeCard
              icon={ChartColumn}
              title="Analytics"
              href="/analytics"
              action="View analytics"
            >
              Storefront visits, product clicks and Instagram taps — updated live.
            </HomeCard>
            <HomeCard
              icon={Store}
              title="Your storefront"
              href={`/creator/${summary.handle}`}
              action="View storefront"
            >
              See your page exactly as shoppers see it, and share the link.
            </HomeCard>
            <HomeCard
              icon={Settings}
              title="Account"
              href="/account"
              action="Edit profile"
            >
              Profile photo, bio, category, media kit and your Instagram link.
            </HomeCard>
          </section>
        </>
      ) : null}
    </main>
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
  icon: LucideIcon;
  title: string;
}) {
  const Icon = icon;
  return (
    <article className="creatorHomeCard">
      <span className="creatorHomeIcon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      <Link href={href}>
        {action}
        <ArrowUpRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}

function messageFor(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'The creator studio could not be opened.';
}

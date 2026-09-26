'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { trackClientAnalytics } from '../../lib/analytics';

export function StorefrontViewTracker({ creatorId }: { creatorId: string }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('mobilePreview')) return;
    trackClientAnalytics({ creatorId, name: 'creator.storefrontViewed' });
  }, [creatorId]);
  return null;
}

export function TrackedInstagramLink({
  children,
  className,
  creatorId,
  href,
  title,
}: {
  children: ReactNode;
  className?: string;
  creatorId: string;
  href: string;
  title?: string;
}) {
  function open(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.blur();
    trackClientAnalytics({ creatorId, name: 'creator.instagramTapped' });
  }
  return (
    <a
      className={className}
      href={href}
      onClick={open}
      rel="noreferrer"
      target="_blank"
      title={title}
    >
      {children}
    </a>
  );
}

export function RecommendationImpressionTracker({
  creatorId,
  productId,
  recommendationId,
}: {
  creatorId: string;
  productId: string;
  recommendationId: string;
}) {
  const target = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = target.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sent = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry || sent) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer ??= setTimeout(() => {
            sent = true;
            trackClientAnalytics({
              creatorId,
              name: 'recommendation.impression',
              productId,
              recommendationId,
            });
            observer.disconnect();
          }, 1_000);
        } else if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(node);
    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [creatorId, productId, recommendationId]);

  return <span aria-hidden="true" className="analyticsImpressionTarget" ref={target} />;
}

export function CopyDiscountCodeButton({
  code,
  creatorId,
  discountCodeId,
  recommendationId,
}: {
  code: string;
  creatorId: string;
  discountCodeId: string;
  recommendationId: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      trackClientAnalytics({
        creatorId,
        discountCodeId,
        name: 'discountCode.copied',
        recommendationId,
      });
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      aria-label={`Copy discount code ${code}`}
      className="copyDiscountCodeButton"
      onClick={() => void copy()}
      type="button"
    >
      {copied ? 'Copied' : 'Copy code'}
    </button>
  );
}
